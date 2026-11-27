// 抽獎紀錄，兩種抽法：
//  · 抽印好的券：現場實體抽出 → 輸入／掃描券號 → 檢查 → 登記
//  · 名單直接抽：不用印券，把名單打進表格，電腦隨機抽
// 結果都同步到投影視窗。
import { LS } from "./constants.js";
import { $, num, el, ls, randomId, downloadCSV, infoLine, setMarked } from "./util.js";
import { buildNumbers, parseRanges, codeFor, usesCode, recordLabel, isList, padNumber, parseList, mainColumn, tableToTSV } from "./numbers.js";
import { app } from "./state.js";
import { createGrid } from "./grid.js";
import { pushShow, initShowChannel, openProjector } from "./show.js";
import { icon } from "./icons.js";

export const newPrizeId = () => randomId("p", 7);
const defaultDraw = () => ({
  prizes: [
    { id: newPrizeId(), name: "參加獎", qty: 10 },
    { id: newPrizeId(), name: "三獎", qty: 5 },
    { id: newPrizeId(), name: "二獎", qty: 3 },
    { id: newPrizeId(), name: "頭獎", qty: 1 },
  ],
  voidList: "", verify: false, winners: [], cur: null, title: "",
  showSecs: 60, // 得獎號碼在投影上停留幾秒，0 = 不自動清除
  mode: "ticket", // "ticket" 抽印好的券｜"list" 名單直接抽
  people: "",     // 名單直接抽的名單（TSV，第一行是欄名），和印券設計的名單分開
  pickCount: "1",
});
const byList = () => D.mode === "list";

export let D = defaultDraw();

export function saveDraw() {
  if (!ls.set(LS.draw, JSON.stringify(D))) msg("err", "無法存到瀏覽器（儲存空間已滿？），請立刻匯出 CSV 備份。");
}
function loadDraw() {
  try {
    const raw = ls.get(LS.draw);
    if (raw) { D = Object.assign(defaultDraw(), JSON.parse(raw)); if (!Array.isArray(D.winners)) D.winners = []; }
  } catch (e) { /* 壞掉的紀錄就用預設 */ }
}

const okCount = (pid) => D.winners.filter((w) => w.prizeId === pid && w.status === "ok").length;
const prizeName = (w) => D.prizes.find((p) => p.id === w.prizeId)?.name ?? w.prizeName;
function currentPrize() {
  const sel = D.prizes.find((p) => p.id === D.cur);
  if (sel && okCount(sel.id) < sel.qty) return sel;
  return D.prizes.find((p) => okCount(p.id) < p.qty) || sel || null;
}
// 名單直接抽：每一行是一個人。同名同資料的兩行算兩個人，各自只能中一次
function people() {
  const { headers, records } = parseList(D.people);
  const main = mainColumn(headers);
  return records.map((rec) => {
    const key = headers.map((h) => rec[h] || "").join("\t");
    const name = rec[main] || headers.map((h) => rec[h]).find(Boolean) || "";
    const info = headers.filter((h) => h !== main && rec[h]).map((h) => rec[h]).join("・");
    return { key, name, info };
  }).filter((p) => p.key.trim());
}
function peoplePool() {
  const all = people();
  const left = new Map();
  D.winners.forEach((w) => { if (w.key != null) left.set(w.key, (left.get(w.key) || 0) + 1); });
  const avail = all.filter((p) => { const n = left.get(p.key) || 0; if (n > 0) { left.set(p.key, n - 1); return false; } return true; });
  return { all, avail };
}
// 得獎者的附帶資料（名單模式：其他欄位；印券＋名單：券上的名單資料）
const whoOf = (w) => (w.key != null ? w.info || "" : recordLabel(w.num));
const anyInfo = () => D.winners.some((w) => whoOf(w));

