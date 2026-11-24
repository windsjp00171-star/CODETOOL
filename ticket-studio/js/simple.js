// 三步驟面板（簡易模式）：① 放圖 ② 放號碼 ③ 下載列印。
import { PRESETS } from "./constants.js";
import { $, num, el, infoLine } from "./util.js";
import { app, defaultField } from "./state.js";
import { buildNumbers, isList, parseList, namesToTable, tableToTSV, tableToNames } from "./numbers.js";
import { computeLayout, fitChoices, ticketIndex } from "./geometry.js";
import { applyPreset, chooseFit, syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { autoContrast } from "./background.js";
import { schedulePreview } from "./preview.js";
import { openGenerator } from "./generator.js";
import { exportPdf } from "./output.js";
import { toggleUIMode } from "./shell.js";
import { addField, newBlankField } from "./fields.js";

const currentPreset = () => (app.S.meta.preset && PRESETS[app.S.meta.preset] ? app.S.meta.preset : "lottery");

export function updateSimpleUI() {
  const S = app.S;
  $("sSize").textContent = `${+num(S.ticket.w, 0).toFixed(1)} × ${+num(S.ticket.h, 0).toFixed(1)} mm`;
  $("sPreset").value = currentPreset();
  const list = isList();
  $("sRange").hidden = list; $("sListLine").hidden = !list;
  $("sListBox").hidden = !list;
  // 券上有沒有號碼（{n}）
  const hasNum = S.fields.some((f) => /\{n\}/.test(f.tpl || ""));
  $("sStep2Title").textContent = list ? "放名單" : hasNum ? "放號碼" : "要印幾張";
  $("sFromLabel").textContent = hasNum ? "從幾號" : "從";
  $("sToLabel").textContent = hasNum ? "到幾號" : "到";
  $("sNoNumHint").hidden = list || hasNum;
  $("sAddNum").lastChild.textContent = hasNum ? "再加一個號碼（例如存根）" : "加一個號碼";
  document.querySelectorAll('input[name="sMode"]').forEach((r) => {
    r.checked = r.value === (list ? "list" : "seq");
    r.parentElement.classList.toggle("on", r.checked);
  });
  if (list) {
    const { headers, records } = parseList(S.data.list);
    const groups = headers.includes("小組") ? new Set(records.map((r) => r["小組"]).filter(Boolean)).size : 0;
    $("sListLine").textContent = records.length
      ? `共 ${records.length} 人，每人印一張${groups ? `（${groups} 個小組）` : ""}。`
      : "還沒有名單。";
    if (document.activeElement !== $("sNames")) $("sNames").value = S.data.names || tableToNames(S.data.list);
  }

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

  // 號碼排列：疊切（裁好疊起來就連號）或每頁依序
  $("sOrder").hidden = L.perPage < 2 || nums.length <= L.perPage;
  if (!$("sOrder").hidden) {
    const first = L.slots.map((_, s) => ticketIndex(L, 0, s, pages)).filter((i) => i < nums.length).map((i) => nums[i]);
    const pageFirst = nums.slice(0, L.perPage);
    $("sOrderStackHint").textContent = S.layout.stackCut
      ? `第 1 頁是 ${first.join("、")}。整疊一起裁，再把 ${Math.min(L.perPage, nums.length)} 疊依序疊好，就是 ${nums[0]}～${nums[nums.length - 1]} 連號，不用一張張整理。`
      : "整疊一起裁，再把各疊依序疊好就是連號，不用一張張整理。";
    $("sOrderPageHint").textContent = `第 1 頁是 ${pageFirst.join("、")}。裁好後要一張一張整理順序。`;
    document.querySelectorAll("#sOrder .fit-opt").forEach((lab) => {
      const on = (lab.dataset.order === "stack") === !!S.layout.stackCut;
      lab.classList.toggle("on", on); lab.querySelector("input").checked = on;
    });
  }

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
  document.querySelectorAll('#sOrder input[name="sOrder"]').forEach((r) => r.addEventListener("change", () => {
    app.S.layout.stackCut = r.value === "stack"; syncBindings(); refreshAll();
  }));
  $("sPdf").onclick = () => exportPdf();
  $("sFull").onclick = () => toggleUIMode();
  $("sSizeToggle").onclick = () => {
    const box = $("sSizeBox"); box.hidden = !box.hidden;
    $("sSizeToggle").textContent = box.hidden ? "改大小" : "收起";
    $("sSizeToggle").setAttribute("aria-expanded", String(!box.hidden));
  };
  // 名單：照平常習慣打 → 轉成表格，名字（和小組）自動放到券上
  let namesTimer = null;
  $("sNames").addEventListener("input", () => {
    clearTimeout(namesTimer);
    namesTimer = setTimeout(() => {
      const S = app.S, { headers, rows } = namesToTable($("sNames").value);
      S.data.names = $("sNames").value;
      S.data.list = tableToTSV(headers, rows);
      S.data.mode = "list";
      ensureNameFields(headers);
      refreshAll();
    }, 250);
  });
  document.querySelectorAll('input[name="sMode"]').forEach((r) => r.addEventListener("change", () => {
    const S = app.S;
    if (r.value === "list") {
      S.data.mode = "list";
      if (!String(S.data.list || "").trim()) { S.data.names = ""; S.data.list = tableToTSV(["姓名"], []); }
      ensureNameFields(parseList(S.data.list).headers);
      refreshAll();
      setTimeout(() => $("sNames").focus(), 50);
    } else { S.data.mode = "seq"; refreshAll(); }
  }));
  $("sAddBlank").onclick = () => {
    addField(newBlankField({ y: 0.6 }));
    $("sStatus").textContent = "已加一個填寫欄。在右邊預覽上點它，可以改文字、把線拉長縮短，再拖到想要的位置。";
  };
  $("sAddText").onclick = () => {
    addField(defaultField({ name: "文字", tpl: "請輸入文字", align: "left", bold: false, size: 11, x: 0.08, y: 0.3 }));
    autoContrast();
    $("sStatus").textContent = "已加一段文字。在右邊預覽上點它就能直接改字。";
  };
  $("sAddNum").onclick = () => {
    const f = defaultField({ name: "編號 " + (app.S.fields.length + 1), x: 0.85, y: 0.5 });
    app.S.fields.push(f); app.selId = f.id; refreshAll(); autoContrast();
    $("sStatus").textContent = "已加一個號碼，請在右邊預覽上把它拖到想要的位置。";
  };
}

// 名字（和小組）自動放到券上：名字放大置中，小組小字放左上。
// 自動放的欄位會跟著名單的欄名走；名單沒有小組時，自動放的小組欄位拿掉。
export function ensureNameFields(headers) {
  const S = app.S, th = num(S.ticket.h, 50);
  const nameKey = headers.find((h) => h === "姓名") || headers[headers.length - 1] || "姓名";
  const groupKey = headers.find((h) => h === "小組");
  const uses = (k) => S.fields.some((f) => !f.autoName && String(f.tpl || "").includes(`{${k}}`));
  const autoOf = (role) => S.fields.find((f) => f.autoName === role);
  const added = [];
  // 名字
  const an = autoOf("name");
  if (uses(nameKey)) { if (an) S.fields = S.fields.filter((f) => f !== an); }
  else if (an) an.tpl = `{${nameKey}}`;
  else {
    const f = defaultField({ name: "名字", tpl: `{${nameKey}}`, x: 0.5, y: 0.58, size: +Math.min(60, (th * 0.3) / 0.3528).toFixed(1), align: "center", autoName: "name" });
    S.fields.push(f); added.push(f);
  }
  // 小組
  const ag = autoOf("group");
  if (!groupKey || uses(groupKey)) { if (ag) S.fields = S.fields.filter((f) => f !== ag); }
  else if (ag) ag.tpl = `{${groupKey}}`;
  else {
    const f = defaultField({ name: "小組", tpl: `{${groupKey}}`, x: 0.06, y: 0.18, size: +Math.max(8, Math.min(16, (th * 0.07) / 0.3528)).toFixed(1), align: "left", bold: false, color: "#374151", autoName: "group" });
    S.fields.push(f); added.push(f);
  }
  if (added.length) { app.selId = added[0].id; autoContrast(); }
  return added.length;
}
