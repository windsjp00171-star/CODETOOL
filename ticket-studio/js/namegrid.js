// 名單表格：像 Excel 一樣點格子就能打字（操作參考 tianfu-diary 後台的讀經計畫表格）。
// 欄位不寫死：預設只有一欄，可以自己加欄、改欄名、刪欄；勾「印」的欄位會放到券上。
// 鍵盤：Enter／↓ 下一行（到底自動加一行）、↑ 上一行、←→ 換欄、Ctrl+D 複製上一格。
// 沿用上一行：在某一格打字時，同一行左邊空著的格子自動帶入上一行的內容；
// 右邊的格子要上面兩行一樣才帶入（例如分組），避免把電話之類每人不同的資料抄下來。
import { $, el } from "./util.js";
import { app, defaultField } from "./state.js";
import { parseList, tableToTSV, mainColumn } from "./numbers.js";
import { refreshAll } from "./refresh.js";
import { autoContrast } from "./background.js";

let headers = [];        // 欄名
let rows = [];           // 每行：字串陣列，和 headers 對齊
let committed = null;    // 上一次由表格寫出的名單；不同就代表外面改過，要重新載入
let timer = null;

const body = () => $("ngBody");
const head = () => $("ngHead");
const filled = (r) => r.some((v) => String(v || "").trim());
const placeholderUsed = (h) => app.S.fields.some((f) => String(f.tpl || "").includes(`{${h}}`));

function uniqueName(base) {
  let n = base, i = 2;
  while (headers.includes(n)) n = base + i++;
  return n;
}

// ---------- 券上的欄位：勾「印」就放上去 ----------
function addAutoField(h) {
  const S = app.S, th = Number(S.ticket.h) || 50;
  const isMain = h === mainColumn(headers);
  if (isMain) {
    S.fields.push(defaultField({ name: h, tpl: `{${h}}`, x: 0.5, y: 0.58, size: +Math.min(60, (th * 0.3) / 0.3528).toFixed(1), align: "center", autoCol: h }));
  } else {
    // 其他欄位：小字，從左上往下排，避開已經放好的
    const taken = S.fields.filter((f) => f.autoCol && f.x < 0.2).map((f) => f.y);
    let y = 0.16; while (taken.some((t) => Math.abs(t - y) < 0.06) && y < 0.9) y += 0.1;
    S.fields.push(defaultField({ name: h, tpl: `{${h}}`, x: 0.06, y, size: +Math.max(8, Math.min(16, (th * 0.07) / 0.3528)).toFixed(1), align: "left", bold: false, color: "#374151", autoCol: h }));
  }
  autoContrast();
}
function removeFieldsFor(h) {
  const S = app.S, tag = `{${h}}`;
  // 整個欄位就是這一欄的（例如 {電話}）直接拿掉；混在其他文字裡的只拿掉代碼
  S.fields = S.fields.filter((f) => String(f.tpl || "").trim() !== tag);
  S.fields.forEach((f) => { if (String(f.tpl || "").includes(tag)) f.tpl = f.tpl.split(tag).join(""); });
}
function renameInFields(oldH, newH) {
  app.S.fields.forEach((f) => {
    if (String(f.tpl || "").includes(`{${oldH}}`)) f.tpl = f.tpl.split(`{${oldH}}`).join(`{${newH}}`);
    if (f.autoCol === oldH) { f.autoCol = newH; f.name = newH; }
  });
}

// ---------- 畫表格 ----------
// 欄位多到放不下時才左右捲動
const minW = () => `calc(${headers.length} * 5.2em + 28px + ${headers.length * 4 + 12}px)`;
function gridCols() { return `repeat(${headers.length}, minmax(5.2em, 1fr)) 28px`; }

function renderHead() {
  const cells = headers.map((h, c) => {
    const name = el("input", { type: "text", className: "ng-hname", value: h, title: "點這裡改欄名" });
    name.setAttribute("aria-label", `第 ${c + 1} 欄的名字`);
    name.dataset.hcol = String(c);
    name.addEventListener("change", () => renameCol(c, name.value));
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
    const pr = el("input", { type: "checkbox", checked: placeholderUsed(h) });
    pr.addEventListener("change", () => togglePrint(h, pr.checked));
    const print = el("label", { className: "ng-print", title: "勾起來：這一欄會印在券上" }, pr, "印");
    const del = headers.length > 1 ? el("button", { type: "button", className: "ng-del", title: `刪除「${h}」這一欄`, onclick: () => removeCol(c) }, "×") : null;
    return el("div", { className: "ng-hcell" }, name, el("div", { className: "ng-hctl" }, print, del));
  });
  const add = el("button", { type: "button", className: "ng-addcol", title: "加一欄", onclick: () => addCol() }, "＋欄");
  head().replaceChildren(...cells, add);
  head().style.gridTemplateColumns = gridCols(); head().style.minWidth = minW();
}

