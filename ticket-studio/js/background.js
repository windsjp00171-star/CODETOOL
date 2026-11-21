// 券的底圖：載入、白邊偵測與裁切、比例提醒、依深淺自動選字色、拖曳上傳。
import { PT_MM } from "./constants.js";
import { $, clamp, num, el, setStatus, setMarked, marked } from "./util.js";
import { app } from "./state.js";
import { bleedMm, ticketSize } from "./geometry.js";
import { makeBgFull } from "./render.js";
import { syncBindings } from "./settings.js";
import { refreshAll } from "./refresh.js";
import { useGenerated } from "./generator.js";

export function setBackground(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      app.bgImg = img; app.bgDataURL = dataURL;
      app.bgBorder = app.S.gen.active ? null : detectWhiteBorder(img);
      refreshAll(); resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = dataURL;
  });
}

export function clearBackground() {
  app.bgImg = null; app.bgDataURL = null;
}

export function setBgName(name) {
  const text = name
    ? (name.startsWith("✨") ? name.replace(/^✨\s*/, "") : `✓ ${name}`)
    : app.bgImg ? "✓ 已載入（上次的圖片）" : "還沒選擇（也可以不用圖片，直接印在白紙上）";
  setMarked($("bgName"), text); setMarked($("sBgName"), text);
}

// ---------- 白邊偵測：圖片某一兩邊有整條白色（常見於截圖或匯出時多留的邊） ----------
function detectWhiteBorder(img) {
  const sc = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const white = (x, y) => { const i = (y * w + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 236 && d[i + 3] > 200; };
  const rowWhite = (y) => { let bad = 0; for (let x = 0; x < w; x++) if (!white(x, y) && ++bad > w * 0.01) return false; return true; };
  const colWhite = (x) => { let bad = 0; for (let y = 0; y < h; y++) if (!white(x, y) && ++bad > h * 0.01) return false; return true; };
  let t = 0, bt = 0, l = 0, r = 0;
  while (t < h * 0.2 && rowWhite(t)) t++;
  while (bt < h * 0.2 && rowWhite(h - 1 - bt)) bt++;
  while (l < w * 0.2 && colWhite(l)) l++;
  while (r < w * 0.2 && colWhite(w - 1 - r)) r++;
  const sides = [t, bt, l, r].filter((v) => v > 0).length;
  // 四邊都白通常是「白底設計」，不是多出來的白邊
  if (sides === 0 || sides > 2) return null;
  const px = (v) => (v ? Math.ceil((v + 1) / sc) : 0); // 多裁 1 個縮圖像素，避免殘留灰線
  const res = { t: px(t), b: px(bt), l: px(l), r: px(r) };
  if (res.t + res.b < img.naturalHeight * 0.004 && res.l + res.r < img.naturalWidth * 0.004) return null;
  return res;
}

async function trimWhiteBorder(silent) {
  const img = app.bgImg, border = app.bgBorder;
  if (!img || !border) return;
  const { t, b, l, r } = border;
  const w = img.naturalWidth - l - r, h = img.naturalHeight - t - b;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, l, t, w, h, 0, 0, w, h);
  await setBackground(c.toDataURL("image/jpeg", 0.95));
  app.bgBorder = null;
  if (silent) return;
  // 裁掉之後比例會變，直接讓券的高度配合圖片
  const S = app.S, tw = num(S.ticket.w, 1), ia = w / h, ta = tw / num(S.ticket.h, 1);
  if (S.ticket.bgMode !== "included" && Math.abs(ia - ta) / ta >= 0.015) S.ticket.h = +(tw / ia).toFixed(2);
  syncBindings(); refreshAll();
  setStatus("✓ 已裁掉白邊。", true);
}

// ---------- 底圖提醒（完整面板與三步驟面板各一份） ----------
export function updateAspectWarn() { ["aspectWarn", "sWarn"].forEach((id) => renderWarn($(id))); }

function renderWarn(box) {
  box.replaceChildren(); box.hidden = true; box.className = "note note-warn";
  if (!app.bgImg) return;
  let warned = false;
  const addMsg = (text, btnText, fn) => {
    box.append(el("p", null, text));
    if (btnText) box.append(el("button", { type: "button", className: "btn btn-quiet btn-small", onclick: fn }, btnText));
    box.hidden = false; warned = true;
  };
  const S = app.S, border = app.bgBorder;
  if (border && !S.gen.active) {
    const th0 = num(S.ticket.h, 1), tw0 = num(S.ticket.w, 1), ih = app.bgImg.naturalHeight, iw = app.bgImg.naturalWidth;
    const parts = [];
    if (border.t) parts.push(`上方約 ${((border.t / ih) * th0).toFixed(1)} mm`);
    if (border.b) parts.push(`下方約 ${((border.b / ih) * th0).toFixed(1)} mm`);
    if (border.l) parts.push(`左邊約 ${((border.l / iw) * tw0).toFixed(1)} mm`);
    if (border.r) parts.push(`右邊約 ${((border.r / iw) * tw0).toFixed(1)} mm`);
    addMsg(`圖片邊緣有一條白邊（${parts.join("、")}），印出來每張券都會多一條白線。`, "自動裁掉白邊（建議）", () => trimWhiteBorder());
  }
  renderAspectMsg(addMsg);
  if (app.autoNote) {
    const p = el("p", null, ...marked(app.autoNote.text + " "), el("button", { type: "button", className: "link-btn", onclick: app.autoNote.undo }, "復原"));
    box.append(p); box.hidden = false;
    if (!warned) box.className = "note note-ok";
  }
}

