// 名單表格：欄位固定（小組、姓名），點格子就能打字。
// 參考 tianfu-diary 後台「讀經計畫」表格的操作：Enter 換行（到底自動加一行）、↑↓ 移動、
// Ctrl+D 複製上一格、從 Excel 整塊貼上；新的一行自動沿用上一行的小組。
import { $, el } from "./util.js";
import { app } from "./state.js";
import { parseList, tableToTSV, namesToTable } from "./numbers.js";
import { refreshAll } from "./refresh.js";
import { ensureNameFields } from "./simple.js";

const COLS = ["小組", "姓名"];
let rows = [];          // { data: { 小組, 姓名, …其他欄 }, inputs: { 小組, 姓名 }, el }
let extra = [];         // 名單裡其他欄位（在完整設定裡貼的），保留不動
let committed = null;   // 上一次由表格寫出的名單；不同就代表外面改過，要重新載入
let timer = null;

const val = (r, c) => r.inputs[c].value.trim();
const body = () => $("ngBody");

function makeRow(data) {
  const r = { data: Object.assign({}, data), inputs: {}, groupAuto: false };
  r.el = el("div", { className: "ng-row" });
  COLS.forEach((c) => {
    const inp = el("input", { type: "text", autocomplete: "off", value: data[c] || "", placeholder: c === "姓名" ? "輸入名字" : "" });
    inp.dataset.col = c;
    inp.className = c === "姓名" ? "ng-name" : "ng-group";
    inp.addEventListener("input", () => onInput(r, c));
    r.inputs[c] = inp; r.el.append(inp);
  });
  r.del = el("button", { type: "button", className: "ng-del", title: "刪除這一行", onclick: () => removeRow(r) }, "×");
  r.el.append(r.del);
  return r;
}

function relabel() {
  rows.forEach((r, i) => {
    COLS.forEach((c) => r.inputs[c].setAttribute("aria-label", `${c}（第 ${i + 1} 行）`));
    r.del.setAttribute("aria-label", `刪除第 ${i + 1} 行`);
  });
}
const isEmpty = (r) => !val(r, "姓名") && !val(r, "小組");

// 最後一定留一行空白，打字就自動多一行
function ensureTrailingBlank() {
  const last = rows[rows.length - 1];
  if (!last || !isEmpty(last)) addRow({});
}
function addRow(data, before) {
  const r = makeRow(data);
  const i = before ? rows.indexOf(before) : rows.length;
  rows.splice(i, 0, r);
  if (before) body().insertBefore(r.el, before.el); else body().append(r.el);
  relabel();
  return r;
}
function removeRow(r) {
  const i = rows.indexOf(r);
  rows.splice(i, 1); r.el.remove();
  ensureTrailingBlank(); relabel(); scheduleCommit();
  const next = rows[Math.min(i, rows.length - 1)]; if (next) next.inputs["姓名"].focus();
}

function onInput(r, c) {
  // 開始打新的名字、小組還空著：自動沿用上一行的小組
  if (c === "姓名" && val(r, "姓名") && !val(r, "小組")) {
    const i = rows.indexOf(r), prev = rows[i - 1];
    if (prev && val(prev, "小組")) { r.inputs["小組"].value = val(prev, "小組"); r.groupAuto = true; }
  }
  if (c === "小組") r.groupAuto = false;
  ensureTrailingBlank();
  scheduleCommit();
}

function scheduleCommit() { clearTimeout(timer); timer = setTimeout(commit, 300); }
export function commit() {
  clearTimeout(timer);
  const S = app.S;
  const filled = rows.filter((r) => val(r, "姓名"));
  const grouped = filled.some((r) => val(r, "小組"));
  const headers = (grouped ? COLS : ["姓名"]).concat(extra);
  const out = filled.map((r) => headers.map((h) => (COLS.includes(h) ? val(r, h) : r.data[h] || "")));
  S.data.list = tableToTSV(headers, out);
  S.data.names = ""; S.data.mode = "list";
  committed = S.data.list;
  ensureNameFields(headers);
  refreshAll();
}

