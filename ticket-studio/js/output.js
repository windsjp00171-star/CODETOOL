// 輸出：拼版 PDF、單張圖片 ZIP、驗證碼對照表。
import { $, num, tick, downloadBlob, downloadCSV, setStatus } from "./util.js";
import { app, newSeed } from "./state.js";
import { buildNumbers, fieldText, outName, codeFor } from "./numbers.js";
import { computeLayout, ticketIndex, cutGeometry, ticketSize } from "./geometry.js";
import { renderField, makeBgFull, bgCrop, cropCanvas } from "./render.js";
import { refreshAll } from "./refresh.js";

function setBusy(on, text) {
  app.busy = on;
  $("btnPdf").disabled = $("btnZip").disabled = $("sPdf").disabled = on;
  $("progress").hidden = !on;
  document.body.classList.toggle("busy", on);
  if (text != null) setStatus(text, true);
}
const setProgress = (r) => { $("progress").firstElementChild.style.transform = `scaleX(${r.toFixed(3)})`; };
const fileRange = (nums) => `${nums[0]}_${nums[nums.length - 1]}`;

function preflight() {
  if (app.busy) return null;
  const { nums, err } = buildNumbers();
  if (err) { alert(err); return null; }
  if (!nums.length) { alert("沒有可輸出的編號。"); return null; }
  if (!app.bgImg && !app.S.out.noBg && !confirm("尚未載入底圖，要直接印在白紙上嗎？")) return null;
  return nums;
}

export async function exportPdf() {
  const nums = preflight(); if (!nums) return;
  if (!window.jspdf) { alert("PDF 元件載入失敗，請確認網路連線後重新整理。"); return; }
  const S = app.S, L = computeLayout(), pages = Math.ceil(nums.length / L.perPage);
  const dpi = num(S.out.dpi, 200), pxmm = dpi / 25.4;
  setBusy(true, "正在產生 PDF…"); setProgress(0);
  try {
    await document.fonts?.ready;
    const orientation = L.pw > L.ph ? "landscape" : "portrait";
    const doc = new window.jspdf.jsPDF({ orientation, unit: "mm", format: [L.pw, L.ph], compress: true });
    const tppm = pxmm * L.scale;
    const full = app.bgImg && !S.out.noBg ? makeBgFull(tppm) : null;
    // 依每張券的出血範圍（外圍／內側）裁出底圖，相同範圍只嵌入一次
    const bgVariants = new Map();
    const bgFor = (e) => {
      const key = `${e.l}|${e.t}|${e.r}|${e.b}`;
      if (!bgVariants.has(key)) bgVariants.set(key, { alias: "bg" + bgVariants.size, data: cropCanvas(full, ...bgCrop(full, e, tppm)).toDataURL("image/jpeg", 0.92) });
      return bgVariants.get(key);
    };
    const g = cutGeometry(L);
    for (let p = 0; p < pages; p++) {
      if (p > 0) doc.addPage([L.pw, L.ph], orientation);
      L.slots.forEach((slot, s) => {
        const idx = ticketIndex(L, p, s, pages);
        if (idx >= nums.length) return;
        if (full) {
          const e = slot.ext, v = bgFor(e), sc = L.scale;
          doc.addImage(v.data, "JPEG", slot.x - e.l * sc, slot.y - e.t * sc, L.sw + (e.l + e.r) * sc, L.sh + (e.t + e.b) * sc, v.alias, "NONE");
        }
        S.fields.forEach((f) => {
          const text = fieldText(f, nums[idx]);
          if (!text) return;
          const r = renderField(f, text, pxmm * L.scale);
          doc.addImage(r.canvas.toDataURL("image/png"), "PNG",
            slot.x + f.x * L.sw + r.ox / pxmm, slot.y + f.y * L.sh + r.oy / pxmm,
            r.canvas.width / pxmm, r.canvas.height / pxmm, undefined, "FAST");
        });
      });
      if (S.layout.cutLines) {
        doc.setDrawColor(150); doc.setLineWidth(0.15); doc.setLineDashPattern([1.5, 1], 0);
        g.lines.forEach(([a, b, c, d]) => doc.line(a, b, c, d));
        doc.setLineDashPattern([], 0);
      }
      if (S.layout.cutMarks) {
        doc.setDrawColor(0); doc.setLineWidth(0.2);
        g.marks.forEach(([a, b, c, d]) => doc.line(a, b, c, d));
      }
      setProgress((p + 1) / pages);
      setStatus(`正在產生 PDF… ${p + 1} / ${pages} 頁`, true);
      await tick();
    }
    doc.save(`${outName()}_${fileRange(nums)}.pdf`);
    setBusy(false, `已下載 PDF：${pages} 頁、${nums.length} 張。列印時請選「實際大小 / 100%」。`);
    $("printDlgTitle").textContent = `PDF 已下載（${pages} 頁、${nums.length} 張）`;
    try { $("printDlg").showModal(); } catch (e) { /* 已開啟 */ }
  } catch (e) {
    console.error(e); setBusy(false, "產生 PDF 時發生錯誤：" + e.message);
  }
}

