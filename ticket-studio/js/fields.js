// 券上的文字欄位：欄位清單、設定表單、新增／複製／刪除。
import { FONTS } from "./constants.js";
import { $, clamp, num, el } from "./util.js";
import { app, save, defaultField, fieldId, selectedField } from "./state.js";
import { refreshAll } from "./refresh.js";
import { renderEditor, markSelected, placeMiniBar, redrawRulers } from "./editor.js";
import { schedulePreview } from "./preview.js";

export function renderChips() {
  const box = $("fieldChips");
  box.replaceChildren(...app.S.fields.map((f) => el("button", {
    type: "button", className: "chip" + (f.id === app.selId ? " on" : ""),
    ariaPressed: String(f.id === app.selId), onclick: () => selectField(f.id),
  }, f.name || "（未命名）")));
}

export function selectField(id) {
  app.selId = id;
  markSelected(id);
  renderChips(); fillFieldForm(); placeMiniBar(); redrawRulers();
}

export function fillFieldForm(posOnly) {
  const f = selectedField(), form = $("fieldForm"), S = app.S;
  form.querySelectorAll("[data-f]").forEach((inp) => {
    inp.disabled = !f;
    if (!f) return;
    const k = inp.dataset.f;
    if (posOnly && k !== "xmm" && k !== "ymm") return;
    const v = k === "xmm" ? +(f.x * num(S.ticket.w, 0)).toFixed(1) : k === "ymm" ? +(f.y * num(S.ticket.h, 0)).toFixed(1) : f[k];
    if (k === "font" && !FONTS.some((o) => o.v === v)) $("fontSelect").append(el("option", { value: v }, v));
    if (inp.type === "checkbox") inp.checked = !!v; else inp.value = v ?? "";
  });
  $("btnDelField").disabled = $("btnDupField").disabled = !f;
  const qr = f?.type === "qr";
  form.querySelectorAll(".only-text").forEach((node) => (node.hidden = qr));
  form.querySelectorAll(".only-qr").forEach((node) => (node.hidden = !qr));
}

function addField(f) { app.S.fields.push(f); app.selId = f.id; refreshAll(); }

export function initFields() {
  FONTS.forEach((f) => $("fontSelect").append(el("option", { value: f.v }, f.t)));

  $("fieldForm").querySelectorAll("[data-f]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const f = selectedField(); if (!f) return;
      const k = inp.dataset.f, S = app.S;
      if (k === "xmm") f.x = clamp(num(inp.value, 0) / num(S.ticket.w, 1), 0, 1);
      else if (k === "ymm") f.y = clamp(num(inp.value, 0) / num(S.ticket.h, 1), 0, 1);
      else if (inp.type === "checkbox") f[k] = inp.checked;
      else if (inp.type === "number") f[k] = num(inp.value, f[k]);
      else f[k] = inp.value;
      if (k === "name") renderChips();
      if (k === "type") fillFieldForm();
      renderEditor(); schedulePreview(); save();
    });
  });

  $("btnAddField").onclick = () => addField(defaultField({ name: "欄位 " + (app.S.fields.length + 1) }));
  $("btnAddQr").onclick = () => addField(defaultField({ name: "QR Code", type: "qr", tpl: "{n}", x: 0.85, y: 0.35, color: "#000000" }));
  $("btnDupField").onclick = () => {
    const src = selectedField(); if (!src) return;
    const f = defaultField(Object.assign({}, src, { name: src.name + " 複本", x: clamp(src.x + 0.03, 0, 1), y: clamp(src.y + 0.05, 0, 1) }));
    f.id = fieldId();
    addField(f);
  };
  $("btnDelField").onclick = () => {
    const S = app.S, i = S.fields.findIndex((x) => x.id === app.selId); if (i < 0) return;
    S.fields.splice(i, 1); app.selId = S.fields[Math.max(0, i - 1)]?.id ?? null; refreshAll();
  };
}
