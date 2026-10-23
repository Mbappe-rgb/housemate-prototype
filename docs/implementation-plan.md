# HouseMate: Technical Implementation Plan

*From single-file prototype to a working, mobile-first web app with real accounts, households and invite links. Version 1, October 2026.*

## 1. Summary

**Goal.** Turn `Index.html` (a clickable prototype with fake data) into a real web app where invited testers can create accounts, log in, create a household, invite housemates with a link, and share bills and chores, with everything saved in a database. Mobile comes first. The desktop layout comes after.

**Recommendation in six lines**

1. **Stack:** Vite + React + TypeScript for the front end, Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) for the backend, Vercel for hosting, GitHub for code. No Next.js and no extra server.
2. **Port first, wire second.** Rebuild the prototype screens as React components against mock data, then swap the mock data for the database one feature at a time.
3. **Security lives in the database.** Row Level Security on every table. Business rules (split lock, invite acceptance, payer changes) are enforced by database functions, not just by buttons in the UI.
4. **Money in integer cents, dates as real dates.** The prototype uses decimals and day-of-month numbers, which break quickly.
5. **Invite links are database rows** with a long random token, an expiry, a use limit and a revoke switch.
6. **Demo gating:** signups are restricted to an allowlist of tester emails.

**Milestones**

| Milestone | What you can show | Ends after |
|---|---|---|
| A. Shared household | Two real people on two phones, one household, joined through an invite link | Phase 3 |
| B. Usable app | Bills and chores saved, balances correct to the cent, dashboard live | Phase 5 |
| C. Demo-ready | Realtime updates, receipts, reminder emails, installable on the home screen | Phase 7 |

Rough effort for a small beginner team working with Claude: **6 to 9 weeks part-time**. Phases 1 and 2 can run in parallel (UI lane and backend lane).

---

## 2. Where we are today

`Index.html` is one 304-line, 60 KB file. It renders every screen by building HTML strings and assigning them to `innerHTML`, with global state objects (`S` for the app, `O` for onboarding) and inline `onclick` handlers. It is shown inside a 760 px phone frame with showcase controls (palette, state, start-at buttons).

**What it already has (and we keep)**

- A polished visual language: four themes defined as CSS variables, glass cards, bottom sheets, a floating bottom nav.
- Clear flows: Welcome, Create household, Invite (email, link, QR), Ready, Join, Home, Bills (list, detail, add, split, pay-to, receipts), Calendar, Chores, Profile, Household, Leave.
- Smart product rules worth keeping: the split locks once someone has paid, changing the payer resets payments, only the creator edits the split, chores need a "is it really done?" confirmation.

**Findings that shape the plan**

| # | Finding in the prototype | What we do about it |
|---|---|---|
| 1 | User-entered text (household name, bill name, emails) is dropped into HTML strings, and some values go into inline `onclick="...('${v}')"`. A real user could inject script. | Move to React, which escapes text by default. Never use `innerHTML` or `dangerouslySetInnerHTML` with user data. Add a Content Security Policy header. |
| 2 | Four members, `/4` splits and `x/3 paid` are hard-coded. | Members, shares and progress are computed from data. |
| 3 | Money is JavaScript decimals (`192.8`). Splits like $100 / 3 leave stray cents. | Store integer cents. Distribute the remainder cents deterministically. |
| 4 | Dates are day-of-month numbers, "today" is fixed at the 7th, the calendar only knows October and four leading blank cells. | Real `date` columns, household time zone, real month math, recurring bills that handle 29 to 31. |
| 5 | Rules only exist in the UI (split lock, who can edit, payer reset). | Re-implement them in database functions and RLS policies so they can't be bypassed. |
| 6 | Invite code is `WEBR-` plus 4 random characters (about 1.6 million combinations), reusable by anyone, and "Reset link" only changes a string on screen. | Real invite table: long random token, expiry, max uses, revoke. |
| 7 | Rows and cards are `div`s with `onclick`, so they are not keyboard or screen-reader friendly. Some tap targets are small (checkbox 26 px, chip remove 22 px, edit pen 26 px). | Use real `button` and link elements. Keep tap targets at about 44 px (extend the hit area with padding). |
| 8 | Screens are absolutely positioned inside a fixed-height frame. | Real viewport layout: `100dvh`, safe-area insets, sticky bottom nav, scrollable page body. |
| 9 | QR library and fonts load from CDNs. | Install the QR library from npm. Self-host or keep Google Fonts deliberately. |
| 10 | Missing screens: sign up, log in, reset password, loading, error, empty states, invalid or expired invite, Add chore ("comes next"), notifications, log out. | Design these in Phase 1. |
| 11 | Profile shows phone, bank and e-transfer email to housemates. | Treat as sensitive personal data: optional, visible only to people in the same household, never logged. |
| 12 | Receipt upload only stores the file name. | Real private storage bucket with size and type limits. |

