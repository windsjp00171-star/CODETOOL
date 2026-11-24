// 字型：Google Fonts 用到時才下載；畫到 canvas 前先確定字型（和要用到的字）都載好了。
import { FONTS } from "./constants.js";
import { app } from "./state.js";
import { fieldText, sampleNumber, buildNumbers } from "./numbers.js";

const cssLoaded = new Map(); // css 名稱 → Promise
function ensureCss(fontStack) {
  const f = FONTS.find((x) => x.v === fontStack);
  if (!f || !f.css) return Promise.resolve();
  if (!cssLoaded.has(f.css)) {
    cssLoaded.set(f.css, new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
      link.onload = link.onerror = () => resolve();
      document.head.appendChild(link);
    }));
  }
  return cssLoaded.get(f.css);
}

const done = new Set();
// entries：[{ font, bold, text }]。回傳 true 表示這次有新下載的字（畫面要重畫）。
export async function ensureFonts(entries) {
  if (!document.fonts || !document.fonts.load) return false;
  const jobs = new Map();
  for (const { font, bold, text } of entries) {
    if (!font || !text) continue;
    const k = `${bold ? 700 : 400}|${font}`;
    let set = jobs.get(k); if (!set) jobs.set(k, (set = new Set()));
    for (const ch of String(text)) set.add(ch);
  }
  let fresh = false;
  await Promise.all([...jobs].map(async ([k, chars]) => {
    const sig = k + "|" + [...chars].sort().join("");
    if (done.has(sig)) return;
    const i = k.indexOf("|"), w = k.slice(0, i), font = k.slice(i + 1);
    await ensureCss(font);
    try { await document.fonts.load(`${w} 24px ${font}`, [...chars].join("")); } catch (e) { /* 字型載不到就用替代字型 */ }
    done.add(sig); fresh = true;
  }));
  return fresh;
}

// 目前所有欄位會印出的字（最多看前 2000 張），供預覽與輸出前載入字型
export function fieldFontEntries(all) {
  const nums = all ? buildNumbers().nums.slice(0, 2000) : [sampleNumber()];
  const out = [];
  app.S.fields.forEach((f) => {
    if (f.type === "qr") return;
    let text = "";
    for (const n of nums) text += fieldText(f, n);
    out.push({ font: f.font, bold: f.bold, text });
  });
  return out;
}
export const ensureFieldFonts = (all) => ensureFonts(fieldFontEntries(all));
