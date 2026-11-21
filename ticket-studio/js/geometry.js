// 拼版幾何：一頁放幾張、縮放、出血、裁切線位置。
import { PAPERS, SAVE_MIN_SCALE } from "./constants.js";
import { clamp, num } from "./util.js";
import { app } from "./state.js";
import { buildNumbers } from "./numbers.js";

export const bleedMm = () => clamp(num(app.S.ticket.bleed, 0), 0, 10);
export const ticketSize = () => ({ tw: num(app.S.ticket.w, 100), th: num(app.S.ticket.h, 50) });

export function computeLayout(over) {
  const S = app.S;
  const lay = Object.assign({}, S.layout, over || {});
  const { tw, th } = ticketSize();
  let [pw, ph] = PAPERS[lay.paper] || PAPERS.A4;
  if (lay.orient === "landscape") [pw, ph] = [ph, pw];
  const cols = clamp(Math.floor(num(lay.cols, 1)), 1, 20), rows = clamp(Math.floor(num(lay.rows, 1)), 1, 40);
  const margin = Math.max(0, num(lay.margin, 0)), gap = Math.max(0, num(lay.gap, 0));
  const bleed = bleedMm();
  const gridW = cols * tw + (cols - 1) * gap, gridH = rows * th + (rows - 1) * gap;
  // 外圍要留出血的空間
  const scale = Math.max(0.01, Math.min(1, (pw - 2 * margin) / (gridW + 2 * bleed), (ph - 2 * margin) / (gridH + 2 * bleed)));
  const sw = tw * scale, sh = th * scale, sg = gap * scale;
  const ox = (pw - gridW * scale) / 2, oy = (ph - gridH * scale) / 2;
  const slots = [];
  const inner = Math.min(bleed, gap / 2); // 券與券之間能分到的出血（間距不足時會被壓縮）
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    slots.push({ x: ox + c * (sw + sg), y: oy + r * (sh + sg),
      // 這張券四邊各要畫多少出血（券毫米）
      ext: { l: c === 0 ? bleed : inner, r: c === cols - 1 ? bleed : inner, t: r === 0 ? bleed : inner, b: r === rows - 1 ? bleed : inner } });
  return { pw, ph, tw, th, cols, rows, scale, sw, sh, slots, perPage: cols * rows, bleed, gap,
           bleedShort: bleed > 0 && (cols > 1 || rows > 1) && gap < 2 * bleed - 1e-9,
           gridL: ox, gridT: oy, gridR: ox + gridW * scale, gridB: oy + gridH * scale };
}

// 疊切排序：整疊裁切後各疊依序疊起即為連號
export function ticketIndex(L, p, s, pages) {
  return app.S.layout.stackCut ? s * pages + p : p * L.perPage + s;
}

export function cutGeometry(L) {
  const xs = new Set(), ys = new Set();
  L.slots.forEach((s) => { xs.add(+s.x.toFixed(3)); xs.add(+(s.x + L.sw).toFixed(3)); ys.add(+s.y.toFixed(3)); ys.add(+(s.y + L.sh).toFixed(3)); });
  const marks = [], lines = [];
  const off = L.bleed * L.scale + 1, len = 4; // 裁切標記要畫在出血範圍外
  xs.forEach((x) => {
    marks.push([x, L.gridT - off - len, x, L.gridT - off], [x, L.gridB + off, x, L.gridB + off + len]);
    lines.push([x, L.gridT, x, L.gridB]);
  });
  ys.forEach((y) => {
    marks.push([L.gridL - off - len, y, L.gridL - off, y], [L.gridR + off, y, L.gridR + off + len, y]);
    lines.push([L.gridL, y, L.gridR, y]);
  });
  return { marks, lines };
}

// fit："exact" 原尺寸 100% 放最多張；"save" 省紙：允許縮小到 90%，一頁放最多張。找不到回傳 null
export function bestLayout(fit) {
  const minScale = (fit || "exact") === "save" ? SAVE_MIN_SCALE : 0.999;
  let best = null;
  for (const orient of ["portrait", "landscape"])
    for (let cols = 1; cols <= 12; cols++)
      for (let rows = 1; rows <= 30; rows++) {
        const L = computeLayout({ orient, cols, rows });
        if (L.scale < minScale) break; // 再多列只會更擠
        const better = !best || L.perPage > best.n || (L.perPage === best.n && L.scale > best.scale + 1e-6);
        if (better) best = { n: L.perPage, orient, cols, rows, scale: L.scale };
      }
  return best;
}

export function autoLayout() {
  const best = bestLayout(app.S.layout.fit || "save");
  if (best) Object.assign(app.S.layout, { orient: best.orient, cols: best.cols, rows: best.rows });
  return !!best;
}

// 「省紙」與「原尺寸」兩種排法的比較（相同就回傳 null）
export function fitChoices() {
  const { nums } = buildNumbers();
  const save = bestLayout("save"), exact = bestLayout("exact");
  if (!save || !exact || save.n === exact.n) return null;
  const pg = (b) => Math.ceil(nums.length / b.n);
  return { save, exact, savePages: pg(save), exactPages: pg(exact) };
}
