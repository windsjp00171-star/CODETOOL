// AI 畫背景：使用者自己的金鑰，由瀏覽器直接呼叫 Gemini 或 OpenAI。
// 金鑰只存在這台電腦的瀏覽器（使用者勾選時），不會寫進「存成檔案」。
import { AI_MODELS, AI_KEY_HELP, AI_IDEAS, LS } from "./constants.js";
import { $, clamp, el, ls, loadImage } from "./util.js";
import { bleedMm, ticketSize } from "./geometry.js";
import { drawGenPreview } from "./generator.js";

export const genAi = { img: null, dataURL: null, history: [] };

export async function setGenAi(dataURL) {
  genAi.dataURL = dataURL; genAi.img = dataURL ? await loadImage(dataURL) : null;
  if (dataURL) ls.set(LS.genAi, dataURL); else ls.del(LS.genAi);
}

function fillAiModels(provider) {
  $("genAiModel").replaceChildren(...(AI_MODELS[provider] || AI_MODELS.gemini).map(([v, t]) => el("option", { value: v }, t)));
  $("genAiKeyHelp").href = AI_KEY_HELP[provider] || AI_KEY_HELP.gemini;
}
function loadAiKey() {
  const k = ls.get(LS.aiKey($("genAiProvider").value)) || "";
  $("genAiKey").value = k; $("genAiRemember").checked = !!k;
}
// 開啟對話框：先填模型清單，再由 openGenerator 寫回存的設定，最後載入金鑰與縮圖
export const prepareAiForm = (provider) => fillAiModels(provider);
export function finishAiForm() { loadAiKey(); renderAiThumbs(); }
export function updateGenSrcUI() {
  const ai = (document.querySelector('input[name="genSrc"]:checked')?.value || "theme") === "ai";
  $("genAiBox").hidden = !ai; $("genThemeRow").hidden = ai;
}
export function setAiStatus(type, text) { const node = $("genAiStatus"); node.className = "ai-status " + type; node.textContent = text; }

function renderAiThumbs() {
  $("genAiThumbs").replaceChildren(...genAi.history.map((u) => {
    const im = el("img", { src: u, alt: "AI 背景", title: "用這張", className: u === genAi.dataURL ? "on" : "" });
    im.onclick = async () => { await setGenAi(u); renderAiThumbs(); drawGenPreview(); };
    return im;
  }));
}

