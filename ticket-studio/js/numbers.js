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

// ---------- 照平常習慣打的名單 → 表格 ----------
// 支援：「小組：名字、名字」、一行一個名字、從 Excel 貼上的一欄或兩欄（小組、姓名）
// 標題列：整格剛好是這些字才算（「腓立比小組」不是標題）
const HEAD_RE = /^(姓名|名字|名稱|小組|組別|組名|單位|部門|班級|name|group)$/i;
// 常見的欄名統一成「姓名」「小組」，券上的 {姓名}、{小組} 才對得上
const canonHead = (h) => /^(姓名|名字|名稱|name)$/i.test(h) ? "姓名" : /^(小組|組別|組名|單位|部門|班級|group)$/i.test(h) ? "小組" : h;
export function namesToTable(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = []; let headers = null, grouped = false;
  lines.forEach((line, i) => {
    if (line.includes("\t")) {
      const cells = line.split("\t").map((c) => c.trim());
      if (i === 0 && cells.some((c) => HEAD_RE.test(c))) { headers = cells.map((h, k) => canonHead(h) || `欄${k + 1}`); return; }
      if (cells.length >= 2) grouped = true;
      rows.push(cells);
      return;
    }
    const m = line.match(/^([^：:]+)[：:](.*)$/);
    if (m) {
      grouped = true;
      m[2].split(/[、,，;；\s]+/).filter(Boolean).forEach((n) => rows.push([m[1].trim(), n]));
      return;
    }
    line.split(/[、,，;；]+/).map((n) => n.trim()).filter(Boolean).forEach((n) => rows.push(["", n]));
  });
  if (!headers) {
    const width = Math.max(1, ...rows.map((r) => r.length));
    headers = width <= 2 ? (grouped ? ["小組", "姓名"] : ["姓名"]) : [...Array(width - 2).keys()].map((k) => `欄${k + 1}`).concat(["小組", "姓名"]);
  }
  // 一行一個名字的列是 ["", 名字]；只有一欄（姓名）時只留名字
  const fixed = rows.map((r) => {
    if (headers.length === 1) return [r[r.length - 1]];
    if (r.length === 2 && headers.length > 2) return [...Array(headers.length - 2).fill(""), ...r];
    return r;
  });
  return { headers, rows: fixed };
}
const cleanCell = (v) => String(v ?? "").replace(/[\t\n]+/g, " ").trim();
export const tableToTSV = (headers, rows) => [headers, ...rows].map((r) => headers.map((_, i) => cleanCell(r[i])).join("\t")).join("\n");
// 表格 → 平常的寫法（有「小組、姓名」時寫成「小組：名字、名字」）
export function tableToNames(list) {
  const { headers, records } = parseList(list);
  if (!records.length) return "";
  const nameKey = headers.find((h) => /姓名|名字|name/i.test(h)) || headers[headers.length - 1];
  const groupKey = headers.find((h) => /小組|組別|單位|部門|班級/.test(h));
  if (!groupKey) return records.map((r) => r[nameKey]).join("\n");
  const out = []; let cur = null;
  records.forEach((r) => {
    const g = r[groupKey] || "";
    if (!cur || cur.g !== g) { cur = { g, names: [] }; out.push(cur); }
    cur.names.push(r[nameKey]);
  });
  return out.map((x) => (x.g ? `${x.g}：${x.names.join("、")}` : x.names.join("\n"))).join("\n");
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
