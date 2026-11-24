// 繪圖：單一欄位、底圖（含出血）、QR Code。編輯器、預覽、PDF、ZIP 共用。
import { PT_MM } from "./constants.js";
import { num, measureCtx } from "./util.js";
import { app } from "./state.js";
import { bleedMm, ticketSize } from "./geometry.js";

// ---------- QR Code ----------
const qrLib = window.qrcode;
if (qrLib && qrLib.stringToBytesFuncs && qrLib.stringToBytesFuncs["UTF-8"]) qrLib.stringToBytes = qrLib.stringToBytesFuncs["UTF-8"];
const qrCache = new Map();
function makeQR(text) {
  if (!qrLib || !text) return null;
  if (qrCache.has(text)) return qrCache.get(text);
  let q = null;
  try { q = qrLib(0, "M"); q.addData(text); q.make(); } catch (e) { q = null; }
  if (qrCache.size > 2000) qrCache.clear();
  qrCache.set(text, q);
  return q;
}

// ppm：每「券毫米」對應的像素數。回傳 canvas 與相對錨點的偏移（像素）。
export function renderField(f, text, ppm) {
  let w, h, pad, draw;
  if (f.type === "qr") {
    const qr = makeQR(text);
    const q = f.qrQuiet ? 2 : 0, m = qr ? qr.getModuleCount() : 21;
    let cell = Math.max(0.5, num(f.qrSize, 15) * ppm) / (m + 2 * q);
    if (cell >= 3) cell = Math.floor(cell); // 高解析度時對齊整數像素，掃描更穩
    w = h = cell * (m + 2 * q); pad = 1;
    const ov = cell >= 3 ? 0.4 : 0; // 稍微重疊避免模組之間出現細縫
    draw = (ctx, x0) => {
      const y0 = -h / 2;
      if (f.qrQuiet) { ctx.fillStyle = "#fff"; ctx.fillRect(x0, y0, w, h); }
      ctx.fillStyle = f.color;
      if (!qr) { ctx.lineWidth = Math.max(1, w / 30); ctx.strokeStyle = "#ef4444"; ctx.strokeRect(x0, y0, w, h); return; }
      for (let r = 0; r < m; r++) for (let c = 0; c < m; c++)
        if (qr.isDark(r, c)) ctx.fillRect(x0 + (c + q) * cell, y0 + (r + q) * cell, cell + ov, cell + ov);
    };
  } else if (f.type === "blank") {
    // 填寫欄：左邊是文字（可空白），後面接一條底線
    const fontPx = Math.max(1, num(f.size, 12) * PT_MM * ppm);
    const font = `${f.bold ? 700 : 400} ${fontPx}px ${f.font}`;
    measureCtx.font = font;
    const tw0 = text ? measureCtx.measureText(text).width : 0, gap = text ? fontPx * 0.3 : 0;
    const linePx = Math.max(1, num(f.lineLen, 40) * ppm), lw = Math.max(1, num(f.lineW, 0.3) * ppm);
    w = tw0 + gap + linePx; h = fontPx * 1.3; pad = 2 + lw;
    draw = (ctx, x0) => {
      ctx.font = font; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = f.color;
      if (text) ctx.fillText(text, x0, 0);
      const y = fontPx * 0.45;
      ctx.strokeStyle = f.color; ctx.lineWidth = lw; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(x0 + tw0 + gap, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    };
  } else {
    const fontPx = Math.max(1, num(f.size, 12) * PT_MM * ppm);
    const strokePx = Math.max(0, num(f.stroke, 0) * PT_MM * ppm);
    const font = `${f.bold ? 700 : 400} ${fontPx}px ${f.font}`;
    measureCtx.font = font;
    w = measureCtx.measureText(text).width;
    h = fontPx * 1.3; pad = strokePx + 2;
    draw = (ctx) => {
      ctx.font = font; ctx.textAlign = f.align || "center"; ctx.textBaseline = "middle";
      if (strokePx > 0) { ctx.lineJoin = "round"; ctx.lineWidth = strokePx * 2; ctx.strokeStyle = f.strokeColor; ctx.strokeText(text, 0, 0); }
      ctx.fillStyle = f.color; ctx.fillText(text, 0, 0);
    };
  }
  const x0 = f.align === "left" ? 0 : f.align === "right" ? -w : -w / 2;
  const a = (num(f.rotate, 0) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const pts = [[x0 - pad, -h / 2 - pad], [x0 + w + pad, -h / 2 - pad], [x0 + w + pad, h / 2 + pad], [x0 - pad, h / 2 + pad]]
    .map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  const minX = Math.floor(Math.min(...pts.map((p) => p[0]))), maxX = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const minY = Math.floor(Math.min(...pts.map((p) => p[1]))), maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  const c = document.createElement("canvas");
  c.width = Math.max(1, maxX - minX); c.height = Math.max(1, maxY - minY);
  const ctx = c.getContext("2d");
  ctx.translate(-minX, -minY); ctx.rotate(a);
  draw(ctx, x0);
  return { canvas: c, ox: minX, oy: minY };
}

// 產生「成品＋四邊出血」的完整底圖（ppm = 每券毫米的像素數）
export function makeBgFull(ppm) {
  const { tw, th } = ticketSize(), b = bleedMm(), img = app.bgImg;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((tw + 2 * b) * ppm)); c.height = Math.max(1, Math.round((th + 2 * b) * ppm));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  if (!img) return c;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (b === 0 || app.S.ticket.bgMode === "included") { ctx.drawImage(img, 0, 0, c.width, c.height); return c; }
  // 不含出血：圖放在成品區，邊緣 1px 往外拉伸補滿出血
  const bp = b * ppm, w = tw * ppm, h = th * ppm;
  ctx.drawImage(img, bp, bp, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, iw, 1, bp, 0, w, bp);            // 上
  ctx.drawImage(img, 0, ih - 1, iw, 1, bp, bp + h, w, bp);  // 下
  ctx.drawImage(img, 0, 0, 1, ih, 0, bp, bp, h);            // 左
  ctx.drawImage(img, iw - 1, 0, 1, ih, bp + w, bp, bp, h);  // 右
  ctx.drawImage(img, 0, 0, 1, 1, 0, 0, bp, bp);             // 四角
  ctx.drawImage(img, iw - 1, 0, 1, 1, bp + w, 0, bp, bp);
  ctx.drawImage(img, 0, ih - 1, 1, 1, 0, bp + h, bp, bp);
  ctx.drawImage(img, iw - 1, ih - 1, 1, 1, bp + w, bp + h, bp, bp);
  return c;
}

// 從完整底圖裁出某張券要用的範圍（成品＋該券的出血），回傳來源矩形（像素）
export function bgCrop(full, ext, ppm) {
  const b = bleedMm(), { tw, th } = ticketSize();
  return [(b - ext.l) * ppm, (b - ext.t) * ppm, (tw + ext.l + ext.r) * ppm, (th + ext.t + ext.b) * ppm];
}

export function cropCanvas(src, sx, sy, sw, sh) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
  c.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
