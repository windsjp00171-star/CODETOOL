// 三步驟面板（簡易模式）：① 放圖 ② 放號碼 ③ 下載列印。
import { PRESETS } from "./constants.js";
import { $, num, el, infoLine } from "./util.js";
import { app, defaultField } from "./state.js";
import { buildNumbers, isList, parseList } from "./numbers.js";
import { computeLayout, fitChoices } from "./geometry.js";
import { applyPreset, chooseFit } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { autoContrast } from "./background.js";
import { schedulePreview } from "./preview.js";
import { openGenerator } from "./generator.js";
import { exportPdf } from "./output.js";
import { toggleUIMode } from "./shell.js";

const currentPreset = () => (app.S.meta.preset && PRESETS[app.S.meta.preset] ? app.S.meta.preset : "lottery");

export function updateSimpleUI() {
  const S = app.S;
  $("sSize").textContent = `${+num(S.ticket.w, 0).toFixed(1)} × ${+num(S.ticket.h, 0).toFixed(1)} mm`;
  $("sPreset").value = currentPreset();
  const list = isList();
  $("sRange").hidden = list; $("sListLine").hidden = !list;
  if (list) $("sListLine").textContent = `使用匯入的名單（${parseList(S.data.list).records.length} 人）。要改名單請到「更多設定」。`;

  // 排版摘要（和完整面板同一套說法）
  const { nums, err } = buildNumbers(), L = computeLayout(), box = $("sInfo");
  box.replaceChildren();
  if (err) { infoLine(box, err, true, "bad"); $("sPdf").disabled = true; return; }
  $("sPdf").disabled = false;
  const pages = Math.ceil(nums.length / L.perPage);
  infoLine(box, `共 ${nums.length} 張，一頁 ${L.perPage} 張，要印 ${pages} 頁`, true, "sum");
  const fc = fitChoices();
  if (fc) {
    const cur = L.perPage === fc.save.n && L.scale < 0.999 ? "save" : L.perPage === fc.exact.n && L.scale >= 0.999 ? "exact" : "";
    const opt = (key, title, sub) => el("label", { className: "fit-opt" + (cur === key ? " on" : "") },
      el("input", { type: "radio", name: "sFit", checked: cur === key, onchange: () => chooseFit(key) }),
      el("span", { className: "fit-text" }, el("b", null, title), el("small", null, sub)));
    const saved = fc.exactPages - fc.savePages;
    box.append(
      opt("save", `省紙：一頁 ${fc.save.n} 張，共 ${fc.savePages} 頁（推薦）`, `券稍微縮小到 ${(fc.save.scale * 100).toFixed(0)}%，看不太出來，少印 ${saved} 頁`),
      opt("exact", `原尺寸：一頁 ${fc.exact.n} 張，共 ${fc.exactPages} 頁`, `跟設定的大小完全一樣，紙要多用 ${saved} 頁`));
  }
  $("sPdf").lastChild.textContent = `下載 PDF 去列印（${pages} 頁）`;

  // 還沒放圖：第 2、3 步先變淡；放了圖：第 1 步蓋上完成章
  const waiting = !app.bgImg;
  document.querySelectorAll("#simplePanel .step").forEach((st, i) => {
    if (i === 0) { st.classList.toggle("done", !waiting); return; }
    st.classList.toggle("wait", waiting);
    const n = st.querySelector(".wait-note"); if (n) n.hidden = !waiting;
  });
}

export function initSimple() {
  $("btnPageToggle").onclick = () => {
    const open = $("pageCard").classList.toggle("open");
    $("btnPageToggle").setAttribute("aria-expanded", String(open));
    $("btnPageToggle").lastChild.textContent = open ? "收起整頁預覽" : "看整頁印出來的樣子";
    if (open) { schedulePreview(); setTimeout(() => $("pageCard").scrollIntoView({ behavior: "smooth", block: "start" }), 50); }
  };
  const sel = $("sPreset");
  Object.entries(PRESETS).forEach(([k, p]) => sel.append(el("option", { value: k }, p.name)));
  sel.onchange = () => { if (!applyPreset(sel.value)) sel.value = currentPreset(); updateSimpleUI(); };
  $("sGen").onclick = () => openGenerator();
  $("sPdf").onclick = () => exportPdf();
  $("sFull").onclick = () => toggleUIMode();
  $("sSizeToggle").onclick = () => {
    const box = $("sSizeBox"); box.hidden = !box.hidden;
    $("sSizeToggle").textContent = box.hidden ? "改大小" : "收起";
    $("sSizeToggle").setAttribute("aria-expanded", String(!box.hidden));
  };
  $("sAddNum").onclick = () => {
    const f = defaultField({ name: "編號 " + (app.S.fields.length + 1), x: 0.85, y: 0.5 });
    app.S.fields.push(f); app.selId = f.id; refreshAll(); autoContrast();
    $("sStatus").textContent = "已加一個號碼，請在右邊預覽上把它拖到想要的位置。";
  };
}