function pool() {
  const { nums } = buildNumbers();
  const voids = parseRanges(D.voidList);
  const used = new Set(D.winners.map((w) => w.num));
  const issued = nums.filter((n) => { const v = +n; return !voids.some(([a, b]) => v >= a && v <= b); });
  return { all: nums, issued, avail: issued.filter((n) => !used.has(n)) };
}
function msg(type, text) { const m = $("entryMsg"); m.className = "msg " + type; setMarked(m, text); m.hidden = false; }
const fmtTime = (t) => new Date(t).toLocaleTimeString("zh-TW", { hour12: false });
const showCodes = () => D.verify || usesCode();

// 投影上正在顯示的得獎者。顯示期間，獎項名稱和進度都照這個人得的獎，
// 不會因為那個獎抽滿、自動跳到下一個獎而變成「下一個獎＋上一個號碼」。
let shown = null, clearTimer = null;
function armAutoClear() {
  clearTimeout(clearTimer);
  const secs = num(D.showSecs, 60);
  if (shown && secs > 0) clearTimer = setTimeout(clearShown, secs * 1000);
}
// 清掉投影上的號碼，畫面回到「準備抽目前獎項」
function clearShown() {
  shown = null; clearTimeout(clearTimer);
  const big = $("showNum");
  big.textContent = " "; big.classList.remove("rolling", "pop");
  $("showCode").textContent = ""; $("showName").textContent = "";
  renderDrawStatus();
}

function showWinner(w, animate) {
  shown = w || null; armAutoClear();
  const big = $("showNum");
  big.textContent = w ? w.num : " ";
  big.classList.remove("rolling", "pop");
  if (w && animate) { void big.offsetWidth; big.classList.add("pop"); }
  $("showCode").textContent = w && w.key == null && showCodes() ? `驗證碼 ${w.code}` : "";
  $("showName").textContent = w ? whoOf(w) : "";
  pushShow(w && animate ? "pop" : "none");
}

function iconBtn(name, title, onclick, cls) {
  return el("button", { type: "button", className: "btn btn-icon" + (cls ? " " + cls : ""), title, ariaLabel: title, onclick }, icon(name));
}

// ---------- 名單直接抽：名單表格 ----------
let pgrid = null, pgLoaded = null;
function renderPeopleLine() {
  const list = people(), n = list.length;
  const line = $("pgLine"); line.replaceChildren(n ? `共 ${n} 人。可以直接從 Excel 整塊貼上。` : "一格一個名字，按 Enter 換下一行；也可以從 Excel 整塊貼上。");
  // 同一行資料出現兩次：如果是不小心貼兩次，那個人中獎機會就變兩倍，一定要讓人看到
  const seen = new Map(); list.forEach((p) => seen.set(p.key, (seen.get(p.key) || 0) + 1));
  const dup = list.filter((p, i) => seen.get(p.key) > 1 && list.findIndex((q) => q.key === p.key) === i);
  if (dup.length) line.append(el("span", { className: "bad-line" },
    `⚠ 重複：${dup.slice(0, 5).map((p) => `${p.name}${p.info ? `（${p.info}）` : ""} ×${seen.get(p.key)}`).join("、")}${dup.length > 5 ? " …" : ""}。如果是同一個人，請刪掉多的那行（不然中獎機會會變兩倍）；真的是不同人，可以加一欄（例如小組）區分。`));
  $("pgImport").hidden = !parseList(app.S.data.list).records.length;
}
function syncPeople() {
  if (pgLoaded !== D.people) { pgrid.load(D.people); pgLoaded = D.people; }
  renderPeopleLine();
}
const MODE_HINT = {
  ticket: "現場從箱子抽出印好的券，把券上的號碼輸入右邊登記。號碼範圍沿用「印券設計」。",
  list: "不用印券：把名單打進下面的表格，按右邊的「抽出」，電腦隨機抽。同一個人不會被抽中兩次。",
};
function renderMode() {
  const L = byList();
  document.querySelectorAll('input[name="drawMode"]').forEach((r) => { r.checked = r.value === (L ? "list" : "ticket"); });
  $("drawModeHint").textContent = MODE_HINT[L ? "list" : "ticket"];
  $("peopleBox").hidden = !L;
  $("entryForm").hidden = L; $("pickRow").hidden = !L;
  $("btnRandom").hidden = L; $("btnCam").hidden = L || !("BarcodeDetector" in window);
  $("voidBox").hidden = $("verifyBox").hidden = L;
  $("prizeHint").textContent = L ? "從第一個獎開始抽，抽滿了自動換下一個；也可以在右邊手動切換。" : "登記時會自動填入第一個還沒抽滿的獎項，也可以在右邊手動切換。";
  $("absentLabel").textContent = L ? "上一位不在現場（作廢後再抽一位）" : "上一位未到場（作廢後再抽一張）";
  $("liveTitle").textContent = L ? "現場抽獎" : "現場登記";
  $("clearShowLabel").textContent = L ? "清除投影上的名字" : "清除投影上的號碼";
  $("pickCount").value = String(D.pickCount || "1");
  if (L) syncPeople();
}
const focusEntry = () => (byList() ? $("btnPick") : $("entryNum")).focus();

