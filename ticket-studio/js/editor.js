// 單張編輯器：在切割墊上顯示一張券，拖曳欄位、量尺、小工具列、方向鍵微調。
import { SAFE_MM } from "./constants.js";
import { $, clamp, num, isTyping } from "./util.js";
import { app, save, selectedField } from "./state.js";
import { bleedMm, ticketSize } from "./geometry.js";
import { fieldText, sampleNumber } from "./numbers.js";
import { renderField, makeBgFull } from "./render.js";
import { selectField, fillFieldForm } from "./fields.js";
import { schedulePreview } from "./preview.js";
import { refreshAll } from "./refresh.js";

const fieldEls = new Map();
let drag = null;
let miniArmed = false; // 使用者點過號碼才顯示小工具列
let stage;

// 編輯器裡「成品範圍」的位置（相對 stage，px）
function trimRect() {
  const { tw, th } = ticketSize(), b = bleedMm();
  const k = stage.clientWidth / (tw + 2 * b);
  return { x: b * k, y: b * k, w: tw * k, h: th * k, k };
}

export function renderEditor() {
  const { tw, th } = ticketSize(), b = bleedMm();
  // 有出血時，編輯器顯示「成品＋出血」全貌，並畫出裁切線與安全區
  stage.style.aspectRatio = `${tw + 2 * b} / ${th + 2 * b}`;
  const pctX = (v) => (v / (tw + 2 * b)) * 100 + "%", pctY = (v) => (v / (th + 2 * b)) * 100 + "%";
  $("trimBox").hidden = $("safeGuide").hidden = $("stageLegend").hidden = b <= 0;
  Object.assign($("trimBox").style, { left: pctX(b), right: pctX(b), top: pctY(b), bottom: pctY(b) });
  const sm = b + SAFE_MM;
  Object.assign($("safeGuide").style, { left: pctX(sm), right: pctX(sm), top: pctY(sm), bottom: pctY(sm) });
  $("stagePh").hidden = !!app.bgDataURL;
  fieldEls.forEach((node) => node.remove()); fieldEls.clear();
  const W = stage.clientWidth; if (!W) { $("miniBar").hidden = true; return; }
  paintStageBg();
  const sample = sampleNumber();
  $("sampleNum").textContent = sample;
  $("stageSize").textContent = `${+tw.toFixed(1)} × ${+th.toFixed(1)} mm${b > 0 ? `　出血 ${b} mm` : ""}`;
  app.S.fields.forEach((f) => {
    const node = document.createElement("canvas");
    node.className = "fld" + (f.id === app.selId ? " on" : "");
    node.title = f.name;
    stage.appendChild(node); fieldEls.set(f.id, node);
    paintFieldEl(f, node, sample);
    node.addEventListener("pointerdown", (e) => startDrag(e, f, node));
  });
  drawRulers();
  placeMiniBar();
}

export const markSelected = (id) => fieldEls.forEach((node, fid) => node.classList.toggle("on", fid === id));

let stageBgKey = null;
function paintStageBg() {
  const cv = $("stageBg"), dpr = window.devicePixelRatio || 1, S = app.S;
  const key = [app.bgDataURL?.length, app.bgDataURL?.slice(-32), S.ticket.w, S.ticket.h, bleedMm(), S.ticket.bgMode, stage.clientWidth, dpr].join("|");
  if (key === stageBgKey) return;
  stageBgKey = key;
  if (!app.bgImg) { cv.width = cv.height = 1; cv.getContext("2d").clearRect(0, 0, 1, 1); return; }
  const full = makeBgFull(trimRect().k * dpr);
  cv.width = full.width; cv.height = full.height;
  cv.getContext("2d").drawImage(full, 0, 0);
}

function paintFieldEl(f, node, sample) {
  const dpr = window.devicePixelRatio || 1;
  const r = renderField(f, fieldText(f, sample ?? sampleNumber()), trimRect().k * dpr);
  node.width = r.canvas.width; node.height = r.canvas.height;
  node.getContext("2d").drawImage(r.canvas, 0, 0);
  node.style.width = r.canvas.width / dpr + "px"; node.style.height = r.canvas.height / dpr + "px";
  node.dataset.ox = r.ox / dpr; node.dataset.oy = r.oy / dpr;
  positionFieldEl(f, node);
}

function positionFieldEl(f, node) {
  const t = trimRect();
  node.style.left = t.x + f.x * t.w + +node.dataset.ox + "px";
  node.style.top = t.y + f.y * t.h + +node.dataset.oy + "px";
}

