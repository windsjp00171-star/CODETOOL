// 抽獎網址：把標題、獎項、名單整個包進網址的 # 後面（# 後面不會送到伺服器，只在瀏覽器裡）。
// 先壓縮再轉成網址可用的 base64；瀏覽器不支援壓縮時就不壓。
// 格式：z… = 壓縮過的 JSON、j… = 沒壓縮的 JSON。JSON：{ v:1, t:標題, p:[[獎項,名額]…], h:欄名[], m:主要欄序號, r:[[…]…] }

const toB64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function packStage(data) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ...data }));
  if ("CompressionStream" in window) {
    try { return "z" + toB64(await pipe(bytes, new CompressionStream("deflate-raw"))); } catch (e) { /* 改用不壓縮 */ }
  }
  return "j" + toB64(bytes);
}

export async function unpackStage(code) {
  code = String(code || "").replace(/^#/, "");
  const kind = code[0], body = fromB64(code.slice(1));
  let bytes = body;
  if (kind === "z") {
    if (!("DecompressionStream" in window)) throw new Error("這個瀏覽器太舊，打不開這個網址，請換 Chrome、Edge 或 Safari 新版。");
    bytes = await pipe(body, new DecompressionStream("deflate-raw"));
  } else if (kind !== "j") throw new Error("bad");
  const d = JSON.parse(new TextDecoder().decode(bytes));
  if (!d || !Array.isArray(d.p) || !Array.isArray(d.h) || !Array.isArray(d.r)) throw new Error("bad");
  return d;
}

// 同一個網址的抽獎結果存在同一格（重新整理不會不見）
export function stageKey(code) {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h * 33) ^ code.charCodeAt(i)) >>> 0;
  return "ticketStudio.stage." + h.toString(36);
}