async function exportZip() {
  const nums = preflight(); if (!nums) return;
  if (!window.JSZip) { alert("ZIP 元件載入失敗，請確認網路連線後重新整理。"); return; }
  const S = app.S, dpi = num(S.out.dpi, 200), pxmm = dpi / 25.4;
  const { tw, th } = ticketSize();
  setBusy(true, "正在產生圖片…"); setProgress(0);
  try {
    await document.fonts?.ready;
    const zip = new window.JSZip();
    // 單張圖片輸出成品尺寸（不含出血）
    const fullBg = app.bgImg && !S.out.noBg ? makeBgFull(pxmm) : null;
    const base = fullBg ? cropCanvas(fullBg, ...bgCrop(fullBg, { l: 0, t: 0, r: 0, b: 0 }, pxmm)) : null;
    const c = document.createElement("canvas");
    c.width = Math.round(tw * pxmm); c.height = Math.round(th * pxmm);
    const ctx = c.getContext("2d");
    for (let i = 0; i < nums.length; i++) {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      if (base) ctx.drawImage(base, 0, 0);
      S.fields.forEach((f) => {
        const r = renderField(f, fieldText(f, nums[i]), pxmm);
        ctx.drawImage(r.canvas, f.x * c.width + r.ox, f.y * c.height + r.oy);
      });
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
      zip.file(`${outName()}_${nums[i]}.jpg`, blob);
      if (i % 5 === 4 || i === nums.length - 1) {
        setProgress(((i + 1) / nums.length) * 0.8);
        setStatus(`正在產生圖片… ${i + 1} / ${nums.length}`, true);
        await tick();
      }
    }
    setStatus("正在壓縮 ZIP…", true);
    const out = await zip.generateAsync({ type: "blob" }, (m) => setProgress(0.8 + (m.percent / 100) * 0.2));
    downloadBlob(out, `${outName()}_${fileRange(nums)}.zip`);
    setBusy(false, `已下載 ${nums.length} 張圖片（${dpi} dpi）。`);
  } catch (e) {
    console.error(e); setBusy(false, "產生 ZIP 時發生錯誤：" + e.message);
  }
}

export function initOutput() {
  $("btnPdf").onclick = () => exportPdf();
  $("btnZip").onclick = () => exportZip();
  $("btnCodeCsv").onclick = () => {
    const { nums, err } = buildNumbers();
    if (err) { alert(err); return; }
    // 用 ="000001" 格式避免 Excel 吃掉開頭的 0
    downloadCSV([["編號", "驗證碼"], ...nums.map((n) => [`="${n}"`, codeFor(n)])], `驗證碼對照表_${fileRange(nums)}.csv`);
  };
  $("btnNewSeed").onclick = () => {
    if (!confirm("重新產生後，所有編號的驗證碼都會改變。\n已經印好的券就無法再核對，確定嗎？")) return;
    app.S.num.seed = newSeed(); refreshAll();
  };
}