---

## 3. Target architecture

```
Phone browser / installed web app (PWA)
        |  HTTPS
   Vercel  --serves-->  React single-page app (static files)
        |
        |  supabase-js (public publishable/anon key, user's login token)
        v
   Supabase
   - Auth        (sign up, log in, password reset)
   - Postgres    (tables + Row Level Security + functions/RPC)
   - Storage     (private receipts bucket)
   - Realtime    (live updates for the household)
   - Edge Functions + pg_cron (reminders, invite emails)  -->  Resend (email)
```

| Layer | Choice | Why |
|---|---|---|
| Front end | Vite + React + TypeScript | The prototype now has about 15 screens and shared parts (rows, sheets, avatars). Components remove the copy-paste, and React escapes user text. TypeScript plus Supabase's generated types catches mismatches between app and database early. Claude writes it well. |
| Routing | React Router | Real URLs such as `/join/ABCD...` work for invite links and QR codes. Needs a one-line rewrite rule on Vercel so every path serves `index.html`. |
| Data fetching | TanStack Query | Caching, loading and error states, optimistic updates. Realtime events just invalidate the cache. |
| Styling | Keep the prototype's CSS, split into `tokens.css` (the theme variables) and component styles | Cheapest migration, keeps the design intact. Tailwind is optional later. |
| Backend | Supabase | One service for auth, database, files, realtime. Free plan covers testing and demo. |
| Hosting | Vercel, deploying from GitHub | Production from `main`, a preview link for every pull request. |
| Email | Resend through Supabase Edge Functions and custom SMTP | Phase 7. |

**Why not Next.js:** this is a logged-in app with no SEO needs, and Supabase already provides the backend. A single-page app is simpler for a beginner team. Revisit only if you need server-rendered pages or marketing pages.

**A correction to earlier advice:** I said the plain HTML file could stay. That was right for a hosted prototype. For real auth, protected routes, invite URLs and 15+ screens, a build step and components are now worth it.

---

## 4. Mobile-first now, desktop-responsive later

**Design rules to follow from day one** (so desktop is a layout change, not a rewrite)

- Write base CSS for a phone. Add `@media (min-width: ...)` rules only for larger screens.
- Layout lives in a few shared components (`AppShell`, `BottomNav`, `Sheet`, `Page`). Screens only render content. Later we change the shell, not the screens.
- Use `100dvh`, not `100vh`, plus `env(safe-area-inset-*)` for notches and home bars. The prototype already declares `viewport-fit=cover`.
- Bottom sheets: set the viewport meta to `interactive-widget=resizes-content` and test with the keyboard open so fields are not hidden.
- Inputs at 16 px or larger to stop iOS zooming in. Keep `inputmode="decimal"` on money fields.
- `backdrop-filter` blur looks great but can be slow on low-end Android. Provide a plain translucent fallback and test on a real mid-range phone.
- No fixed pixel heights for content. Use flex and grid.

**Installable web app (PWA):** add a manifest, 192 and 512 px icons (including a maskable icon), a theme colour and an Apple touch icon, using `vite-plugin-pwa`. Goal is only "Add to Home Screen" with a standalone window. Do not cache money data offline in the first version, because stale balances are worse than a loading spinner.

**Desktop plan (Phase 8)**

| Width | Layout |
|---|---|
| Under 768 px | Phone layout: bottom nav, bottom sheets (the baseline) |
| 768 to 1023 px | Same screens centred in a column of about 480 to 560 px. This is the cheap first desktop fallback. |
| 1024 px and up | Left navigation rail instead of the bottom bar, bottom sheets become centred dialogs or a right-hand detail panel, calendar and day list side by side, the bills-by-person matrix (already sketched in the prototype as `board()`) as a wide table |

---

## 5. Data model

