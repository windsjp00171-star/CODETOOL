// 圖示：index.html 裡的 SVG sprite（#i-名稱），統一 1.75 線寬。
const NS = "http://www.w3.org/2000/svg";

export function icon(name) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", "#i-" + name);
  svg.appendChild(use);
  return svg;
}
