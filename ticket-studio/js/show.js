// 得獎畫面同步：主視窗把畫面內容送到投影視窗（BroadcastChannel，加上 localStorage 事件當備援）。
import { SHOW_CH, LS } from "./constants.js";
import { $, ls } from "./util.js";
import { readGroups } from "./showlist.js";

const bc = "BroadcastChannel" in window ? new BroadcastChannel(SHOW_CH) : null;
let seq = 0;

export function pushShow(anim) {
  const m = {
    id: Date.now() + "-" + ++seq, anim,
    title: $("showTitle").textContent, prize: $("showPrize").textContent, prog: $("showProg").textContent,
    num: $("showNum").textContent.trim(), name: $("showName").textContent, code: $("showCode").textContent,
    groups: readGroups($("showList")),
    names: $("showNum").classList.contains("is-name"), // 名單直接抽：大字是名字，字級要小一點
  };
  try { bc?.postMessage(m); } catch (e) { /* 視窗已關閉 */ }
  ls.set(SHOW_CH, JSON.stringify(m));
}

// 簡報筆（翻頁器）送出的「下一頁」鍵。Space／Enter 不算：那兩個鍵在按鈕、輸入框上本來就有作用
export const NEXT_KEYS = new Set(["PageDown", "ArrowRight", "ArrowDown"]);

// 投影視窗打招呼時，立刻送一次目前畫面；投影視窗收到簡報筆的鍵，轉給 onNext
export function initShowChannel(onNext) {
  if (bc) bc.onmessage = (e) => { if (e.data?.type === "hello") pushShow("none"); else if (e.data?.type === "next") onNext?.(); };
  window.addEventListener("storage", (e) => {
    if (e.key === LS.hello) pushShow("none");
    else if (e.key === LS.remote && e.newValue && !bc) onNext?.();
  });
}

export function openProjector() {
  const w = window.open(location.pathname + "?view=projector", "ticketProjector", "width=1280,height=720");
  if (!w) alert("請允許這個網站開啟彈出視窗。");
  setTimeout(() => pushShow("none"), 800);
}
