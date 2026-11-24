// 一般設定：data-bind 綁定、用途範本、尺寸、印製方式（出血）、名單。
import { PAPERS, PRESETS, SIZES } from "./constants.js";
import { $, num, el, infoLine, setStatus } from "./util.js";
import { app, setPath, getPath, defaultField, fieldId, historyIndex } from "./state.js";
import { bleedMm, computeLayout, autoLayout } from "./geometry.js";
import { isList, parseList, recordMap } from "./numbers.js";
import { refreshAll } from "./refresh.js";
import { clearBackground, setBgName, rotateBackground90 } from "./background.js";
import { useGenerated } from "./generator.js";

// ---------- data-bind：input 與 S 的欄位雙向對應 ----------
export function syncBindings() {
  document.querySelectorAll("[data-bind]").forEach((node) => {
    const v = getPath(node.dataset.bind);
    if (node.type === "checkbox") node.checked = !!v; else node.value = v ?? "";
  });
}

function initBindings() {
  document.querySelectorAll("[data-bind]").forEach((node) => {
    node.addEventListener("input", () => {
      const p = node.dataset.bind;
      let v = node.type === "checkbox" ? node.checked : node.value;
      if (node.type === "number" || p === "out.dpi") { const n = parseFloat(v); if (!Number.isFinite(n)) return; v = n; }
      setPath(p, v);
      if (/^ticket\.(w|h)$/.test(p)) app.autoNote = null; // 自己改了尺寸，先前的自動調整說明就不適用
      // 簡易模式：換尺寸、紙張、出血時自動重新排版
      if (app.simpleUI && /^(ticket\.(w|h|bleed)|layout\.paper)$/.test(p)) autoLayout();
      refreshAll();
    });
  });
}

export function chooseFit(fit) { app.S.layout.fit = fit; autoLayout(); syncBindings(); refreshAll(); }

// ---------- 用途範本 ----------
export function applyPreset(key) {
  const p = PRESETS[key]; if (!p) return false;
  const S = app.S;
  // 已經放了圖或改過設定，才需要確認
  const touched = !!app.bgImg || historyIndex() > 0;
  if (touched && !confirm(`換成「${p.name}」？\n券的大小、文字位置和圖片會換成「${p.name}」的預設。`)) return false;
  S.meta.preset = key;
  Object.assign(S.ticket, p.ticket, { bleed: 0, bgMode: "extend", printMode: "home" });
  Object.assign(S.num, { start: 1, exDigits: "", exList: "" }, p.num);
  S.data.mode = p.data; if (p.list && (!S.data.list.trim() || p.replaceList)) S.data.list = p.list;
  S.meta.name = p.name;
  S.fields = p.fields.map((f) => Object.assign(defaultField(f), { id: fieldId(), fromPreset: true }));
  Object.assign(S.layout, { margin: 5, stackCut: true, cutMarks: true, cutLines: true }, p.layout);
  if (p.auto !== false) autoLayout();
  clearBackground(); $("bgInput").value = ""; S.gen.active = false; app.autoNote = null; setBgName(null);
  app.selId = S.fields[0].id; app.page = 0;
  syncBindings(); refreshAll();
  setStatus(`已換成「${p.name}」，接著可以選擇券的圖片。`);
  return true;
}
const currentPreset = () => (app.S.meta.preset && PRESETS[app.S.meta.preset] ? app.S.meta.preset : "lottery");

// ---------- 名單 ----------
export function updateDataUI() {
  const list = isList();
  document.querySelectorAll(".only-seq").forEach((node) => (node.hidden = list));
  document.querySelectorAll(".only-list").forEach((node) => (node.hidden = !list));
  if (!list) return;
  if (document.activeElement !== $("listText")) $("listText").value = app.S.data.list;
  const { headers, records } = parseList(app.S.data.list);
  $("listInfo").textContent = records.length
    ? `共 ${records.length} 列，每列印一張，編號從 ${recordMap().keys().next().value} 開始。點下方欄位名稱可插入到目前選取的文字欄位：`
    : "貼上名單後，第一列會當作欄位名稱。";
  $("listCols").replaceChildren(...headers.map((h) => el("button", {
    type: "button", className: "chip",
    onclick: () => { const f = app.S.fields.find((x) => x.id === app.selId); if (!f) return; f.tpl = (f.tpl || "") + `{${h}}`; refreshAll(); },
  }, `{${h}}`)));
}

// ---------- 尺寸與印製方式 ----------
export function updateSizeUI() {
  const S = app.S;
  $("printMode").value = S.ticket.printMode || "home";
  $("bleedOpts").hidden = S.ticket.printMode === "home";
  const tw = num(S.ticket.w, 100), th = num(S.ticket.h, 50), b = bleedMm();
  const i = SIZES.findIndex(([, w, h]) => Math.abs(w - tw) < 0.05 && Math.abs(h - th) < 0.05);
  $("sizePreset").value = i >= 0 ? String(i) : "";
  $("presetSelect").value = currentPreset();

  const box = $("sizeInfo"); box.replaceChildren();
  const L = computeLayout(), m = num(S.layout.margin, 0), paperName = S.layout.paper;
  const [pw0, ph0] = PAPERS[paperName] || PAPERS.A4;
  const maxW = +(Math.max(pw0, ph0) - 2 * m - 2 * b).toFixed(1), maxH = +(Math.min(pw0, ph0) - 2 * m - 2 * b).toFixed(1);
  infoLine(box, `${paperName} 最大可以印 ${maxH}×${maxW} mm（直式）或 ${maxW}×${maxH} mm（橫式）的券`, false, "adv");

  // 底圖解析度
  const inc = S.ticket.bgMode === "included" ? 2 * b : 0;
  const needW = Math.round(((tw + inc) / 25.4) * 300), needH = Math.round(((th + inc) / 25.4) * 300);
  const canva = `在 Canva 建立設計時，選「自訂尺寸」並用「像素」輸入 ${needW} × ${needH}。`;
  if (app.bgImg) {
    const real = Math.round(app.bgImg.naturalWidth / (((tw + inc) * L.scale) / 25.4));
    if (real >= 250) infoLine(box, "圖片清晰度：✓ 很清楚", true);
    else if (real >= 150) { infoLine(box, "圖片清晰度：✓ 可以", true); infoLine(box, `想印得更清楚：${canva}`); }
    else { infoLine(box, "圖片清晰度：⚠ 圖片太小，印出來會模糊", true, "bad"); infoLine(box, `請重新做一張大一點的圖：${canva}`); }
    infoLine(box, `技術資訊：${app.bgImg.naturalWidth}×${app.bgImg.naturalHeight} px，約 ${real} dpi；300 dpi 需要 ${needW}×${needH} px`, false, "adv");
  } else infoLine(box, `做圖時建議尺寸：${needW} × ${needH} 像素（在 Canva 選「自訂尺寸」、單位選「像素」，免費版就能用）。`);
}