let prizeEditing = false; // 已開始登記後，獎項預設收成摘要
const isCompact = () => D.winners.length > 0 && !prizeEditing;

export function renderDraw() {
  // 獎項清單：開始登記後收成摘要（即時顯示已抽數量）
  const compact = isCompact();
  $("btnAddPrize").hidden = $("prizeHead").hidden = compact;
  if (compact) {
    const edit = el("button", { type: "button", className: "btn btn-quiet btn-small", onclick: () => { prizeEditing = true; renderDraw(); } }, "編輯獎項");
    $("prizeList").replaceChildren(el("div", { className: "prize-sum" }, ...D.prizes.map((p) =>
      el("div", null, el("span", null, p.name), el("span", { className: "q" }, `${okCount(p.id)} / ${p.qty}`)))), edit);
  } else $("prizeList").replaceChildren(...D.prizes.map((p, i) => {
    const name = el("input", { type: "text", value: p.name, ariaLabel: "獎項名稱" });
    name.oninput = () => { p.name = name.value; saveDraw(); renderDrawStatus(); };
    const qty = el("input", { type: "number", min: 1, value: p.qty, title: "名額", ariaLabel: "名額" });
    qty.oninput = () => { const v = Math.floor(num(qty.value, 0)); if (v >= 1) { p.qty = v; saveDraw(); renderDrawStatus(); } };
    const move = (j) => { [D.prizes[j], D.prizes[i]] = [D.prizes[i], D.prizes[j]]; saveDraw(); renderDraw(); };
    const ops = el("div", { className: "ops" },
      iconBtn("up", "往前", () => { if (i > 0) move(i - 1); }),
      iconBtn("down", "往後", () => { if (i < D.prizes.length - 1) move(i + 1); }),
      iconBtn("x", "刪除", () => {
        if (D.winners.some((w) => w.prizeId === p.id) && !confirm(`「${p.name}」已有得獎紀錄，刪除獎項後紀錄仍會保留，確定刪除？`)) return;
        D.prizes.splice(i, 1); saveDraw(); renderDraw();
      }, "danger"));
    return el("div", { className: "prize-row" }, el("span", { className: "prize-no" }, String(i + 1)), name, qty, ops);
  }));
  renderMode();
  $("voidList").value = D.voidList;
  if (!byList() && (D.verify || String(D.voidList || "").trim())) $("drawMore").open = true; // 有設定就展開，免得被忽略
  $("drawTitle").value = D.title || "";
  $("verifyCode").checked = !!D.verify;
  $("entryCode").hidden = !D.verify || byList();
  $("entryForm").classList.toggle("with-code", !!D.verify);
  renderDrawStatus();
}

