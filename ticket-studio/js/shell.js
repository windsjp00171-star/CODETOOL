// 外框：分頁切換、⋯ 選單、簡易／完整設定、換電腦提醒、Ctrl+Z。
import { LS } from "./constants.js";
import { $, ls, isTyping } from "./util.js";
import { app, undo, redo } from "./state.js";
import { renderEditor } from "./editor.js";
import { schedulePreview } from "./preview.js";
import { renderDraw } from "./draw.js";
import { exportTemplate } from "./files.js";

export function showView(v) {
  document.querySelectorAll(".tabs button").forEach((b) => {
    const on = b.dataset.view === v;
    b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
  });
  $("viewDesign").hidden = v !== "design"; $("viewDraw").hidden = v !== "draw";
  document.body.dataset.view = v;
  $("btnUndo").hidden = $("btnRedo").hidden = $("btnMode").hidden = v !== "design";
  $("btnBackSimple").hidden = app.simpleUI || v !== "design";
  ls.set(LS.view, v);
  if (v === "draw") { renderDraw(); $("entryNum").focus(); } else { renderEditor(); schedulePreview(); }
}

function applyUIMode() {
  document.body.classList.toggle("simple", app.simpleUI);
  $("btnModeText").textContent = app.simpleUI ? "完整設定" : "回簡易模式";
  $("btnModeHint").textContent = app.simpleUI ? "字型、出血、名單、驗證碼…" : "只留三個步驟";
  $("btnBackSimple").hidden = app.simpleUI || $("viewDesign").hidden;
}
export function toggleUIMode() {
  app.simpleUI = !app.simpleUI;
  ls.set(LS.ui, app.simpleUI ? "simple" : "full");
  applyUIMode(); renderEditor(); schedulePreview();
  window.scrollTo({ top: 0 });
}

function initMenu() {
  const menu = $("menuBox"), btn = $("btnMenu");
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) menu.querySelector("button:not([hidden]):not(:disabled), label")?.focus(); };
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".menu-wrap")) close(); });
  menu.querySelectorAll("button, label").forEach((node) => node.addEventListener("click", () => setTimeout(close, 0)));
  // 「開啟檔案」是 label，鍵盤按 Enter／空白鍵也要能開
  menu.querySelectorAll("label").forEach((lab) => lab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lab.querySelector("input")?.click(); }
  }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); } });
}

export function initShell() {
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => showView(b.dataset.view)));
  initMenu();
  $("btnUndo").onclick = undo;
  $("btnRedo").onclick = redo;
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || $("viewDesign").hidden) return;
    if (isTyping() && document.activeElement.type === "text") return; // 文字框內用瀏覽器原生復原
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  });

  app.simpleUI = ls.get(LS.ui) !== "full";
  $("btnMode").onclick = toggleUIMode;
  $("btnBackSimple").onclick = toggleUIMode;
  applyUIMode();

  // 換電腦提醒
  if (ls.get(LS.moveTipHidden) === "1") $("moveTip").hidden = true;
  $("btnMoveSave").onclick = exportTemplate;
  $("btnMoveHide").onclick = () => { $("moveTip").hidden = true; ls.set(LS.moveTipHidden, "1"); };
}
