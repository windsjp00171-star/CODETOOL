// 共用的小工具：DOM、數字、下載、localStorage。

export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export const tick = () => new Promise((r) => setTimeout(r, 0));
export const measureCtx = document.createElement("canvas").getContext("2d");
export const randomId = (prefix, len) => prefix + Math.random().toString(36).slice(2, 2 + len);
export const isTyping = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "");

// 建立元素：el("button", { className: "btn", onclick }, "文字")
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "dataset") Object.assign(node.dataset, v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

// 一行一行的說明文字（第一行或指定行加粗）
export function infoLine(box, text, strong, cls) {
  const d = el("div", { className: [strong ? "strong" : "", cls || ""].join(" ").trim() || null }, text);
  box.appendChild(d);
  return d;
}

// localStorage：私密模式或空間滿時不要讓整個程式掛掉
export const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } },
};

export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function downloadCSV(rows, filename) {
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  downloadBlob(new Blob([body], { type: "text/csv;charset=utf-8" }), filename);
}

export function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("圖片讀取失敗")); i.src = src; });
}

// 狀態列：完整面板與三步驟面板各有一個
export function setStatus(text, both) {
  $("statusText").textContent = text;
  if (both) $("sStatus").textContent = text;
}