// ---------- 量尺：以成品左上角為 0，單位 mm；選取的欄位位置用洋紅色標出 ----------
function drawRulers() {
  const rx = $("rulerX"), ry = $("rulerY");
  if (!rx || !ry || !stage.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const { tw, th } = ticketSize(), b = bleedMm();
  const t = trimRect(), k = t.k;
  // 量尺和預覽之間有外距，用實際位置算出位移，0 才會對準成品左上角
  const sr = stage.getBoundingClientRect(), xr = rx.getBoundingClientRect(), yr = ry.getBoundingClientRect();
  const offX = sr.left - xr.left, offY = sr.top - yr.top;
  const W = rx.clientWidth || stage.clientWidth, H = ry.clientHeight || stage.clientHeight, R = rx.clientHeight || 22;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ruler-ink").trim() || "#1b1f21";
  const mark = css.getPropertyValue("--magenta").trim() || "#d6006f";
  const f = selectedField();
  // 刻度間距：螢幕上至少隔 4px
  const minor = k >= 4 ? 1 : k >= 0.8 ? 5 : 10;
  const labelEvery = k * 10 >= 26 ? 10 : k * 20 >= 26 ? 20 : 50;

  const setup = (cv, w, h) => {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); // 顯示大小交給 CSS，避免反過來撐大版面
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    ctx.font = "600 9.5px system-ui, sans-serif";
    return ctx;
  };
  const ticks = (ctx, len, origin, horizontal) => {
    for (let mm = Math.ceil(-b / minor) * minor; mm <= len + b + 1e-6; mm += minor) {
      const p = Math.round(origin + mm * k) + 0.5;
      const major = mm % 10 === 0, mid = mm % 5 === 0;
      const size = major ? R * 0.55 : mid ? R * 0.35 : R * 0.2;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(p, R); ctx.lineTo(p, R - size); } else { ctx.moveTo(R, p); ctx.lineTo(R - size, p); }
      ctx.stroke();
      if (mm % labelEvery === 0 && mm >= 0 && mm <= len) {
        if (horizontal) { ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(String(mm), p + 2, 2); }
        else { ctx.save(); ctx.translate(2, p + 2); ctx.rotate(Math.PI / 2); ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(String(mm), 0, 0); ctx.restore(); }
      }
    }
  };
  const marker = (ctx, pos, label, horizontal) => {
    ctx.fillStyle = mark; ctx.strokeStyle = mark; ctx.lineWidth = 2;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(pos, 0); ctx.lineTo(pos, R); } else { ctx.moveTo(0, pos); ctx.lineTo(R, pos); }
    ctx.stroke();
    ctx.font = "700 10px system-ui, sans-serif";
    const tw2 = ctx.measureText(label).width + 8;
    if (horizontal) {
      const x = clamp(pos + 3, 0, W - tw2);
      ctx.fillRect(x, 1, tw2, 13); ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(label, x + 4, 2.5);
    } else {
      ctx.save(); ctx.translate(1, clamp(pos + 3, 0, H - tw2)); ctx.rotate(Math.PI / 2);
      ctx.fillRect(0, -14, tw2, 13); ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(label, 4, -12.5); ctx.restore();
    }
  };

  const cx = setup(rx, W, R);
  ticks(cx, tw, offX + t.x, true);
  const cy = setup(ry, R, H);
  ticks(cy, th, offY + t.y, false);
  if (f) {
    marker(cx, offX + t.x + f.x * t.w, (f.x * tw).toFixed(1), true);
    marker(cy, offY + t.y + f.y * t.h, (f.y * th).toFixed(1), false);
  }
}

// ---------- 小工具列：在選取的文字上方顯示「放大／縮小／顏色」 ----------
export function placeMiniBar() {
  const bar = $("miniBar"), f = selectedField(), node = f && fieldEls.get(f.id);
  if (!node || drag || !miniArmed) { bar.hidden = true; return; }
  bar.hidden = false;
  $("mbColor").value = f.color;
  $("mbSmaller").title = f.type === "qr" ? "QR 縮小" : "字縮小";
  $("mbBigger").title = f.type === "qr" ? "QR 放大" : "字放大";
  // 固定文字可以直接在這裡改；含 {n} 等代碼的欄位要到「更多」裡改，避免不小心刪掉代碼
  const editable = f.type !== "qr" && !/\{[^{}]+\}/.test(f.tpl || "");
  $("mbText").hidden = !editable;
  if (editable && document.activeElement !== $("mbText")) $("mbText").value = f.tpl || "";
  $("mbShorter").hidden = $("mbLonger").hidden = f.type !== "blank";
  const top = node.offsetTop - 6, left = node.offsetLeft + node.offsetWidth / 2;
  const bw = bar.offsetWidth, W = $("stageWrap").clientWidth;
  bar.style.left = clamp(left, bw / 2, W - bw / 2) + "px";
  bar.style.top = Math.max(bar.offsetHeight, top) + "px";
}

