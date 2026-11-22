# HouseMate: v1 to v5 style and UX guide

Nov 21, 2026 · @Ola

This guide takes the older HouseMate build to the v5 prototype: one visual system (tokens, type, icons, motion) plus every UX change made along the way, screen by screen.

## Color system

All color comes from CSS variables set per theme with `body[data-theme=forest|night|lilac]`. Forest is the default. Never hard-code a hex in a component; use the token.

| Token | Role | Forest | Night | Lilac |
| --- | --- | --- | --- | --- |
| --page | Backdrop behind the phone | #E6E9E0 | #060806 | #EBE7F6 |
| --sheet | Bottom sheets | #FFFFFF | #131713 | #FFFFFF |
| --bg | App background | #F4F4F1 | #0E110E | #F6F4FB |
| --card | Cards | #FCFCFA | #1A1F19 | #FFFFFF |
| --soft | Soft card fill | #F1F1EE | #1F251E | #F1EDF9 |
| --ink | Text, primary button | #0B0B0B | #F2F4EF | #1E1535 |
| --mute | Secondary text, chevrons | #8A8A86 | #9AA394 | #8A82A3 |
| --faint | Hints, disabled | #B3B3AE | #646B60 | #B8B1CC |
| --line | Hairlines | #E8E8E3 | #262C24 | #E9E5F3 |
| --btn / --on | Primary button / its text | #0B0B0B / #FFFFFF | #F2F4EF / #0E110E | #1E1535 / #FFFFFF |
| --acc | Accent | #3B9B4E | #7BD08C | #2FA37C |
| --chip | Selected pill fill | #EBF7C6 | #27351D | #E9E1FF |
| --chipl | Strong pill fill | #C9E186 | #587A38 | #BFA9FF |
| --h1 / --h2 / --h3 | Hero glow dark / mid / bright | #2E4A27 / #587A38 / #B8D07E | #0E1B0E / #1F3A1B / #3D5E2B | #4A2C9A / #8A63E8 / #F2A9D2 |

