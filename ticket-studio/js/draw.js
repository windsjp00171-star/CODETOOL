// 抽獎紀錄：現場實體抽出 → 輸入／掃描券號 → 檢查 → 登記，並同步到投影視窗。
import { LS } from "./constants.js";
import { $, num, el, ls, randomId, downloadCSV, infoLine, setMarked } from "./util.js";
import { buildNumbers, parseRanges, codeFor, usesCode, recordLabel, isList, padNumber } from "./numbers.js";
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
});

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

function showWinner(w, animate) {
  const big = $("showNum");
  big.textContent = w ? w.num : " ";
  big.classList.remove("rolling", "pop");
  if (w && animate) { void big.offsetWidth; big.classList.add("pop"); }
  $("showCode").textContent = w && showCodes() ? `驗證碼 ${w.code}` : "";
  $("showName").textContent = w ? recordLabel(w.num) : "";
  pushShow(w && animate ? "pop" : "none");
}

function iconBtn(name, title, onclick, cls) {
  return el("button", { type: "button", className: "btn btn-icon" + (cls ? " " + cls : ""), title, ariaLabel: title, onclick }, icon(name));
}

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
  $("voidList").value = D.voidList;
  if (D.verify || String(D.voidList || "").trim()) $("drawMore").open = true; // 有設定就展開，免得被忽略
  $("drawTitle").value = D.title || "";
  $("verifyCode").checked = !!D.verify;
  $("entryCode").hidden = !D.verify;
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

  // 投影區
  $("showPrize").textContent = cur ? cur.name : D.prizes.length ? "所有獎項都抽完了" : "請先設定獎項";
  const got = cur ? D.winners.filter((w) => w.prizeId === cur.id && w.status === "ok") : [];
  $("showProg").textContent = cur ? `已抽 ${got.length} / ${cur.qty} 名` : "";
  $("showList").replaceChildren(...got.map((w) => el("span", null, w.num)));

  // 統計
  const P = pool();
  const valid = D.winners.filter((w) => w.status === "ok").length, absent = D.winners.length - valid;
  const totalQty = D.prizes.reduce((s, p) => s + p.qty, 0);
  const info = $("poolInfo"); info.replaceChildren();
  $("statIssued").textContent = P.issued.length;
  $("statWon").textContent = `${valid}/${totalQty}`;
  $("statLeft").textContent = P.avail.length;
  infoLine(info, `編號共 ${P.all.length}，扣除不參加 ${P.all.length - P.issued.length}${absent ? `；未到場 ${absent}` : ""}`);
  if (D.verify && !usesCode()) infoLine(info, "⚠ 券面設計還沒有 {code} 欄位，現場的券上不會有驗證碼。", true, "bad");

  // 紀錄表
  const tbl = $("winTable"); tbl.replaceChildren();
  const withCode = showCodes();
  const head = tbl.createTHead().insertRow();
  ["#", "獎項", "編號", ...(isList() ? ["名單"] : []), ...(withCode ? ["驗證碼"] : []), "時間", "方式", "狀態", ""]
    .forEach((t) => head.appendChild(el("th", { scope: "col" }, t)));
  const body = tbl.createTBody();
  [...D.winners].map((w, i) => [w, i]).reverse().forEach(([w, i]) => {
    const tr = body.insertRow(); if (w.status !== "ok") tr.className = "absent";
    const td = (t, cls) => { const c = tr.insertCell(); c.textContent = t; if (cls) c.className = cls; return c; };
    td(i + 1, "idx"); td(prizeName(w)); td(w.num, "n"); if (isList()) td(recordLabel(w.num)); if (withCode) td(w.code, "code");
    td(fmtTime(w.t), "t"); td(w.src === "random" ? "電腦抽" : "實體抽");
    tr.insertCell().appendChild(el("span", { className: "badge " + (w.status === "ok" ? "ok" : "ab") }, w.status === "ok" ? "有效" : "未到場"));
    const toggle = el("button", { type: "button", className: "btn btn-quiet btn-small" }, w.status === "ok" ? "標記未到場" : "改回有效");
    toggle.onclick = () => {
      if (w.status !== "ok") {
        const p = D.prizes.find((x) => x.id === w.prizeId);
        if (p && okCount(p.id) >= p.qty && !confirm(`「${p.name}」名額已滿，仍要改回有效嗎？`)) return;
      }
      w.status = w.status === "ok" ? "absent" : "ok"; saveDraw(); renderDrawStatus();
    };
    const del = el("button", { type: "button", className: "btn btn-quiet btn-small danger", title: "登記錯誤時使用（這張券會回到可抽狀態）" }, "刪除");
    del.onclick = () => { if (confirm(`刪除 ${w.num} 這筆紀錄？（只在登記錯誤時使用）`)) { D.winners.splice(i, 1); saveDraw(); renderDrawStatus(); } };
    tr.insertCell().append(el("div", { className: "row-ops" }, toggle, del));
  });
  $("winMeta").textContent = D.winners.length ? `共 ${D.winners.length} 筆，最新的在最上面` : "尚無紀錄";
  if (!D.winners.length) {
    const c = body.insertRow().insertCell(); c.colSpan = 10; c.className = "empty";
    c.textContent = "還沒有任何登記。抽出實體券後，在上方輸入券號按 Enter。";
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
  renderDrawStatus();
  showWinner(w, true); // 最後才送「得獎」動畫給投影視窗
  return true;
}

