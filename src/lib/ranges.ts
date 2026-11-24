/**
 * The ranges: their shape, and the pure filters over them.
 *
 * The ranges themselves live in the `ranges` table, where the shop
 * edits them. lib/server/catalogue.ts reads them; this file never
 * touches the database, so the browser and the tests can use it.
 */

export interface Range {
  id: string;
  name: string;
  material: "Carpet" | "Laminate" | "Vinyl" | "Underlay";
  spec: string;
  /** Guide £/m², supply only. null while the shop has not priced it yet. */
  price: number | null;
  grade: string;
  /** "Heavy domestic · Class 23" → "Class 23", for the tight showcase card. */
  gradeShort: string;
  rooms: string[];
  widths: number[] | null;
  pile: import("./textures.ts").Pile;
  colours: string[];
  order: number;
  showcase?: number;
  body: string;
  /**
   * The photograph, once it exists: a path under public/ or a full
   * URL, 1:1 crop. While it is absent the CSS texture in textures.ts
   * stands in , that is the whole point of those, and they stay as
   * the fallback range by range.
   */
  photo: string | null;
  /** Laminate and LVT are fitted at the hard-floor rate and sold by area. */
  hard: boolean;
  /** The maker, for branded ranges: "Cormar". */
  brand: string | null;
  /** The maker's family: "Easy Clean", "Wool Twist". */
  category: string | null;
  /** Short selling points: "Bleach cleanable", "10 Year Stain & Wear Guarantee". */
  features: string[];
  /** The shades, by name. */
  colourNames: string[];
  /** A swatch photo for each shade, in the same order as colourNames; empty when there are none. */
  colourPhotos: string[];
  /** The maker's free-sample page. */
  sampleUrl: string | null;
  /** The price is a starting price: "from £20.00/m²". */
  priceFrom: boolean;
}

/** A range with a price, which is the only kind the estimator can quote. */
export type PricedRange = Range & { price: number };
export const isPriced = (r: Range): r is PricedRange => r.price !== null;

/** Shown in place of the price while a range has none yet. */
export const PRICE_TBC = "£ —";

/** "£20.00/m²", "From £20.00/m²" for a starting price, or "£ — price coming soon". */
export const priceLabel = (r: Pick<Range, "price" | "priceFrom">, money: (n: number) => string) =>
  r.price === null ? `${PRICE_TBC} price coming soon` : `${r.priceFrom ? "From " : ""}${money(r.price)}/m²`;

export const MATERIALS = ["Carpet", "Vinyl", "Underlay"] as const;
export const ROOMS = ["Living", "Bedroom", "Stairs", "Hall", "Kitchen", "Bathroom"] as const;

/** "Heavy domestic · Class 23" → "Class 23". */
export const gradeShort = (grade: string) => {
  const parts = grade.split("·");
  return (parts[parts.length - 1] ?? grade).trim();
};

/** Sheet vinyl comes off a roll like carpet; LVT and laminate do not. */
export const isHard = (material: Range["material"], widths: readonly number[] | null) =>
  material === "Laminate" || (material === "Vinyl" && widths === null);

/**
 * Everything a customer can put on a floor , underlay is priced separately.
 * A range with no price yet is left out: it cannot be estimated.
 */
export const floorRanges = (all: Range[]) => all.filter(isPriced).filter((r) => r.material !== "Underlay");
export const underlayRanges = (all: Range[]) => all.filter(isPriced).filter((r) => r.material === "Underlay");

export const showcaseRanges = (all: Range[]) =>
  all
    .filter(isPriced)
    .filter((r) => typeof r.showcase === "number")
    .sort((a, b) => (a.showcase ?? 0) - (b.showcase ?? 0));

export function filterRanges(all: Range[], material: string, room: string): Range[] {
  return all.filter(
    (r) =>
      r.material !== "Laminate" &&
      (material === "All" || r.material === material) &&
      (room === "All" || r.rooms.includes(room)),
  );
}
