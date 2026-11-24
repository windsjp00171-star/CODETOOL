// 印券設計的資料：預設值、目前狀態、復原／重做、存到瀏覽器。
import { FONTS, LS } from "./constants.js";
import { $, num, randomId, ls } from "./util.js";
import { syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { setBackground, setBgName } from "./background.js";

export const fieldId = () => randomId("f", 6);

export const defaultField = (o) => Object.assign({
  id: fieldId(), name: "欄位", tpl: "{n}",
  x: 0.5, y: 0.5, size: 16, font: FONTS[0].v, bold: true, color: "#1f2937",
  stroke: 0, strokeColor: "#ffffff", align: "center", rotate: 0,
  type: "text", qrSize: 15, qrQuiet: true,
  lineLen: 40, lineW: 0.3, // 填寫欄：底線長度、粗細（mm）
}, o);

export const newSeed = () => {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const defaultState = () => ({
  ticket: { w: 215.9, h: 69.5, bleed: 0, bgMode: "extend", printMode: "home", bgFit: "cover" }, // bgFit：cover 填滿裁切／contain 整張放進去／stretch 拉伸
  num: { start: 1, end: 250, digits: 6, exDigits: "", exList: "", codeLen: 4, seed: newSeed() },
  fields: [
    defaultField({ id: "f1", name: "左編號", x: 0.28, y: 0.81, color: "#1f2937" }),
    defaultField({ id: "f2", name: "右編號", x: 0.92, y: 0.88, color: "#ffffff" }),
  ],
  layout: { paper: "A4", orient: "portrait", cols: 1, rows: 4, margin: 5, gap: 0, stackCut: true, cutMarks: true, cutLines: true, fit: "save" },
  out: { dpi: 200, noBg: false },
  meta: { name: "摸彩券", preset: "lottery" },
  data: { mode: "seq", list: "", names: "" }, // names：簡易模式裡照平常習慣打的名單（會轉成 list）
  gen: { title: "年終尾牙摸彩", sub: "", note: "", theme: "red", stub: true, name: true, phone: false, active: false,
         layout: "", stubTitle: "存根", number: true,
         src: "theme", aiPrompt: "", aiProvider: "gemini", aiModel: "", panel: true },
});

// 整個程式共用的可變狀態。S 是會存檔的設定，其餘是畫面狀態。
export const app = {
  S: defaultState(),
  bgDataURL: null, bgImg: null,
  bgBorder: null,     // 偵測到的白邊（像素）
  autoNote: null,     // 上傳後自動調整的說明 { text, undo }
  selId: null, page: 0, busy: false,
  simpleUI: true,
};

export const selectedField = () => app.S.fields.find((f) => f.id === app.selId);

export function mergeState(src) {
  const d = defaultState();
  if (!src || typeof src !== "object") return d;
  for (const k of ["ticket", "num", "layout", "out", "meta", "data", "gen"]) d[k] = Object.assign(d[k], src[k] || {});
  if (Array.isArray(src.fields)) d.fields = src.fields.map((f) => defaultField(f));
  if (!src.ticket || !src.ticket.printMode) d.ticket.printMode = num(d.ticket.bleed, 0) > 0 ? "custom" : "home"; // 舊版設定
  return d;
}

export const getPath = (p) => p.split(".").reduce((o, k) => o?.[k], app.S);
export const setPath = (p, v) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((o, k) => o[k], app.S)[last] = v; };

// ---------- 復原／重做：每次設定穩定下來（300ms 沒再變動）就記一個快照 ----------
let history = [], hIndex = -1;
export const historyIndex = () => hIndex;

function pushHistory() {
  const snap = JSON.stringify(app.S);
  if (snap === history[hIndex]) return;
  history = history.slice(0, hIndex + 1); history.push(snap);
  if (history.length > 100) history.shift();
  hIndex = history.length - 1; updateUndoBtns();
}
export function updateUndoBtns() { $("btnUndo").disabled = hIndex <= 0; $("btnRedo").disabled = hIndex >= history.length - 1; }
function restoreHistory(i) {
  if (i < 0 || i >= history.length) return;
  hIndex = i; app.S = mergeState(JSON.parse(history[i]));
  if (!app.S.fields.some((f) => f.id === app.selId)) app.selId = app.S.fields[0]?.id ?? null;
  syncBindings(); refreshAll(); updateUndoBtns();
}
export const undo = () => restoreHistory(hIndex - 1);
export const redo = () => restoreHistory(hIndex + 1);

// ---------- 存到瀏覽器 ----------
let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushHistory();
    ls.set(LS.state, JSON.stringify(app.S));
    if (app.bgDataURL) ls.set(LS.bg, app.bgDataURL); else ls.del(LS.bg); // 圖太大就不存
  }, 300);
}
export function loadSaved() {
  try { const s = ls.get(LS.state); if (s) app.S = mergeState(JSON.parse(s)); } catch (e) { /* 壞掉的設定就用預設 */ }
  const b = ls.get(LS.bg);
  if (b) setBackground(b).then(() => setBgName(null));
}