// ---------- 電腦隨機抽 ----------
let rolling = false;
async function randomDraw() {
  if (rolling) return;
  const prize = currentPrize();
  if (!prize) return msg("err", "所有獎項都已經抽滿了。");
  const avail = pool().avail;
  if (!avail.length) return msg("err", "已經沒有可抽的券了。");
  rolling = true; $("btnRandom").disabled = true;
  const big = $("showNum"); big.classList.add("rolling"); $("showCode").textContent = "";
  const rnd = (k) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % k; };
  const end = performance.now() + 2200;
  let delay = 40;
  while (performance.now() < end) {
    big.textContent = avail[rnd(avail.length)]; $("showName").textContent = "";
    pushShow("roll");
    await new Promise((r) => setTimeout(r, delay)); delay = Math.min(220, delay * 1.08);
  }
  register(avail[rnd(avail.length)], "", "random");
  rolling = false; $("btnRandom").disabled = false;
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
    ws.forEach((w) => { const s = doc.createElement("span"); s.textContent = w.num + (recordLabel(w.num) ? " " + recordLabel(w.num) : ""); d.appendChild(s); });
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
  $("curPrize").onchange = () => { D.cur = $("curPrize").value; saveDraw(); renderDrawStatus(); };
  $("voidList").oninput = () => { D.voidList = $("voidList").value; saveDraw(); renderDrawStatus(); };
  $("verifyCode").onchange = () => { D.verify = $("verifyCode").checked; saveDraw(); renderDraw(); };
  $("btnAddPrize").onclick = () => { D.prizes.push({ id: newPrizeId(), name: "新獎項", qty: 1 }); saveDraw(); renderDraw(); };

  $("btnAbsentLast").onclick = () => {
    const w = [...D.winners].reverse().find((x) => x.status === "ok");
    if (!w) return msg("err", "沒有可標記的得獎者。");
    if (!confirm(`${prizeName(w)}：${w.num} 未到場？\n這張券作廢，名額會空出來，請再抽一張。`)) return;
    w.status = "absent"; D.cur = w.prizeId; saveDraw();
    showWinner(null); msg("ok", `${w.num} 已標記未到場，請再抽一張「${prizeName(w)}」。`);
    renderDrawStatus(); $("entryNum").focus();
  };
  $("btnRandom").onclick = randomDraw;
  $("btnProjector").onclick = openProjector;
  $("btnFull").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $("show").requestFullscreen?.().catch(() => alert("這個瀏覽器不支援全螢幕。"));
  };
  if ("BarcodeDetector" in window) $("btnCam").hidden = false;
  $("camClose").onclick = stopCam;
  $("btnCam").onclick = startCam;

  $("btnWinCsv").onclick = () => {
    if (!D.winners.length) return alert("還沒有紀錄。");
    const rows = D.winners.map((w, i) => [i + 1, prizeName(w), `="${w.num}"`, w.code, new Date(w.t).toLocaleString("zh-TW", { hour12: false }),
      w.src === "random" ? "電腦抽" : "實體抽", w.status === "ok" ? "有效" : "未到場", recordLabel(w.num)]);
    downloadCSV([["順序", "獎項", "編號", "驗證碼", "時間", "方式", "狀態", "名單資料"], ...rows], `得獎名單_${new Date().toISOString().slice(0, 10)}.csv`);
  };
  $("btnWinPrint").onclick = printWinners;
  $("btnWinReset").onclick = () => {
    if (!D.winners.length) return;
    if (!confirm("確定清除全部抽獎紀錄？建議先匯出 CSV。")) return;
    if (!confirm("再確認一次：清除後無法復原。")) return;
    D.winners = []; D.cur = null; saveDraw(); showWinner(null); msg("ok", "已清除全部紀錄。"); renderDrawStatus();
  };
}
