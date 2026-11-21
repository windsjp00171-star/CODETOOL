// 投影視窗（?view=projector）：只顯示得獎畫面，跟主視窗同步。
import { SHOW_CH, LS } from "./constants.js";
import { $, el, ls } from "./util.js";

export const CONFETTI = ["#00a0e0", "#e6007e", "#ffe500", "#ffffff", "#00a0e0", "#e6007e"];

// 彩帶：洋紅、青、黃、白四色紙片
export function confetti(host) {
  for (let i = 0; i < 140; i++) {
    const s = el("span", { className: "cf" });
    s.style.left = Math.random() * 100 + "vw";
    s.style.background = CONFETTI[i % CONFETTI.length];
    s.style.setProperty("--dx", (Math.random() * 30 - 15) + "vw");
    s.style.setProperty("--rot", (Math.random() * 1440 - 720) + "deg");
    s.style.animationDuration = 2.2 + Math.random() * 2 + "s";
    s.style.animationDelay = Math.random() * 0.4 + "s";
    host.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  }
}

export function runProjector() {
  document.title = "得獎投影";
  document.body.classList.add("projector");
  document.body.appendChild($("show"));
  const hint = el("div", { id: "projHint" }, "把這個視窗拖到投影機上，雙擊切換全螢幕");
  document.body.appendChild(hint);
  setTimeout(() => (hint.style.opacity = "0"), 6000);
  document.addEventListener("dblclick", () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  let idleT = null;
  const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add("idle"), 2000); };
  document.addEventListener("mousemove", wake); wake();

  let lastId = null;
  function render(m) {
    if (!m || m.type === "hello" || m.id === lastId) return;
    lastId = m.id;
    $("showTitle").textContent = m.title || "";
    $("showPrize").textContent = m.prize || "";
    $("showProg").textContent = m.prog || "";
    $("showName").textContent = m.name || "";
    $("showCode").textContent = m.code || "";
    const big = $("showNum");
    big.textContent = m.num || " ";
    big.classList.toggle("rolling", m.anim === "roll");
    if (m.anim === "pop") { big.classList.remove("pop"); void big.offsetWidth; big.classList.add("pop"); confetti(document.body); }
    $("showList").replaceChildren(...(m.list || []).map((t) => el("span", null, t)));
  }
  try { render(JSON.parse(ls.get(SHOW_CH))); } catch (e) { /* 還沒有畫面 */ }
  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel(SHOW_CH);
    bc.onmessage = (e) => render(e.data);
    bc.postMessage({ type: "hello" });
  }
  window.addEventListener("storage", (e) => { if (e.key === SHOW_CH && e.newValue) { try { render(JSON.parse(e.newValue)); } catch (err) { /* 忽略 */ } } });
  ls.set(LS.hello, String(Date.now()));
}
