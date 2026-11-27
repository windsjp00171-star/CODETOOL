// 存成檔案／開啟檔案／恢復預設。檔案格式（app: "ticket-studio", version: 2）不可變動。
import { $, num, downloadBlob, setStatus } from "./util.js";
import { app, mergeState, defaultState } from "./state.js";
import { outName } from "./numbers.js";
import { setBackground, clearBackground, setBgName } from "./background.js";
import { syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { genAi, setGenAi } from "./ai.js";
import { D, saveDraw, renderDraw, newPrizeId } from "./draw.js";

export function exportTemplate() {
  const data = { app: "ticket-studio", version: 2, savedAt: new Date().toISOString(), state: app.S, background: app.bgDataURL,
                 draw: { prizes: D.prizes, voidList: D.voidList, verify: D.verify, mode: D.mode, people: D.people }, genAi: genAi.dataURL };
  downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), `${outName()}範本.json`);
}

async function importTemplate(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "ticket-studio" || !data.state) throw new Error("這不是票券工作室「存成檔案」產生的檔案");
    app.S = mergeState(data.state);
    app.selId = app.S.fields[0]?.id ?? null;
    clearBackground();
    if (typeof data.background === "string" && data.background.startsWith("data:image/")) await setBackground(data.background);
    setBgName(app.bgImg ? "（從檔案載入的圖片）" : null);
    if (typeof data.genAi === "string" && data.genAi.startsWith("data:image/")) {
      await setGenAi(data.genAi);
      if (!genAi.history.includes(data.genAi)) genAi.history.unshift(data.genAi);
    }
    if (data.draw && Array.isArray(data.draw.prizes)) {
      D.prizes = data.draw.prizes.map((p) => ({ id: p.id || newPrizeId(), name: String(p.name || "獎項"), qty: Math.max(1, Math.floor(num(p.qty, 1))) }));
      D.voidList = String(data.draw.voidList || ""); D.verify = !!data.draw.verify;
      if (data.draw.mode) { D.mode = data.draw.mode === "list" ? "list" : "ticket"; D.people = String(data.draw.people || ""); }
      saveDraw(); renderDraw();
    }
    syncBindings(); refreshAll();
    setStatus("已開啟檔案，設定都回來了。");
  } catch (err) { alert("開啟失敗：" + err.message); }
}

export function initFiles() {
  $("btnExportTpl").onclick = exportTemplate;
  $("tplInput").addEventListener("change", (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (file) importTemplate(file);
  });
  $("btnReset").onclick = () => {
    if (!confirm("確定要恢復預設？目前的設定與底圖會被清除（建議先按「存成檔案」備份）。")) return;
    app.S = defaultState(); clearBackground(); app.selId = app.S.fields[0].id; app.page = 0;
    $("bgInput").value = ""; setBgName(null); syncBindings(); refreshAll();
  };
}
