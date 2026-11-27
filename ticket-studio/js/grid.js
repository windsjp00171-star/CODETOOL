// 像 Excel 一樣的名單格子（操作參考 tianfu-diary 後台的讀經計畫表格）。
// 印券設計的名單、抽獎的名單共用這一份；各自決定資料存哪裡、欄位要不要「印」到券上。
// 欄位不寫死：可以自己加欄、改欄名、刪欄。
// 鍵盤：Enter／↓ 下一行（到底自動加一行）、↑ 上一行、←→ 換欄、Ctrl+D 複製上一格。
// 沿用上一行：在某一格打字時，同一行左邊空著的格子自動帶入上一行的內容；
// 右邊的格子要上面兩行一樣才帶入（例如分組），避免把電話之類每人不同的資料抄下來。
import { el } from "./util.js";
import { parseList } from "./numbers.js";

const filled = (r) => r.some((v) => String(v || "").trim());

/**
 * @param {object} o
 * @param {HTMLElement} o.head 欄名那一列
 * @param {HTMLElement} o.body 資料列
 * @param {(headers:string[], rows:string[][]) => void} o.onCommit 寫出（只含有內容的行）
 * @param {string} [o.firstCol] 沒有任何欄位時的第一欄名
 * @param {object} [o.print] 有這個才會出現「印」勾勾：{ used(h), add(h), remove(h), rename(old,new), afterPaste(headers) }
 */
