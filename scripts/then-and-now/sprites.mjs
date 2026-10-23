// Things in the station: enemies, the boss shuttle, enemy shots, doors, terminals and consoles, pickups, the jackets the earlier Wrens
// left, Wren's ship and the lift. Enemies are warm (orange, red, purple); echoes from Then are drawn in the teal family so they read
// as memories; Wren's things are cool.
import { Canvas } from "../lib/canvas.mjs";

const K = 0;

// ---------- enemy shots (8x8, centred): 0 burning debris (Now), 1 a memory's flame (Then), 2 a turret bolt
export const SPR_ESHOT = {
  w: 8, h: 8, frames: 3, draw(c, f) {
    if (f === 0) c.disc(4, 4, 3.2, 5).disc(4, 4, 2.2, 10).disc(3.5, 3.5, 1, 14);
    else if (f === 1) c.disc(4, 4, 3.2, 21).disc(4, 4, 2.2, 22).disc(3.5, 3.5, 1, 23);
    else c.disc(4, 4, 3, 4).disc(4, 4, 2, 6).px(3, 3, 7);
  },
};

// ---------- the loader drone (24x24, feet at the bottom): a forklift robot on treads. 0-1 rolling, 2 charging (forks up, eye red)
export const SPR_LOADER = {
  w: 24, h: 24, frames: 3, draw(c, f) {
    const charge = f === 2, bob = f === 1 ? 1 : 0;
    c.rect(3, 18, 16, 6, 1).rect(3, 18, 16, 1, 2);                               // treads
    for (let x = 4 + (f % 2) * 2; x < 18; x += 4) c.rect(x, 20, 2, 2, 0);
    c.rect(5, 6 + bob, 13, 12, 9).rect(5, 6 + bob, 13, 2, 10).rect(5, 15 + bob, 13, 2, 8);   // body
    for (let x = 6; x < 17; x += 4) c.rect(x, 10 + bob, 2, 3, 12);                // hazard stripes
    c.rect(14, 8 + bob, 4, 3, charge ? 6 : 13).px(16, 9 + bob, charge ? 7 : 15);   // eye
    const fy = charge ? 9 : 14;                                                    // forks
    c.rect(18, fy, 1, 8 - (charge ? 0 : 3), 2).rect(18, fy + 5, 6, 2, 2).rect(18, fy + 5, 6, 1, 3);
    c.rect(8, 2 + bob, 2, 4, 1).px(8, 1 + bob, charge ? 7 : 6);                   // antenna
    c.outline(K);
  },
};

// ---------- the rivet turret (16x16, centred, hanging from a ceiling): 0 idle, 1 firing
export const SPR_TURRET = {
  w: 16, h: 16, frames: 2, draw(c, f) {
    c.rect(3, 0, 10, 4, 1).rect(3, 0, 10, 1, 2);
    c.sphere(8, 8, 5.5, [4, 5, 6, 7]);
    c.disc(8, 9, 2.4, 0).disc(8, 9, 1.4, f ? 15 : 7);
    c.rect(7, 12, 2, 4, 1).px(7, 15, f ? 14 : 2).px(8, 15, f ? 14 : 2);
    c.outline(K);
  },
};

// ---------- a pilot echo (24x32, feet at the bottom): a crew member from Then re-living the launch, running. 4 frames.
export const SPR_ECHO_PILOT = {
  w: 24, h: 32, frames: 4, draw(c, f) {
    const legs = [[[9, 31], [15, 31]], [[11, 31], [13, 30]], [[7, 30], [17, 31]], [[12, 30], [11, 31]]][f];
    const bob = f % 2;
    for (const [x, y] of legs) c.line(12, 20 + bob, x, y, 21).line(13, 20 + bob, x + 1, y, 21);
    c.rect(8, 11 + bob, 9, 10, 21).rect(8, 11 + bob, 9, 2, 22).rect(15, 13 + bob, 2, 6, 20);
    c.disc(12.5, 7 + bob, 4.2, 22).rect(13, 6 + bob, 4, 2, 23).rect(8, 3 + bob, 9, 2, 21);   // head, visor, cap
    c.line(16, 13 + bob, 20, 17 + bob - f % 2 * 2, 22);                                         // arm swinging
    c.outline(20);
  },
};

// ---------- a Hollow (32x32, centred): a dark shape of a Wren who did not make it, two glowing eyes. 0-1 drifting
export const SPR_HOLLOW = {
  w: 32, h: 32, frames: 2, draw(c, f) {
    const y = f;
    c.ellipse(16, 10 + y, 7, 7, 28).ellipse(16, 20 + y, 8, 9, 28);
    for (let x = 9; x < 24; x += 3) c.line(x, 26 + y, x + (f ? 1 : -1), 31, 28);                 // a ragged hem instead of legs
    c.ellipse(14, 9 + y, 5, 3, 0);                                                                 // the goggles' place, empty
    c.rect(11, 8 + y, 2, 2, 23).rect(16, 8 + y, 2, 2, 23);
    c.line(9, 14 + y, 4, 20 + y, 28).line(23, 14 + y, 27, 21 + y, 28);
    c.outline(29);
  },
};