function initSize() {
  const sel = $("sizePreset");
  sel.append(el("option", { value: "" }, "自訂尺寸（直接在下面輸入）"),
    ...SIZES.map(([n, w, h], i) => el("option", { value: i }, `${n}　${w}×${h} mm`)));
  sel.onchange = () => {
    const v = sel.value; if (v === "") return;
    const [, w, h] = SIZES[+v];
    Object.assign(app.S.ticket, { w, h }); app.autoNote = null; autoLayout(); syncBindings(); refreshAll();
    setStatus("已換成新尺寸並重新排版。");
  };
  $("btnSwapSize").onclick = () => swapOrientation();

  // 印製方式 → 出血
  $("printMode").onchange = () => {
    const S = app.S, m = $("printMode").value;
    S.ticket.printMode = m;
    const notes = [];
    if (m === "home") S.ticket.bleed = 0;
    else {
      if (m === "shop" || !(num(S.ticket.bleed, 0) > 0)) S.ticket.bleed = 3;
      const L = computeLayout(), need = +(2 * bleedMm()).toFixed(2);
      if ((L.cols > 1 || L.rows > 1) && num(S.layout.gap, 0) < need) { S.layout.gap = need; notes.push(`券與券的間距改為 ${need} mm，每張四邊才都有出血`); }
      if (S.layout.cutLines) { S.layout.cutLines = false; notes.push("關掉券之間的虛線（印刷廠看頁緣的裁切標記裁切）"); }
      if (computeLayout().scale < 0.999 && autoLayout()) notes.push("重新排版");
    }
    syncBindings(); refreshAll();
    setStatus(m === "home" ? "已取消出血。" : `已設定 ${bleedMm()} mm 出血。${notes.length ? "另外自動幫你：" + notes.join("；") + "。" : ""}`);
  };
  $("bleedInput").addEventListener("input", () => { if (app.S.ticket.printMode !== "custom") { app.S.ticket.printMode = "custom"; updateSizeUI(); } });
}

function initList() {
  $("listText").addEventListener("input", () => { app.S.data.list = $("listText").value; refreshAll(); });
  $("listFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) { try { text = new TextDecoder("big5").decode(buf); } catch (err) { /* 保留 UTF-8 結果 */ } } // Excel 存的 CSV 常是 Big5
    app.S.data.list = text; $("listText").value = text; refreshAll();
  });
}

export function initSettings() {
  initBindings(); initSize(); initList();

  const presetSel = $("presetSelect");
  Object.entries(PRESETS).forEach(([k, p]) => presetSel.append(el("option", { value: k }, p.label)));
  presetSel.onchange = () => { if (!applyPreset(presetSel.value)) presetSel.value = currentPreset(); };

  $("btnAutoLayout").onclick = () => {
    app.S.layout.fit = "save";
    if (!autoLayout()) { alert("這張紙放不下這個大小的券，請改用較大紙張或縮小邊界。"); return; }
    syncBindings(); refreshAll();
  };
}

// 直橫對調：有自己的圖時，整張券（圖片＋文字）一起轉 90°，圖片不會變形；
// 用「幫我做一張」產生的圖就依新的方向重新產生；沒有圖時只對調寬高
export async function swapOrientation() {
  const S = app.S;
  [S.ticket.w, S.ticket.h] = [S.ticket.h, S.ticket.w];
  app.autoNote = null;
  if (app.bgImg && S.gen.active) {
    autoLayout(); syncBindings();
    await useGenerated();
    setStatus("已改成另一個方向，並依新的方向重新產生圖片。");
    return;
  }
  if (app.bgImg) {
    // 第一次順時針轉 90°，再按一次就逆時針轉回來（不會變成上下顛倒）
    const dir = S.ticket.turned ? -1 : 1;
    S.ticket.turned = !S.ticket.turned;
    // 順時針：(x, y) → (1 − y, x)；逆時針：(x, y) → (y, 1 − x)。文字也跟著轉
    S.fields.forEach((f) => {
      [f.x, f.y] = dir > 0 ? [1 - f.y, f.x] : [f.y, 1 - f.x];
      f.rotate = ((num(f.rotate, 0) + 90 * dir) % 360 + 360) % 360;
    });
    autoLayout(); syncBindings();
    await rotateBackground90(dir);
    setStatus("整張券（圖片和文字）已一起轉 90°，圖片不會變形。");
    return;
  }
  S.fields.forEach((f) => { [f.x, f.y] = [f.y, f.x]; });
  autoLayout(); syncBindings(); refreshAll();
}
