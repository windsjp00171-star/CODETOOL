// 得獎畫面同步：主視窗把畫面內容送到投影視窗（BroadcastChannel，加上 localStorage 事件當備援）。
import { SHOW_CH, LS } from "./constants.js";
import { $, ls } from "./util.js";

const bc = "BroadcastChannel" in window ? new BroadcastChannel(SHOW_CH) : null;
let seq = 0;

export function pushShow(anim) {
  const m = {
    id: Date.now() + "-" + ++seq, anim,
    title: $("showTitle").textContent, prize: $("showPrize").textContent, prog: $("showProg").textContent,
    num: $("showNum").textContent.trim(), name: $("showName").textContent, code: $("showCode").textContent,
    list: [...$("showList").children].map((x) => x.textContent),
  };
  try { bc?.postMessage(m); } catch (e) { /* 視窗已關閉 */ }
  ls.set(SHOW_CH, JSON.stringify(m));
}

// 投影視窗打招呼時，立刻送一次目前畫面
export function initShowChannel() {
  if (bc) bc.onmessage = (e) => { if (e.data?.type === "hello") pushShow("none"); };
  window.addEventListener("storage", (e) => { if (e.key === LS.hello) pushShow("none"); });
}

export function openProjector() {
  const w = window.open(location.pathname + "?view=projector", "ticketProjector", "width=1280,height=720");
  if (!w) alert("請允許這個網站開啟彈出視窗。");
  setTimeout(() => pushShow("none"), 800);
}
