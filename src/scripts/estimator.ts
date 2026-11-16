/**
 * The estimator island.
 *
 * All arithmetic is delegated to lib/pricing.ts, which is pure and
 * unit-tested. This file only builds inputs, renders the answer and
 * asks the server what a code is worth — it never decides that
 * itself.
 */

import {
  bestRoll,
  estimate,
  money,
  type DiscountVerdict,
  type EstimateInput,
  type RateCard,
  type RoomInput,
} from "../lib/pricing.ts";

type Floor = {
  id: string;
  name: string;
  material: string;
  price: number;
  /** A starting price: shown as "From £x/m²". */
  priceFrom?: boolean;
  widths: number[] | null;
  hard: boolean;
  swatch: string;
};
type Underlay = { id: string; name: string; spec: string; price: number; forHard: boolean };
type Config = { floors: Floor[]; underlays: Underlay[]; rates: RateCard };

const root = document.querySelector<HTMLElement>("#estimator");

if (root) {
  const cfg: Config = JSON.parse(root.dataset.config ?? "{}");
  const $ = <T extends Element = Element>(s: string) => document.querySelector<T>(s);
  const $$ = <T extends Element = Element>(s: string) =>
    Array.from(document.querySelectorAll<T>(s));

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s: string) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

  const byId = new Map(cfg.floors.map((f) => [f.id, f]));
  const ulById = new Map(cfg.underlays.map((u) => [u.id, u]));

  // Nothing is chosen until the customer chooses it — except a range
  // link from /ranges/, which pre-selects that floor.
  const wanted = new URLSearchParams(location.search).get("range");
  const defaultFloor = wanted && byId.has(wanted) ? wanted : "";
  const defaultUnderlay =
    cfg.underlays.find((u) => !u.forHard)?.id ?? cfg.underlays[0]?.id ?? "none";

  const state = {
    floor: defaultFloor,
    underlay: defaultUnderlay,
    fit: "fitted" as "fitted" | "supply",
    extras: { uplift: true, gripper: true, doorbars: true, furniture: false },
    // One empty room to fill in; the boxes show examples, not values.
    rooms: [{ kind: "room", name: "", width: 0, length: 0 }] as RoomInput[],
    discount: null as DiscountVerdict | null,
    /** Set once the customer picks an underlay; until then it follows the floor. */
    underlayPicked: false,
    /** The furthest step unlocked. Steps open one at a time. */
    reached: defaultFloor ? 2 : 1,
    /** Which kind of floor the picker shows, and which page of it. */
    kind: "All",
    page: 0,
  };

  const PER_PAGE = 4;
  const KINDS = ["All", ...new Set(cfg.floors.map((f) => f.material))];
  const shownFloors = () => cfg.floors.filter((f) => state.kind === "All" || f.material === state.kind);
  // Open on the page holding a pre-selected floor.
  if (defaultFloor) state.page = Math.floor(shownFloors().findIndex((f) => f.id === defaultFloor) / PER_PAGE);

  const currentFloor = () => byId.get(state.floor);
  /** A size box shows blank, with its example, until something is typed. */
  const num = (v: number) => (v > 0 ? String(v) : "");

  /* ---------------- step 1: the floor ---------------- */
  function drawFloors() {
    const box = $("#estRanges");
    if (!box) return;
    const all = shownFloors();
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    state.page = Math.min(state.page, pages - 1);

    const tabs = $("#estTabs");
    if (tabs) {
      tabs.innerHTML = KINDS.map(
        (k) => `<button class="chip" type="button" data-kind="${esc(k)}" aria-pressed="${state.kind === k}">${k === "All" ? "All floors" : esc(k)}</button>`,
      ).join("");
      $$<HTMLButtonElement>("#estTabs [data-kind]").forEach((b) =>
        b.addEventListener("click", () => {
          state.kind = b.dataset.kind!;
          state.page = 0;
          drawFloors();
        }),
      );
    }

    const pager = $("#estPager");
    if (pager) {
      pager.innerHTML =
        pages > 1
          ? `<button class="btn ghost sm" type="button" data-pg="-1"${state.page === 0 ? " disabled" : ""} aria-label="Previous floors">‹ Prev</button>
             <span class="pg">${state.page + 1} of ${pages}</span>
             <button class="btn ghost sm" type="button" data-pg="1"${state.page >= pages - 1 ? " disabled" : ""} aria-label="More floors">Next ›</button>`
          : "";
      $$<HTMLButtonElement>("#estPager [data-pg]").forEach((b) =>
        b.addEventListener("click", () => {
          state.page += Number(b.dataset.pg);
          drawFloors();
        }),
      );
    }

    box.innerHTML = all
      .slice(state.page * PER_PAGE, state.page * PER_PAGE + PER_PAGE)
      .map(
        (r) => `
        <button class="rangecard${state.floor === r.id ? " picked" : ""}" type="button"
          data-floor="${r.id}" aria-pressed="${state.floor === r.id}"
          style="text-align:left;padding:0;cursor:pointer;background:var(--ground)">
          <span class="swatch" style="display:block;${r.swatch}"></span>
          <span class="body" style="padding:11px 12px 13px;gap:3px">
            <b style="font-size:.9rem">${esc(r.name)}</b>
            <span class="meta" style="font-size:.76rem">${esc(r.material)} · ${r.priceFrom ? "From " : ""}${money(r.price)}/m²</span>
          </span>
        </button>`,
      )
      .join("");
    $$<HTMLButtonElement>("#estRanges [data-floor]").forEach((b) =>
      b.addEventListener("click", () => {
        state.floor = b.dataset.floor!;
        // Carpet gets carpet underlay, laminate and LVT get board — the
        // one we'd suggest — unless they've already chosen for themselves.
        if (!state.underlayPicked) {
          const hard = currentFloor()?.hard ?? false;
          state.underlay = cfg.underlays.find((u) => u.forHard === hard)?.id ?? state.underlay;
        }
        drawFloors();
        drawUnderlay();
        drawFit();
        calc();
      }),
    );
  }

  /* ---------------- step 2: the rooms ---------------- */
  function drawRooms() {
    const box = $("#rooms");
    if (!box) return;
    const rollWidthFor = (room: Extract<RoomInput, { kind: "room" }>) => {
      const floor = currentFloor();
      const widths = floor?.material === "Carpet" ? [4, 5] : floor?.widths;
      if (!widths || !(room.width > 0 && room.length > 0)) return "Automatic";
      return `${bestRoll(room.width, room.length, widths).rollWidth}m roll`;
    };
    box.innerHTML = state.rooms
      .map((r, i) => {
        if (r.kind === "stairs") {
          return `<div class="roomrow">
            <div class="field"><label for="rn${i}">Area</label>
              <input id="rn${i}" value="${esc(r.name)}" placeholder="e.g. Stairs &amp; landing" data-i="${i}" data-p="name"></div>
            <div class="field"><label for="rs${i}">Steps</label>
              <input id="rs${i}" class="mono" inputmode="numeric" value="${num(r.steps)}" placeholder="e.g. 13" data-i="${i}" data-p="steps"></div>
            <div class="field" style="grid-column:span 2"><label for="rs${i}-note">&nbsp;</label>
              <p class="hint" id="rs${i}-note" style="padding:11px 0">Priced per step, including the landing return.</p></div>
            <button class="iconbtn" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">✕</button>
          </div>`;
        }
        return `<div class="roomrow">
          <div class="field"><label for="rn${i}">Room</label>
            <input id="rn${i}" value="${esc(r.name)}" placeholder="e.g. Living room" data-i="${i}" data-p="name"></div>
          <div class="field"><label for="rw${i}">Room width (m)</label>
            <input id="rw${i}" class="mono" inputmode="decimal" value="${num(r.width)}" placeholder="e.g. 4.2" data-i="${i}" data-p="width"></div>
          <div class="field"><label for="rl${i}">Length (m)</label>
            <input id="rl${i}" class="mono" inputmode="decimal" value="${num(r.length)}" placeholder="e.g. 4.6" data-i="${i}" data-p="length"></div>
          <div class="field"><span class="hint" style="font-weight:700;color:var(--ink);font-size:.85rem">Carpet roll width</span>
            <output class="mono locked-readout" id="rr${i}">${rollWidthFor(r)}</output></div>
          <div class="field"><span class="hint" style="font-weight:700;color:var(--ink);font-size:.85rem">Floor area</span>
            <p class="mono" id="ra${i}" style="padding:11px 0;font-size:.9rem">${r.width * r.length > 0 ? (r.width * r.length).toFixed(1) + " m²" : "—"}</p></div>
          <button class="iconbtn" type="button" data-del="${i}" aria-label="Remove ${esc(r.name)}">✕</button>
        </div>`;
      })
      .join("");

    $$<HTMLInputElement>("#rooms input").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.i);
        const p = input.dataset.p!;
        const room = state.rooms[i];
        if (!room) return;
        if (p === "name") {
          room.name = input.value;
        } else {
          const v = parseFloat(input.value.replace(",", "."));
          // A blank box means zero, not NaN — the total keeps working while you type.
          (room as Record<string, unknown>)[p] = Number.isNaN(v) ? 0 : Math.max(0, v);
          // Only this row's readout changes. Redrawing the whole list
          // here would replace the box the customer is moving into.
          const area = $(`#ra${i}`);
          if (area && room.kind === "room") {
            const a = room.width * room.length;
            area.textContent = a > 0 ? `${a.toFixed(1)} m²` : "—";
          }
          const roll = $(`#rr${i}`);
          if (roll && room.kind === "room") roll.textContent = rollWidthFor(room);
        }
        calc();
      });
    });

    $$<HTMLButtonElement>("#rooms [data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        state.rooms.splice(Number(b.dataset.del), 1);
        drawRooms();
        calc();
      }),
    );
  }

  /* ---------------- step 3: underlay ---------------- */
  function drawUnderlay() {
    const box = $("#underlayOpts");
    if (!box) return;
    const hard = currentFloor()?.hard ?? false;
    const opts = [
      ...cfg.underlays,
      { id: "none", name: "No underlay", spec: "Re-using what's already down, or not needed", price: 0, forHard: false },
    ];
    box.innerHTML = opts
      .map((u) => {
        const suggested = u.id !== "none" && u.forHard === hard && isFirstOfKind(u, hard);
        return `<label class="opt${state.underlay === u.id ? " on" : ""}">
          <input type="radio" name="ul" value="${u.id}"${state.underlay === u.id ? " checked" : ""}>
          <span><span class="t">${esc(u.name)}${suggested ? ' <span style="color:var(--yellow-ink);font-size:.76rem">· we\'d suggest this</span>' : ""}</span>
          <span class="d" style="display:block">${esc(u.spec)}</span></span>
          <span class="p">${u.price ? money(u.price) + "/m²" : "—"}</span>
        </label>`;
      })
      .join("");
    $$<HTMLInputElement>("#underlayOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.underlay = i.value;
        state.underlayPicked = true;
        drawUnderlay();
        calc();
      }),
    );
  }

  const isFirstOfKind = (u: Underlay, hard: boolean) =>
    cfg.underlays.find((x) => x.forHard === hard)?.id === u.id;

  /* ---------------- step 4: fitting and extras ---------------- */
  function drawFit() {
    const box = $("#fitOpts");
    if (!box) return;
    const hard = currentFloor()?.hard ?? false;
    const rate = hard ? cfg.rates.fitHard : cfg.rates.fitCarpet;
    box.innerHTML = `
      <label class="opt${state.fit === "fitted" ? " on" : ""}">
        <input type="radio" name="fit" value="fitted"${state.fit === "fitted" ? " checked" : ""}>
        <span><span class="t">Supply &amp; fit</span>
        <span class="d" style="display:block">Our own fitters. Gripper, door bars and a hoover round before we go.</span></span>
        <span class="p">${money(rate)}/m²</span>
      </label>
      <label class="opt${state.fit === "supply" ? " on" : ""}">
        <input type="radio" name="fit" value="supply"${state.fit === "supply" ? " checked" : ""}>
        <span><span class="t">Supply only</span>
        <span class="d" style="display:block">You fit it yourself. Free delivery up to 20 miles.</span></span>
        <span class="p">—</span>
      </label>`;
    $$<HTMLInputElement>("#fitOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.fit = i.value as "fitted" | "supply";
        drawFit();
        drawExtras();
        calc();
      }),
    );
  }

  function drawExtras() {
    const box = $("#extraOpts");
    if (!box) return;
    if (state.fit !== "fitted") {
      box.innerHTML =
        '<p class="notice info">Extras below are part of the fitting service — switch to supply &amp; fit to add them.</p>';
      return;
    }
    const E = [
      { k: "uplift", t: "Uplift & take the old floor away", d: "Lifted, rolled, loaded and disposed of properly.", p: `${money(cfg.rates.uplift)}/m²` },
      { k: "gripper", t: "New gripper rods", d: "Fresh gripper round the perimeter — worth it on anything over ten years old.", p: `${money(cfg.rates.gripper)}/lin m` },
      { k: "doorbars", t: "Door bars", d: "One per doorway, colour matched to the floor.", p: `${money(cfg.rates.doorbar)} each` },
      { k: "furniture", t: "Move the furniture", d: "We shift it out and put it back. Beds and wardrobes included.", p: `${money(cfg.rates.furniture)} per room` },
    ] as const;
    box.innerHTML = E.map(
      (x) => `<label class="opt${state.extras[x.k] ? " on" : ""}">
        <input type="checkbox" data-e="${x.k}"${state.extras[x.k] ? " checked" : ""}>
        <span><span class="t">${x.t}</span><span class="d" style="display:block">${x.d}</span></span>
        <span class="p">${x.p}</span></label>`,
    ).join("");
    $$<HTMLInputElement>("#extraOpts input").forEach((i) =>
      i.addEventListener("change", () => {
        state.extras[i.dataset.e as keyof typeof state.extras] = i.checked;
        drawExtras();
        calc();
      }),
    );
  }

  /* ---------------- step 5: the code ----------------
     The client posts the code and recomputes from whatever the
     server says it is worth. It never holds the code table. */
  async function applyCode() {
    const input = $<HTMLInputElement>("#promo");
    const box = $("#promoMsg");
    if (!input || !box) return;
    const value = input.value.trim().toUpperCase();

    state.discount = null;
    if (!value) {
      box.innerHTML = "";
      calc();
      return;
    }

    box.innerHTML = '<p class="notice info">Checking that code…</p>';
    try {
      const res = await fetch("/api/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const verdict = (await res.json()) as DiscountVerdict;
      state.discount = verdict.valid ? verdict : null;
      box.innerHTML = `<p class="notice ${verdict.valid ? "ok" : "warn"}">${esc(verdict.message)}</p>`;
    } catch {
      box.innerHTML =
        '<p class="notice warn">We couldn\'t check that code just now. Bring it in with you and we\'ll apply it at the counter.</p>';
    }
    calc();
  }

  /* ---------------- the answer ---------------- */
  /** The summary before there is anything to price: what's missing, not £0. */
  function drawEmpty(floor: Floor | undefined) {
    const row = (label: string, done: boolean, hint: string) =>
      `<div class="l ${done ? "" : "todo"}"><span>${label}</span><span>${done ? "✓" : esc(hint)}</span></div>`;
    const lines = $("#estLines");
    if (lines) {
      lines.innerHTML =
        row(floor ? esc(floor.name) : "Floor", Boolean(floor), "Pick one") +
        row("Room sizes", false, "Add them") +
        row("Underlay", false, "—") +
        row("Fitting & extras", false, "—") +
        `<hr><div class="l" style="font-weight:800"><span>Estimate incl. VAT</span><span>£—</span></div>`;
    }
    const total = $("#estTotal");
    if (total) total.innerHTML = `£—<small> incl. VAT</small>`;
  }

  /* ---------------- the steps ----------------
     Each step opens once the one above is done, so the page reads
     top to bottom: later steps are dimmed and inert until then. */
  const hasSize = () =>
    state.rooms.some((r) => (r.kind === "stairs" ? r.steps > 0 : r.width > 0 && r.length > 0));

  function steps() {
    $$<HTMLElement>("#estimator .panel[data-step]").forEach((panel) => {
      const n = Number(panel.dataset.step);
      const locked = n > state.reached;
      panel.classList.toggle("locked", locked);
      panel.classList.toggle("current", n === state.reached);
      panel.toggleAttribute("inert", locked);
    });
    const next1 = $<HTMLButtonElement>('[data-next="2"]');
    if (next1) {
      const f = currentFloor();
      next1.disabled = !f;
      next1.textContent = f ? `Continue with ${f.name} →` : "Choose a floor to continue";
    }
    const next2 = $<HTMLButtonElement>('[data-next="3"]');
    if (next2) {
      next2.disabled = !hasSize();
      next2.textContent = hasSize() ? "Continue to underlay →" : "Add a size to continue";
    }
  }

  $$<HTMLButtonElement>("#estimator [data-next]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = Number(b.dataset.next);
      state.reached = Math.max(state.reached, n);
      steps();
      const panel = $<HTMLElement>(`#estimator .panel[data-step="${n}"]`);
      panel?.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
      panel?.querySelector<HTMLElement>(".bd input, .bd button")?.focus({ preventScroll: true });
    }),
  );

  function calc() {
    steps();
    const floor = currentFloor();
    if (!floor || !hasSize()) {
      drawEmpty(floor);
      drawFoot();
      return;
    }
    const underlay = state.underlay === "none" ? null : ulById.get(state.underlay) ?? null;

    const input: EstimateInput = {
      floor: {
        name: floor.name,
        pricePerSqm: floor.price,
        widths: floor.material === "Carpet" ? [4, 5] : floor.widths,
        hard: floor.hard,
      },
      underlay: underlay ? { name: underlay.name, pricePerSqm: underlay.price } : null,
      rooms: state.rooms,
      fit: state.fit,
      extras: state.extras,
      discount: state.discount,
      rates: cfg.rates,
    };

    const out = estimate(input);

    let html = out.lines
      .map((l) =>
        l.sub
          ? `<div class="l sub"><span>${esc(l.label)}</span><span></span></div>`
          : `<div class="l"><span>${esc(l.label)}</span><span>${money(l.amount)}</span></div>`,
      )
      .join("");

    if (out.discount > 0) {
      html += `<hr><div class="l disc"><span>${esc(out.discountLabel)}</span><span>−${money(out.discount)}</span></div>`;
    }
    html += `<hr><div class="l" style="font-weight:800"><span>Estimate incl. VAT</span><span>${money(out.total)}</span></div>`;
    if (out.total > 0) {
      html += `<div class="l sub"><span>Typical range once measured</span><span>£${Math.round(out.rangeLow).toLocaleString("en-GB")} – £${Math.round(out.rangeHigh).toLocaleString("en-GB")}</span></div>`;
    }

    const lines = $("#estLines");
    if (lines) lines.innerHTML = html || '<p class="muted">Add a room to see your estimate.</p>';

    const total = $("#estTotal");
    if (total) total.innerHTML = `${out.total > 0 ? money(out.total) : "£0"}<small> incl. VAT</small>`;

    drawFoot();
  }

  /** Taller than the screen? Then stick by the bottom edge, not the top. */
  function fitSummary() {
    const box = $<HTMLElement>("aside.summary");
    if (!box) return;
    box.style.top = `${Math.min(88, window.innerHeight - box.offsetHeight - 16)}px`;
  }
  window.addEventListener("resize", fitSummary);

  function drawFoot() {
    const foot = $("#estFoot");
    if (foot && !foot.querySelector("#estBook")) {
      foot.innerHTML = `
        <a class="btn yellow" id="estBook" href="/book/" style="width:100%">Book a free measure</a>
        <p class="hint" style="margin-top:10px;text-align:center">Free, no payment online — your estimate comes with the booking.</p>`;
      foot.querySelector("#estBook")?.addEventListener("click", book);
    }
    fitSummary();
  }

  /* ---------------- on to the booking form ----------------
     The estimate is saved now, not on every keystroke, and the
     server mints its code. It sends what the customer chose; the
     server works out the figures again for itself. */
  async function book(e: Event) {
    e.preventDefault();
    const link = e.currentTarget as HTMLAnchorElement;
    if (link.getAttribute("aria-busy") === "true") return;
    link.setAttribute("aria-busy", "true");
    link.textContent = "Saving your estimate…";

    let target = "/book/";
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          floor: state.floor,
          underlay: state.underlay,
          rooms: state.rooms,
          fit: state.fit,
          extras: state.extras,
          discountCode: state.discount?.code ?? "",
        }),
      });
      const data = (await res.json()) as { code?: string };
      if (res.ok && data.code) {
        target = `/book/?estimate=${encodeURIComponent(data.code)}`;
        // Carried to the booking form so the customer doesn't retype it.
        try {
          sessionStorage.setItem("qc.estimate", JSON.stringify({ code: data.code }));
        } catch {
          /* private window, or storage blocked — the code is in the URL anyway */
        }
      }
    } catch {
      /* The booking matters more than the estimate. Carry on without it. */
    }
    location.href = target;
  }

  // The band at the foot of the page books with this estimate too.
  document.querySelectorAll<HTMLAnchorElement>("a[data-book]").forEach((a) => a.addEventListener("click", book));

  $("#addRoom")?.addEventListener("click", () => {
    state.rooms.push({ kind: "room", name: "", width: 0, length: 0 });
    drawRooms();
    calc();
  });
  $("#addStairs")?.addEventListener("click", () => {
    state.rooms.push({ kind: "stairs", name: "Stairs & landing", steps: 0 });
    drawRooms();
    calc();
  });
  $("#applyPromo")?.addEventListener("click", applyCode);
  $("#promo")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void applyCode();
    }
  });

  // Coming back with the Back button restores the page as it was
  // left, mid-save. Put the button back.
  window.addEventListener("pageshow", () => {
    document.querySelectorAll<HTMLAnchorElement>("#estBook, a[data-book]").forEach((link) => {
      link.removeAttribute("aria-busy");
      link.textContent = "Book a free measure";
    });
  });

  void RM; // reduced motion is handled in CSS here; nothing to animate

  drawFloors();
  drawRooms();
  drawUnderlay();
  drawFit();
  drawExtras();
  calc();
}