function renderDrawStatus() {
  // 第一次登記後，獎項改成摘要；摘要裡的已抽數量即時更新
  const sum = $("prizeList").querySelector(".prize-sum");
  if (isCompact()) {
    if (!sum || sum.children.length !== D.prizes.length) return renderDraw();
    D.prizes.forEach((p, i) => { sum.children[i].querySelector(".q").textContent = `${okCount(p.id)} / ${p.qty}`; });
  } else if (sum) return renderDraw();
  $("showTitle").textContent = D.title || "";
  // 目前獎項下拉
  const cur = currentPrize();
  $("curPrize").replaceChildren(...D.prizes.map((p) => el("option", { value: p.id },
    `${p.name}（${okCount(p.id)}/${p.qty}）${okCount(p.id) >= p.qty ? " ✓" : ""}`)));
  if (cur) $("curPrize").value = cur.id;

  // 顯示中的得獎者被標記未到場或刪掉：號碼一起從投影上拿掉
  if (shown && (shown.status !== "ok" || !D.winners.includes(shown))) {
    shown = null; clearTimeout(clearTimer);
    $("showNum").textContent = " "; $("showNum").classList.remove("rolling", "pop");
    $("showCode").textContent = ""; $("showName").textContent = "";
  }
  // 投影區：正在顯示得獎號碼時，獎項跟著那個號碼；清掉之後才換成目前要抽的獎項
  $("showNum").classList.toggle("is-name", byList());
  const shownPrize = shown && shown.status === "ok" ? D.prizes.find((p) => p.id === shown.prizeId) : null;
  const disp = shownPrize || cur;
  $("showPrize").textContent = disp ? disp.name : D.prizes.length ? "所有獎項都抽完了" : "請先設定獎項";
  const got = disp ? D.winners.filter((w) => w.prizeId === disp.id && w.status === "ok") : [];
  $("showProg").textContent = disp ? `已抽 ${got.length} / ${disp.qty} 名` : "";
  $("showList").replaceChildren(...got.map((w) => el("span", null, w.num)));
  $("showList").classList.toggle("is-name", byList());

  // 統計
  const valid = D.winners.filter((w) => w.status === "ok").length, absent = D.winners.length - valid;
  const totalQty = D.prizes.reduce((s, p) => s + p.qty, 0);
  const info = $("poolInfo"); info.replaceChildren();
  $("statWon").textContent = `${valid}/${totalQty}`;
  if (byList()) {
    const P = peoplePool();
    $("statIssuedL").textContent = "名單人數"; $("statLeftL").textContent = "還沒抽中";
    $("statIssued").textContent = P.all.length;
    $("statLeft").textContent = P.avail.length;
    if (absent) infoLine(info, `不在現場 ${absent} 位（不會再被抽到）`);
    if (P.all.length && P.all.length < totalQty) infoLine(info, `名單 ${P.all.length} 人，比獎項名額 ${totalQty} 少，最後幾個獎會抽不完。`, true, "bad");
  } else {
    const P = pool();
    $("statIssuedL").textContent = "發出"; $("statLeftL").textContent = "箱中剩餘";
    $("statIssued").textContent = P.issued.length;
    $("statLeft").textContent = P.avail.length;
    infoLine(info, `編號共 ${P.all.length}，扣除不參加 ${P.all.length - P.issued.length}${absent ? `；未到場 ${absent}` : ""}`);
    if (D.verify && !usesCode()) infoLine(info, "⚠ 券面設計還沒有 {code} 欄位，現場的券上不會有驗證碼。", true, "bad");
  }

  // 紀錄表
  const tbl = $("winTable"); tbl.replaceChildren();
  const withCode = showCodes() && !byList();
  const withInfo = byList() ? anyInfo() : isList() || anyInfo();
  const head = tbl.createTHead().insertRow();
  ["#", "獎項", byList() ? "得獎者" : "編號", ...(withInfo ? [byList() ? "其他資料" : "名單"] : []), ...(withCode ? ["驗證碼"] : []), "時間", "方式", "狀態", ""]
    .forEach((t) => head.appendChild(el("th", { scope: "col" }, t)));
  const body = tbl.createTBody();
  [...D.winners].map((w, i) => [w, i]).reverse().forEach(([w, i]) => {
    const tr = body.insertRow(); if (w.status !== "ok") tr.className = "absent";
    const td = (t, cls) => { const c = tr.insertCell(); c.textContent = t; if (cls) c.className = cls; return c; };
    td(i + 1, "idx"); td(prizeName(w)); td(w.num, w.key != null ? "" : "n"); if (withInfo) td(whoOf(w)); if (withCode) td(w.code, "code");
    td(fmtTime(w.t), "t"); td(w.src === "random" ? "電腦抽" : "實體抽");
    const absentWord = w.key != null ? "不在現場" : "未到場";
    tr.insertCell().appendChild(el("span", { className: "badge " + (w.status === "ok" ? "ok" : "ab") }, w.status === "ok" ? "有效" : absentWord));
    const toggle = el("button", { type: "button", className: "btn btn-quiet btn-small" }, w.status === "ok" ? "標記" + absentWord : "改回有效");
    toggle.onclick = () => {
      if (w.status !== "ok") {
        const p = D.prizes.find((x) => x.id === w.prizeId);
        if (p && okCount(p.id) >= p.qty && !confirm(`「${p.name}」名額已滿，仍要改回有效嗎？`)) return;
      }
      w.status = w.status === "ok" ? "absent" : "ok"; saveDraw(); renderDrawStatus();
    };
    const del = el("button", { type: "button", className: "btn btn-quiet btn-small danger", title: w.key != null ? "抽錯時使用（這個人會回到可抽狀態）" : "登記錯誤時使用（這張券會回到可抽狀態）" }, "刪除");
    del.onclick = () => { if (confirm(`刪除 ${w.num} 這筆紀錄？（只在登記錯誤時使用）`)) { D.winners.splice(i, 1); saveDraw(); renderDrawStatus(); } };
    tr.insertCell().append(el("div", { className: "row-ops" }, toggle, del));
  });
  $("winMeta").textContent = D.winners.length ? `共 ${D.winners.length} 筆，最新的在最上面` : "尚無紀錄";
  if (!D.winners.length) {
    const c = body.insertRow().insertCell(); c.colSpan = 10; c.className = "empty";
    c.textContent = byList() ? "還沒有人被抽中。在左邊放好名單，按上方的「抽出」。" : "還沒有任何登記。抽出實體券後，在上方輸入券號按 Enter。";
  }
  pushShow("none");
}