**Conventions:** UUID primary keys. Money as integer cents (`total_cents`). Dates as `date`. Timestamps as `timestamptz`. Every table has `created_at`. Every table has Row Level Security enabled. Names and text have length limits (`check`).

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth user id), `display_name`, `avatar_hue`, `etransfer_email`, `bank_name`, `phone`, `theme`, `notify_enabled`, `notify_bills`, `notify_chores` | Created automatically by a trigger when a user signs up. Payment fields are optional. Readable only by the owner and people in the same household. |
| `households` | `id`, `name`, `created_by`, `timezone`, `currency` (default CAD) | Timezone is captured at creation and used for "due today". |
| `household_members` | `household_id`, `user_id`, `role` (`owner` or `member`), `joined_at` | Primary key on both ids. **`unique(user_id)` for the MVP** means one household per person, which matches the prototype's "Leave household" flow. |
| `invites` | `id`, `household_id`, `token`, `kind` (`link` or `email`), `email`, `created_by`, `expires_at`, `max_uses`, `uses`, `revoked_at` | See section 8. |
| `bills` | `id`, `household_id`, `name`, `category`, `emoji`, `total_cents`, `due_date`, `payer_id`, `created_by`, `recurrence` (`none` or `monthly`), `series_id`, `split_mode` (`equal` or `custom`) | `series_id` links the monthly copies of a recurring bill. |
| `bill_shares` | `bill_id`, `user_id`, `amount_cents`, `paid_at`, `marked_by`, `receipt_path` | One row per member per bill. For the payer's own row, `paid_at` means "I paid the provider" (the prototype's `prov`). The shares must add up to `total_cents`. |
| `chores` | `id`, `household_id`, `title`, `emoji`, `assignee_id`, `due_date`, `recurrence` (`none`, `daily`, `weekly`), `done_at`, `done_by`, `created_by` | |
| `reminders_sent` | `kind`, `entity_id`, `user_id`, `sent_at` | Phase 7. Stops duplicate reminder emails. |
| `allowed_signups` | `email` | Demo allowlist (section 7). Not readable from the app. |

**Rules enforced in the database (not only in the UI)**

- Shares must add up to the bill total. Equal splits distribute leftover cents to the first members by join order, and the app shows the same numbers.
- The split cannot change once any non-payer share is paid.
- Changing the payer clears all paid marks.
- Only the bill creator edits the split. Only the payer, or the person themselves, can mark a share paid or received.
- A household has at most 8 members (adjust as you like).
- Deleting a bill is allowed only for its creator or the household owner, and only while nothing is paid.

**Writes go through functions.** Simple reads use RLS directly. Anything that touches several rows runs as one atomic database function called with `supabase.rpc(...)`:

`create_household`, `create_invite`, `preview_invite`, `accept_invite`, `revoke_invites`, `leave_household`, `create_bill`, `update_split`, `change_payer`, `set_share_paid`, `create_chore`, `complete_chore`.

---

## 6. Security model

1. **RLS on every table, default deny.** A policy helper `is_member(household_id)` (a `security definer` function with an empty `search_path`) is used in every policy. Use `(select auth.uid())` in policies for speed, and index `household_id` and `user_id`.
2. **Keys.** The front end only ever gets the Project URL and the publishable (anon) key. The secret or `service_role` key is used only inside Edge Functions and never goes in the repo, the browser or chat.
3. **Function permissions.** New functions are callable by default. For every function that should not be public, run `revoke execute ... from public, anon` and grant it to `authenticated` only. The invite preview is the one function anonymous visitors may call.
4. **Output safety.** React escapes text. No `innerHTML` with user data. Add a Content Security Policy and basic security headers in `vercel.json`.
5. **Validation twice.** Client forms give friendly messages. The database enforces limits with `check` constraints and function checks.
6. **Storage.** Private `receipts` bucket, 5 MB limit, images and PDF only. Path `receipts/{household_id}/{bill_id}/{user_id}-{timestamp}`. Storage policies read the household id from the path and call `is_member`. Show receipts through short-lived signed URLs. Compress photos in the browser before upload (the free plan has limited file storage).
7. **Auth settings.** Minimum password length 8 or more. Set the Site URL to production and add redirect URLs for `http://localhost:5173/**` and the Vercel preview pattern, otherwise confirmation and reset links fail.
8. **Personal data.** Payment details are optional, shown only to housemates, and removable. Provide a way to delete an account. Add a short privacy note. Check what your jurisdiction requires (this plan is not legal advice).

---

## 7. Accounts and demo gating

**Screens to add:** Sign up (name, email, password), Log in, Forgot password, Reset password, a "check your email" screen if confirmation is on, and an account/Log out action in Profile.