// ---------- the shuttle (64x40, centred): 0 as it was (Then: white, blue stripes, engines lit), 1 as it is (Now: a burnt wreck)
export const SPR_SHUTTLE = {
  w: 64, h: 40, frames: 2, draw(c, f) {
    const wreck = f === 1;
    const hull = wreck ? [0, 1, 1, 2] : [1, 2, 3, 3], stripe = wreck ? 8 : 25;
    c.poly([[6, 16], [44, 12], [58, 18], [62, 22], [58, 26], [44, 30], [6, 28]], hull[2]);         // body
    c.poly([[6, 16], [44, 12], [58, 18], [6, 19]], hull[3]);
    c.poly([[6, 26], [44, 30], [58, 26], [6, 29]], hull[1]);
    c.rect(10, 21, 44, 2, stripe);
    c.poly([[46, 15], [56, 18], [58, 21], [47, 20]], wreck ? 0 : 21).px(50, 17, wreck ? 1 : 23);    // cockpit
    c.poly([[14, 16], [26, 4], [32, 4], [28, 16]], hull[2]).line(26, 4, 32, 4, hull[3]);           // fin
    c.poly([[16, 28], [30, 28], [24, 37], [18, 37]], hull[1]);                                     // wing
    c.rect(1, 17, 6, 10, 1).rect(1, 17, 6, 1, 2);                                                  // engine
    if (wreck) {
      for (const [x, y, r] of [[20, 18, 3], [36, 24, 2.5], [44, 16, 2]]) c.disc(x, y, r, 0);
      c.disc(4, 15, 3, 5).disc(4, 14, 2, 10).px(4, 13, 14).disc(30, 12, 2.2, 6).px(30, 11, 14);
    } else {
      c.rect(0, 19, 2, 6, 22).px(0, 21, 23).px(0, 22, 23);
    }
    c.outline(K);
  },
};

// ---------- a door hatch (16x48, top-left at the top of the opening): 0 shut, 1-2 opening, 3 open (only the frame shows)
export const SPR_DOOR = {
  w: 16, h: 48, frames: 4, draw(c, f) {
    c.rect(0, 0, 16, 4, 1).rect(0, 44, 16, 4, 1).rect(0, 0, 16, 1, 2);
    const gap = [0, 8, 16, 21][f];
    if (gap < 21) {
      const hh = 20 - gap;
      c.rect(3, 4, 10, hh, 25).rect(3, 4, 10, 1, 26).rect(3, 44 - hh, 10, hh, 25).rect(3, 43, 10, 1, 24);
      c.rect(6, 4 + hh - 2, 4, 2, 27).rect(6, 44 - hh, 4, 2, 27);
    }
    c.rect(1, 4, 2, 40, 1).rect(13, 4, 2, 40, 1);
  },
};

// ---------- the terminal (24x32, standing on the floor): saves the game. 0 and 1 are the screen's scan lines moving
export const SPR_TERMINAL = {
  w: 24, h: 32, frames: 2, draw(c, f) {
    c.rect(7, 16, 10, 16, 1).rect(7, 16, 1, 16, 2).rect(9, 21, 6, 1, 0).rect(9, 25, 6, 1, 0).rect(5, 30, 14, 2, 1);
    c.rect(2, 14, 20, 3, 2).rect(2, 14, 20, 1, 3).px(5, 15, 18).px(8, 15, 14).px(11, 15, 6);
    c.rect(3, 1, 18, 13, 2).rect(3, 1, 18, 1, 3).rect(5, 3, 14, 9, 20);
    for (let y = 3 + f; y < 12; y += 2) c.rect(5, y, 14, 1, 21);
    c.rect(7, 4, 6, 1, 23).rect(7, 6, 9, 1, 22).rect(7, 8, 4, 1, 22).px(17, 10, 18);
    c.outline(0);
  },
};

// ---------- Tender's console (24x32): a column with Tender's eye, a warm ring of light. 0-1 the eye breathing
export const SPR_CONSOLE = {
  w: 24, h: 32, frames: 2, draw(c, f) {
    c.rect(6, 12, 12, 20, 1).rect(6, 12, 1, 20, 2).rect(4, 29, 16, 3, 1);
    c.disc(12, 9, 8.5, 2).disc(12, 9, 7, 0);
    c.ring(12, 9, f ? 6 : 5.5, 2, 13).ring(12, 9, f ? 6 : 5.5, 1, 15).disc(12, 9, 2, f ? 15 : 14);
    for (let y = 16; y < 28; y += 3) c.rect(9, y, 6, 1, f && y === 22 ? 13 : 0);
    c.outline(0);
  },
};