function buildAiPrompt(desc, portrait) {
  return `${desc}\n\nDecorative background artwork for a printed raffle ticket, ${portrait ? "tall vertical layout; keep the upper and middle area calm and uncluttered" : "wide horizontal banner; keep the left two-thirds calm and uncluttered"} so that text can be placed on top later. Soft, high quality, print friendly. Absolutely no text, letters, numbers, logos, frames with writing or watermarks anywhere in the image. 畫面中不要出現任何文字或數字。`;
}
function nearestRatio(r, list) {
  let best = list[0], bd = Infinity;
  list.forEach((s) => { const [a, b] = s.split(":").map(Number); const d = Math.abs(Math.log(r / (a / b))); if (d < bd) { bd = d; best = s; } });
  return best;
}
async function postJSON(url, headers, body, signal) {
  const res = await fetch(url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(body), signal });
  let json = null; try { json = await res.json(); } catch (e) { /* 非 JSON 回應 */ }
  return { status: res.status, ok: res.ok, json };
}
function aiErrorText(status, json, provider) {
  const m = json?.error?.message || "";
  if (status === 401 || status === 403 || /API key not valid|invalid_api_key|Incorrect API key/i.test(m)) return "金鑰不正確或沒有權限，請確認貼上的金鑰。";
  if (status === 429 || /quota|rate limit|billing|insufficient/i.test(m)) return provider === "openai" ? "額度不足或太頻繁：請確認 OpenAI 帳號已儲值，或稍等一下再試。" : "額度用完或太頻繁：請稍等一下再試，或到 Google AI Studio 確認方案。";
  if (status === 404) return "找不到這個模型，請換一個模型試試。";
  if (/safety|moderation|blocked|policy/i.test(m)) return "AI 拒絕畫這張（可能觸發了安全限制），請換個說法。";
  return `產生失敗（${status}）：${m || "未知錯誤"}`;
}
async function callGemini(key, model, prompt, ratio, signal) {
  const isNew = model.startsWith("gemini-3.1");
  const ratios = isNew ? ["1:8", "1:4", "9:16", "2:3", "3:4", "4:5", "1:1", "5:4", "4:3", "3:2", "16:9", "21:9", "4:1", "8:1"] : ["9:16", "2:3", "3:4", "4:5", "1:1", "5:4", "4:3", "3:2", "16:9", "21:9"];
  const mk = (full) => {
    const imageConfig = { aspectRatio: full ? nearestRatio(ratio, ratios) : (ratio >= 1 ? "16:9" : "9:16") };
    if (full && !model.startsWith("gemini-2.5")) imageConfig.imageSize = "2K";
    return { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig } };
  };
  const hdr = { "x-goog-api-key": key };
  const url = (v) => `https://generativelanguage.googleapis.com/${v}/models/${encodeURIComponent(model)}:generateContent`;
  let r = await postJSON(url("v1"), hdr, mk(true), signal);
  if (r.status === 404) r = await postJSON(url("v1beta"), hdr, mk(true), signal);
  if (r.status === 400 && !/API key/i.test(r.json?.error?.message || "")) r = await postJSON(url("v1beta"), hdr, mk(false), signal); // 退回最基本的設定
  if (!r.ok) throw new Error(aiErrorText(r.status, r.json, "gemini"));
  const cand = r.json?.candidates?.[0];
  const part = cand?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const inl = part && (part.inlineData || part.inline_data);
  if (!inl?.data) {
    const why = r.json?.promptFeedback?.blockReason || cand?.finishReason || "";
    throw new Error(/SAFETY|BLOCK|PROHIBITED|IMAGE_SAFETY/i.test(why) ? "AI 拒絕畫這張（可能觸發了安全限制），請換個說法。" : "AI 沒有回傳圖片，請再按一次試試。");
  }
  return `data:${inl.mimeType || inl.mime_type || "image/png"};base64,${inl.data}`;
}
async function callOpenAI(key, model, prompt, ratio, signal) {
  const flexible = /^gpt-image-2/.test(model);
  const stdSize = ratio > 1.2 ? "1536x1024" : ratio < 0.83 ? "1024x1536" : "1024x1024";
  let size = stdSize;
  if (flexible) {
    const r = clamp(ratio, 1 / 3, 3);
    const w = r >= 1 ? 2048 : Math.round((2048 * r) / 16) * 16, h = r >= 1 ? Math.round(2048 / r / 16) * 16 : 2048;
    size = `${w}x${h}`;
  }
  const body = (sz) => ({ model, prompt, size: sz, n: 1, quality: "medium", output_format: "jpeg", output_compression: 92 });
  const hdr = { Authorization: "Bearer " + key };
  let r = await postJSON("https://api.openai.com/v1/images/generations", hdr, body(size), signal);
  if (r.status === 400 && size !== stdSize && /size/i.test(r.json?.error?.message || "")) r = await postJSON("https://api.openai.com/v1/images/generations", hdr, body(stdSize), signal);
  if (!r.ok) throw new Error(aiErrorText(r.status, r.json, "openai"));
  const b64 = r.json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI 沒有回傳圖片，請再按一次試試。");
  return "data:image/jpeg;base64," + b64;
}
// 統一轉成 JPEG（檔案小、存得進瀏覽器）
async function toJpeg(src) {
  const img = await loadImage(src);
  const sc = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

let aiBusy = false;
async function generate() {
  if (aiBusy) return;
  const provider = $("genAiProvider").value, model = $("genAiModel").value, key = $("genAiKey").value.trim(), desc = $("genAiPrompt").value.trim();
  if (!desc) return setAiStatus("err", "請先寫想要的背景，或點一個靈感。");
  if (!key) return setAiStatus("err", "請貼上 API 金鑰（點「怎麼申請？」看說明）。");
  if ($("genAiRemember").checked) ls.set(LS.aiKey(provider), key); else ls.del(LS.aiKey(provider));
  const { tw, th } = ticketSize(), b = bleedMm();
  const ratio = (tw + 2 * b) / (th + 2 * b);
  const prompt = buildAiPrompt(desc, th > tw * 1.1);
  aiBusy = true; $("genAiGo").disabled = true;
  const t0 = Date.now();
  const timer = setInterval(() => setAiStatus("busy", `AI 正在畫…（${Math.round((Date.now() - t0) / 1000)} 秒，通常 10～40 秒）`), 500);
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 150000);
  try {
    const raw = provider === "openai" ? await callOpenAI(key, model, prompt, ratio, ctrl.signal) : await callGemini(key, model, prompt, ratio, ctrl.signal);
    const jpg = await toJpeg(raw);
    genAi.history.unshift(jpg); if (genAi.history.length > 6) genAi.history.pop();
    await setGenAi(jpg);
    clearInterval(timer);
    setAiStatus("ok", "✓ 畫好了！不滿意可以再按一次，下方會保留最近幾張讓你挑。");
    renderAiThumbs(); drawGenPreview();
  } catch (e) {
    clearInterval(timer);
    setAiStatus("err", e.name === "AbortError" ? "等太久了（超過 150 秒），請再試一次。" : (e.message === "Failed to fetch" ? "連不上 AI 服務，請檢查網路。" : e.message));
  } finally { clearTimeout(to); aiBusy = false; $("genAiGo").disabled = false; }
}

export function initAi() {
  $("genAiIdeas").append(...AI_IDEAS.map(([t, prompt]) => el("button", { type: "button", className: "chip", onclick: () => { $("genAiPrompt").value = prompt; } }, t)));
  $("genAiProvider").addEventListener("change", () => { fillAiModels($("genAiProvider").value); loadAiKey(); });
  $("genAiRemember").addEventListener("change", () => { if (!$("genAiRemember").checked) ls.del(LS.aiKey($("genAiProvider").value)); });
  $("genAiGo").onclick = generate;
  const saved = ls.get(LS.genAi);
  if (saved) setGenAi(saved).then(() => genAi.history.push(saved)).catch(() => {});
}