**Limiting accounts for testing:** use Supabase's **Before User Created** auth hook (available on the Free plan). It runs just before a signup is saved and can reject it. Keep a table `allowed_signups(email)`. The hook function checks the email and returns an error for anyone not listed. You add testers by inserting rows. Everyone else sees "This demo is invite-only." Also cap households and members as in section 5.

**Email confirmation (important constraint):** Supabase's built-in email sender only delivers to addresses on your Supabase team and is limited to about 2 messages per hour. It is meant for testing, not real users. Until you set up custom SMTP (Phase 7, needs a domain):

- Turn **Confirm email off** in the dev and demo projects. The allowlist already controls who can sign up.
- Password reset emails will not reach testers. For now an admin sets a new password from the Supabase dashboard.
- When custom SMTP is on, turn confirmation back on. Keep the pending invite token in the redirect URL (see section 8), so it survives opening the email on another device.

---

## 8. Invite links

**Design**

- Each invite is a row in `invites`. The **token** is generated in the database from cryptographically random bytes: 12 to 16 characters from an alphabet without look-alikes (no 0/O, 1/I). That is 60+ bits, so guessing is not realistic. Shown to people in groups of four, for example `K7QM-2XPD-9TCF`.
- The same token powers the link (`/join/K7QM2XPD9TCF`), the QR code and the "enter a code" box.
- **Link invites:** expire after 7 days, up to 10 uses. **Email invites:** single use, 7 days.
- **Reset link** = revoke all active link invites for the household and create a new one (the prototype's button becomes real).
- Any member can create invites (as in the prototype). The creator or the owner can revoke.
- Joining checks: signed in, invite valid, not expired, not used up, household not full, user not already in a household.

**Join flow**

1. Visitor opens `/join/TOKEN`. The app calls `preview_invite(token)`, which returns only the household name, member count and a few initials (the screen already in the prototype). No other data.
2. If not signed in: store the token and send them to Sign up or Log in. Pass the token in the redirect URL as well, so it survives an email-confirmation hop.
3. After sign in, call `accept_invite(token)`, then go to the dashboard.
4. Friendly screens for: invalid, expired, used up, household full, already in a household.

**Sketch** (illustrative; the final migration is written and reviewed in Phase 2)

```sql
-- Used by every policy
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = (select auth.uid())
  );
$$;

alter table public.bills enable row level security;
create policy "members read bills" on public.bills
  for select to authenticated using (public.is_member(household_id));

-- Joining a household
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invites;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;

  select * into inv from public.invites
   where token = upper(replace(p_token, '-', '')) for update;

  if not found or inv.revoked_at is not null
     or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invite_invalid';
  end if;

  if (select count(*) from public.household_members
       where household_id = inv.household_id) >= 8 then
    raise exception 'household_full';
  end if;

  -- unique(user_id) rejects a second household
  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member');

  update public.invites set uses = uses + 1 where id = inv.id;
  return inv.household_id;
end $$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
```

The app maps the error names (`invite_invalid`, `household_full`, and so on) to friendly messages.

---

## 9. Repository, environments and workflow

```
housemate/
  prototype/index.html       original prototype, kept as the design reference
  src/
    app/                     router, providers, AppShell, route guards
    components/              Avatar, Button, Row, Chip, Sheet, Toast, Segmented, Field...
    features/                auth, households, invites, bills, chores, calendar, profile
    lib/                     supabase.ts, money.ts, dates.ts, format.ts
    styles/                  tokens.css, base.css
    types/database.ts        generated from Supabase
  supabase/
    migrations/              every SQL change, in order
    functions/               send-invite-email, send-reminders
    seed.sql                 fake data for the dev project
  docs/                      this plan, decisions
  .env.example  .gitignore  vercel.json  README.md
```

(This refines the earlier `database/` folder suggestion: `supabase/migrations` lets the Supabase CLI apply the same files later with no restructuring.)

**Environments**

| Environment | Frontend | Supabase project | Purpose |
|---|---|---|---|
| Local | `localhost:5173` | dev | Day-to-day work |
| Preview | Vercel link per pull request | dev | Reviewing changes on a real phone |
| Production / demo | `main` branch on Vercel | prod | What testers and the demo use |

The free plan allows 2 active projects, which is exactly dev and prod. Set Vercel environment variables per environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key). Only those two values ever go into front-end config.

**Git workflow for a small team**