// ---------- the launch console in the tower (24x32): only there in Then. A desk with a big green button and a lit board
export const SPR_LAUNCH = {
  w: 24, h: 32, frames: 2, draw(c, f) {
    c.rect(4, 18, 16, 14, 21).rect(4, 18, 16, 1, 22).rect(6, 22, 12, 1, 20);
    c.rect(1, 12, 22, 6, 22).rect(1, 12, 22, 1, 23);
    for (let x = 3; x < 20; x += 3) c.px(x, 14, (x + f) % 2 ? 18 : 14);
    c.disc(17, 15, 2, f ? 19 : 18);
    c.rect(4, 2, 16, 9, 21).rect(5, 3, 14, 7, 20).rect(6, 5, 8, 1, 23).rect(6, 7, 5, 1, 22);
    c.outline(20);
  },
};

// ---------- pickups (16x16, centred): 0-1 hull plate (a heart-shaped armour plate, glinting), 2-3 Lens battery
export const SPR_PICKUP = {
  w: 16, h: 16, frames: 4, draw(c, f) {
    const glint = f % 2;
    if (f < 2) {
      c.disc(5.5, 6, 3.6, 5).disc(10.5, 6, 3.6, 5).poly([[2, 7], [14, 7], [8, 14]], 5);
      c.disc(5, 5.5, 2.4, 6).disc(10, 5.5, 2.4, 6).poly([[3.5, 7], [12.5, 7], [8, 12]], 6).px(4, 4, 7);
      c.rect(6, 7, 4, 1, 1).rect(7, 6, 2, 3, 1);
    } else {
      c.rect(5, 2, 6, 12, 1).rect(6, 1, 4, 1, 2).rect(6, 3, 4, 10, 21);
      for (let y = 4; y < 13; y += 3) c.rect(6, y, 4, 1, 22);
      c.px(6, 3, 23);
    }
    if (glint) c.px(12, 2, 3).px(11, 3, 3).px(13, 3, 3).px(12, 4, 3);
    c.outline(K);
  },
};

// ---------- an earlier Wren's jacket (32x16, lying on the floor): empty, slumped against a crate, a note pinned to it
export const SPR_JACKET = {
  w: 32, h: 16, frames: 1, draw(c) {
    c.rect(22, 3, 10, 13, 1).rect(22, 3, 10, 1, 2);                                    // crate
    c.poly([[4, 15], [8, 6], [16, 5], [22, 8], [22, 15]], 9);                          // jacket
    c.poly([[8, 6], [16, 5], [18, 8], [10, 10]], 10).line(12, 8, 13, 15, 8);
    c.poly([[2, 15], [6, 11], [10, 15]], 9).poly([[18, 15], [22, 10], [26, 15]], 9);   // sleeves
    c.rect(14, 2, 4, 3, 6).rect(15, 1, 3, 1, 5);                                       // a red scarf, knotted
    c.rect(15, 9, 5, 4, 3).rect(16, 10, 3, 1, 1).rect(16, 12, 2, 1, 1);                // the note
    c.outline(K);
  },
};

// ---------- Wren's ship (64x48, standing on the floor): 0 as Now shows it, 1 as Then shows it (only seen late in the game)
export const SPR_SHIP = {
  w: 64, h: 48, frames: 2, draw(c, f) {
    const old = f === 0, hull = old ? [8, 9, 9, 10] : [9, 10, 11, 11];
    c.poly([[4, 30], [12, 14], [44, 10], [58, 20], [60, 32], [52, 40], [8, 40]], hull[1]);
    c.poly([[12, 14], [44, 10], [58, 20], [14, 20]], hull[3]);
    c.poly([[8, 40], [52, 40], [56, 36], [6, 36]], hull[0]);
    c.poly([[44, 14], [56, 21], [56, 26], [46, 24]], old ? 21 : 22).line(47, 16, 54, 21, old ? 22 : 23);
    c.rect(18, 24, 14, 10, hull[0]).rect(19, 25, 12, 8, old ? 1 : 2);                  // hatch
    c.rect(10, 40, 4, 8, 1).rect(46, 40, 4, 8, 1).rect(8, 46, 8, 2, 2).rect(44, 46, 8, 2, 2);
    c.rect(0, 26, 6, 8, 1).rect(0, 27, 2, 6, old ? 0 : 22);
    if (old) for (const [x, y] of [[20, 16], [36, 30], [50, 34], [28, 12], [8, 32]]) c.px(x, y, 8).px(x + 1, y, 4);
    c.outline(K);
  },
};

// ---------- the lift (32x48, standing on the floor): heavy doors, dead lights
export const SPR_LIFT = {
  w: 32, h: 48, frames: 2, draw(c, f) {
    c.rect(0, 0, 32, 48, 1).rect(0, 0, 32, 2, 2).rect(2, 6, 28, 42, 0);
    c.rect(3, 7, 12, 41, 24).rect(17, 7, 12, 41, 24).rect(3, 7, 12, 1, 25).rect(17, 7, 12, 1, 25);
    c.rect(15, 7, 2, 41, 0);
    c.rect(12, 2, 8, 3, 0).px(14, 3, f ? 6 : 4).px(17, 3, 4);
    for (let y = 12; y < 44; y += 8) { c.rect(5, y, 8, 1, 25); c.rect(19, y, 8, 1, 25); }
  },
};
