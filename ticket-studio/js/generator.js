// 幫我做一張：用文字＋風格（或 AI 背景）直接產生券的底圖，並把號碼放到「No.」線上。
import { FONTS, PT_MM, THEMES, SIZES } from "./constants.js";
import { $, clamp, num, el, setStatus, measureCtx } from "./util.js";
import { app, defaultField } from "./state.js";
import { bleedMm, ticketSize, autoLayout, bestLayout } from "./geometry.js";
import { isList, sampleNumber, parseList } from "./numbers.js";
import { renderField } from "./render.js";
import { setBackground, setBgName } from "./background.js";
import { syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { genAi, prepareAiForm, finishAiForm, updateGenSrcUI, setAiStatus, initAi } from "./ai.js";

const GEN_FONT = FONTS[0].v;

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 名單券的範例名單（使用者還沒匯入名單時用）
const SAMPLE_LIST = "小組\t姓名\n腓立比小組\t進發\n腓立比小組\t建志\n毘努伊勒小組\t淑閔\n加利利小組\t阿蘭\n伯特利小組\t惠子\n多加小組\t淑如";

// 版型：沒設定過時，依舊設定推算
export function genLayout(o) {
  if (o.layout === "stub" || o.layout === "single" || o.layout === "list") return o.layout;
  if (isList()) return "list";
  return o.stub === false ? "single" : "stub";
}

// 量文字寬度（mm）
function textMm(text, sizeMm, bold) {
  measureCtx.font = `${bold ? 700 : 400} 100px ${GEN_FONT}`;
  return (measureCtx.measureText(text || " ").width / 100) * sizeMm;
}
// 放得進 maxW×maxH（mm）的最大字級（mm）
function fitMm(text, bold, maxW, maxH) {
  const w = textMm(text, maxH, bold);
  return w > maxW ? Math.max(1.5, maxH * (maxW / w)) : maxH;
}
// 名單裡「名字」那一欄：欄名有姓名／名字就用它，否則用最後一欄
function nameColumn(headers) {
  return headers.find((h) => /姓名|名字|名稱|name/i.test(h)) || headers[headers.length - 1];
}

// o：gen 設定。圖片只畫背景、花紋、存根底色、撕線、外框；
// 標題、填寫欄、No. 線、存根上的字都回傳成「欄位」（items），之後可以拖動、改字。
// slots：號碼要放的位置。所有位置都是成品比例 0~1，字級為 pt。
function genBackground(o, tw, th, b, ppm) {
  let T = THEMES[o.theme] || THEMES.red;
  const layout = genLayout(o);
  const W = Math.round((tw + 2 * b) * ppm), H = Math.round((th + 2 * b) * ppm);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const aiImg = genAi.img;
  const useAi = o.src === "ai" && !!aiImg;
  const X = (mm) => (b + mm) * ppm, Y = (mm) => (b + mm) * ppm, M = (mm) => mm * ppm;
  const portrait = th > tw * 1.1;
  const main = { x: 0, y: 0, w: tw, h: th }; let stub = null;
  if (layout === "stub") {
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
      ? { ink: "#ffffff", sub: "#f8fafc", line: "#ffffff", stubBg: "rgba(255,255,255,.9)", stubInk: "#111827", stubLine: "#374151", pattern: "none", panel: "rgba(15,23,42,.42)" }
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
  // 主券區的留白
  const P = Math.min(main.w, main.h) * 0.11;
  const L = { x: main.x + P, y: main.y + P * 0.95, w: main.w - 2 * P, h: main.h - 2 * P };
  if (useAi && o.panel) {
    const pad = P * 0.45;
    ctx.fillStyle = T.panel; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X(L.x - pad), Y(L.y - pad), M(L.w + 2 * pad), M(L.h + 2 * pad), M(2.5)); else ctx.rect(X(L.x - pad), Y(L.y - pad), M(L.w + 2 * pad), M(L.h + 2 * pad));
    ctx.fill();
  }

  // ---------- 欄位（可拖動、可改字） ----------
  const items = [], slots = {};
  const fx = (mm) => mm / tw, fy = (mm) => mm / th, pt = (mm) => +(mm / PT_MM).toFixed(1);
  const text = (name, tpl, xMm, yMm, sizeMm, color, opt = {}) =>
    items.push(Object.assign({ name, tpl, x: fx(xMm), y: fy(yMm), size: pt(sizeMm), color, align: "left", bold: false }, opt));
  // 填寫欄：label 在 x、底線在 yLine；回傳底線起訖（mm）
  const blank = (name, label, x, yLine, w, sizeMm, color) => {
    const lw = textMm(label, sizeMm, false) + (label ? sizeMm * 0.3 : 0);
    items.push({ name, type: "blank", tpl: label, x: fx(x), y: fy(yLine - sizeMm * 0.45), size: pt(sizeMm), color, align: "left", bold: false,
      lineLen: +Math.max(4, w - lw).toFixed(1), lineW: +Math.max(0.25, sizeMm * 0.07).toFixed(2) });
    return [x + lw, x + w];
  };
  const numSlot = (key, a, z, yLine, sizeMm, color) => { slots[key] = { x: fx((a + z) / 2), y: fy(yLine - sizeMm * 0.48), pt: pt(sizeMm), color }; };
  const hasInfo = o.name || o.phone, withNum = o.number !== false;

  if (layout === "list") {
    // 名單券：標題置中、其他欄位小字、名字放大置中、角落小小的號碼（抽獎登記用）
    const { headers, records } = parseList(app.S.data.list || SAMPLE_LIST);
    const big = nameColumn(headers), others = headers.filter((h) => h !== big);
    const title = (o.title || "").trim();
    let y = L.y;
    if (title) {
      const tMm = fitMm(title, true, L.w, Math.min(L.h * 0.16, 7));
      text("標題", title, main.x + main.w / 2, y + tMm * 0.6, tMm, T.ink, { align: "center", bold: true });
      y += tMm * 1.35;
    }
    if (o.sub) { const sMm = fitMm(o.sub, false, L.w, Math.min(L.h * 0.09, 4)); text("日期地點", o.sub, main.x + main.w / 2, y + sMm * 0.6, sMm, T.sub, { align: "center" }); y += sMm * 1.4; }
    const smallMm = clamp(main.h * 0.075, 2.6, 5);
    others.slice(0, 3).forEach((h) => { text(h, `{${h}}`, L.x, y + smallMm * 0.7, smallMm, T.sub); y += smallMm * 1.45; });
    const longest = records.reduce((m, r) => (String(r[big] || "").length > m.length ? String(r[big]) : m), "") || "王小明";
    const noteMm = o.note ? clamp(main.h * 0.048, 2.3, 4) : 0;
    const bottom = L.y + L.h - (noteMm ? noteMm * 1.6 : 0);
    const bigMm = fitMm(longest, true, L.w, Math.max(4, (bottom - y) * 0.85));
    text("名字", `{${big}}`, main.x + main.w / 2, (y + bottom) / 2, bigMm, T.ink, { align: "center", bold: true });
    if (o.note) text("備註", o.note, L.x, L.y + L.h - noteMm * 0.4, noteMm, T.sub);
    if (withNum) {
      const nMm = clamp(th * 0.05, 2.2, 3.6);
      text("編號", "{n}", main.x + main.w - P * 0.5, main.y + main.h - P * 0.45, nMm, T.sub, { align: "right" });
    }
    return { canvas: c, items, slots, layout };
  }

  // 主券：標題、日期地點、姓名／電話、No.、備註
  const titleH = L.h * (o.sub ? 0.24 : 0.3);
  const title = (o.title || "").trim();
  if (title) { const tMm = fitMm(title, true, L.w, titleH); text("標題", title, L.x, L.y + L.h * 0.03 + titleH / 2, tMm, T.ink, { bold: true }); }
  let yCur = L.y + L.h * 0.03 + titleH;
  if (o.sub) {
    const subH = L.h * 0.1, sMm = fitMm(o.sub, false, L.w, subH);
    text("日期地點", o.sub, L.x, yCur + L.h * 0.05 + subH / 2, sMm, T.sub);
    yCur += L.h * 0.17;
  }
  const labelMm = clamp(main.h * 0.065, 2.6, 6);
  const numMm = clamp(main.h * 0.1, 3.2, 11);
  const noteMm = clamp(main.h * 0.048, 2.3, 4);
  const lineNo = L.y + L.h - (o.note ? noteMm * 2.2 : 0);
  if (hasInfo) {
    // 沒有 No. 線時，姓名／電話往下放到 No. 線的位置
    const lineInfo = withNum ? lineNo - Math.max(labelMm * 2.6, (lineNo - yCur) * 0.5) : lineNo;
    if (o.name && o.phone) { const half = (L.w - P * 0.6) / 2; blank("姓名欄", "姓名", L.x, lineInfo, half, labelMm, T.sub); blank("電話欄", "電話", L.x + half + P * 0.6, lineInfo, half, labelMm, T.sub); }
    else blank(o.name ? "姓名欄" : "電話欄", o.name ? "姓名" : "電話", L.x, lineInfo, L.w * 0.75, labelMm, T.sub);
  }
  if (withNum) {
    const [n0, n1] = blank("No. 線", "No.", L.x, lineNo, L.w * 0.6, labelMm, T.sub);
    numSlot("main", n0, n1, lineNo, numMm, T.ink);
  }
  if (o.note) {
    let note = o.note; while (note.length > 1 && textMm(note, noteMm, false) > L.w) note = note.slice(0, -1);
    text("備註", note, L.x, L.y + L.h - noteMm * 0.4, noteMm, T.sub);
  }
  // 存根
  if (stub) {
    const stubTitle = (o.stubTitle || "").trim() || "存根";
    const sp = Math.min(stub.w, stub.h) * 0.13;
    const S0 = { x: stub.x + sp, y: stub.y + sp, w: stub.w - 2 * sp, h: stub.h - 2 * sp };
    if (!portrait) {
      const sLabel = clamp(stub.h * 0.065, 2.4, 5), sNum = clamp(Math.min(stub.h * 0.1, stub.w * 0.11), 3, 10);
      const tMm = fitMm(stubTitle, true, S0.w, Math.min(S0.h * 0.2, 7));
      text("存根標題", stubTitle, S0.x, S0.y + tMm / 2, tMm, T.stubInk, { bold: true });
      const sNo = S0.y + S0.h * 0.94;
      if (hasInfo) blank("存根" + (o.name ? "姓名欄" : "電話欄"), o.name ? "姓名" : "電話", S0.x, withNum ? sNo - Math.max(sLabel * 2.8, S0.h * 0.33) : sNo, S0.w, sLabel, T.stubInk);
      if (withNum) {
        const [s0, s1] = blank("存根 No. 線", "No.", S0.x, sNo, S0.w, sLabel, T.stubInk);
        numSlot("stub", s0, s1, sNo, sNum, T.stubInk);
      }
    } else {
      const sLabel = clamp(S0.h * 0.2, 2.6, 5.5), sNum = clamp(S0.h * 0.26, 3.2, 10);
      const tMm = fitMm(stubTitle, true, S0.w, Math.min(S0.h * 0.32, 7));
      text("存根標題", stubTitle, S0.x, S0.y + tMm / 2, tMm, T.stubInk, { bold: true });
      const sNo = S0.y + S0.h * 0.95, gap = S0.w * 0.06;
      let nx = S0.x, nw = S0.w;
      if (hasInfo) { const half = withNum ? (S0.w - gap) / 2 : S0.w; blank("存根" + (o.name ? "姓名欄" : "電話欄"), o.name ? "姓名" : "電話", S0.x, sNo, half, sLabel, T.stubInk); nx = S0.x + half + gap; nw = half; }
      if (withNum) {
        const [s0, s1] = blank("存根 No. 線", "No.", nx, sNo, nw, sLabel, T.stubInk);
        numSlot("stub", s0, s1, sNo, sNum, T.stubInk);
      }
    }
  }
  return { canvas: c, items, slots, layout };
}

// ---------- 對話框 ----------
const genIds = {
  genTitle: "title", genSub: "sub", genNote: "note", genTheme: "theme", genName: "name", genPhone: "phone",
  genLayout: "layout", genStubTitle: "stubTitle", genNumber: "number",
  genAiPrompt: "aiPrompt", genAiProvider: "aiProvider", genAiModel: "aiModel", genPanel: "panel",
};
const genSrc = () => document.querySelector('input[name="genSrc"]:checked')?.value || "theme";

function readGenForm() {
  const o = {};
  Object.entries(genIds).forEach(([id, k]) => { const node = $(id); o[k] = node.type === "checkbox" ? node.checked : node.value.trim(); });
  o.src = genSrc();
  o.stub = o.layout === "stub";
  return o;
}

// 把欄位規格變成真正的欄位（加上 gen 標記，重新產生時會被換掉）
const toFields = (items) => items.map((it) => Object.assign(defaultField({ font: GEN_FONT }), it, { gen: true }));

function syncGenSizeUI() {
  const { tw, th } = ticketSize();
  $("genW").value = +tw.toFixed(1); $("genH").value = +th.toFixed(1);
  const i = SIZES.findIndex(([, w, h]) => Math.abs(w - tw) < 0.05 && Math.abs(h - th) < 0.05);
  $("genSize").value = i >= 0 ? String(i) : "";
  const best = bestLayout("save");
  $("genFitHint").textContent = best ? `這個大小在 ${app.S.layout.paper} 紙上一頁可以放 ${best.n} 張。` : `這個大小比 ${app.S.layout.paper} 紙還大，會縮小列印。`;
}
function setGenSize(w, h) {
  const S = app.S;
  S.ticket.w = clamp(num(w, S.ticket.w), 20, 600); S.ticket.h = clamp(num(h, S.ticket.h), 20, 600);
  autoLayout(); syncBindings(); refreshAll(); syncGenSizeUI(); drawGenPreview();
}

export function drawGenPreview() {
  const o = readGenForm(), { tw, th } = ticketSize(), layout = genLayout(o);
  $("genStubTitleRow").hidden = layout !== "stub";
  $("genName").parentElement.hidden = $("genPhone").parentElement.hidden = layout === "list";
  const box = $("genCanvas").parentElement;
  const maxW = Math.max(200, box.clientWidth - 28), maxH = 360;
  const dpr = window.devicePixelRatio || 1;
  const ppmCss = Math.min(maxW / tw, maxH / th);
  const { canvas, items, slots } = genBackground(o, tw, th, 0, ppmCss * dpr);
  const cv = $("genCanvas"); cv.width = canvas.width; cv.height = canvas.height;
  cv.style.width = canvas.width / dpr + "px"; cv.style.height = canvas.height / dpr + "px";
  const ctx = cv.getContext("2d"); ctx.drawImage(canvas, 0, 0);
  const sample = sampleNumber();
  // 名單券預覽：還沒有名單時用範例名單的第一個人
  const rec = layout === "list" ? (parseList(app.S.data.list || SAMPLE_LIST).records[0] || {}) : {};
  const fill = (tpl) => String(tpl).replace(/\{n\}/g, sample).replace(/\{([^{}]+)\}/g, (m, k) => (k in rec ? rec[k] : m));
  const draw = (f, t) => { const r = renderField(f, t, ppmCss * dpr); ctx.drawImage(r.canvas, f.x * canvas.width + r.ox, f.y * canvas.height + r.oy); };
  toFields(items).forEach((f) => draw(f, fill(f.tpl)));
  Object.values(slots).forEach((sl) => draw(defaultField({ x: sl.x, y: sl.y, size: sl.pt, color: sl.color, align: "center" }), sample));
  $("genHint").textContent = layout === "list"
    ? (isList() ? `每個人一張（共 ${parseList(app.S.data.list).records.length} 人），名字會放大。右下角的小號碼是抽獎登記用的。` : "名單券要用名單：按「使用這張圖」後會先放入範例名單，再到左邊第 2 步貼上你的名單。")
    : o.number === false ? "這張券不印號碼。抽獎當天就不能用「抽獎紀錄」核對號碼。" : "號碼會自動放在「No.」的線上。";
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
  $("genLayout").value = genLayout(G);
  $("genNumber").checked = G.number !== false;
  if (!$("genStubTitle").value) $("genStubTitle").value = "存根";
  document.querySelectorAll('input[name="genSrc"]').forEach((r) => (r.checked = r.value === (G.src || "theme")));
  finishAiForm(); updateGenSrcUI(); syncGenSizeUI();
  $("genDlg").showModal(); drawGenPreview();
}

export async function useGenerated() {
  const S = app.S;
  app.autoNote = null;
  const layout = genLayout(S.gen);
  const notes = [];
  if (layout === "list" && !isList()) {
    S.data.mode = "list";
    if (!String(S.data.list || "").trim()) { S.data.list = SAMPLE_LIST; notes.push("先放入範例名單，請到第 2 步換成你的名單"); }
  }
  const { tw, th } = ticketSize(), b = bleedMm();
  const { canvas, items, slots } = genBackground(S.gen, tw, th, b, 300 / 25.4);
  S.ticket.bgMode = b > 0 ? "included" : "extend";
  // 換掉上一次產生的欄位、以及和圖上重複的範本文字；使用者自己加的欄位保留
  const isNum = (f) => f.type !== "qr" && String(f.tpl || "").includes("{n}") && !f.gen;
  const removed = S.fields.filter((f) => f.gen || (f.fromPreset && f.type !== "qr" && !/\{[^{}]+\}/.test(f.tpl || "")));
  let fields = S.fields.filter((f) => !removed.includes(f));
  const targets = [slots.main, slots.stub].filter(Boolean);
  if (layout === "list" || S.gen.number === false) {
    // 名單券用自己的欄位（名字、小組、角落號碼）；不印號碼時也一樣，原本的號碼欄位拿掉
    const dropNum = fields.filter((f) => isNum(f) || (f.fromPreset && f.type !== "qr"));
    fields = fields.filter((f) => !dropNum.includes(f));
  } else {
    const numFields = fields.filter(isNum);
    targets.forEach((sl, i) => {
      let f = numFields[i];
      if (!f) { f = defaultField({ name: i ? "存根編號" : "編號" }); fields.push(f); }
      if (/^\s*(no\.?|#)?\s*\{n\}\s*$/i.test(f.tpl)) f.tpl = "{n}"; // 圖上已經有「No.」
      Object.assign(f, { x: sl.x, y: sl.y, size: sl.pt, color: sl.color, align: "center", rotate: 0, font: GEN_FONT, bold: true, stroke: 0 });
    });
    numFields.slice(targets.length).forEach((f) => { fields = fields.filter((x) => x !== f); });
  }
  const genFields = toFields(items);
  S.fields = [...genFields, ...fields];
  app.selId = null;
  await setBackground(canvas.toDataURL("image/jpeg", 0.93));
  setBgName("✨ 用「幫我做一張」產生的圖片");
  syncBindings(); refreshAll();
  setStatus(`已產生券的圖片，文字和號碼都放好了。在預覽上點文字可以改字、拖動位置。${notes.length ? notes.join("。") + "。" : ""}`);
}

export function initGenerator() {
  Object.entries(THEMES).forEach(([k, t]) => $("genTheme").append(el("option", { value: k }, t.label)));
  $("genSize").append(el("option", { value: "" }, "自訂大小（在下面輸入）"), ...SIZES.map(([n, w, h], i) => el("option", { value: String(i) }, `${n}　${w}×${h} mm`)));
  $("genSize").onchange = () => { const v = $("genSize").value; if (v !== "") { const [, w, h] = SIZES[+v]; setGenSize(w, h); } };
  $("genW").addEventListener("change", () => setGenSize($("genW").value, $("genH").value));
  $("genH").addEventListener("change", () => setGenSize($("genW").value, $("genH").value));
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
