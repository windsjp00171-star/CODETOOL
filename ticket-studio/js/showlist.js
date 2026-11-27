// 投影下方的得獎名單：所有獎項都列出來、依獎項分類（換到下一個獎，上一個獎的人不會消失）。
// 主畫面、投影視窗、抽獎網址頁共用。
import { el } from "./util.js";

/** @param {{name:string, cur?:boolean, items:string[]}[]} groups 依抽獎順序，只放有人得獎的獎項 */
export function renderGroups(host, groups) {
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  host.classList.toggle("dense", total > 24);
  host.classList.toggle("xdense", total > 60);
  host.dataset.groups = JSON.stringify(groups);
  host.replaceChildren(...groups.map((g) => el("div", { className: "grp" + (g.cur ? " cur" : "") },
    el("span", { className: "grp-name" }, g.name),
    el("div", { className: "grp-items" }, ...g.items.map((t) => el("span", null, t))))));
}
export const readGroups = (host) => { try { return JSON.parse(host.dataset.groups || "[]"); } catch (e) { return []; } };
