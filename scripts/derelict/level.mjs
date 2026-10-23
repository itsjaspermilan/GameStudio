// The movement test room of carts/derelict: one big room (60x30 tiles, 960x480) with a spot for every move.
//   start: the terminal (press Up at it) and the five upgrade capsules in a row
//   two shallow pits on the floor (the second one wants Dash or Double Jump), a target down in the first to shoot down at
//   thin floors stacked left of a shaft (jump up through them, Down + B drops), the shaft itself for wall jumps
//   a high ledge on the right for Double Jump, and drones up high to shoot upward at
import { TILE, UPGRADES } from "./art.mjs";
import { rng } from "../lib/canvas.mjs";

export const COLS = 60, ROWS = 30, T = 16;

export function buildLevel() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
  const fill = (c0, r0, c1, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  const thin = (c0, c1, r) => fill(c0, r, c1, r, "=");

  fill(0, 0, COLS - 1, 0, "#"); fill(0, ROWS - 1, COLS - 1, ROWS - 1, "#");
  fill(0, 0, 0, ROWS - 1, "#"); fill(COLS - 1, 0, COLS - 1, ROWS - 1, "#");
  fill(0, 27, COLS - 1, 28, "#");
  fill(13, 27, 18, 28, " ");               // pit 1: six wide, a running jump nearly clears it
  fill(44, 27, 50, 28, " ");               // pit 2: seven wide, needs Dash or Double Jump

  // the thin floors above the start, to practise dropping through
  // (three tiles apart: a full jump rises about three and a half)
  thin(2, 8, 24); thin(3, 9, 21);
  // a ladder of thin floors up to the top left, then a walk along the top
  thin(20, 24, 24); thin(24, 28, 21); thin(19, 23, 18); thin(24, 28, 15); thin(19, 23, 12); thin(22, 28, 9);
  thin(13, 19, 6); thin(3, 10, 9);
  // the wall-jump shaft: two thick walls with a gap at the bottom to walk in, a thin floor on top to pop out through
  fill(29, 8, 30, 23, "#"); fill(35, 8, 36, 23, "#"); thin(31, 34, 7);
  // the top right: a floor with a thin step, drones to shoot from below
  fill(37, 7, 58, 7, "#"); thin(40, 44, 4);
  // the high ledge for Double Jump, open underneath
  fill(53, 21, 58, 22, "#");
  fill(37, 8, 38, 12, "#");

  const floorY = 27 * T;
  const entities = [
    { kind: "hero", x: 24, y: floorY, name: "hero" },
    { kind: "terminal", x: 64, y: floorY },
    ...UPGRADES.map((id, i) => ({ kind: "upgrade", x: 96 + i * 24, y: floorY - 14, props: { gives: id } })),
    { kind: "drone", x: 15 * T + 16, y: 28 * T - 2 },   // in pit 1: jump over and shoot down
    { kind: "drone", x: 6 * T, y: 18 * T },             // above the thin floors
    { kind: "drone", x: 26 * T, y: 26 * T - 4 },        // on the floor path: shoot it straight ahead
    { kind: "drone", x: 33 * T, y: 3 * T },             // above the shaft
    { kind: "drone", x: 7 * T, y: 5 * T },              // top left
    { kind: "drone", x: 47 * T, y: 2 * T + 8 },         // top right, over the thin step
    { kind: "drone", x: 55 * T, y: 4 * T },
    { kind: "drone", x: 42 * T, y: 18 * T },            // the right hall
    { kind: "drone", x: 47 * T, y: 23 * T },            // over pit 2
    { kind: "drone", x: 56 * T, y: 18 * T },            // above the high ledge
  ];
  return { grid: g, entities };
}

// tile numbers for the "solid" layer: walls get trim on their open sides
export function solidLayer(g) {
  const wallAt = (r, c) => r < 0 || c < 0 || r >= ROWS || c >= COLS || g[r][c] === "#";
  return g.map((row, r) => row.map((ch, c) => {
    if (ch === "=") return TILE.THIN;
    if (ch !== "#") return -1;
    return TILE.WALL + (wallAt(r - 1, c) ? 0 : 1) + (wallAt(r, c + 1) ? 0 : 2) + (wallAt(r + 1, c) ? 0 : 4) + (wallAt(r, c - 1) ? 0 : 8);
  }));
}

// the "back" layer: hull panels everywhere, with lights, vents, windows and a few pipe runs scattered by a fixed seed
export function backLayer() {
  const rand = rng(7);
  const b = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => {
    const v = rand();
    return v < 0.05 ? TILE.WINDOW : v < 0.11 ? TILE.PANEL_LIGHT : v < 0.16 ? TILE.VENT : TILE.PANEL;
  }));
  for (const c of [12, 33, 47]) for (let r = 1; r < 27; r++) b[r][c] = TILE.PIPE_V;
  for (const r of [10, 25]) for (let c = 1; c < COLS - 1; c++) if (b[r][c] !== TILE.PIPE_V) b[r][c] = TILE.PIPE_H;
  return b;
}
