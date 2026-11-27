// 抽獎網址頁（stage.html#…）：名單、獎項、標題都在網址裡，打開就能抽。
// 給同工用（不用進票券工作室設定），也可以放進 PowerPoint 的 Web Viewer 增益集。
// 不用 confirm()：放在簡報裡時對話框可能被擋，危險的動作改成「再按一次確認」。
import { $, ls, downloadCSV } from "./util.js";
import { confetti } from "./projector.js";
import { renderGroups } from "./showlist.js";
import { unpackStage, stageKey } from "./stagelink.js";

const code = location.hash.slice(1);
const rnd = (k) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % k; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let data, KEY, people, prizes, W = [], shown = null, rolling = false;

function say(text, bad) {
  const m = $("stageMsg"); m.textContent = text; m.className = bad ? "bad" : ""; m.hidden = false;
  clearTimeout(say.t); say.t = setTimeout(() => (m.hidden = true), 4000);
}
const save = () => { if (!ls.set(KEY, JSON.stringify({ winners: W }))) say("⚠ 無法存到瀏覽器，請記得另外記下得獎名單", true); };
const okCount = (i) => W.filter((w) => w.p === i && w.s === "ok").length;
const curIdx = () => prizes.findIndex((p, i) => okCount(i) < p.qty);
function avail() {
  const left = new Map(); W.forEach((w) => left.set(w.key, (left.get(w.key) || 0) + 1));
  return people.filter((p) => { const n = left.get(p.key) || 0; if (n > 0) { left.set(p.key, n - 1); return false; } return true; });
}

function render() {
  $("showTitle").textContent = data.t || "";
  const ci = curIdx();
  const di = shown ? shown.p : ci;
  const disp = prizes[di];
  $("showPrize").textContent = disp ? disp.name : prizes.length ? "所有獎項都抽完了" : "沒有設定獎項";
  $("showProg").textContent = disp ? `已抽 ${okCount(di)} / ${disp.qty} 名` : "";
  if (!rolling) {
    const big = $("showNum");
    big.textContent = shown ? shown.name : " ";
    $("showName").textContent = shown ? shown.info : "";
    $("showCode").textContent = shown || ci < 0 ? "" : !avail().length ? "名單上的人都抽過了" : "按「抽出」，或用簡報筆按下一頁";
  }
  renderGroups($("showList"), prizes.map((p, i) => ({ name: p.name, cur: i === di,
    items: W.filter((w) => w.p === i && w.s === "ok").map((w) => w.name) })).filter((g) => g.items.length));
  $("sbAbsent").disabled = !W.some((w) => w.s === "ok");
}

async function pick() {
  if (rolling) return;
  const ci = curIdx();
  if (ci < 0) return say("所有獎項都抽完了");
  let pool = avail();
  if (!pool.length) return say("名單上的人都抽過了", true);
  rolling = true; $("sbPick").disabled = true; shown = null; render();
  const big = $("showNum"); big.classList.remove("pop"); big.classList.add("rolling");
  $("showName").textContent = ""; $("showCode").textContent = "";
  const end = performance.now() + 2200; let delay = 40;
  while (performance.now() < end) { big.textContent = pool[rnd(pool.length)].name; await sleep(delay); delay = Math.min(220, delay * 1.08); }
  pool = avail();
  const p = pool[rnd(pool.length)];
  const w = { p: ci, key: p.key, name: p.name, info: p.info, s: "ok", t: Date.now() };
  W.push(w); save();
  rolling = false; $("sbPick").disabled = false; shown = w;
  big.classList.remove("rolling"); render();
  void big.offsetWidth; big.classList.add("pop"); confetti(document.body);
}

// 危險的按鈕：第一次按變成「再按一次確認」，3 秒內再按才算
function twoStep(btn, label, run) {
  const orig = btn.textContent; let armed = false, t = null;
  btn.addEventListener("click", () => {
    if (!armed) { armed = true; btn.textContent = label; btn.classList.add("armed"); t = setTimeout(() => { armed = false; btn.textContent = orig; btn.classList.remove("armed"); }, 3000); return; }
    clearTimeout(t); armed = false; btn.textContent = orig; btn.classList.remove("armed"); run();
  });
}

async function start() {
  try { data = await unpackStage(code); }
  catch (e) {
    $("showPrize").textContent = "這個抽獎網址不完整";
    $("showCode").textContent = /^這個/.test(e.message || "") ? e.message : "可能只複製到一半。請回票券工作室重新按「複製網址」，整串都要貼上";
    $("stageBar").hidden = true; return;
  }
  document.title = (data.t ? data.t + "｜" : "") + "抽獎";
  KEY = stageKey(code);
  const m = Math.max(0, Math.floor(Number(data.m) || 0));
  people = data.r.map((r) => {
    const name = String(r[m] || r.find(Boolean) || "");
    return { key: r.join("\t"), name, info: r.filter((v, i) => i !== m && v).join("・") };
  }).filter((p) => p.name);
  prizes = data.p.map(([name, qty]) => ({ name: String(name || "獎項"), qty: Math.max(1, Math.floor(Number(qty) || 1)) }));
  try { const s = JSON.parse(ls.get(KEY) || "{}"); if (Array.isArray(s.winners)) W = s.winners; } catch (e) { /* 沒有紀錄 */ }
  render();
  if (W.length) say(`接續上次的結果（已抽 ${W.filter((w) => w.s === "ok").length} 位）`);

  $("sbPick").onclick = pick;
  twoStep($("sbAbsent"), "確定不在現場？再按一次", () => {
    const w = [...W].reverse().find((x) => x.s === "ok"); if (!w) return;
    w.s = "absent"; shown = null; save(); render(); say(`${w.name} 不在現場，請再抽一位「${prizes[w.p]?.name || ""}」`);
  });
  twoStep($("sbReset"), "會清掉所有結果，再按一次", () => { W = []; shown = null; save(); render(); $("sbMore").open = false; say("已清除，可以重新抽"); });
  $("sbCsv").onclick = () => {
    if (!W.length) return say("還沒有人被抽中", true);
    downloadCSV([["順序", "獎項", "得獎者", "其他資料", "時間", "狀態"], ...W.map((w, i) => [i + 1, prizes[w.p]?.name || "", w.name, w.info,
      new Date(w.t).toLocaleString("zh-TW", { hour12: false }), w.s === "ok" ? "有效" : "不在現場"])], `得獎名單_${new Date().toISOString().slice(0, 10)}.csv`);
  };
  $("sbFull").onclick = () => { $("sbMore").open = false; if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => say("這裡不能全螢幕", true)); };
  // 簡報筆：下一頁＝抽出。按鈕上按 Space／Enter 交給按鈕自己處理，免得一次觸發兩個動作
  document.addEventListener("keydown", (e) => {
    if (!["PageDown", "ArrowRight", "ArrowDown", " ", "Enter"].includes(e.key) || e.repeat) return;
    if ((e.key === " " || e.key === "Enter") && /BUTTON|SUMMARY/.test(e.target.tagName)) return;
    e.preventDefault(); pick();
  });
  // 按完按鈕把焦點還給頁面，簡報筆的鍵才不會被按鈕吃掉
  $("stageBar").addEventListener("click", (e) => { if (e.target.tagName === "BUTTON") setTimeout(() => e.target.blur(), 0); });
}
// 另一個分頁抽了，這邊也跟著更新（例如同工開了兩個視窗）
window.addEventListener("storage", (e) => {
  if (e.key !== KEY || rolling) return;
  try { W = JSON.parse(e.newValue || "{}").winners || []; shown = null; render(); } catch (err) { /* 忽略 */ }
});
start();
