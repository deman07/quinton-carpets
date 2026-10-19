# Quinton Carpets

The production website for Quinton Carpets, 589–613 Hagley Road West, Birmingham B32 1BY.

Astro 5 · Tailwind 4 · TypeScript · Vercel + Supabase (Postgres).

---

## The three rules

1. **No payment anywhere on this site.** No cards, no checkout, no deposits. Money is taken in
   the shop. If a change would add one, it is the wrong change.
2. **Booking a measure is free**, and the page says so in the heading, on the button and in the
   confirmation.
3. Every figure the site produces before a physical measure is an **estimate** or a **guide
   price** — never a "quote".

---

## Running it

```bash
npm install
cp .env.example .env   # then paste your Supabase connection string in
npm run db:setup       # creates the tables and the placeholder content. Safe to re-run
npm run dev            # http://localhost:4321 — the whole site, database included
```

Every page reads the database — the ranges, the rates and the settings live there — so the
site needs `DATABASE_URL` to run at all, locally as much as on Vercel.

A free Supabase project **pauses after a week without traffic**, and a paused one answers every
connection with `tenant/user … not found`. Restore it from the Supabase dashboard and it comes
back as it was.

**Use the pooler connection string**, not the direct one — Supabase dashboard → Connect →
Connection string → Transaction pooler, on port 6543. Serverless functions open and drop
connections constantly, and the pooler is what stops that exhausting the database. The client
in `src/lib/server/db.ts` sets `prepare: false` for the same reason: the pooler runs in
transaction mode and cannot hold a prepared statement between queries.

### Tests

```bash
npm test               # the pricing and date maths — pure, fast, no browser
npm run test:e2e       # the journey, accessibility, and the banner
npm run check          # types
```

The end-to-end suite needs `.env` and `npm run db:setup` first. It starts its own `astro dev`
and clears the rate-limit ledger before each run — the booking endpoint caps one IP at eight
bookings an hour, and every test run comes from the same address.

---

## Layout

```
src/
  data/                  business facts and the 12 real reviews
  lib/
    pricing.ts           the estimator maths. Pure, unit-tested, no DOM
    dates.ts             the diary rules, in Europe/London
    codes.ts             minting and shape-checking references
    textures.ts          the CSS floor textures (placeholders for photography)
    ranges.ts            the shape of a range, and the filters over a list of them
    server/              the database, validation, email and secrets — server only
      catalogue.ts       reads the ranges, rates and settings, cached for 30 seconds
      auth.ts            staff logins: scrypt passwords, sessions in the database
      diary.ts           reading the diary, and every change staff make to a booking
      email.ts           sends the emails through Resend
    email-templates.ts   what every email says, as HTML and plain text
  middleware.ts          lets Vercel's CDN hold the public pages for a minute
  pages/
    api/                 the booking and code endpoints
    booking/[ref].astro  a customer looking up their own booking
    admin/               the staff diary: login, diary, staff, email previews
    api/admin/           every change the diary makes to a booking
    api/cron/daily.ts    the day-before reminders, run by Vercel Cron
  scripts/               the browser: motion, the estimator, the booking island
  styles/                the design system, split by concern
public/ranges/, site/    the placeholder photographs the database points at
schema.sql, seed.sql     the tables, and the placeholder content they start with
reference/prototype.html the approved prototype, kept as a test fixture only
```

### Every page is rendered on demand

The shop's content lives in the database, so no page is built ahead of time — a prebuilt page
would show yesterday's prices until the next deploy. Instead `src/middleware.ts` gives every
public page `s-maxage=60, stale-while-revalidate`: Vercel's CDN answers almost every request,
goes back to the function at most once a minute per URL, and keeps serving the last copy while
it does. Four routes are never cached:

| Route | Why |
|---|---|
| `/book/` | "today" has to be today, and it shows which windows are already full |
| `/booking/[ref]/` | a customer's own booking |
| `/admin/` | the diary, behind the staff login |
| `/api/*` | answers per request |