function renderBody() {
  body().replaceChildren(...rows.map((r, i) => rowEl(r, i)));
}
function rowEl(r, i) {
  const node = el("div", { className: "ng-row" });
  node.style.gridTemplateColumns = gridCols(); node.style.minWidth = minW();
  headers.forEach((h, c) => {
    const inp = el("input", { type: "text", autocomplete: "off", value: r[c] || "", placeholder: i === rows.length - 1 && c === 0 ? "輸入…" : "" });
    inp.dataset.row = String(i); inp.dataset.col = String(c);
    inp.setAttribute("aria-label", `${h}（第 ${i + 1} 行）`);
    inp.addEventListener("input", () => onInput(+inp.dataset.row, c, inp.value));
    node.append(inp);
  });
  node.append(el("button", { type: "button", className: "ng-del", title: "刪除這一行", onclick: () => removeRow(i) }, "×"));
  return node;
}
function render() { renderHead(); renderBody(); }
const cellInput = (i, c) => body().querySelector(`input[data-row="${i}"][data-col="${c}"]`);
function focusCell(i, c) { const inp = cellInput(i, c); if (inp) { inp.focus(); inp.select(); } }

// 最後一定留一行空白，打字就自動多一行
function ensureTrailingBlank() {
  if (!rows.length || filled(rows[rows.length - 1])) { rows.push(headers.map(() => "")); return true; }
  return false;
}

// ---------- 編輯 ----------
function onInput(i, c, v) {
  const r = rows[i], wasEmpty = !filled(r);
  r[c] = v;
  if (wasEmpty && String(v).trim() && i > 0) {
    const prev = rows[i - 1], prev2 = rows[i - 2];
    headers.forEach((_, j) => {
      if (j === c || String(r[j] || "").trim() || !String(prev[j] || "").trim()) return;
      if (j < c || (prev2 && prev2[j] === prev[j])) { r[j] = prev[j]; const inp = cellInput(i, j); if (inp) inp.value = prev[j]; }
    });
  }
  if (ensureTrailingBlank()) body().append(rowEl(rows[rows.length - 1], rows.length - 1));
  scheduleCommit();
}
function removeRow(i) {
  rows.splice(i, 1);
  ensureTrailingBlank(); renderBody(); scheduleCommit();
  focusCell(Math.min(i, rows.length - 1), 0);
}
function addCol() {
  const h = uniqueName("欄位" + (headers.length + 1));
  headers.push(h); rows.forEach((r) => r.push(""));
  addAutoField(h);
  render(); commit();
  const name = head().querySelector(`[data-hcol="${headers.length - 1}"]`);
  if (name) { name.focus(); name.select(); }
}
function removeCol(c) {
  const h = headers[c];
  if (rows.some((r) => String(r[c] || "").trim()) && !confirm(`刪除「${h}」這一欄和裡面的資料？`)) return;
  headers.splice(c, 1); rows.forEach((r) => r.splice(c, 1));
  removeFieldsFor(h);
  render(); commit();
}
function renameCol(c, v) {
  const oldH = headers[c];
  let h = String(v || "").replace(/[{}\t\n]/g, "").trim();
  if (!h || h === oldH) { renderHead(); return; }
  if (headers.includes(h)) h = uniqueName(h);
  headers[c] = h;
  renameInFields(oldH, h);
  render(); commit();
}
function togglePrint(h, on) {
  if (on) { if (!placeholderUsed(h)) addAutoField(h); } else removeFieldsFor(h);
  commit();
}

function scheduleCommit() { clearTimeout(timer); timer = setTimeout(commit, 300); }
export function commit() {
  clearTimeout(timer);
  const S = app.S;
  S.data.list = tableToTSV(headers, rows.filter(filled));
  S.data.names = ""; S.data.mode = "list";
  committed = S.data.list;
  refreshAll();
  renderHead(); // 「印」的勾勾跟著券上的欄位更新
}

