-- Quinton Carpets — Postgres schema, for Supabase.
--
-- Bookings, the shop's content, the staff, and a rate-limit ledger. No card data, no payment
-- records: money is taken in the shop and nothing about it touches
-- this database.
--
-- Dates and timestamps are TEXT on purpose. Every date the site
-- handles is a Europe/London calendar day written YYYY-MM-DD, and
-- every timestamp is an ISO 8601 string in UTC. Storing them as text
-- keeps them sorting and comparing exactly as they read, and stops a
-- database timezone setting from quietly moving someone's booking to
-- the day before.
--
-- Apply it with:  npm run db:setup

CREATE TABLE IF NOT EXISTS bookings (
  ref           TEXT PRIMARY KEY,          -- QC-DDMM-XXXX
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  address       TEXT NOT NULL,
  postcode      TEXT NOT NULL,
  estimate_code TEXT,                      -- QC-EST-XXXXX, optional
  referred_by   TEXT,                      -- a friend's QC-REF-XXXX, optional
  date          TEXT NOT NULL,             -- YYYY-MM-DD, Europe/London
  slot          TEXT NOT NULL,             -- am | pm | eve
  notes         TEXT,
  created_at    TEXT NOT NULL,             -- ISO 8601 UTC
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','called','measured','fitted','cancelled'))
);

-- Added for the staff diary. ADD COLUMN IF NOT EXISTS, so a database
-- made before them gains them on the next db:setup.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_notes TEXT;   -- the shop's own, never shown to the customer
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at  TEXT;   -- ISO 8601 UTC, last change by staff
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminded_at TEXT;   -- when the day-before email went

-- 'cancelled' came later than the other statuses. A cancelled booking
-- stays in the diary, so the history is not lost, but it no longer
-- takes up a place in its window.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('new','called','measured','fitted','cancelled'));

CREATE INDEX IF NOT EXISTS bookings_by_date   ON bookings (date, slot);
CREATE INDEX IF NOT EXISTS bookings_by_status ON bookings (status, date);

-- One code per customer, minted when they book. Redemption is
-- confirmed by the shop, never by the site — this table only counts.
CREATE TABLE IF NOT EXISTS referral_codes (
  code          TEXT PRIMARY KEY,          -- QC-REF-XXXX
  owner_ref     TEXT NOT NULL REFERENCES bookings(ref),
  redemptions   INTEGER NOT NULL DEFAULT 0,
  -- Set by the shop once a referred job is paid; that is what turns
  -- the owner's 10% code into their 20% reward. Kept as 0/1 rather
  -- than a boolean so the queries read the same as they always did.
  reward_earned INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_by_owner ON referral_codes (owner_ref);

-- Seasonal promotions. The shop edits this, not the code, and the
-- client never sees the table — it posts a code and is told what it
-- is worth.
CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  percent_off INTEGER,                     -- off fitting only
  amount_off  DOUBLE PRECISION,            -- off the order
  message     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  expires_at  TEXT
);

-- Like every discount, both come off the fitting only. WINTER10 runs
-- to the end of February.
INSERT INTO promo_codes (code, percent_off, amount_off, message, active, expires_at) VALUES
  ('WINTER10',   10, NULL, 'WINTER10 applied — 10% off fitting.',        1, '2027-02-28'),
  ('NEWFLOOR25', NULL, 25, 'NEWFLOOR25 applied — £25 off your fitting.', 1, NULL)
ON CONFLICT (code) DO NOTHING;

-- NEWFLOOR25 used to promise £25 off the whole order, materials and
-- all, against the rule that materials never discount. Correct the
-- wording on databases seeded before then. It matches the old text
-- exactly, so it never touches a message the shop has written.
UPDATE promo_codes SET message = 'NEWFLOOR25 applied — £25 off your fitting.'
 WHERE code = 'NEWFLOOR25' AND message = 'NEWFLOOR25 applied — £25 off your order.';

