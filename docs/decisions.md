# Decisions

Short record of product and technical decisions, newest first. Each one says what we chose and why.

## 2026-11-22: v5 redesign

The app now follows the v5 prototype, screen map and style guide in `docs/design/`. All earlier features stay.

- **Two-step payments.** A housemate taps Pay, sends the e-Transfer, and marks it **Sent**. The person who paid
  the bill then **confirms** it, and only then is it **Paid**. The payer can also mark someone paid directly, or
  undo either step. A bill's split can't be edited once anyone has sent or paid, and such a bill can't be deleted.
- **Reminders are in the app for now.** The payer can remind people who haven't paid, at most once per person
  per bill per day. Reminders appear in a bell on Home and arrive live. Emails come in Phase 7, and so does
  "email this report".
- **Four tabs:** Home, Schedule (bills and chores by period, with a calendar), Household and Profile. A + button
  adds a bill or a chore. Old links (`/bills`, `/calendar`, `/chores`) redirect.
- **Reports** (Household → Reports) cover personal or household payments for a month or a date range, with a
  CSV download. Payments are grouped by the bill's due date.
- **Sign-up** now starts with intro slides and a privacy step, and asks for the person's e-Transfer details after
  sign-up. Profiles gain a full name, one `etransfer` field (email or phone) and the date privacy was accepted.
- **Themes** are Forest (default), Night and Lilac. Saved old names are mapped (lime/sage → Forest, midnight →
  Night, pop → Lilac).
- **Left out for now:** Apple/Google sign-in, and photo avatars (initials for now).

**Why additive:** the migration only adds columns, functions and a `notifications` table, so the current live app
keeps working until this branch is merged. The old profile columns (`etransfer_email`, `phone`, `bank_name`) and
old theme names can be removed after that.

## 2026-10-31: Live updates, receipts and the installable app (Phase 6)

- **Live updates use private broadcast channels**, not "postgres changes". The database sends a tiny
  "this table changed" message to `household:<id>` (and `user:<id>` for join decisions); the app then re-reads
  through normal RLS-protected queries. Only members can listen, so no data from other households ever reaches
  a phone. The app still re-checks every 60 seconds and when it comes back on screen, as a backup.
- **Receipts** live in a private `receipts` bucket (5 MB, photos and PDFs). Photos are shrunk on the phone first.
  Housemates can view them through 60-second links. Deleting or un-paying a bill doesn't remove the file yet.
- **Monthly bills** are created by a nightly database job (06:15 UTC), as well as when the app opens.
- **Installable app without the vite-plugin-pwa package:** a hand-written manifest, icons and a service worker
  that caches nothing (stale balances offline would be worse than a spinner). Avoids a new dependency.

## 2026-10-24: Joining a household needs the admin's approval

**Decision**

- Whoever creates a household is its owner, shown in the app as **Admin**.
- Anyone with an invite link, QR code or typed code can **ask** to join, but must sign up or log in first.
- The admin sees each request on the dashboard (a card on Home and the bell) and approves or declines it.
  Approving adds the person as a member. A declined person sees "Request declined" once.
- One household per person, 8 members max, one pending request per person (a new request replaces the old one).
- Invite links last 7 days. Any member can share the link; only the admin can reset it (which kills the old link).
- The admin can remove a housemate. An admin who leaves must pick the next admin; the last person leaving closes
  the household.

**Why:** an invite link can be forwarded. Approval means only people the admin recognises get in, and the
request shows the person's name and email so the admin can tell who it is.

**Changes from the plan (section 8):** `accept_invite` became `request_to_join` + `decide_join_request`. Because every
join is approved, a link no longer needs a tight use limit (it allows 50 requests, as a spam guard).

**Later**

- Email notifications for new requests and decisions arrive with custom email in Phase 7 (needs a domain).
  Since Phase 6, requests and approvals show up instantly through Realtime.
- The Email tab on the invite screen opens the person's own email app with the link filled in.

## 2026-10-24: Phase 1 ports the prototype as-is

UI/UX changes the team has planned come after the port, on top of the React components. Signed-in people see
their real household with empty bills and chores until Phases 4–5; `/demo` shows the full prototype with sample
data for design review.

## 2026-10-23: Invite-only signups and email confirmation off

Signups are limited to emails in `allowed_signups` (a Before User Created hook). Email confirmation is off until
custom SMTP exists, because Supabase's built-in email only reaches the Supabase team.