`/ranges/` is cached per URL, so `?material=carpet` is cached separately from the full list and
the filter still works with JavaScript off.

**On the database layer.** The site was first built for Cloudflare Pages and D1, as the brief
asked, and later moved to Vercel and Supabase. The thirteen SQL statements were not rewritten:
`src/lib/server/db.ts` keeps the same `prepare().bind().first()/all()/run()` shape and a
`batch()` that is a real Postgres transaction, and rewrites `?1` placeholders to `$1` on the
way through. The queries read exactly as they did when they were reviewed, and the schema
keeps dates and timestamps as TEXT so a database timezone setting can never move someone's
booking to the day before.

---

## Editing the shop's content

Everything the shop changes is in three tables, edited in the Supabase dashboard → **Table
Editor**. A change is on the site within about a minute, with no deploy.

| Table | What is in it |
|---|---|
| `ranges` | one row per range: name, material, spec line, guide price per m², grade, rooms, roll widths, colours, photo, order on the page, place in the home banner, description. Untick `active` to hide one without deleting it |
| `rates` | one row: the fitting rates per m² and per step, uplift, gripper, door bars, moving furniture, and the allowances the estimator works with |
| `settings` | one row: the live domain, where booking emails go and who they come from, how many measures each time window takes, the four category photos on the home page, and the picture used when the site is shared |
| `promo_codes` | the seasonal codes. Every discount comes off the fitting only |

**Photos** are a path or a URL in a `photo_url` (or `photo_…`) column, cropped 1:1. To add one,
upload it to a **public** bucket in Supabase → Storage, copy its public URL, and paste it in.
Vercel resizes it on the way out. Leave a range's `photo_url` empty and its CSS weave from
`lib/textures.ts` shows instead.

**Time windows**: `capacity_am`, `capacity_pm` and `capacity_eve` in `settings` are how many
measures each window takes. Set one to 0 to stop taking bookings in it.

**Email**: `shop_email` and `mail_from` in `settings` win over the `SHOP_EMAIL` and `MAIL_FROM`
environment variables. Left empty, the variables stand. The sender must be on a domain verified
with Resend.

**The domain**: `site_url` in `settings` is what canonical links, the sitemap and shared links
use. Point the domain at Vercel first (Project → Settings → Domains), then change `site_url`.

`npm run db:setup` never writes over any of this: the placeholders in `seed.sql` only go in
where a row is missing.

---

## Deploying

The repository is connected to Vercel, so **pushing to `main` deploys**. Nothing else is
needed for a release.

Set these once in Vercel → Project → Settings → Environment Variables, for Production,
Preview and Development:

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | the Supabase **pooler** connection string |
| `ADMIN_USER` | first time | the owner's username, lower case — makes the first account, then does nothing |
| `ADMIN_PASSWORD` | first time | the owner's first password; change it on the Staff page afterwards |
| `CRON_SECRET` | yes | any long random string; lets Vercel Cron run the daily job |
| `RESEND_API_KEY` | no | sends every email |
| `SHOP_EMAIL` | no | where the shop's copy goes, unless `shop_email` in `settings` is filled in |
| `MAIL_FROM` | no | verified sender on the shop's domain, unless `mail_from` in `settings` is filled in |
| `DEMO_MODE` | while demoing | `1` makes every page `noindex` and `robots.txt` refuse everything |

`DEMO_MODE` is set to `1` today. The site carries the shop's name over placeholder prices and
invented range names, and canonicalises to a domain that is not live, so it must not reach a
search result under that name. **Delete the variable and redeploy** when the real content and
the real domain land — that is the whole of what "going live" means here.

### The diary

`/admin/` needs a login. Each member of staff has their own, kept in the `staff` table with the
password as an scrypt hash. The very first login, while that table is empty, uses `ADMIN_USER`
and `ADMIN_PASSWORD` and makes the owner's account; after that the owner adds, resets and
switches off people on **Staff**, and those two variables do nothing.

