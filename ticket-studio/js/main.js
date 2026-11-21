// 啟動：投影視窗只跑投影；主視窗依序初始化各模組再第一次繪製。
import { LS } from "./constants.js";
import { ls } from "./util.js";
import { app, loadSaved, updateUndoBtns } from "./state.js";
import { runProjector } from "./projector.js";
import { initBackground, setBgName } from "./background.js";
import { initEditor } from "./editor.js";
import { initFields } from "./fields.js";
import { initSettings, syncBindings } from "./settings.js";
import { initPreview } from "./preview.js";
import { initSimple } from "./simple.js";
import { initOutput } from "./output.js";
import { initFiles } from "./files.js";
import { initGenerator } from "./generator.js";
import { initDraw } from "./draw.js";
import { initShell, showView } from "./shell.js";
import { refreshAll, markReady } from "./refresh.js";

if (new URLSearchParams(location.search).get("view") === "projector") {
  runProjector();
} else {
  initEditor(); initFields(); initSettings(); initPreview(); initSimple();
  initOutput(); initFiles(); initGenerator(); initBackground(); initDraw(); initShell();
  markReady();
  setBgName(null);
  loadSaved();
  app.selId = app.S.fields[0]?.id ?? null;
  syncBindings();
  refreshAll();
  updateUndoBtns();
  showView(ls.get(LS.view) === "draw" ? "draw" : "design");
}