// 從名單載入表格（第一次顯示、或名單在別的地方被改過）
export function syncNameGrid() {
  if (app.S.data.list === committed && rows.length) return;
  const { headers, records } = parseList(app.S.data.list);
  extra = headers.filter((h) => !COLS.includes(h));
  rows = []; body().replaceChildren();
  records.forEach((rec) => addRow(rec));
  ensureTrailingBlank();
  committed = app.S.data.list;
}

function focusCell(r, c) { const inp = r.inputs[c]; inp.focus(); inp.select(); }

// 從 Excel／試算表貼上：Tab 分欄、換行分列；也看得懂「小組：名字、名字」
function onPaste(e) {
  const inp = e.target; if (inp.tagName !== "INPUT") return;
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!/[\t\n：:、,，]/.test(text.trim())) return; // 單格貼上，照瀏覽器預設
  e.preventDefault();
  const r0 = rows.find((r) => r.inputs[inp.dataset.col] === inp); if (!r0) return;
  let data;
  if (/[：:]/.test(text) || !/\t/.test(text)) {
    // 「小組：名字、名字」或一行一個名字／頓號分隔
    const t = namesToTable(text), ni = t.headers.indexOf("姓名"), gi = t.headers.indexOf("小組");
    data = t.rows.map((row) => ({ 小組: gi >= 0 ? row[gi] : "", 姓名: ni >= 0 ? row[ni] : row[row.length - 1] }));
    if (gi < 0 && inp.dataset.col === "小組") data = data.map((d) => ({ 小組: d.姓名, 姓名: "" }));
  } else {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const startCol = COLS.indexOf(inp.dataset.col);
    const head = /^(姓名|名字|小組|組別|name)$/i;
    if (lines.length && lines[0].split("\t").some((c) => head.test(c.trim()))) lines.shift(); // 標題列不要
    data = lines.map((l) => {
      const cells = l.split("\t").map((c) => c.trim());
      if (startCol === 1) return { 姓名: cells[0] || "" };
      return cells.length >= 2 ? { 小組: cells[0], 姓名: cells[1] } : { 小組: cells[0] || "" };
    });
  }
  let i = rows.indexOf(r0);
  data.forEach((d) => {
    const r = rows[i] || addRow({});
    if (d["小組"] !== undefined) r.inputs["小組"].value = d["小組"];
    if (d["姓名"] !== undefined) r.inputs["姓名"].value = d["姓名"];
    i++;
  });
  ensureTrailingBlank(); scheduleCommit();
}

function onKey(e) {
  const inp = e.target; if (inp.tagName !== "INPUT" || e.isComposing) return;
  const r = rows.find((x) => x.inputs[inp.dataset.col] === inp); if (!r) return;
  const c = inp.dataset.col, i = rows.indexOf(r), ci = COLS.indexOf(c);
  if (e.key === "Enter" || e.key === "ArrowDown") {
    e.preventDefault();
    if (e.key === "Enter" && e.shiftKey) { if (i > 0) focusCell(rows[i - 1], c); return; }
    const next = rows[i + 1] || (e.key === "Enter" ? addRow({}) : null);
    if (next) focusCell(next, c === "小組" && e.key === "Enter" ? "姓名" : c);
  } else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) focusCell(rows[i - 1], c); }
  else if (e.key === "ArrowLeft" && ci > 0 && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.preventDefault(); focusCell(r, COLS[ci - 1]); }
  else if (e.key === "ArrowRight" && ci < COLS.length - 1 && inp.selectionStart === inp.value.length) { e.preventDefault(); focusCell(r, COLS[ci + 1]); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
    e.preventDefault();
    if (i > 0) { inp.value = rows[i - 1].inputs[c].value; onInput(r, c); }
  }
}

export function initNameGrid() {
  body().addEventListener("keydown", onKey);
  body().addEventListener("paste", onPaste);
  $("ngClear").onclick = () => {
    if (rows.some((r) => !isEmpty(r)) && !confirm("清空整份名單？")) return;
    rows = []; body().replaceChildren(); ensureTrailingBlank(); commit();
    focusCell(rows[0], "姓名");
  };
}
