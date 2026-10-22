// Turns a GS_PERF log into a table, one row per scenario (a "mark: name" line starts one), for carts like carts/stress:
//   node scripts/summarize-perf.mjs last-run-stress.log
// Columns: fps = frames over seconds as measured, then average ms of update / drawing / render flush / copy+wait, the worst frame, and frames over 20 ms.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/summarize-perf.mjs <log>"); process.exit(2); }
const blank = (id) => ({ id, n: 0, frame: 0, upd: 0, draw: 0, pres: 0, fb: 0, worst: 0, slow: 0, secs: 0, mhz: 0, mhzn: 0, temp: 0 });
const rows = []; let cur = blank("(start)");
const flush = () => { if (cur.n) rows.push(cur); };
for (const line of readFileSync(file, "utf8").split("\n")) {
  const mark = line.match(/^mark: (.+)$/);
  if (mark && !/^room /.test(mark[1])) { flush(); cur = blank(mark[1]); continue; } // "room ..." marks are the engine's own: not a new scenario
  const cpu = line.match(/cpu (\d+) MHz, (\d+) C/);
  if (cpu) { cur.mhz += +cpu[1]; cur.mhzn += 1; cur.temp = Math.max(cur.temp, +cpu[2]); continue; }
  const m = line.match(/^perf: (\d+) frames\s+frame ([\d.]+)\/([\d.]+)\s+update ([\d.]+)\/[\d.]+\s+draw ([\d.]+)\/[\d.]+\s+render-flush ([\d.]+)\/[\d.]+\s+fb\+vsync ([\d.]+)\/[\d.]+\s+over 20ms: (\d+)/);
  if (!m) continue;
  const n = +m[1];
  cur.n += n; cur.secs += 1; cur.frame += +m[2] * n; cur.upd += +m[4] * n; cur.draw += +m[5] * n; cur.pres += +m[6] * n; cur.fb += +m[7] * n;
  cur.worst = Math.max(cur.worst, +m[3]); cur.slow += +m[8];
}
flush();
const f = (v, w = 5) => v.toFixed(1).padStart(w);
console.log("scenario".padEnd(16) + "  fps  update  draw flush  copy+wait  worst  over20ms  cpu MHz  max C");
for (const r of rows) {
  const avg = r.frame / r.n;
  console.log(r.id.padEnd(16) + f(1000 / avg, 5) + f(r.upd / r.n, 8) + f(r.draw / r.n, 6) + f(r.pres / r.n, 6) + f(r.fb / r.n, 11) + f(r.worst, 7) + String(r.slow).padStart(9) + (r.mhzn ? String(Math.round(r.mhz / r.mhzn)).padStart(9) + String(r.temp).padStart(7) : ""));
}