// 解析輸入：接受「123」、「000123」、「000123-AB7K」、「000123 AB7K」
function parseEntry(str) {
  const toks = String(str || "").trim().toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean);
  return { numTok: toks[0] || "", codeTok: toks[1] || "" };
}

function register(rawNum, rawCode, src) {
  const { numTok, codeTok } = parseEntry(rawNum);
  const code = String(rawCode || codeTok || "").trim().toUpperCase();
  if (!/^\d+$/.test(numTok)) return msg("err", "請輸入券上的編號（數字）。"), false;
  const n = padNumber(numTok);
  const P = pool();
  if (!P.all.includes(n)) return msg("err", `✗ ${n} 不在這次印製的編號範圍內，請確認是不是本活動的券。`), false;
  if (!P.issued.includes(n)) return msg("err", `✗ ${n} 已登記為「未發出／作廢」，不能得獎。`), false;
  const prev = D.winners.find((w) => w.num === n);
  if (prev) return msg("err", `✗ ${n} 已經登記過（${prizeName(prev)}${prev.status === "ok" ? "" : "，未到場"}，${fmtTime(prev.t)}），請放回並重抽。`), false;
  const prize = currentPrize();
  if (!prize) return msg("err", "所有獎項都已經抽滿了。"), false;
  if (okCount(prize.id) >= prize.qty) return msg("err", `「${prize.name}」名額已滿，請切換獎項。`), false;
  if (D.verify && src !== "random") {
    if (!code) return msg("err", "請輸入券上的驗證碼。"), false;
    if (code !== codeFor(n)) return msg("err", `✗ ${n} 的驗證碼不符（輸入 ${code}）。可能是輸入錯誤，或是偽造的券，請人工確認。`), false;
  }
  const w = { id: newPrizeId(), prizeId: prize.id, prizeName: prize.name, num: n, code: codeFor(n), status: "ok", t: Date.now(), src };
  D.winners.push(w); D.cur = prize.id; saveDraw();
  const left = prize.qty - okCount(prize.id);
  const who = recordLabel(n);
  msg("ok", `✓ ${prize.name}：${n}${who ? `（${who}）` : ""}${left > 0 ? `，還剩 ${left} 名` : `，「${prize.name}」已抽滿`}`);
  shown = w; // 先記住，畫面上的獎項名稱才會是這個號碼得的獎
  renderDrawStatus();
  showWinner(w, true); // 最後才送「得獎」動畫給投影視窗
  return true;
}

