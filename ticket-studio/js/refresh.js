// 設定改變後，所有依賴設定的畫面一起更新，並存檔。
import { save } from "./state.js";
import { updateDataUI, updateSizeUI } from "./settings.js";
import { updateAspectWarn } from "./background.js";
import { updateSimpleUI } from "./simple.js";
import { updateInfo } from "./info.js";
import { renderChips, fillFieldForm } from "./fields.js";
import { renderEditor } from "./editor.js";
import { schedulePreview } from "./preview.js";
import { ensureFieldFonts } from "./fonts.js";

let ready = false; // 啟動完成前不要重繪（各模組還沒初始化）
export const markReady = () => { ready = true; };

export function refreshAll() {
  if (!ready) return;
  updateDataUI(); updateSizeUI(); updateAspectWarn(); updateSimpleUI(); updateInfo();
  renderChips(); fillFieldForm(); renderEditor(); schedulePreview(); save();
  ensureFieldFonts(true).then((fresh) => { if (fresh) { renderEditor(); schedulePreview(); } });
}