- Work on a branch, open a pull request, someone else reviews, then merge. Protect `main` so nothing lands directly.
- A GitHub Action runs lint, type-check, unit tests and build on every pull request.
- Every database change is a new numbered file in `supabase/migrations`. Never edit the production database by hand without saving the SQL here.
- Generate types after schema changes: `supabase gen types typescript` into `src/types/database.ts`.
- Beginners can start by pasting migrations into the SQL Editor and saving the file. Move to the Supabase CLI (`supabase db push`) by Phase 3.
- The earlier plan caveat still applies: Vercel's free plan is built for one person, so the lead owns deployments and teammates contribute through pull requests.

---

## 10. Phased roadmap

Maps to the earlier backlog: Phase 2 is "Set up the database and security", Phases 2 and 3 are "Accounts and households", Phases 4 and 5 are "Make chores and bills live".

**Two lanes after Phase 0**

| Lane | Owner | Phases |
|---|---|---|
| UI lane | Lead and designer, with Claude | 1, then wiring in 3 to 6 |
| Backend lane | Dev intern, reviewed by the lead | 2, then functions for 3 to 7 |

The two lanes meet through one contract: the function names and the generated `database.ts` types from section 5. Agree on those at the end of Phase 0.

### Phase 0: Setup and decisions (1 to 2 days)

- Answer the open decisions in section 12.
- Create the dev and prod Supabase projects. Save keys in the password manager.
- Scaffold Vite + React + TypeScript, commit, connect to Vercel, add the `vercel.json` rewrite, set environment variables.
- Add branch protection, the CI workflow, README and `.env.example`.
- Move the prototype into `/prototype`.

**Done when:** an empty app deploys from `main`, a pull request produces a preview link, both Supabase projects exist.

### Phase 1: Port the UI with mock data (4 to 6 days)

- Split the CSS: theme variables into `tokens.css`, the rest into component styles.
- Remove the phone frame and showcase controls. Keep the palette, state and start-at tools behind `?dev=1` for design review. Theme becomes a profile setting later.
- Build shared components, then port every screen with the same mock data. Fix semantic buttons and tap targets while porting.
- Move logic into `lib/` with unit tests: cents math and equal-split remainders, "who owes what", due-date labels, calendar month grid.
- Design and build the missing screens: Sign up, Log in, Reset, Loading skeletons, Error, Empty states, Invalid or expired invite, Add chore, Log out.

**Done when:** every flow works on a real phone through a preview link, matches the prototype, and checks pass.

### Phase 2: Database and accounts (3 to 5 days)

- Migrations for all tables, constraints, indexes, RLS policies, the `is_member` helper, the profile trigger.
- Seed script for the dev project.
- Wire Sign up, Log in, Log out, Reset, session persistence, and route guards: logged out goes to Welcome; signed in without a profile name goes to a name step; no household goes to Create or Join; otherwise the app.
- The allowlist hook and Auth URL settings. Confirm-email setting per section 7.
- Isolation test with two accounts in two households (checklist in section 11).

**Done when:** an allowlisted tester can sign up, log in and out on a phone; a non-listed email is refused; account A cannot read anything of account B.

### Phase 3: Households and invites (4 to 6 days) *Milestone A*

- `create_household` (creator becomes owner) wired to the Create screen.
- `create_invite`, `preview_invite`, `accept_invite`, `revoke_invites` and the join route with token persistence.
- Household screen: members, leave household (an owner must hand over ownership or close the household if others remain), owner can remove a member.
- Invite UI: copy, share sheet (`navigator.share`), QR code from the `qrcode` npm package, and the typed code.
- Email tab: for now it produces a copyable link. Real email arrives in Phase 7.

**Done when:** Person A creates a household on their phone and shares the link; Person B opens it on another phone, signs up and lands in A's household; both see each other under Members; a revoked or expired link shows a friendly message.

### Phase 4: Bills (5 to 8 days)

- `create_bill` (bill plus shares in one transaction), bill list and detail sheet from live data.
- Mark paid and unpaid, "mark received" by the payer, change payer, edit split with the lock enforced in the database, delete.
- Dashboard numbers (you owe, progress, next up, tiles) from queries or a small database view.
- Optimistic updates with clear error toasts.

**Done when:** on two phones, A adds "Hydro $192.80", B sees it after a refresh, B marks it paid, A sees it paid and every balance is right to the cent; trying to break the rules through the API fails.

### Phase 5: Chores and calendar (3 to 5 days)

- Add chore screen (new), assignee, due date, repeat (none, daily, weekly).
- Complete with the confirmation modal, undo, repeat creates the next one.
- Calendar built from real month math and `due_date` queries, with dots per day.

