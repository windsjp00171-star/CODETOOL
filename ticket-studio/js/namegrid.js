// 印券設計的名單表格（每行印一張）。格子本身在 grid.js；這裡負責把名單存到 S.data.list，
// 以及勾「印」的欄位要放到券上。
import { $ } from "./util.js";
import { app, defaultField } from "./state.js";
import { tableToTSV, mainColumn } from "./numbers.js";
import { refreshAll } from "./refresh.js";
import { autoContrast } from "./background.js";
import { createGrid } from "./grid.js";

let grid = null;
let committed = null; // 上一次由表格寫出的名單；不同就代表外面改過，要重新載入
const placeholderUsed = (h) => app.S.fields.some((f) => String(f.tpl || "").includes(`{${h}}`));

// ---------- 券上的欄位：勾「印」就放上去 ----------
function addAutoField(h) {
  const S = app.S, th = Number(S.ticket.h) || 50;
  const isMain = h === mainColumn(grid.headers());
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
// 券上還沒有任何名單欄位：把主要欄位放上去
function ensureMainField(hs) { if (!hs.some(placeholderUsed)) addAutoField(mainColumn(hs)); }

export function commit() { grid.commit(); }

// 從名單載入表格（第一次顯示、或名單在別的地方被改過）
export function syncNameGrid() {
  if (app.S.data.list === committed && grid.headers().length) return;
  grid.load(app.S.data.list);
  committed = app.S.data.list;
}

// 切到名單模式：還沒有名單就從「姓名」一欄開始；券上還沒放任何欄位就把主要欄位放上去
export function startList() {
  const S = app.S;
  S.data.mode = "list";
  if (!String(S.data.list || "").trim()) S.data.list = tableToTSV(["姓名"], []);
  committed = null; syncNameGrid();
  ensureMainField(grid.headers());
  grid.commit();
}

export function initNameGrid() {
  grid = createGrid({
    head: $("ngHead"), body: $("ngBody"),
    onCommit(headers, rows) {
      const S = app.S;
      S.data.list = tableToTSV(headers, rows);
      S.data.names = ""; S.data.mode = "list";
      committed = S.data.list;
      refreshAll();
    },
    print: { used: placeholderUsed, add: addAutoField, remove: removeFieldsFor, rename: renameInFields, afterPaste: ensureMainField },
  });
  $("ngClear").onclick = () => {
    if (grid.hasData() && !confirm("清空整份名單？（欄位會保留）")) return;
    grid.clear();
  };
}