-- An estimate, saved when the customer goes on to book. The code is
-- minted here, on the server, and the figures are worked out again
-- here from the ranges and rates rather than taken from the browser.
-- No personal details: the booking points at the estimate, not the
-- other way round. Prices are copied into `input` as they were, so a
-- later change to a range's guide price does not rewrite what the
-- customer was shown.
CREATE TABLE IF NOT EXISTS estimates (
  code        TEXT PRIMARY KEY,            -- QC-EST-XXXXX
  input       JSONB NOT NULL,              -- floor, underlay, rooms, fit, extras, discount
  result      JSONB NOT NULL,              -- lib/pricing.ts estimate(), lines and totals
  total       DOUBLE PRECISION NOT NULL,   -- £, incl. VAT, after discount
  created_at  TEXT NOT NULL                -- ISO 8601 UTC
);

-- ---------------------------------------------------------------
-- What the shop edits: the ranges, the fitting rates and the site
-- settings. Change them in the Supabase Table Editor and the site
-- shows the change within about a minute — no deploy.
-- seed.sql fills them with the placeholders the first time only;
-- running db:setup again never writes over the shop's edits.
-- ---------------------------------------------------------------

-- One row per range. Money is DOUBLE PRECISION, as promo_codes
-- already is, so it reaches the site as a number and not a string.
CREATE TABLE IF NOT EXISTS ranges (
  id          TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),   -- the URL slug
  name        TEXT NOT NULL,
  material    TEXT NOT NULL CHECK (material IN ('Carpet','Laminate','Vinyl','Underlay')),
  spec        TEXT NOT NULL,                                  -- the spec line, in the fitter's words
  price       DOUBLE PRECISION NOT NULL CHECK (price > 0),    -- guide £/m², supply only
  grade       TEXT NOT NULL,                                  -- 'Heavy domestic · Class 23'; underlay: 'For carpet' or 'For hard floors'
  rooms       TEXT[] NOT NULL DEFAULT '{}'
              CHECK (rooms <@ ARRAY['Living','Bedroom','Stairs','Hall','Kitchen','Bathroom']),
  widths      DOUBLE PRECISION[]                              -- roll widths in metres; NULL when sold by area
              CHECK (widths IS NULL OR (cardinality(widths) > 0 AND 0 < ALL (widths))),
  pile        TEXT NOT NULL                                   -- the CSS texture shown when there is no photo
              CHECK (pile IN ('twist','saxony','loop','stripe','plank','herring','sheet','foam')),
  colours     TEXT[] NOT NULL CHECK (cardinality(colours) > 0),
  photo_url   TEXT,                                           -- 1:1 crop; '/ranges/x.jpg' or a full https:// URL. NULL shows the texture
  sort_order  INTEGER NOT NULL DEFAULT 50,
  showcase    INTEGER CHECK (showcase IS NULL OR showcase > 0), -- position in the home banner; NULL leaves it out
  description TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true                   -- false hides it everywhere without deleting it
);

-- The fitting rates. Exactly one row: id is always 1.
CREATE TABLE IF NOT EXISTS rates (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fit_carpet         DOUBLE PRECISION NOT NULL CHECK (fit_carpet >= 0),         -- £/m² to fit a soft floor
  fit_hard           DOUBLE PRECISION NOT NULL CHECK (fit_hard >= 0),           -- £/m² to fit laminate and LVT
  fit_stair          DOUBLE PRECISION NOT NULL CHECK (fit_stair >= 0),          -- £ per step
  uplift             DOUBLE PRECISION NOT NULL CHECK (uplift >= 0),             -- £/m² to lift and dispose of the old floor
  gripper            DOUBLE PRECISION NOT NULL CHECK (gripper >= 0),            -- £ per metre of perimeter
  doorbar            DOUBLE PRECISION NOT NULL CHECK (doorbar >= 0),            -- £ each, one per room
  furniture          DOUBLE PRECISION NOT NULL CHECK (furniture >= 0),          -- £ flat
  trim               DOUBLE PRECISION NOT NULL CHECK (trim >= 0),               -- metres added to each run for trimming
  wastage_hard       DOUBLE PRECISION NOT NULL CHECK (wastage_hard >= 1),       -- × area for laminate and LVT
  underlay_allowance DOUBLE PRECISION NOT NULL CHECK (underlay_allowance >= 1), -- × floor area for underlay
  stair_area         DOUBLE PRECISION NOT NULL CHECK (stair_area > 0)           -- m² of carpet per step
);