// ---------- 載入 ----------
// 從名單載入表格（第一次顯示、或名單在別的地方被改過）
export function syncNameGrid() {
  if (app.S.data.list === committed && headers.length) return;
  const { headers: hs, records } = parseList(app.S.data.list);
  headers = hs.length ? hs.slice() : ["姓名"];
  rows = records.map((rec) => headers.map((h) => rec[h] || ""));
  ensureTrailingBlank();
  committed = app.S.data.list;
  render();
}

// 切到名單模式：還沒有名單就從「姓名」一欄開始；券上還沒放任何欄位就把主要欄位放上去
export function startList() {
  const S = app.S;
  S.data.mode = "list";
  if (!String(S.data.list || "").trim()) S.data.list = tableToTSV(["姓名"], []);
  committed = null; syncNameGrid();
  if (!headers.some(placeholderUsed)) addAutoField(mainColumn(headers));
  commit();
}

// ---------- 貼上：Excel 整塊、或一行一個 ----------
function onPaste(e) {
  const inp = e.target; if (inp.tagName !== "INPUT") return;
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!/[\t\n]/.test(text.trim())) return; // 單格貼上，照瀏覽器預設
  e.preventDefault();
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((l) => l.split("\t").map((v) => v.trim()));
  const inHead = inp.dataset.hcol != null;
  const c0 = inHead ? +inp.dataset.hcol : +inp.dataset.col;
  const r0 = inHead ? 0 : +inp.dataset.row;
  // 欄位不夠就自動加
  const need = c0 + Math.max(...lines.map((l) => l.length));
  while (headers.length < need) { headers.push(uniqueName("欄位" + (headers.length + 1))); rows.forEach((r) => r.push("")); }
  let data = lines;
  if (inHead) {
    // 貼在欄名那一列：第一行當欄名。原本就有的欄名只是換位置，券上的欄位不動；
    // 原本的欄名在新的欄名裡找不到，才當成改名（券上的代碼跟著改）
    const next = headers.slice();
    lines[0].forEach((v, k) => { if (v) next[c0 + k] = v; });
    const seen = new Set();
    next.forEach((h, c) => { let n = h; let i = 2; while (seen.has(n)) n = h + i++; next[c] = n; seen.add(n); });
    headers.forEach((oldH, c) => { if (!next.includes(oldH) && next[c] !== oldH) renameInFields(oldH, next[c]); });
    headers = next;
    data = lines.slice(1);
  } else if (lines[0].every((v, k) => v === headers[c0 + k])) data = lines.slice(1); // 複製時連欄名一起貼：跳過
  data.forEach((cells, li) => {
    const i = r0 + li;
    while (rows.length <= i) rows.push(headers.map(() => ""));
    cells.forEach((v, k) => { rows[i][c0 + k] = v; });
  });
  // 券上還沒有任何名單欄位：把主要欄位放上去
  if (!headers.some(placeholderUsed)) addAutoField(mainColumn(headers));
  ensureTrailingBlank(); render(); commit();
}

function onKey(e) {
  const inp = e.target; if (inp.tagName !== "INPUT" || e.isComposing || inp.dataset.row == null) return;
  const i = +inp.dataset.row, c = +inp.dataset.col;
  if (e.key === "Enter" || e.key === "ArrowDown") {
    e.preventDefault();
    if (e.key === "Enter" && e.shiftKey) { if (i > 0) focusCell(i - 1, c); return; }
    if (i + 1 >= rows.length && e.key === "Enter") { rows.push(headers.map(() => "")); body().append(rowEl(rows[rows.length - 1], rows.length - 1)); }
    focusCell(i + 1, c);
  } else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) focusCell(i - 1, c); }
  else if (e.key === "ArrowLeft" && c > 0 && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.preventDefault(); focusCell(i, c - 1); }
  else if (e.key === "ArrowRight" && c < headers.length - 1 && inp.selectionStart === inp.value.length) { e.preventDefault(); focusCell(i, c + 1); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
    e.preventDefault();
    if (i > 0) { inp.value = rows[i - 1][c] || ""; onInput(i, c, inp.value); }
  }
}
export function initNameGrid() {
  body().addEventListener("keydown", onKey);
  body().addEventListener("paste", onPaste);
  head().addEventListener("paste", onPaste);
  $("ngClear").onclick = () => {
    if (rows.some(filled) && !confirm("清空整份名單？（欄位會保留）")) return;
    rows = []; ensureTrailingBlank(); renderBody(); commit();
    focusCell(0, 0);
  };
}