// ---------- 電腦隨機抽 ----------
let rolling = false;
// 用瀏覽器的密碼學亂數，不用 Math.random
const rnd = (k) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % k; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 跑馬燈：在投影上快速輪播候選，越跑越慢（只是效果，結果另外抽）
async function roll(labels, ms) {
  const big = $("showNum");
  big.classList.remove("pop"); big.classList.add("rolling");
  $("showCode").textContent = ""; $("showName").textContent = "";
  const end = performance.now() + ms;
  let delay = 40;
  while (performance.now() < end) {
    big.textContent = labels[rnd(labels.length)];
    pushShow("roll");
    await sleep(delay); delay = Math.min(220, delay * 1.08);
  }
}
async function randomDraw() {
  if (rolling) return;
  const prize = currentPrize();
  if (!prize) return msg("err", "所有獎項都已經抽滿了。");
  const avail = pool().avail;
  if (!avail.length) return msg("err", "已經沒有可抽的券了。");
  rolling = true; $("btnRandom").disabled = true;
  if (shown) clearShown();
  await roll(avail, 2200);
  register(avail[rnd(avail.length)], "", "random");
  rolling = false; $("btnRandom").disabled = false;
}

// 名單直接抽：一次可以抽好幾位，一位一位揭曉
async function pickPeople() {
  if (rolling) return;
  const prize = currentPrize();
  if (!prize || okCount(prize.id) >= prize.qty) return msg("err", D.prizes.length ? "所有獎項都已經抽滿了。" : "請先在左邊設定獎項。");
  let P = peoplePool();
  if (!P.all.length) { msg("err", "名單還是空的：先在左邊的表格輸入名字，或從 Excel 整塊貼上。"); pgrid.focusCell(0, 0); return; }
  if (!P.avail.length) return msg("err", "名單上的人都已經抽過了。");
  const left = prize.qty - okCount(prize.id);
  const want = D.pickCount === "all" ? left : Math.min(left, Math.max(1, Math.floor(num(D.pickCount, 1))));
  const n = Math.min(want, P.avail.length);
  rolling = true; $("btnPick").disabled = $("curPrize").disabled = $("btnAbsentLast").disabled = true;
  if (shown) clearShown();
  const got = [];
  try {
    for (let k = 0; k < n; k++) {
      P = peoplePool();
      await roll(P.avail.map((x) => x.name), k === 0 ? 2200 : 900);
      const p = P.avail[rnd(P.avail.length)];
      const w = { id: newPrizeId(), prizeId: prize.id, prizeName: prize.name, num: p.name, key: p.key, info: p.info, code: "", status: "ok", t: Date.now(), src: "random" };
      D.winners.push(w); D.cur = prize.id; saveDraw(); got.push(w);
      shown = w; renderDrawStatus(); showWinner(w, true);
      if (k < n - 1) await sleep(1500); // 讓台下看清楚再抽下一位
    }
  } finally {
    rolling = false; $("btnPick").disabled = $("curPrize").disabled = $("btnAbsentLast").disabled = false;
  }
  const rest = prize.qty - okCount(prize.id);
  const names = got.map((w) => w.num + (w.info ? `（${w.info}）` : "")).join("、");
  msg("ok", `✓ ${prize.name}：${names}${rest > 0 ? `，還剩 ${rest} 名` : `，「${prize.name}」已抽滿`}${n < want ? "。名單上已經沒有其他人了" : ""}`);
  $("btnPick").focus();
}