**Done when:** chores and bills share the same calendar, and changes by one housemate are visible to the other.

### Phase 6: Realtime, receipts and polish (3 to 5 days)

- Realtime subscriptions filtered by household that refresh cached data, with refetch on tab focus as backup.
- Receipt upload: client compression, private bucket, storage policies, signed URLs.
- Save notification preferences and theme to the profile.
- Recurring bills generator (daily database job that creates next month's bill; clamp 29 to 31 to the month's last day).
- PWA install, skeleton loaders, offline banner.

**Done when:** a change on one phone appears on the other within a few seconds without refreshing; receipts upload and open; the app installs to the home screen.

### Phase 7: Email and reminders (3 to 5 days; needs a domain)

- Buy a domain. Verify it in Resend (SPF and DKIM records). Free Resend allows 3,000 emails a month but only 100 a day and one domain.
- Enable custom SMTP in Supabase Auth so confirmation and reset emails reach real users. Then turn Confirm email on.
- Edge Function `send-invite-email` for the Email tab. Secrets stay in Supabase function secrets.
- Scheduled `send-reminders` (pg_cron calls the function daily): bills 2 days before, chores the morning they are due, honouring each person's preferences. `reminders_sent` prevents duplicates.
- An unsubscribe or preferences link in every email.

**Done when:** an invited email arrives with a working link; a reminder arrives once, at the right time, for a user who opted in.

### Phase 8: Desktop responsive and launch hardening (after the demo, or in spare time)

- Breakpoints from section 4, left rail, dialogs instead of sheets, the bills matrix view.
- Accessibility pass (focus order, labels, contrast in all four themes), Lighthouse run, security checklist, privacy note, account deletion.
- Decide on the Supabase Pro plan before any important demo: free projects pause after a week of inactivity, and Pro adds always-on and backups.

---

## 11. Testing and quality

- **Unit tests (Vitest)** for the logic that handles money and dates. These are the bugs users notice most.
- **Two-account isolation check** (run after every RLS change): sign in as A (household 1) and B (household 2). B must see none of A's households, members, bills, shares, chores, invites or receipts, by direct queries and by guessing ids. An anonymous visitor must see nothing except an invite preview. Try calling every function as a user who should be refused.
- **Rule checks:** try to edit a locked split, mark someone else's share paid, accept an expired token, join twice, and exceed the household cap.
- **Real devices:** one iPhone on Safari, one Android phone on Chrome, every preview. Check keyboard overlap, notch spacing, scrolling inside sheets, the share sheet and QR scanning.
- **Release checklist:** migrations applied to prod, types regenerated, env vars set, redirect URLs correct, allowlist updated.

---

## 12. Risks and open decisions

| Decision or risk | Recommendation |
|---|---|
| One household per person in the MVP? | Yes (`unique(user_id)`). It keeps screens and rules simple. |
| Who can create invites? | Any member, as in the prototype. Creator or owner can revoke. |
| Household size cap | 8 members. Demo cap of about 20 allowlisted emails. |
| Email confirmation during the demo | Off until custom SMTP exists. The allowlist is the gate. |
| Domain | Buy one before Phase 7. `housemate.app` in the prototype is a placeholder, so check availability. Until then use the Vercel URL. |
| Collect bank and phone details? | Make optional, or drop for the MVP. E-transfer email alone may be enough. |
| TypeScript? | Recommended. Fall back to JavaScript only if the team finds it a blocker. |
| Supabase free plan limits | Fine for testing. Free projects pause after about a week of inactivity, so wake the project before demos or move to Pro for the demo period. |
| Beginners writing RLS | The highest-risk work. Have Claude draft it and a second person review with the isolation checklist. |
| Scope creep | Not in version 1: payment integrations, push notifications, multiple households per person, unequal recurring chore rotations, native apps. |

---

## 13. Your first week

1. Decide the items in section 12 (30 minutes as a team).
2. Create the dev and prod Supabase projects. Save the keys in the password manager.
3. Create the repo, scaffold the React app, deploy it to Vercel, and confirm a pull request gets a preview link.
4. Dev intern: start Phase 2 in the dev project (tables, RLS, profile trigger, isolation checklist).
5. Lead and designer: start Phase 1 with the shared components (`Button`, `Row`, `Sheet`, `Avatar`) and the Sign up and Log in screens.
6. Friday: demo the empty app on a real phone, with the first shared components visible, and review the plan.