Also per theme: --warn (Forest #D9822B, Night #F0B35E, Lilac #E8791F), --dng (Forest and Lilac #E5534B, Night #FF7B72), hero text --hink #FFFFFF, --hmute white at 60 to 70%, glass sheet fill --glass (white at 82 to 84%; Night #1A1F19 at 82%).

### Semantic colors

- Warning and pending: --warn #D9822B. Amber action button (Pay): fill #9A5B00, text #F7E7CA. Amber badge dot: #E69A1A.
- Settled and success: #2E9B4F, darker text #1F7A3A.
- Danger and overdue: --dng #E5534B, text #B42F2F.
- Inner panels inside a sheet (payment progress, account details): #F8F8F6 in both collapsed and expanded states.
- Ghost button fill: ink at 8% (`color-mix(in srgb, var(--ink) 8%, transparent)`).
- Quick-add options: bill = icon #4A6CF0 on #E0E7FE; chore = icon #E8892F on #FDEBD6.

### Illustration palette (onboarding, privacy)

Flat, low-contrast shapes: peach #F3D5BD, orange #E5995B, mauve #BE9F9F, pale #E8DEDE, with a thin offset outline in #1B1B1B. No gradients inside illustrations.

## Typography, shape and icons

### Type scale

| Size | Use |
| --- | --- |
| 28 to 30, bold | Page titles ("Profile", "Reports") |
| 24, semibold | Hero greeting and "Due this week" rows |
| 20, bold | Money amounts on You owe / You are owed cards |
| 16 | Body, list rows, buttons |
| 14 | Secondary text, labels, hints |
| 12 | Captions, status pills, badges |

Labels in key/value lists (account details) use 14 in --mute; values use regular weight, never bold.

### Radii and spacing

- Cards: 20, filled with --soft.
- Inner panels (payment progress, account details): 14 to 16, fill #F8F8F6.
- Buttons and pills: fully rounded (30 to 99).
- Bottom sheets: 34 to 36 top radius.
- Avatars: circles.
- Nav: active pill has equal 16px left and right padding; the FAB is a fixed 64px circle.

### Icons

- Library: MingCute. Line style for inactive and secondary, fill style for the active nav item.
- Chevrons: 18px, --mute, the same everywhere (expand, row-opens-detail, back).
- Copy: icon-only, subtle grey circular button, no label.
- Where the library lacks an icon (search, lock, copy, plus/minus), use a small inline SVG with the same stroke weight. Do not hand-draw other icons.

### Avatars and status badges

- Circle with a pastel fill `hsl(hue 70% 90%)` and the initial in `hsl(hue 45% 32%)`; hue is derived from the person.
- Status badge sits bottom-right of the avatar: green check (settled), amber clock (pending), black receipt (paid, needs review).
- Bill cards always show all four housemate tiles with their status, including the bill payer.

## Components

| Component | Spec |
| --- | --- |
| Primary button | Fill --btn, text --on, pill. Used for the one main action per screen ("Pay this bill", "Generate report", "Log in"). |
| Secondary button | Grey fill (ink at 8%), ink text. Used for "Confirm bill paid" on dashboard bill cards. |
| Amber Pay pill | Fill #9A5B00, text #F7E7CA. Sits inside the pinned action frame beside the "Send $x to Name" label. |
| Pinned action frame | Fixed to the bottom of the bill sheet. Payer sees "Pay $x for bill" / Confirm / Review / Remind by state; everyone else sees "Send $x to Name" plus Pay. |
| Bottom sheet | Top radius 34 to 36, no Close or Dismiss button. Closes by tapping outside or swiping down (touch on the sheet when scrolled to top; mouse on the grabber). |
| Soft card | Radius 20, fill --soft, used for You owe / You are owed ("-" and "+" icons, 20px bold amounts). |
| Bill card (home) | Title, amount, four housemate tiles with status, secondary or primary button by role. |
| Bottom nav | Pill-shaped bar. Active item expands to a pill sized to its content with equal 16px side padding; inactive icons share remaining width (min 36px); FAB stays 64px and never shifts. |
| Selected-state pill | Fill --chip, text --ink. Used for Date / Period and Personal / Household switches. |
| Dropdown field | Rounded field with chevron; opens a sheet (period picker, bills checklist with Select all and Apply). |
| Toast | Short confirmation at the bottom ("Report sent to your email"). |

## Motion

- **Quick-add menu opens** with a staggered spring: `cubic-bezier(.34,1.5,.64,1)`, 460ms, each option offset slightly. The FAB plus rotates 135 degrees into an x. A blurred full-screen backdrop fades in.
- **Quick-add menu closes** in 260ms with a small anticipation, reversing the stagger.
- **Hero particles (home):** WebGL fragment shader, domain-warped noise glow in the theme colors (--h1, --h2, --h3), three particle layers drifting at twice the original speed, film grain, 30fps cap. Static frame under reduced motion; CSS radial-gradient fallback if WebGL fails.
- **Onboarding:** slides auto-advance about every 4.8s and loop; a manual tap resets the timer. Progress dots sit top-right, active dot a 28px pill.
- **Sheets:** swipe down to close, tap outside to close.

## Screen-by-screen UX changes (v1 to v5)

### Onboarding and privacy

- Removed the app name and the Skip button.
- Three slides, each with a subtle flat illustration panel (rounded panel, pastel shapes, skeleton bars, thin offset outline) abstracting the idea. Text sits directly on the themed gradient, white, left-aligned, over a dark scrim. No white background.
- Log in (black) and Sign up (white) sit side by side on all three slides. The clearer wording replaces the older labels.
- Dots move to the top-right; slides auto-advance and loop.
- New privacy page, shown only after Sign up: shield and gears illustration, "Your money. Your data.", two checkboxes, Accept all, and a Next button that stays disabled until both are ticked. Log in skips it.

### Home (dashboard)

- Header is "Hey, Moyin" plus a bell. The settings gear is gone, since Profile is in the nav.
- "Due this week" is a stacked list (bills, then chores) at 24px, top to bottom, not side by side.
- Hero is the animated theme-colored particle glow. Below it, a sheet with the You owe and You are owed cards and the Due soon list.
- Bill cards always show all four housemates with status, including the payer. The payer's "Confirm bill paid" is a secondary grey button; "Pay this bill" is the primary black one.

### Bill sheet and payment progress

- Header reflects bill status (head, sub, status). The sheet no longer closes on its own after an action.
- New Payment progress card: collapsed shows avatars and "x/y settled"; expanded shows each person with a status pill or action button and a more menu.
- The main action is pinned at the bottom: "Send $x to Name" with the amber Pay pill (payer: Pay / Confirm / Review / Remind by state).
- Removed: Confirm paid button, Dismiss and Close buttons, and the standing attach-receipt section. Closing is tap outside or swipe down.
- A receipt row appears on the sheet only once a receipt is attached.

### Pay-to account details

- Opens from the Pay-to row. Labels in a left-aligned 76px column, values in regular weight, nothing bold.
- One "E-transfer" line showing the person's own Interac detail, an email or a phone number. The separate phone line is removed.
- Copy is an icon-only, subtle grey circular button.
- Attaching a receipt or provider invoice lives only here (the payer sees "Attach provider invoice").

### Schedule and calendar

- The calendar icon opens a bottom sheet with a left chevron to go back.
- A Date | Period toggle makes range selection obvious, with a hint line under it; ranges are highlighted from start to end.
- Picking a date no longer closes the sheet. The main button reads "View selected date" or "View period" and stays disabled until something is selected.
- A "Reports" button replaces the History/Upcoming switch. A chosen period shows as a filter chip on Schedule (for example "Nov 14 - Nov 19").

### Reports (was Payment history)

- Reachable from the calendar sheet and from a Reports row under Household.
- Modeled on a statements screen: back chevron, centered title and subtitle, Personal | Household switch, Period dropdown (year and month grid, plus "Select day range"), Bills dropdown (checkbox list with Select all and Apply), summary rows, and one Generate report button.
- Individual bills stay hidden until a report is generated. The result shows totals, by housemate (household view), by bill, by month, and a searchable list, with Download CSV and Send to email.

### Profile

- Light page with a 28px "Profile" title.
- Avatar card: name, email, chevron. It opens an Edit profile sheet with the avatar and edit badge, Name, Display name and Interac e-Transfer details.
- Household card shows no invite code and no avatars. Settings toggles and Log out follow. The old payment details card is removed.

### Quick-add menu

- Tapping the plus shows a blurred backdrop and two stacked options above the FAB, right-aligned labels with round colored icons: Add a bill, Add a chore. No Cancel row. Spring open and close as in Motion.

### Navigation

- Household and every other item get equal side padding; inactive icons share the leftover space and the FAB stays fixed.

## Implementation notes

- Build the theme tokens first; every screen change above reads from them, so a theme switch then works everywhere.
- Bill state drives the sheet: the header, progress rows and pinned action all come from one status value per person, so keep them in one function.
- Sheets: tap-outside and swipe-down close; do not add Close buttons back. Swipe-down on touch only when the sheet content is scrolled to the top.
- Give calendar range classes unique names (the prototype uses cra, crb, crm); a generic class like `.rb` collided with other styles.
- Hero: keep the WebGL canvas alive across re-renders, set `preserveDrawingBuffer: true`, cap at 30fps, and fall back to a CSS gradient. Verified only with a software renderer so far; check on a real phone.
- Nav: set `min-width: 0` on the bar, a 36px minimum on inactive items, and `flex: none` on the FAB to stop overflow.
- Reports: CSV download works in a normal browser or app; it was blocked inside the prototype viewer, and email sending is only a toast in the prototype.
- The working reference is the v5 prototype file; open it side by side with this guide when matching spacing.