From the diary staff can search every booking (name, phone, postcode, email or reference), look
at a day, a week, everything ahead or the past, change the status, keep shop notes the customer
never sees, move a booking (refused if the window is full, unless "Overbook" is ticked), cancel
and reinstate it, mark a referral reward as earned, resend the confirmation, and download any
view as a CSV. Every change is written to `booking_events`, shown as each booking's history. A
cancelled booking stays in the diary but frees its place.

Each person also has a private **calendar link** (on Staff) to subscribe to in Google Calendar
or on an iPhone. It shows every measure from a fortnight ago onwards.

### Emails

All in `src/lib/email-templates.ts`, previewed on **/admin/emails/** with a "send me a test"
button:

| Email | When |
|---|---|
| Booking confirmed | the customer books, with a calendar file attached |
| New booking | to the shop, at the same moment |
| Day-before reminder | 4pm UK time the day before (3pm in winter), by Vercel Cron |
| Booking moved | staff move it with "Email the customer" ticked |
| Booking cancelled | staff cancel it with "Email the customer" ticked |
| Thank you | staff mark it fitted and say yes, or press the button afterwards |

The daily job (`/api/cron/daily`, scheduled in `vercel.json`) sends the reminders and clears out
old rate-limit rows and expired logins. Using the database every day also helps keep a free
Supabase project from pausing.

Without `RESEND_API_KEY` the site still works — bookings save and the customer still gets their
reference on screen. Only the emails are skipped, and each booking's history says so. A mail provider having a bad morning must never lose a booking.

---

## The estimator

The maths lives in `src/lib/pricing.ts` and nowhere else. It is pure: give it an input, get the
same answer every time, no DOM and no clock.

The part that sells the site is roll-width costing. A fitter does not buy your floor area, they
buy a length off a roll — so a 4.2 × 4.6m lounge takes two strips off a 4m roll (37.6 m²) but
drops onto a 5m roll in one (23.5 m²), and the site charges the cheaper of the two and says
which won. Ties go to the narrower roll. Underlay is charged on actual floor area × 1.05, not
on roll usage. Stairs are 0.85 m² a step and are fitted per step, never per m².

**Discounts apply to labour only** — fitting and fitting extras. Materials are already at the
shop's best price and never discount. The client never decides what a code is worth: it posts
the code to `/api/codes`, gets back `{ valid, kind, percentOff | amountOff, message }`, and
recomputes from the server's answer.

The rates the site charges come from the `rates` table. `PRICES` at the top of `pricing.ts`
holds the same placeholder figures `seed.sql` starts the table with, and the unit tests price
against it.

---

## Where this build departs from the prototype

The prototype is the visual source of truth, and `tests/e2e/fidelity.spec.ts` proves it: it
loads both documents at 1440, 1024, 768 and 390 in both themes and asserts that every design
token and the banner's geometry and typography match exactly. Four things were changed
deliberately, because reproducing them would have shipped a defect.

1. **The nav collapses at 1080px, not 760px.** The full nav, the wordmark and the call button
   need about 1090px between them. In the prototype they simply overflow: it scrolls sideways
   by 66px at 1024, 322px at 768 and 11px at 390. The hamburger now takes over before that can
   happen, and the phone number still stays visible down to 760px exactly as specified. Below
   420px and 380px the header tightens its own gaps; below 340px the wordmark's strapline is
   dropped. The rest of the page keeps the prototype's 760px breakpoint untouched.

2. **The footer and the referral band have their own tokens.** Both painted themselves with
   `background: var(--ink)` and hard-coded cream text. In dark mode `--ink` flips to near-white,
   so the footer became a pale slab with pale text on it — unreadable. They are meant to be ink
   in both themes, so they now use `--slab` / `--slab-ink`, which are constant across themes the
   way `--yellow` is.

3. **The dark-mode highlight behind "on a roll." is a full block.** The prototype paints a
   partial band across the lower part of the words. That works in light, where the headline is
   ink; in dark the headline is near-white, so the words ended up near-white on yellow — about
   1.5:1, and against the rule that yellow never carries white text. In dark mode the band now
   covers the full line and the text is ink, which is the same relationship the light theme
   already has. Light mode is untouched.

4. **Three small contrast fixes.** `--muted` on the `--surface` tint is 4.16:1, just under AA
   for small text, so the selected option's description and the eyebrow on tinted sections step
   up to `--ink-2`. The star ratings gained `role="img"` so their label is legal. The privacy
   link in the footer's fine print is underlined, because it sits at low contrast by design and
   cannot be marked by colour alone. Axe reports zero violations on every route in all three
   theme states.

The reduced-motion block also needed `.aurora i:nth-child(n)` rather than `.aurora i` — the
drift rules are written per-child, so the original override lost on specificity and the glow
kept moving for people who had asked it not to.

---

## Still to do before it goes live

These need the shop, not the developer.

All of it is now data, not code — see **Editing the shop's content** above.

1. **Photograph** the shop, the fitters and every range, and replace the images. Each range
   points at a **stock photograph of the right material** in `public/ranges/<id>.jpg` —
   a wool twist for a wool twist, berber loops for the berber, oak planks for the oak. They are
   from [Pexels](https://www.pexels.com/license/), free for commercial use without attribution.
   They are still placeholders: they are not the shop's stock, and **alt text is generated from
   the range name and spec**, so it describes a product the photograph is not. Upload the real
   photograph to Supabase Storage and paste its URL into the range's `photo_url`, 1:1 crop.

   Two caveats. **Halesowen Stripe is not striped** in its photograph; no neutral striped
   flatweave existed in the library and a wrong colour would have been worse, so it carries a
   dark charcoal loop that matches its swatch. **The three underlays have no photograph at
   all** — nothing in stock libraries honestly depicts carpet underlay, and acoustic foam or
   loft insulation would be a worse lie than none, so they fall back to the CSS weave in
   `lib/textures.ts`. That fallback works for any range: empty its `photo_url` and the weave
   comes back.

   The category cards on the home page (`photo_…` in `settings`) and the share picture
   (`og_image`) are placeholders too.
2. **Replace every placeholder range name and guide price** with the real ranges and today's
   prices, in the `ranges` table.
3. **Confirm the fitting, uplift, gripper, door bar and stair rates** in the `rates` table so
   the estimator matches the counter. Every figure there is currently a placeholder.
4. **Point the domain** at Vercel and put it in `site_url`; verify the sending domain with
   Resend and fill in `mail_from`; verify the Google Business Profile.
5. **Decide on a room visualiser** for phase two, once the photography exists.

### Decided for the shop, to revisit if they disagree

- **Referrals stay at 10% for the friend and 20% for the referrer**, both off fitting only. The
  figures are written into the copy on six pages and both emails, and on labour alone they are
  modest: on the estimator's own lounge-and-stairs example (£1,344 in all, £337 of it fitting)
  they come to about £34 and £67.
- **Every discount comes off the fitting, flat ones included.** `NEWFLOOR25` used to take £25
  off the whole order, materials and all, which broke the rule above; it is now £25 off the
  fitting, and does nothing on a supply-only order. `WINTER10` ends on 28 February 2027.
- **Time windows take 3 measures in the morning, 3 in the afternoon and 2 in the late window.**
  A measure is twenty minutes plus the drive across Birmingham, so one surveyor manages about
  three in a three-hour window and two in the two-hour one. Change them in `settings`.

### Two things worth a decision

- **The reviews section** is parked as built, pending a decision on it. There is no
  `AggregateRating` in the structured data and there must not be until it is wired to the live
  Google Business Profile feed.
- **The privacy notice** at `/privacy/` states 12 months for a booking that does not become a
  job and 6 years for one that does. Those are sensible defaults, not instructions from the
  shop. Confirm them, and confirm the shop is content to be named as the data controller at
  that address.