function renderAspectMsg(addMsg) {
  const S = app.S, b = bleedMm();
  const inc = S.ticket.bgMode === "included" ? 2 * b : 0;
  const tw = num(S.ticket.w, 1), th = num(S.ticket.h, 1);
  const ia = app.bgImg.naturalWidth / app.bgImg.naturalHeight, ta = (tw + inc) / (th + inc);
  // 用「幫我做一張」產生的圖：尺寸或出血改了就提供重新產生
  if (S.gen.active) {
    const tb = 2 * b, ga = (tw + tb) / (th + tb);
    if (Math.abs(ia - ga) / ga < 0.01 && inc === tb) return;
    addMsg("券的大小或印製方式改了，圖片需要重新產生。", "依新的大小重新產生圖片", () => useGenerated());
    return;
  }
  if (app.bgBorder) return; // 先處理白邊，裁完會自動調整比例
  if (Math.abs(ia - ta) / ta < 0.015) return;
  addMsg(`這張圖片的長寬比例，跟設定的券大小不太一樣，直接用的話圖片會被${ia > ta ? "壓扁" : "拉長"}一點。建議按下面的按鈕，讓券的高度配合圖片。`,
    "讓券的高度配合圖片（建議）", () => { S.ticket.h = +((tw + inc) / ia - inc).toFixed(2); syncBindings(); refreshAll(); });
}

// ---------- 依圖片深淺自動選黑字或白字 ----------
export function autoContrast() {
  if (!app.bgImg) return false;
  const S = app.S, { tw, th } = ticketSize(), b = bleedMm();
  const ppm = 400 / (tw + 2 * b);
  const full = makeBgFull(ppm), ctx = full.getContext("2d");
  let changed = false;
  S.fields.forEach((f) => {
    if (f.type === "qr") return;
    const cx = (b + f.x * tw) * ppm, cy = (b + f.y * th) * ppm;
    const hw = Math.max(4, ((num(f.size, 16) * PT_MM * 3) / 2) * ppm), hh = Math.max(3, (num(f.size, 16) * PT_MM * 0.6) * ppm);
    const x0 = clamp(Math.round(cx - hw), 0, full.width - 1), y0 = clamp(Math.round(cy - hh), 0, full.height - 1);
    const w = clamp(Math.round(hw * 2), 1, full.width - x0), h = clamp(Math.round(hh * 2), 1, full.height - y0);
    const d = ctx.getImageData(x0, y0, w, h).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const want = sum / (d.length / 4) > 140 ? "#111827" : "#ffffff";
    if (f.color !== want) { f.color = want; changed = true; }
  });
  if (changed) refreshAll();
  return changed;
}

// ---------- 上傳後自動處理白邊、比例；事後告知並可復原 ----------
export function handleImageFile(file) {
  if (!file || !/^image\//.test(file.type)) { alert("請選擇圖片檔（JPG、PNG…）。"); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const S = app.S;
    const before = { url: ev.target.result, h: S.ticket.h };
    const wasGen = S.gen.active; S.gen.active = false; app.autoNote = null;
    const ok = await setBackground(ev.target.result);
    if (!ok) { S.gen.active = wasGen; alert("無法讀取這張圖片。"); return; }
    setBgName(file.name);
    const notes = [];
    if (app.bgBorder) {
      const bb = app.bgBorder, parts = [];
      if (bb.t) parts.push("上方"); if (bb.b) parts.push("下方"); if (bb.l) parts.push("左邊"); if (bb.r) parts.push("右邊");
      await trimWhiteBorder(true);
      notes.push(`已自動裁掉${parts.join("、")}多出來的白邊`);
    }
    // 比例差一點點：直接讓券的高度配合圖片（差太多才問）
    const tw = num(S.ticket.w, 1), ia = app.bgImg.naturalWidth / app.bgImg.naturalHeight, ta = tw / num(S.ticket.h, 1);
    if (S.ticket.bgMode !== "included" && Math.abs(ia - ta) / ta >= 0.015 && Math.abs(ia - ta) / ta < 0.2) {
      S.ticket.h = +(tw / ia).toFixed(2);
      notes.push(`券的高度改成 ${S.ticket.h} mm，配合圖片比例`);
    }
    const changed = autoContrast();
    if (notes.length) {
      app.autoNote = { text: "✓ " + notes.join("；") + "。", undo: async () => {
        app.S.gen.active = false; app.autoNote = null; app.S.ticket.h = before.h;
        await setBackground(before.url); syncBindings(); refreshAll();
      } };
    }
    syncBindings(); refreshAll();
    setStatus(`已載入圖片。${changed ? "已依圖片深淺自動調整文字顏色。" : ""}`);
  };
  reader.readAsDataURL(file);
}

export function initBackground() {
  $("bgInput").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; handleImageFile(f); });
  // 直接把圖片拖進網頁
  let dragDepth = 0;
  const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => { if (!hasFile(e) || $("viewDesign").hidden) return; dragDepth++; $("dropHint").hidden = false; });
  window.addEventListener("dragleave", (e) => { if (!hasFile(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $("dropHint").hidden = true; } });
  window.addEventListener("dragover", (e) => { if (hasFile(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (!hasFile(e)) return;
    e.preventDefault(); dragDepth = 0; $("dropHint").hidden = true;
    if ($("viewDesign").hidden) return;
    handleImageFile(e.dataTransfer.files[0]);
  });
}