function bump(dir) {
  const f = selectedField(); if (!f) return;
  if (f.type === "qr") f.qrSize = clamp(+(num(f.qrSize, 15) * (dir > 0 ? 1.1 : 1 / 1.1)).toFixed(1), 5, 200);
  else f.size = clamp(+(num(f.size, 16) * (dir > 0 ? 1.12 : 1 / 1.12)).toFixed(1), 3, 400);
  fillFieldForm(); renderEditor(); schedulePreview(); save();
}

function startDrag(e, f, node) {
  e.preventDefault(); miniArmed = true;
  selectField(f.id);
  node.setPointerCapture(e.pointerId);
  const sr = stage.getBoundingClientRect(), t = trimRect();
  const r = { left: sr.left + t.x, top: sr.top + t.y, width: t.w, height: t.h };
  drag = { f, node, r, dx: e.clientX - (r.left + f.x * r.width), dy: e.clientY - (r.top + f.y * r.height) };
  stage.classList.add("dragging");
}

export function initEditor() {
  stage = $("stage");
  // 點到空白處就收起小工具列
  stage.addEventListener("pointerdown", (e) => { if (!e.target.classList.contains("fld")) { miniArmed = false; $("miniBar").hidden = true; } });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const { f, node, r, dx, dy } = drag;
    f.x = clamp((e.clientX - dx - r.left) / r.width, 0, 1);
    f.y = clamp((e.clientY - dy - r.top) / r.height, 0, 1);
    positionFieldEl(f, node); drawRulers(); fillFieldForm(true);
    $("miniBar").hidden = true;
  });
  const endDrag = () => { if (drag) { drag = null; stage.classList.remove("dragging"); placeMiniBar(); schedulePreview(); save(); } };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  new ResizeObserver(() => renderEditor()).observe(stage);

  // 方向鍵微調 0.5 mm（Shift 為 5 mm）
  document.addEventListener("keydown", (e) => {
    if (!app.selId || isTyping() || $("viewDesign").hidden) return;
    const step = e.shiftKey ? 5 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const f = selectedField(); if (!f) return;
    f.x = clamp(f.x + d[0] / num(app.S.ticket.w, 100), 0, 1);
    f.y = clamp(f.y + d[1] / num(app.S.ticket.h, 50), 0, 1);
    const node = fieldEls.get(f.id); if (node) positionFieldEl(f, node);
    drawRulers(); fillFieldForm(true); schedulePreview(); save();
  });

  $("mbText").addEventListener("input", () => {
    const f = selectedField(); if (!f) return;
    f.tpl = $("mbText").value;
    const node = fieldEls.get(f.id); if (node) paintFieldEl(f, node);
    fillFieldForm(); schedulePreview(); save();
  });
  $("mbText").addEventListener("blur", () => placeMiniBar());
  const lineBump = (dir) => {
    const f = selectedField(); if (!f || f.type !== "blank") return;
    f.lineLen = clamp(Math.round(num(f.lineLen, 40) + dir * Math.max(2, num(f.lineLen, 40) * 0.12)), 2, 400);
    fillFieldForm(); renderEditor(); schedulePreview(); save();
  };
  $("mbLonger").onclick = () => lineBump(1);
  $("mbShorter").onclick = () => lineBump(-1);
  $("mbDel").onclick = () => {
    const S = app.S, i = S.fields.findIndex((x) => x.id === app.selId); if (i < 0) return;
    S.fields.splice(i, 1); app.selId = null; miniArmed = false; $("miniBar").hidden = true; refreshAll();
  };
  $("mbBigger").onclick = () => bump(1);
  $("mbSmaller").onclick = () => bump(-1);
  $("mbColor").oninput = () => { const f = selectedField(); if (!f) return; f.color = $("mbColor").value; fillFieldForm(); renderEditor(); schedulePreview(); save(); };
  $("mbMore").onclick = () => {
    // 簡易模式下設定在「完整設定」裡；完整模式直接捲到欄位設定
    $("fieldForm").scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

export const redrawRulers = () => drawRulers();
