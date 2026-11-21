// 整頁預覽：把券排到紙上的樣子，可翻頁。
import { $, clamp, num } from "./util.js";
import { app } from "./state.js";
import { buildNumbers, fieldText } from "./numbers.js";
import { computeLayout, ticketIndex, cutGeometry } from "./geometry.js";
import { renderField, makeBgFull, bgCrop } from "./render.js";

let queued = false;
export function schedulePreview() {
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false; drawPreview(); });
}

function drawPreview() {
  const S = app.S;
  const { nums, err } = buildNumbers();
  const L = computeLayout();
  const pages = Math.max(1, Math.ceil(nums.length / L.perPage));
  app.page = clamp(app.page, 0, pages - 1);
  const page = app.page;
  $("pgTotal").textContent = pages; $("pgInput").value = page + 1; $("pgInput").max = pages;
  $("pgPrev").disabled = page <= 0; $("pgNext").disabled = page >= pages - 1;

  const cv = $("pageCanvas"), wrap = $("pageWrap");
  if (!wrap.clientWidth) return; // 收起來時不用畫
  const cssW = Math.min(wrap.clientWidth - 32, 640), cssH = cssW * (L.ph / L.pw);
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  const k = cv.width / L.pw; // px / 頁面 mm
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);

  // 邊界參考線（青色，印刷打樣常用的非印刷色）
  ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = "rgba(0,137,196,.45)"; ctx.lineWidth = 1;
  const m = num(S.layout.margin, 0);
  ctx.strokeRect(m * k, m * k, (L.pw - 2 * m) * k, (L.ph - 2 * m) * k); ctx.setLineDash([]);

  const tppm = k * L.scale; // px / 券毫米
  const full = app.bgImg && !S.out.noBg ? makeBgFull(tppm) : null;
  L.slots.forEach((slot, s) => {
    const idx = ticketIndex(L, page, s, pages);
    const x = slot.x * k, y = slot.y * k, w = L.sw * k, h = L.sh * k;
    if (idx >= nums.length) {
      ctx.strokeStyle = "#d1d5db"; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      return;
    }
    const e = slot.ext;
    if (full) ctx.drawImage(full, ...bgCrop(full, e, tppm), x - e.l * tppm, y - e.t * tppm, w + (e.l + e.r) * tppm, h + (e.t + e.b) * tppm);
    else { ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#e5e7eb"; ctx.strokeRect(x, y, w, h); }
    S.fields.forEach((f) => {
      const r = renderField(f, fieldText(f, nums[idx]), k * L.scale);
      ctx.drawImage(r.canvas, x + f.x * w + r.ox, y + f.y * h + r.oy);
    });
  });

  const g = cutGeometry(L);
  if (S.layout.cutLines) {
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = Math.max(1, 0.2 * k); ctx.setLineDash([1.5 * k, 1 * k]);
    g.lines.forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a * k, b * k); ctx.lineTo(c * k, d * k); ctx.stroke(); });
    ctx.setLineDash([]);
  }
  if (S.layout.cutMarks) {
    ctx.strokeStyle = "#000"; ctx.lineWidth = Math.max(1, 0.2 * k);
    g.marks.forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a * k, b * k); ctx.lineTo(c * k, d * k); ctx.stroke(); });
  }

  const first = L.slots.map((_, s) => ticketIndex(L, page, s, pages)).filter((i) => i < nums.length);
  $("pageHint").textContent = err ? err : first.length
    ? `本頁編號（由左上到右下）：${first.map((i) => nums[i]).join("、")}`
    : "沒有可輸出的編號";
}

export function initPreview() {
  $("pgPrev").onclick = () => { app.page--; drawPreview(); };
  $("pgNext").onclick = () => { app.page++; drawPreview(); };
  $("pgInput").addEventListener("change", () => { app.page = Math.floor(num($("pgInput").value, 1)) - 1; drawPreview(); });
  new ResizeObserver(() => schedulePreview()).observe($("pageWrap"));
}