-- Everything else the shop might change. Exactly one row: id is 1.
CREATE TABLE IF NOT EXISTS settings (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- The live domain, for canonical links, the sitemap and sharing.
  site_url      TEXT NOT NULL DEFAULT 'https://www.quintoncarpets.co.uk'
                CHECK (site_url ~ '^https://[a-z0-9.-]+$'),
  -- Where the shop's copy of each booking goes, and who it is from.
  -- Empty means the SHOP_EMAIL / MAIL_FROM environment variables.
  shop_email    TEXT,
  mail_from     TEXT,
  -- How many measures each time window takes. 0 closes the window.
  capacity_am   INTEGER NOT NULL DEFAULT 3 CHECK (capacity_am >= 0),
  capacity_pm   INTEGER NOT NULL DEFAULT 3 CHECK (capacity_pm >= 0),
  capacity_eve  INTEGER NOT NULL DEFAULT 2 CHECK (capacity_eve >= 0),
  -- The four category cards on the home page, and the image shown
  -- when the site is shared. A path under public/ or a full URL.
  photo_carpets  TEXT NOT NULL DEFAULT '/site/cat-carpets.jpg',
  photo_underlay TEXT NOT NULL DEFAULT '/site/cat-underlay.jpg',
  photo_laminate TEXT NOT NULL DEFAULT '/site/cat-laminate.jpg',
  photo_vinyl    TEXT NOT NULL DEFAULT '/site/cat-vinyl.jpg',
  og_image       TEXT NOT NULL DEFAULT '/og.jpg'
);

-- ---------------------------------------------------------------
-- The staff who can open the diary. Each person has their own login,
-- so the activity log can say who did what, and somebody leaving is
-- one switch rather than a new password for everyone.
--
-- The first account is made by logging in with ADMIN_USER and
-- ADMIN_PASSWORD from the environment while this table is empty;
-- after that, people are added on the diary's Staff page.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id             SERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{2,40}$'),
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,            -- scrypt$N$r$p$salt$hash, never the password
  role           TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  active         BOOLEAN NOT NULL DEFAULT true,
  calendar_token TEXT NOT NULL UNIQUE,     -- the secret in their calendar feed's URL
  created_at     TEXT NOT NULL
);

-- A logged-in browser. Only a hash of the cookie is kept, so a copy of
-- this table cannot be used to log in.
CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_by_staff ON staff_sessions (staff_id);

-- Every change made in the diary, newest last: who, when, and what.
CREATE TABLE IF NOT EXISTS booking_events (
  id      BIGSERIAL PRIMARY KEY,
  ref     TEXT NOT NULL REFERENCES bookings(ref) ON DELETE CASCADE,
  at      TEXT NOT NULL,                   -- ISO 8601 UTC
  actor   TEXT NOT NULL,                   -- a staff name, or 'site' for the automatic emails
  what    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_by_ref ON booking_events (ref, id);

-- Rate limiting, per IP, per hour. Cheaper than a CAPTCHA and it
-- does not make a customer prove they are human to book a measure.
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket  TEXT PRIMARY KEY,                -- ip|YYYY-MM-DDTHH
  hits    INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT NOT NULL
);

-- Nothing in this database is reachable from the browser: the anon
-- key is never shipped to the client and every query runs server-side
-- through the pooled connection. Row Level Security is switched on
-- regardless, so that a key leaking later cannot become a data leak.
-- No policies are added, which means: deny everything except the
-- service role the site connects as.
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated full rights on every table in
-- the public schema by default. This site never uses either role — it
-- connects as the owner over the pooled connection — so the grants are
-- nothing but a loaded gun on the table. Row Level Security already
-- denies both roles, but defence should not rest on one setting that a
-- future "enable the Data API" click could undermine.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;

-- And the same for anything added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
