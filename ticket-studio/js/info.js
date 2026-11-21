// 完整設定「怎麼排到紙上」下方的排版摘要。
import { $, el, infoLine } from "./util.js";
import { app } from "./state.js";
import { buildNumbers } from "./numbers.js";
import { computeLayout, bestLayout } from "./geometry.js";
import { chooseFit, syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";

export function updateInfo() {
  const { nums, err, skipped } = buildNumbers();
  const L = computeLayout();
  const pages = Math.ceil(nums.length / L.perPage);
  const box = $("layoutInfo");
  box.replaceChildren();
  if (err) { infoLine(box, err, true, "bad"); return; }
  infoLine(box, `共 ${nums.length} 張${skipped ? `（已排除 ${skipped} 個）` : ""}，一頁 ${L.perPage} 張，要印 ${pages} 頁`, true);
  if (L.scale < 0.999) {
    const best = bestLayout();
    infoLine(box, `為了一頁放 ${L.perPage} 張，券稍微縮小（${(L.scale * 100).toFixed(0)}%），印出來每張 ${L.sw.toFixed(0)}×${L.sh.toFixed(0)} mm。`);
    if (best) box.append(el("button", { type: "button", className: "btn btn-quiet btn-small", onclick: () => chooseFit("exact") },
      `改成原尺寸（一頁 ${best.n} 張，共 ${Math.ceil(nums.length / best.n)} 頁，多用紙）`));
    else infoLine(box, `券比 ${app.S.layout.paper} 紙還大，只能縮小印。可以在上面改用 A3 紙。`);
  } else infoLine(box, `✓ 原本大小（${L.sw.toFixed(0)}×${L.sh.toFixed(0)} mm），不縮放`);
  if (L.bleed > 0) infoLine(box, `出血 ${L.bleed} mm${L.bleedShort ? "（只有外圍）" : "（每張四邊）"}`);
  if (L.bleedShort) {
    const need = +(2 * L.bleed).toFixed(2);
    infoLine(box, `⚠ 券與券的間距小於 ${need} mm，相鄰券之間沒有完整出血。滿版設計建議把間距設為 ${need} mm。`, true, "bad");
    box.append(el("button", { type: "button", className: "btn btn-quiet btn-small", onclick: () => { app.S.layout.gap = need; syncBindings(); refreshAll(); } },
      `間距設為 ${need} mm`));
  }
  $("btnPdf").lastChild.textContent = `下載 PDF 去列印（${pages} 頁）`;
  $("btnZip").lastChild.textContent = `下載全部單張圖片 ZIP（${nums.length} 張）`;
}