export function createGrid(o) {
  let headers = [], rows = [], timer = null;
  const P = o.print || null;

  const uniqueName = (base) => { let n = base, i = 2; while (headers.includes(n)) n = base + i++; return n; };
  const minW = () => `calc(${headers.length} * 5.2em + 28px + ${headers.length * 4 + 12}px)`;
  const gridCols = () => `repeat(${headers.length}, minmax(5.2em, 1fr)) 28px`;

  function renderHead() {
    const cells = headers.map((h, c) => {
      const name = el("input", { type: "text", className: "ng-hname", value: h, title: "點這裡改欄名" });
      name.setAttribute("aria-label", `第 ${c + 1} 欄的名字`);
      name.dataset.hcol = String(c);
      name.addEventListener("change", () => renameCol(c, name.value));
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
      let print = null;
      if (P) {
        const pr = el("input", { type: "checkbox", checked: P.used(h) });
        pr.addEventListener("change", () => { if (pr.checked) { if (!P.used(h)) P.add(h); } else P.remove(h); commit(); });
        print = el("label", { className: "ng-print", title: "勾起來：這一欄會印在券上" }, pr, "印");
      }
      const del = headers.length > 1 ? el("button", { type: "button", className: "ng-del", title: `刪除「${h}」這一欄`, onclick: () => removeCol(c) }, "×") : null;
      return el("div", { className: "ng-hcell" }, name, el("div", { className: "ng-hctl" }, print || el("span"), del));
    });
    const add = el("button", { type: "button", className: "ng-addcol", title: "加一欄", onclick: () => addCol() }, "＋欄");
    o.head.replaceChildren(...cells, add);
    o.head.style.gridTemplateColumns = gridCols(); o.head.style.minWidth = minW();
  }
  const renderBody = () => o.body.replaceChildren(...rows.map((r, i) => rowEl(r, i)));
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
  const render = () => { renderHead(); renderBody(); };
  const cellInput = (i, c) => o.body.querySelector(`input[data-row="${i}"][data-col="${c}"]`);
  function focusCell(i, c) { const inp = cellInput(i, c); if (inp) { inp.focus(); inp.select(); } }
  // 最後一定留一行空白，打字就自動多一行
  function ensureTrailingBlank() {
    if (!rows.length || filled(rows[rows.length - 1])) { rows.push(headers.map(() => "")); return true; }
    return false;
  }

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
    if (ensureTrailingBlank()) o.body.append(rowEl(rows[rows.length - 1], rows.length - 1));
    clearTimeout(timer); timer = setTimeout(commit, 300);
  }
  function removeRow(i) {
    rows.splice(i, 1);
    ensureTrailingBlank(); renderBody(); commit();
    focusCell(Math.min(i, rows.length - 1), 0);
  }
  function addCol() {
    const h = uniqueName("欄位" + (headers.length + 1));
    headers.push(h); rows.forEach((r) => r.push(""));
    P?.add(h);
    render(); commit();
    const name = o.head.querySelector(`[data-hcol="${headers.length - 1}"]`);
    if (name) { name.focus(); name.select(); }
  }
  function removeCol(c) {
    const h = headers[c];
    if (rows.some((r) => String(r[c] || "").trim()) && !confirm(`刪除「${h}」這一欄和裡面的資料？`)) return;
    headers.splice(c, 1); rows.forEach((r) => r.splice(c, 1));
    P?.remove(h);
    render(); commit();
  }
  function renameCol(c, v) {
    const oldH = headers[c];
    let h = String(v || "").replace(/[{}\t\n]/g, "").trim();
    if (!h || h === oldH) { renderHead(); return; }
    if (headers.includes(h)) h = uniqueName(h);
    headers[c] = h;
    P?.rename(oldH, h);
    render(); commit();
  }

  function commit() {
    clearTimeout(timer);
    o.onCommit(headers.slice(), rows.filter(filled).map((r) => r.slice()));
    if (P) renderHead(); // 「印」的勾勾跟著券上的欄位更新
  }

  // 從 TSV 載入（第一行是欄名）
  function load(tsv) {
    const { headers: hs, records } = parseList(tsv);
    headers = hs.length ? hs.slice() : [o.firstCol || "姓名"];
    rows = records.map((rec) => headers.map((h) => rec[h] || ""));
    ensureTrailingBlank();
    render();
  }

  // 貼上：Excel 整塊、或一行一個
  function onPaste(e) {
    const inp = e.target; if (inp.tagName !== "INPUT") return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!/[\t\n]/.test(text.trim())) return; // 單格貼上，照瀏覽器預設
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((l) => l.split("\t").map((v) => v.trim()));
    const inHead = inp.dataset.hcol != null;
    const c0 = inHead ? +inp.dataset.hcol : +inp.dataset.col;
    const r0 = inHead ? 0 : +inp.dataset.row;
    const orig = headers.length;
    const need = c0 + Math.max(...lines.map((l) => l.length));
    while (headers.length < need) { headers.push(uniqueName("欄位" + (headers.length + 1))); rows.forEach((r) => r.push("")); }
    // 連欄名一起貼：第一行和原本的欄名對得上（例如原本「姓名」、貼上「姓名｜小組」），
    // 第一行就當欄名，不當成資料；新多出來的欄直接用那一行的名字
    const headerLine = !inHead && lines.length > 1 && c0 < orig
      && lines[0].every((v, k) => c0 + k >= orig || v === headers[c0 + k]);
    if (headerLine) lines[0].forEach((v, k) => { const c = c0 + k; if (c >= orig && v && !headers.includes(v)) headers[c] = v; });
    let data = lines;
    if (inHead) {
      // 貼在欄名那一列：第一行當欄名。原本就有的欄名只是換位置；
      // 原本的欄名在新的欄名裡找不到，才當成改名
      const next = headers.slice();
      lines[0].forEach((v, k) => { if (v) next[c0 + k] = v; });
      const seen = new Set();
      next.forEach((h, c) => { let n = h; let i = 2; while (seen.has(n)) n = h + i++; next[c] = n; seen.add(n); });
      headers.forEach((oldH, c) => { if (!next.includes(oldH) && next[c] !== oldH) P?.rename(oldH, next[c]); });
      headers = next;
      data = lines.slice(1);
    } else if (headerLine) data = lines.slice(1);
    data.forEach((cells, li) => {
      const i = r0 + li;
      while (rows.length <= i) rows.push(headers.map(() => ""));
      cells.forEach((v, k) => { rows[i][c0 + k] = v; });
    });
    P?.afterPaste?.(headers);
    ensureTrailingBlank(); render(); commit();
  }

  function onKey(e) {
    const inp = e.target; if (inp.tagName !== "INPUT" || e.isComposing || inp.dataset.row == null) return;
    const i = +inp.dataset.row, c = +inp.dataset.col;
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (e.key === "Enter" && e.shiftKey) { if (i > 0) focusCell(i - 1, c); return; }
      if (i + 1 >= rows.length && e.key === "Enter") { rows.push(headers.map(() => "")); o.body.append(rowEl(rows[rows.length - 1], rows.length - 1)); }
      focusCell(i + 1, c);
    } else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) focusCell(i - 1, c); }
    else if (e.key === "ArrowLeft" && c > 0 && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.preventDefault(); focusCell(i, c - 1); }
    else if (e.key === "ArrowRight" && c < headers.length - 1 && inp.selectionStart === inp.value.length) { e.preventDefault(); focusCell(i, c + 1); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (i > 0) { inp.value = rows[i - 1][c] || ""; onInput(i, c, inp.value); }
    }
  }
  o.body.addEventListener("keydown", onKey);
  o.body.addEventListener("paste", onPaste);
  o.head.addEventListener("paste", onPaste);

  return {
    load, commit, focusCell,
    headers: () => headers,
    hasData: () => rows.some(filled),
    clear() { rows = []; ensureTrailingBlank(); renderBody(); commit(); focusCell(0, 0); },
  };
}