// ---------- 相機掃描（支援 BarcodeDetector 的瀏覽器才顯示） ----------
let camStream = null, camTimer = null;
function stopCam() {
  clearInterval(camTimer); camTimer = null;
  camStream?.getTracks().forEach((t) => t.stop()); camStream = null;
  $("camBox").hidden = true;
}
async function startCam() {
  try {
    const det = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const v = $("camVideo"); v.srcObject = camStream; await v.play();
    $("camBox").hidden = false;
    camTimer = setInterval(async () => {
      try {
        const r = await det.detect(v);
        if (r.length) { const val = r[0].rawValue; stopCam(); $("entryNum").value = val; $("entryForm").requestSubmit(); }
      } catch (e) { /* 這一格沒掃到 */ }
    }, 250);
  } catch (e) { stopCam(); alert("無法開啟相機：" + e.message); }
}

// ---------- 匯出／列印 ----------
function printWinners() {
  const ok = D.winners.filter((w) => w.status === "ok");
  if (!ok.length) return alert("還沒有有效的得獎紀錄。");
  const win = window.open("", "_blank"); if (!win) return alert("請允許彈出視窗。");
  const doc = win.document;
  doc.title = "得獎名單";
  const st = doc.createElement("style");
  st.textContent = "body{font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;padding:24px;color:#15181a}h1{font-size:22px}h2{font-size:17px;margin:18px 0 6px;border-bottom:1px solid #15181a;padding-bottom:4px}span{display:inline-block;min-width:90px;margin:3px 10px 3px 0;font-size:16px;font-variant-numeric:tabular-nums}";
  doc.head.appendChild(st);
  const h = doc.createElement("h1"); h.textContent = `得獎名單（${new Date().toLocaleDateString("zh-TW")}）`; doc.body.appendChild(h);
  const order = [...D.prizes].reverse(); // 頭獎在最上面
  const ids = new Set(order.map((p) => p.id));
  const groups = order.map((p) => [p.name, ok.filter((w) => w.prizeId === p.id)]);
  const orphan = ok.filter((w) => !ids.has(w.prizeId));
  if (orphan.length) groups.push(["其他", orphan]);
  groups.forEach(([name, ws]) => {
    if (!ws.length) return;
    const h2 = doc.createElement("h2"); h2.textContent = `${name}（${ws.length} 名）`; doc.body.appendChild(h2);
    const d = doc.createElement("div");
    ws.forEach((w) => { const s = doc.createElement("span"); s.textContent = w.num + (whoOf(w) ? " " + whoOf(w) : ""); d.appendChild(s); });
    doc.body.appendChild(d);
  });
  setTimeout(() => win.print(), 300);
}

