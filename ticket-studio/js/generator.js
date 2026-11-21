// 幫我做一張：用文字＋風格（或 AI 背景）直接產生券的底圖，並把號碼放到「No.」線上。
import { FONTS, PT_MM, THEMES } from "./constants.js";
import { $, clamp, num, el, setStatus } from "./util.js";
import { app, defaultField } from "./state.js";
import { bleedMm, ticketSize } from "./geometry.js";
import { isList, sampleNumber } from "./numbers.js";
import { renderField } from "./render.js";
import { setBackground, setBgName } from "./background.js";
import { syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { genAi, prepareAiForm, finishAiForm, updateGenSrcUI, setAiStatus, initAi } from "./ai.js";

const GEN_FONT = FONTS[0].v;

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 找出放得進 maxW×maxH（px）的最大字級
function fitFont(ctx, text, weight, maxW, maxH) {
  let size = Math.max(4, maxH);
  ctx.font = `${weight} ${size}px ${GEN_FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size = Math.max(4, size * (maxW / w));
  return size;
}

// o：gen 設定；回傳 { canvas, slots }，slots 為號碼位置（成品比例 0~1）與字級（pt）、顏色
function genBackground(o, tw, th, b, ppm) {
  let T = THEMES[o.theme] || THEMES.red;
  const W = Math.round((tw + 2 * b) * ppm), H = Math.round((th + 2 * b) * ppm);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const aiImg = genAi.img;
  const useAi = o.src === "ai" && !!aiImg;
  const X = (mm) => (b + mm) * ppm, Y = (mm) => (b + mm) * ppm, M = (mm) => mm * ppm;
  const portrait = th > tw * 1.1;
  const main = { x: 0, y: 0, w: tw, h: th }; let stub = null;
  if (o.stub) {
    if (!portrait) { const sw = clamp(tw * 0.25, Math.min(28, tw * 0.4), 60); stub = { x: tw - sw, y: 0, w: sw, h: th }; main.w = tw - sw; }
    else { const sh = clamp(th * 0.24, Math.min(25, th * 0.4), 55); stub = { x: 0, y: th - sh, w: tw, h: sh }; main.h = th - sh; }
  }
  // 背景（畫滿出血）
  if (useAi) {
    // AI 圖片鋪滿（cover），再依圖片深淺決定字的顏色
    const iw = aiImg.naturalWidth, ih = aiImg.naturalHeight, sc = Math.max(W / iw, H / ih);
    ctx.drawImage(aiImg, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    const mx = Math.round(X(main.x)), my = Math.round(Y(main.y)), mw = Math.max(1, Math.round(M(main.w))), mh = Math.max(1, Math.round(M(main.h)));
    const d = ctx.getImageData(mx, my, mw, mh).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 9) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    const dark = sum / n < 140;
    T = dark
      ? { ink: "#ffffff", sub: "#f8fafc", line: "rgba(255,255,255,.9)", stubBg: "rgba(255,255,255,.9)", stubInk: "#111827", stubLine: "#374151", pattern: "none", panel: "rgba(15,23,42,.42)" }
      : { ink: "#111827", sub: "#1f2937", line: "#111827", stubBg: "rgba(255,255,255,.9)", stubInk: "#111827", stubLine: "#374151", pattern: "none", panel: "rgba(255,255,255,.62)" };
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const mainClip = () => { ctx.beginPath(); if (!stub) ctx.rect(0, 0, W, H); else if (!portrait) ctx.rect(0, 0, X(stub.x), H); else ctx.rect(0, 0, W, Y(stub.y)); ctx.clip(); };
  // 花紋
  ctx.save(); mainClip();
  const r = rng(20261120);
  if (T.pattern === "stripes") {
    ctx.strokeStyle = "rgba(59,130,246,.08)"; ctx.lineWidth = M(2.2);
    for (let x = -H; x < W + H; x += M(7)) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
  } else if (T.pattern === "dots") {
    for (let x = 0; x < W; x += M(4)) for (let y = 0; y < H; y += M(4)) {
      const k = x / W; if (k < 0.45) continue;
      ctx.fillStyle = `rgba(234,88,12,${(0.05 + 0.18 * (k - 0.45)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, M(0.35 + 1.1 * (k - 0.45)), 0, Math.PI * 2); ctx.fill();
    }
  } else if (T.pattern === "snow") {
    for (let i = 0; i < (W * H) / (M(9) * M(9)); i++) { ctx.fillStyle = `rgba(255,255,255,${(0.15 + r() * 0.35).toFixed(2)})`; ctx.beginPath(); ctx.arc(r() * W, r() * H, M(0.3 + r() * 0.9), 0, Math.PI * 2); ctx.fill(); }
  } else if (T.pattern === "confetti") {
    const cols = ["#f472b6", "#a78bfa", "#60a5fa", "#fbbf24", "#34d399"];
    for (let i = 0; i < (W * H) / (M(11) * M(11)); i++) {
      ctx.save(); ctx.translate(r() * W, r() * H); ctx.rotate(r() * Math.PI); ctx.globalAlpha = 0.28;
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-M(0.9), -M(0.4), M(1.8), M(0.8)); ctx.restore();
    }
  }
  ctx.restore();
  // 存根底色
  if (stub) { ctx.fillStyle = T.stubBg; if (!portrait) ctx.fillRect(X(stub.x), 0, W - X(stub.x), H); else ctx.fillRect(0, Y(stub.y), W, H - Y(stub.y)); }
  // 外框
  const inset = Math.min(main.w, main.h) * 0.045;
  if (T.pattern === "frame" || T.pattern === "border") {
    ctx.strokeStyle = T.line; ctx.globalAlpha = T.pattern === "frame" ? 0.85 : 1;
    ctx.lineWidth = M(T.pattern === "frame" ? 0.5 : 0.3);
    ctx.strokeRect(X(main.x + inset), Y(main.y + inset), M(main.w - 2 * inset), M(main.h - 2 * inset));
    if (T.pattern === "frame") { ctx.lineWidth = M(0.2); const i2 = inset + 1.2; ctx.strokeRect(X(main.x + i2), Y(main.y + i2), M(main.w - 2 * i2), M(main.h - 2 * i2)); }
    ctx.globalAlpha = 1;
  }
  // 撕線
  if (stub) {
    ctx.strokeStyle = T.pattern === "border" ? "#6b7280" : (portrait ? T.stubLine : T.line); ctx.lineWidth = M(0.35); ctx.setLineDash([M(1.6), M(1.2)]);
    ctx.beginPath(); if (!portrait) { ctx.moveTo(X(stub.x), Y(0)); ctx.lineTo(X(stub.x), Y(th)); } else { ctx.moveTo(X(0), Y(stub.y)); ctx.lineTo(X(tw), Y(stub.y)); } ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle; ctx.font = `${M(3.2)}px ${GEN_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (!portrait) ctx.fillText("✂", X(stub.x), Y(Math.min(4.5, th * 0.12))); else ctx.fillText("✂", X(Math.min(4.5, tw * 0.08)), Y(stub.y));
  }

  // 「標籤＋底線」，回傳底線在 x 方向的起訖（mm）
  const labelLine = (label, x, yLine, w, sizeMm, color, lineColor) => {
    ctx.font = `500 ${M(sizeMm)}px ${GEN_FONT}`; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(label, X(x), Y(yLine) - M(sizeMm * 0.12));
    const lw = ctx.measureText(label).width / ppm + sizeMm * 0.4;
    ctx.strokeStyle = lineColor; ctx.lineWidth = M(Math.max(0.25, sizeMm * 0.07));
    ctx.beginPath(); ctx.moveTo(X(x + lw), Y(yLine)); ctx.lineTo(X(x + w), Y(yLine)); ctx.stroke();
    return [x + lw, x + w];
  };

  // 主券內容
  const P = Math.min(main.w, main.h) * 0.11;
  const L = { x: main.x + P, y: main.y + P * 0.95, w: main.w - 2 * P, h: main.h - 2 * P };
  if (useAi && o.panel) {
    const pad = P * 0.45;
    ctx.fillStyle = T.panel; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X(L.x - pad), Y(L.y - pad), M(L.w + 2 * pad), M(L.h + 2 * pad), M(2.5)); else ctx.rect(X(L.x - pad), Y(L.y - pad), M(L.w + 2 * pad), M(L.h + 2 * pad));
    ctx.fill();
  }
  const hasInfo = o.name || o.phone;
  const titleH = L.h * (o.sub ? 0.24 : 0.3);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const title = (o.title || "").trim() || " ";
  let fs = fitFont(ctx, title, 800, M(L.w), M(titleH));
  ctx.font = `800 ${fs}px ${GEN_FONT}`; ctx.fillStyle = T.ink; ctx.fillText(title, X(L.x), Y(L.y + L.h * 0.03) + M(titleH) / 2);
  let yCur = L.y + L.h * 0.03 + titleH;
  if (o.sub) {
    const subH = L.h * 0.1;
    fs = fitFont(ctx, o.sub, 500, M(L.w), M(subH));
    ctx.font = `500 ${fs}px ${GEN_FONT}`; ctx.fillStyle = T.sub; ctx.fillText(o.sub, X(L.x), Y(yCur + L.h * 0.05) + M(subH) / 2);
    yCur += L.h * 0.17;
  }
  const labelMm = clamp(main.h * 0.065, 2.6, 6);
  const numMm = clamp(main.h * 0.1, 3.2, 11);
  const noteMm = clamp(main.h * 0.048, 2.3, 4);
  const lineNo = L.y + L.h - (o.note ? noteMm * 2.2 : 0);
  if (hasInfo) {
    const lineInfo = lineNo - Math.max(labelMm * 2.6, (lineNo - yCur) * 0.5);
    if (o.name && o.phone) { const half = (L.w - P * 0.6) / 2; labelLine("姓名", L.x, lineInfo, half, labelMm, T.sub, T.line); labelLine("電話", L.x + half + P * 0.6, lineInfo, half, labelMm, T.sub, T.line); }
    else labelLine(o.name ? "姓名" : "電話", L.x, lineInfo, L.w * 0.75, labelMm, T.sub, T.line);
  }
  const [n0, n1] = labelLine("No.", L.x, lineNo, Math.min(L.w * 0.6, L.w), labelMm, T.sub, T.line);
  const slots = { main: { x: (n0 + n1) / 2 / tw, y: (lineNo - numMm * 0.48) / th, pt: numMm / PT_MM, color: T.ink } };
  if (o.note) {
    ctx.font = `400 ${M(noteMm)}px ${GEN_FONT}`; ctx.fillStyle = T.sub; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    let note = o.note; while (note.length > 1 && ctx.measureText(note).width > M(L.w)) note = note.slice(0, -1);
    ctx.fillText(note, X(L.x), Y(L.y + L.h - noteMm * 0.4));
  }
  // 存根內容
  if (stub) {
    const sp = Math.min(stub.w, stub.h) * 0.13;
    const S0 = { x: stub.x + sp, y: stub.y + sp, w: stub.w - 2 * sp, h: stub.h - 2 * sp };
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = T.stubInk;
    if (!portrait) {
      const sLabel = clamp(stub.h * 0.065, 2.4, 5), sNum = clamp(Math.min(stub.h * 0.1, stub.w * 0.11), 3, 10);
      fs = fitFont(ctx, "存根", 700, M(S0.w), M(Math.min(S0.h * 0.2, 7)));
      ctx.font = `700 ${fs}px ${GEN_FONT}`; ctx.fillText("存根", X(S0.x), Y(S0.y) + fs / 2);
      const sNo = S0.y + S0.h * 0.94;
      if (hasInfo) labelLine(o.name ? "姓名" : "電話", S0.x, sNo - Math.max(sLabel * 2.8, S0.h * 0.33), S0.w, sLabel, T.stubInk, T.stubLine);
      const [s0, s1] = labelLine("No.", S0.x, sNo, S0.w, sLabel, T.stubInk, T.stubLine);
      slots.stub = { x: (s0 + s1) / 2 / tw, y: (sNo - sNum * 0.48) / th, pt: sNum / PT_MM, color: T.stubInk };
    } else {
      // 直式：上面一行「存根」，下面一行「姓名＿＿  No.＿＿」並排
      const sLabel = clamp(S0.h * 0.2, 2.6, 5.5), sNum = clamp(S0.h * 0.26, 3.2, 10);
      fs = fitFont(ctx, "存根", 700, M(S0.w), M(Math.min(S0.h * 0.32, 7)));
      ctx.font = `700 ${fs}px ${GEN_FONT}`; ctx.fillText("存根", X(S0.x), Y(S0.y) + fs / 2);
      const sNo = S0.y + S0.h * 0.95, gap = S0.w * 0.06;
      let nx = S0.x, nw = S0.w;
      if (hasInfo) { const half = (S0.w - gap) / 2; labelLine(o.name ? "姓名" : "電話", S0.x, sNo, half, sLabel, T.stubInk, T.stubLine); nx = S0.x + half + gap; nw = half; }
      const [s0, s1] = labelLine("No.", nx, sNo, nw, sLabel, T.stubInk, T.stubLine);
      slots.stub = { x: (s0 + s1) / 2 / tw, y: (sNo - sNum * 0.48) / th, pt: sNum / PT_MM, color: T.stubInk };
    }
  }
  return { canvas: c, slots };
}

// ---------- 對話框 ----------
const genIds = {
  genTitle: "title", genSub: "sub", genNote: "note", genTheme: "theme", genStub: "stub", genName: "name", genPhone: "phone",
  genAiPrompt: "aiPrompt", genAiProvider: "aiProvider", genAiModel: "aiModel", genPanel: "panel",
};
const genSrc = () => document.querySelector('input[name="genSrc"]:checked')?.value || "theme";

function readGenForm() {
  const o = {};
  Object.entries(genIds).forEach(([id, k]) => { const node = $(id); o[k] = node.type === "checkbox" ? node.checked : node.value.trim(); });
  o.src = genSrc();
  return o;
}

export function drawGenPreview() {
  const o = readGenForm(), { tw, th } = ticketSize();
  const box = $("genCanvas").parentElement;
  const maxW = Math.max(200, box.clientWidth - 28), maxH = 360;
  const dpr = window.devicePixelRatio || 1;
  const ppmCss = Math.min(maxW / tw, maxH / th);
  const { canvas, slots } = genBackground(o, tw, th, 0, ppmCss * dpr);
  const cv = $("genCanvas"); cv.width = canvas.width; cv.height = canvas.height;
  cv.style.width = canvas.width / dpr + "px"; cv.style.height = canvas.height / dpr + "px";
  const ctx = cv.getContext("2d"); ctx.drawImage(canvas, 0, 0);
  const sample = sampleNumber();
  Object.values(slots).forEach((sl) => {
    const r = renderField(defaultField({ x: sl.x, y: sl.y, size: sl.pt, color: sl.color, align: "center" }), sample, ppmCss * dpr);
    ctx.drawImage(r.canvas, sl.x * canvas.width + r.ox, sl.y * canvas.height + r.oy);
  });
  $("genStubText").textContent = th > tw * 1.1 ? "下面加存根（撕下來給主辦單位）" : "右邊加存根（撕下來給主辦單位）";
  $("genHint").textContent = `券的大小：${tw}×${th} mm（要改大小請先在左邊「券的大小」調整）。號碼會自動放在「No.」的線上。`;
}

export function openGenerator() {
  const G = app.S.gen;
  prepareAiForm(G.aiProvider || "gemini");
  Object.entries(genIds).forEach(([id, k]) => {
    const node = $(id);
    if (node.type === "checkbox") node.checked = !!G[k];
    else if (G[k]) node.value = G[k];
    else if (node.tagName !== "SELECT") node.value = "";
  });
  document.querySelectorAll('input[name="genSrc"]').forEach((r) => (r.checked = r.value === (G.src || "theme")));
  finishAiForm(); updateGenSrcUI();
  $("genDlg").showModal(); drawGenPreview();
}

export async function useGenerated() {
  const S = app.S;
  app.autoNote = null;
  const { tw, th } = ticketSize(), b = bleedMm();
  const { canvas, slots } = genBackground(S.gen, tw, th, b, 300 / 25.4);
  S.ticket.bgMode = b > 0 ? "included" : "extend";
  const notes = [];
  if (!isList()) {
    const isNum = (f) => f.type !== "qr" && String(f.tpl || "").includes("{n}");
    const targets = [slots.main, slots.stub].filter(Boolean);
    const numFields = S.fields.filter(isNum);
    targets.forEach((sl, i) => {
      let f = numFields[i];
      if (!f) { f = defaultField({ name: i ? "存根編號" : "編號" }); S.fields.push(f); }
      if (/^\s*(no\.?|#)?\s*\{n\}\s*$/i.test(f.tpl)) f.tpl = "{n}"; // 圖上已經有「No.」
      Object.assign(f, { x: sl.x, y: sl.y, size: +sl.pt.toFixed(1), color: sl.color, align: "center", rotate: 0, font: FONTS[0].v, bold: true, stroke: 0 });
    });
    // 多出來的編號欄位、和圖上重複的固定文字，移除（可按復原找回）
    const extra = numFields.slice(targets.length);
    const staticText = S.fields.filter((f) => f.type !== "qr" && !/\{[^{}]+\}/.test(f.tpl || ""));
    const drop = new Set([...extra, ...staticText]);
    if (drop.size) { S.fields = S.fields.filter((f) => !drop.has(f)); notes.push(`移除了 ${drop.size} 個和圖片重複的文字欄位（可按「復原」找回）`); }
    app.selId = S.fields[0]?.id ?? null;
  }
  await setBackground(canvas.toDataURL("image/jpeg", 0.93));
  setBgName("✨ 用「幫我做一張」產生的圖片");
  syncBindings(); refreshAll();
  setStatus(`已產生券的圖片，號碼也放好了。${notes.join("。")}`);
}

export function initGenerator() {
  Object.entries(THEMES).forEach(([k, t]) => $("genTheme").append(el("option", { value: k }, t.label)));
  Object.keys(genIds).forEach((id) => $(id).addEventListener("input", drawGenPreview));
  document.querySelectorAll('input[name="genSrc"]').forEach((r) => r.addEventListener("change", () => { updateGenSrcUI(); drawGenPreview(); }));
  $("btnGen").onclick = () => openGenerator();
  $("genCancel").onclick = () => $("genDlg").close();
  $("genUse").onclick = async () => {
    const o = readGenForm();
    if (o.src === "ai" && !genAi.img) { setAiStatus("err", "還沒有 AI 背景：請先按「產生背景」，或改用內建風格。"); return; }
    Object.assign(app.S.gen, o, { active: true });
    await useGenerated();
    $("genDlg").close();
  };
  initAi();
}
