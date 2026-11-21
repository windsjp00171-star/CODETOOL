// 編號、名單、防偽驗證碼、欄位文字。
import { CODE_CHARS } from "./constants.js";
import { clamp, num } from "./util.js";
import { app } from "./state.js";

// 「13, 100-105」→ [[13,13],[100,105]]
export function parseRanges(str) {
  const out = [];
  String(str || "").split(/[,，、;\s]+/).forEach((tok) => {
    if (!tok) return;
    const m = tok.match(/^(\d+)\s*[-~～]\s*(\d+)$/);
    if (m) { const a = +m[1], b = +m[2]; out.push([Math.min(a, b), Math.max(a, b)]); }
    else if (/^\d+$/.test(tok)) out.push([+tok, +tok]);
  });
  return out;
}

// ---------- 名單（從 Excel 貼上的 TSV 或 CSV） ----------
let listCache = { key: null, val: null };
export function parseList(text) {
  text = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (listCache.key === text) return listCache.val;
  const firstLine = text.split("\n", 1)[0] || "";
  const sep = firstLine.includes("\t") ? "\t" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (clean.shift() || []).map((h, i) => h.trim() || `欄${i + 1}`);
  const records = clean.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  const val = { headers, records };
  listCache = { key: text, val };
  return val;
}

const digits = () => clamp(Math.floor(num(app.S.num.digits, 1)), 1, 12);

let recCache = { key: null, map: null };
export function recordMap() {
  const S = app.S, d = digits(), s = Math.floor(num(S.num.start, 1));
  const key = `${S.data.list}|${d}|${s}`;
  if (recCache.key !== key) {
    const m = new Map();
    parseList(S.data.list).records.forEach((r, i) => m.set(String(s + i).padStart(d, "0"), r));
    recCache = { key, map: m };
  }
  return recCache.map;
}
export const isList = () => app.S.data.mode === "list";
export const recordFor = (n) => (isList() ? recordMap().get(n) : null);
// 名單模式下用來代表一個人的簡短文字（前兩欄）
export const recordLabel = (n) => { const r = recordFor(n); return r ? Object.values(r).filter(Boolean).slice(0, 2).join("・") : ""; };
export const outName = () => String(app.S.meta?.name || "票券").replace(/[\\/:*?"<>|]/g, "");
export const padNumber = (n) => String(parseInt(n, 10)).padStart(digits(), "0");

export function buildNumbers() {
  const S = app.S;
  if (isList()) {
    const { records } = parseList(S.data.list);
    if (!records.length) return { nums: [], err: "名單是空的：請貼上名單（第一列是欄位名稱）" };
    if (records.length > 100000) return { nums: [], err: "名單過長（上限 100,000 列）" };
    return { nums: [...recordMap().keys()], skipped: 0 };
  }
  const s = Math.floor(num(S.num.start, NaN)), e = Math.floor(num(S.num.end, NaN));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { nums: [], err: "請輸入起始與結束編號" };
  if (e < s) return { nums: [], err: "結束編號需大於或等於起始編號" };
  if (e - s > 100000) return { nums: [], err: "範圍過大（上限 100,000 張）" };
  const d = digits();
  const exD = [...new Set(String(S.num.exDigits || "").replace(/\D/g, ""))];
  const ranges = parseRanges(S.num.exList);
  const nums = [];
  for (let n = s; n <= e; n++) {
    const raw = String(n);
    if (exD.some((c) => raw.includes(c))) continue;
    if (ranges.some(([a, b]) => n >= a && n <= b)) continue;
    nums.push(raw.padStart(d, "0"));
  }
  return { nums, skipped: e - s + 1 - nums.length };
}

export function sampleNumber() {
  const { nums } = buildNumbers();
  return nums[0] ?? String(num(app.S.num.start, 1)).padStart(num(app.S.num.digits, 1), "0");
}

// ---------- 防偽驗證碼：由金鑰 + 編號（不含補零）算出，同一份範本永遠算出同一組 ----------
function hash32(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}
const codeCache = new Map();
export function codeFor(numStr) {
  const S = app.S;
  const n = String(parseInt(numStr, 10));
  const len = clamp(Math.floor(num(S.num.codeLen, 4)), 3, 8);
  const key = `${S.num.seed}|${len}|${n}`;
  let c = codeCache.get(key);
  if (!c) {
    c = "";
    for (let i = 0; i < len; i++) c += CODE_CHARS[hash32(`${S.num.seed}:${n}:${i}`) & 31];
    if (codeCache.size > 200000) codeCache.clear();
    codeCache.set(key, c);
  }
  return c;
}
export const usesCode = () => app.S.fields.some((f) => String(f.tpl || "").includes("{code}"));

export function fieldText(f, n) {
  let t = String(f.tpl ?? "{n}").split("{n}").join(n);
  if (t.includes("{code}")) t = t.split("{code}").join(codeFor(n));
  const rec = recordFor(n);
  if (rec) t = t.replace(/\{([^{}]+)\}/g, (m, k) => (k in rec ? rec[k] : m));
  return t;
}
