/**
 * What the shop edits: the ranges, the fitting rates and the site
 * settings, read from the database.
 *
 * Each is held for CACHE_MS on a warm instance, so a busy page does
 * not query on every request, and Vercel's CDN holds the pages
 * themselves for a minute on top of that (see src/middleware.ts). An
 * edit in the Supabase Table Editor is on the site within about a
 * minute either way.
 *
 * If the database stops answering, the last good copy keeps being
 * served. Settings have safe defaults, so the pages that only need
 * those render even without a database; ranges and rates do not —
 * guessing at a price would be worse than an error page.
 */

import { db, hasDatabase } from "./db.ts";
import { PRICES, type RateCard } from "../pricing.ts";
import { gradeShort, isHard, type Range } from "../ranges.ts";
import type { SlotKey } from "../dates.ts";

const CACHE_MS = 30_000;

const cache = new Map<string, { value: unknown; at: number }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  try {
    const value = await load();
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (err) {
    if (hit) {
      console.error(`could not refresh ${key}; serving the last good copy`, err);
      return hit.value as T;
    }
    throw err;
  }
}

/* ---------------- ranges ---------------- */

type RangeRow = {
  id: string;
  name: string;
  material: Range["material"];
  spec: string;
  price: number;
  grade: string;
  rooms: string[];
  widths: number[] | null;
  pile: Range["pile"];
  colours: string[];
  photo_url: string | null;
  sort_order: number;
  showcase: number | null;
  description: string;
  brand: string | null;
  category: string | null;
  features: string[] | null;
  colour_names: string[] | null;
  sample_url: string | null;
  price_from: boolean | null;
};

const toRange = (r: RangeRow): Range => ({
  id: r.id,
  name: r.name,
  material: r.material,
  spec: r.spec,
  price: Number(r.price),
  grade: r.grade,
  gradeShort: gradeShort(r.grade),
  rooms: [...r.rooms],
  widths: r.widths ? r.widths.map(Number) : null,
  pile: r.pile,
  colours: [...r.colours],
  order: r.sort_order,
  showcase: r.showcase ?? undefined,
  photo: r.photo_url?.trim() || null,
  body: r.description.trim(),
  hard: isHard(r.material, r.widths),
  brand: r.brand?.trim() || null,
  category: r.category?.trim() || null,
  features: [...(r.features ?? [])],
  colourNames: [...(r.colour_names ?? [])],
  sampleUrl: r.sample_url?.trim() || null,
  priceFrom: Boolean(r.price_from),
});

/** Every range on sale, in the shop's order. Hidden ones are left out. */
export const getRanges = (): Promise<Range[]> =>
  cached("ranges", async () => {
    const { results } = await db
      .prepare(
        `SELECT id, name, material, spec, price, grade, rooms, widths, pile, colours,
                photo_url, sort_order, showcase, description,
                brand, category, features, colour_names, sample_url, price_from
           FROM ranges WHERE active ORDER BY sort_order, name`,
      )
      .all<RangeRow>();
    return results.map(toRange);
  });

/* ---------------- rates ---------------- */

type RatesRow = {
  fit_carpet: number;
  fit_hard: number;
  fit_stair: number;
  uplift: number;
  gripper: number;
  doorbar: number;
  furniture: number;
  trim: number;
  wastage_hard: number;
  underlay_allowance: number;
  stair_area: number;
};

/** The fitting rates the estimator charges. */
export const getRates = (): Promise<RateCard> =>
  cached("rates", async () => {
    const r = await db.prepare(`SELECT * FROM rates WHERE id = 1`).first<RatesRow>();
    if (!r) throw new Error("The rates table is empty. Run: npm run db:setup");
    return {
      fitCarpet: Number(r.fit_carpet),
      fitHard: Number(r.fit_hard),
      fitStair: Number(r.fit_stair),
      uplift: Number(r.uplift),
      gripper: Number(r.gripper),
      doorbar: Number(r.doorbar),
      furniture: Number(r.furniture),
      trim: Number(r.trim),
      wastageHard: Number(r.wastage_hard),
      underlayAllowance: Number(r.underlay_allowance),
      stairArea: Number(r.stair_area),
    } satisfies Record<keyof typeof PRICES, number>;
  });

/* ---------------- settings ---------------- */

export interface Settings {
  /** "https://www.quintoncarpets.co.uk", no trailing slash. */
  siteUrl: string;
  /** Where the shop's copy of a booking goes; null falls back to SHOP_EMAIL. */
  shopEmail: string | null;
  /** The sender on booking emails; null falls back to MAIL_FROM. */
  mailFrom: string | null;
  /** Measures each time window takes. 0 closes it. */
  capacity: Record<SlotKey, number>;
  /** The home page's four category cards. */
  photos: { carpets: string; underlay: string; laminate: string; vinyl: string };
  /** The picture used when the site is shared. */
  ogImage: string;
  /** Aman's photo for About Us on the home page; null shows the section without one. */
  aboutPhoto: string | null;
}

/** What the site uses until the settings row says otherwise. Matches the column defaults. */
export const DEFAULT_SETTINGS: Settings = {
  siteUrl: "https://www.quintoncarpets.co.uk",
  shopEmail: null,
  mailFrom: null,
  capacity: { am: 3, pm: 3, eve: 2 },
  photos: {
    carpets: "/site/cat-carpets.jpg",
    underlay: "/site/cat-underlay.jpg",
    laminate: "/site/cat-laminate.jpg",
    vinyl: "/site/cat-vinyl.jpg",
  },
  ogImage: "/og.jpg",
  // Aman's photo, in public/. settings.about_photo replaces it.
  aboutPhoto: "/about-aman.jpg",
};

type SettingsRow = {
  site_url: string;
  shop_email: string | null;
  mail_from: string | null;
  capacity_am: number;
  capacity_pm: number;
  capacity_eve: number;
  photo_carpets: string;
  photo_underlay: string;
  photo_laminate: string;
  photo_vinyl: string;
  og_image: string;
  about_photo: string | null;
};

const blankToNull = (v: string | null) => v?.trim() || null;

/**
 * The site settings. Every page needs the domain, so this never
 * fails: without a database, or with one that is not answering and
 * nothing cached, it hands back the defaults and says so in the log.
 */
export async function getSettings(): Promise<Settings> {
  if (!hasDatabase()) return DEFAULT_SETTINGS;
  try {
    return await cached("settings", async () => {
      const r = await db.prepare(`SELECT * FROM settings WHERE id = 1`).first<SettingsRow>();
      if (!r) return DEFAULT_SETTINGS;
      return {
        siteUrl: r.site_url.replace(/\/+$/, ""),
        shopEmail: blankToNull(r.shop_email),
        mailFrom: blankToNull(r.mail_from),
        capacity: { am: r.capacity_am, pm: r.capacity_pm, eve: r.capacity_eve },
        photos: {
          carpets: r.photo_carpets,
          underlay: r.photo_underlay,
          laminate: r.photo_laminate,
          vinyl: r.photo_vinyl,
        },
        ogImage: r.og_image,
        aboutPhoto: blankToNull(r.about_photo ?? null) ?? DEFAULT_SETTINGS.aboutPhoto,
      };
    });
  } catch (err) {
    console.error("could not read settings; using the defaults", err);
    return DEFAULT_SETTINGS;
  }
}
