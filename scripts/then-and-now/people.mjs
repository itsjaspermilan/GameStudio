// People: crew echoes (drawn in the teal family, the colour of memories) and 48x48 portraits for the text boxes.
// Wren's portrait is in living colours; Tender is an amber ring of light; the crew are teal like their echoes.
import { Canvas } from "../lib/canvas.mjs";

// ---------- Ossie Okafor's echo (32x32, feet at the bottom): a shuttle pilot in a flight jacket, cap and headset.
// 0-1 idle (bouncing on his heels, impatient), 2 talking (a thumbs up), 3 sad (head down)
export const SPR_OSSIE = {
  w: 32, h: 32, frames: 4, draw(c, f) {
    const bob = f === 1 ? 1 : 0, sad = f === 3;
    c.rect(12, 22, 3, 8, 21).rect(17, 22, 3, 8, 21).rect(11, 29, 5, 3, 20).rect(16, 29, 5, 3, 20);       // legs, boots
    c.rect(10, 12 + bob, 12, 11, 21).rect(10, 12 + bob, 12, 2, 22).rect(15, 14 + bob, 1, 8, 20);          // jacket, zip
    c.rect(9, 12 + bob, 3, 3, 22).rect(20, 12 + bob, 3, 3, 22);                                           // collar
    const hy = sad ? 5 : 3;
    c.disc(16.5, hy + 5 + bob, 4.8, 22);                                                                  // head
    c.rect(11, hy + 1 + bob, 11, 3, 20).rect(19, hy + 3 + bob, 6, 1, 20);                                 // cap and brim
    c.px(19, hy + 6 + bob, 20).line(18, hy + 9 + bob, 21, hy + 9 + bob, sad ? 21 : 23);                   // eye, mouth
    c.rect(11, hy + 4 + bob, 2, 4, 20).line(12, hy + 8 + bob, 18, hy + 10 + bob, 20);                     // headset and mic
    if (f === 2) c.rect(22, 9, 3, 6, 22).rect(22, 7, 2, 3, 23);                                          // thumbs up
    else c.rect(21, 14 + bob, 3, 7, 22);
    c.rect(8, 14 + bob, 3, 7, 22);
    c.outline(20);
  },
};

// ---------- portraits (48x48)
function wrenFace(c, mood) {
  c.poly([[2, 48], [7, 37], [19, 32], [31, 32], [42, 37], [47, 48]], 10);
  c.poly([[2, 48], [7, 37], [19, 32], [20, 48]], 11);
  c.poly([[31, 32], [42, 37], [47, 48], [34, 48]], 9);
  c.rect(20, 26, 10, 8, 7);                                                                                    // neck (the shader shades it)
  c.ellipse(25, 20, 10, 12, 7);
  c.ellipse(24, 33, 12, 4, 6).poly([[13, 33], [9, 44], [14, 44], [18, 35]], 5);                              // scarf
  c.ellipse(22, 10, 14, 9, 29).ellipse(18, 8, 8, 5, 30);                                                      // hair
  for (const [x0, y0, x1, y1, x2, y2] of [[8, 12, 2, 6, 12, 7], [10, 6, 6, 0, 16, 3], [18, 3, 18, -2, 26, 3], [27, 4, 33, 0, 32, 8], [33, 9, 39, 8, 35, 14]])
    c.poly([[x0, y0], [x1, y1], [x2, y2]], 29);
  c.ellipse(11, 18, 4, 8, 28).poly([[14, 12], [22, 16], [30, 12], [36, 16], [36, 11], [14, 9]], 29);         // side hair, fringe
  c.rect(12, 16, 26, 3, 1);                                                                                    // goggle band
  for (const x of [21, 31]) c.disc(x, 18, 5, 2).disc(x, 18, 3.6, 21).disc(x - 1, 17, 1.4, 23);
  const mouth = { 0: [[23, 28], [28, 28]], 1: [[24, 29], [27, 29]], 2: [[23, 29], [28, 27]] }[mood];
  c.line(mouth[0][0], mouth[0][1], mouth[1][0], mouth[1][1], 5);
  if (mood === 1) c.px(25, 30, 5).px(26, 30, 5);
  c.outline(0);
}
export const SPR_POR_WREN = { w: 48, h: 48, frames: 3, draw: (c, f) => wrenFace(c, f) };

export const SPR_POR_TENDER = {
  w: 48, h: 48, frames: 2, draw(c, f) {
    const worried = f === 1;
    c.disc(24, 24, 21, 0);
    c.ring(24, 24, 20, 2, 12).ring(24, 24, 16, 1, 13).ring(24, 24, 11, 3, worried ? 10 : 14).ring(24, 24, 11, 1, 15);
    c.disc(24, 24, worried ? 3 : 5, worried ? 11 : 15).disc(23, 23, 1.2, 3);
    for (let a = 0; a < 12; a++) {
      const t = a / 12 * Math.PI * 2, r = 18;
      c.px(24 + Math.cos(t) * r, 24 + Math.sin(t) * r, a % 3 ? 13 : 15);
    }
    if (worried) c.line(10, 14, 18, 18, 10).line(38, 14, 30, 18, 10);
  },
};

export const SPR_POR_OSSIE = {
  w: 48, h: 48, frames: 3, draw(c, f) {
    c.poly([[2, 48], [8, 36], [18, 32], [32, 32], [42, 36], [46, 48]], 21);
    c.poly([[10, 34], [18, 31], [20, 40]], 22).poly([[38, 34], [30, 31], [28, 40]], 22);   // collar
    c.rect(20, 26, 9, 7, 21);
    c.ellipse(25, 20, 10, 12, 22).ellipse(31, 23, 4, 8, 21);
    c.ellipse(24, 8, 13, 5, 20).rect(11, 8, 26, 4, 20).poly([[30, 10], [44, 12], [42, 14], [30, 13]], 20);   // cap and brim
    c.rect(11, 12, 4, 12, 20).line(13, 24, 28, 31, 20).disc(29, 31, 1.5, 20);                              // headset
    const eyes = f === 2 ? [[20, 20], [30, 20]] : [[20, 18], [30, 18]];
    for (const [x, y] of eyes) c.rect(x, y, 3, f === 2 ? 1 : 2, 20);
    if (f === 1) c.line(29, 15, 33, 14, 20);
    const mouth = [[[20, 26], [24, 28], [30, 26]], [[22, 27], [24, 27], [28, 27]], [[21, 28], [25, 27], [29, 28]]][f];
    c.line(mouth[0][0], mouth[0][1], mouth[1][0], mouth[1][1], 20).line(mouth[1][0], mouth[1][1], mouth[2][0], mouth[2][1], 20);
    if (f === 0) c.line(22, 27, 28, 27, 23);
    c.outline(20);
  },
};
