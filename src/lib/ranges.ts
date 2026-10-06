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
  price: number;
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
   * stands in — that is the whole point of those, and they stay as
   * the fallback range by range.
   */
  photo: string | null;
  /** Laminate and LVT are fitted at the hard-floor rate and sold by area. */
  hard: boolean;
}

export const MATERIALS = ["Carpet", "Laminate", "Vinyl", "Underlay"] as const;
export const ROOMS = ["Living", "Bedroom", "Stairs", "Hall", "Kitchen", "Bathroom"] as const;

/** "Heavy domestic · Class 23" → "Class 23". */
export const gradeShort = (grade: string) => {
  const parts = grade.split("·");
  return (parts[parts.length - 1] ?? grade).trim();
};

/** Sheet vinyl comes off a roll like carpet; LVT and laminate do not. */
export const isHard = (material: Range["material"], widths: readonly number[] | null) =>
  material === "Laminate" || (material === "Vinyl" && widths === null);

/** Everything a customer can put on a floor — underlay is priced separately. */
export const floorRanges = (all: Range[]) => all.filter((r) => r.material !== "Underlay");
export const underlayRanges = (all: Range[]) => all.filter((r) => r.material === "Underlay");

export const showcaseRanges = (all: Range[]) =>
  all
    .filter((r) => typeof r.showcase === "number")
    .sort((a, b) => (a.showcase ?? 0) - (b.showcase ?? 0));

export function filterRanges(all: Range[], material: string, room: string): Range[] {
  return all.filter(
    (r) =>
      (material === "All" || r.material === material) &&
      (room === "All" || r.rooms.includes(room)),
  );
}