export function initDraw() {
  loadDraw();
  initShowChannel();
  $("drawTitle").oninput = () => { D.title = $("drawTitle").value; saveDraw(); renderDrawStatus(); };
  $("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (register($("entryNum").value, $("entryCode").value, "manual")) { $("entryNum").value = ""; $("entryCode").value = ""; }
    $("entryNum").focus(); $("entryNum").select();
  });
  // 換獎項：上一個號碼一定要清掉，免得台下以為那個號碼得的是新獎項
  $("curPrize").onchange = () => { D.cur = $("curPrize").value; saveDraw(); clearShown(); };
  $("btnClearShow").onclick = () => { clearShown(); msg("ok", byList() ? "已清除投影上的名字。" : "已清除投影上的號碼。"); focusEntry(); };
  $("showSecs").value = String(num(D.showSecs, 60));
  $("showSecs").onchange = () => { D.showSecs = num($("showSecs").value, 60); saveDraw(); armAutoClear(); };
  $("voidList").oninput = () => { D.voidList = $("voidList").value; saveDraw(); renderDrawStatus(); };
  $("verifyCode").onchange = () => { D.verify = $("verifyCode").checked; saveDraw(); renderDraw(); };
  $("btnAddPrize").onclick = () => { D.prizes.push({ id: newPrizeId(), name: "新獎項", qty: 1 }); saveDraw(); renderDraw(); };

  $("btnAbsentLast").onclick = () => {
    const w = [...D.winners].reverse().find((x) => x.status === "ok");
    if (!w) return msg("err", "沒有可標記的得獎者。");
    const person = w.key != null;
    if (!confirm(person ? `${prizeName(w)}：${w.num} 不在現場？\n這位不會再被抽到，名額會空出來，請再抽一位。` : `${prizeName(w)}：${w.num} 未到場？\n這張券作廢，名額會空出來，請再抽一張。`)) return;
    w.status = "absent"; D.cur = w.prizeId; saveDraw();
    clearShown(); msg("ok", person ? `${w.num} 已標記不在現場，請再抽一位「${prizeName(w)}」。` : `${w.num} 已標記未到場，請再抽一張「${prizeName(w)}」。`);
    focusEntry();
  };
  $("btnRandom").onclick = randomDraw;
  $("btnPick").onclick = pickPeople;
  $("pickCount").onchange = () => { D.pickCount = $("pickCount").value; saveDraw(); };
  document.querySelectorAll('input[name="drawMode"]').forEach((r) => r.addEventListener("change", () => {
    const next = r.value === "list" ? "list" : "ticket";
    if (!r.checked || next === D.mode) return;
    if (D.winners.length && !confirm(`已經有 ${D.winners.length} 筆抽獎紀錄。\n換抽法後舊紀錄會留在下面的表格裡；如果是新的一場，建議先匯出 CSV，再按「清除全部紀錄」。\n\n確定要換嗎？`)) { renderMode(); return; }
    D.mode = next; saveDraw(); clearShown(); renderDraw();
    if (next === "list" && !people().length) pgrid.focusCell(0, 0);
  }));
  pgrid = createGrid({
    head: $("pgHead"), body: $("pgBody"), firstCol: "姓名",
    onCommit(headers, rows) { D.people = tableToTSV(headers, rows); pgLoaded = D.people; saveDraw(); renderPeopleLine(); renderDrawStatus(); },
  });
  $("pgClear").onclick = () => {
    if (pgrid.hasData() && !confirm("清空抽獎名單？（已經抽出的紀錄不受影響）")) return;
    pgrid.clear();
  };
  $("pgImport").onclick = () => {
    const n = parseList(app.S.data.list).records.length;
    if (pgrid.hasData() && !confirm(`把目前的抽獎名單換成「印券設計」的名單（${n} 人）？`)) return;
    D.people = app.S.data.list; saveDraw(); syncPeople(); renderDrawStatus();
  };
  $("btnProjector").onclick = openProjector;
  $("btnFull").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $("show").requestFullscreen?.().catch(() => alert("這個瀏覽器不支援全螢幕。"));
  };
  if ("BarcodeDetector" in window && !byList()) $("btnCam").hidden = false;
  $("camClose").onclick = stopCam;
  $("btnCam").onclick = startCam;

  $("btnWinCsv").onclick = () => {
    if (!D.winners.length) return alert("還沒有紀錄。");
    const rows = D.winners.map((w, i) => [i + 1, prizeName(w), w.key != null ? w.num : `="${w.num}"`, w.code, new Date(w.t).toLocaleString("zh-TW", { hour12: false }),
      w.src === "random" ? "電腦抽" : "實體抽", w.status === "ok" ? "有效" : w.key != null ? "不在現場" : "未到場", whoOf(w)]);
    downloadCSV([["順序", "獎項", byList() ? "得獎者" : "編號", "驗證碼", "時間", "方式", "狀態", byList() ? "其他資料" : "名單資料"], ...rows], `得獎名單_${new Date().toISOString().slice(0, 10)}.csv`);
  };
  $("btnWinPrint").onclick = printWinners;
  $("btnWinReset").onclick = () => {
    if (!D.winners.length) return;
    if (!confirm("確定清除全部抽獎紀錄？建議先匯出 CSV。")) return;
    if (!confirm("再確認一次：清除後無法復原。")) return;
    D.winners = []; D.cur = null; saveDraw(); showWinner(null); msg("ok", "已清除全部紀錄。"); renderDrawStatus();
  };
}
