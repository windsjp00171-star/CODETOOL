// 不會變動的設定值：紙張、字型、範本、主題、儲存鍵名。

export const PT_MM = 25.4 / 72;
export const PAPERS = { A4: [210, 297], A3: [297, 420], B4: [257, 364], Letter: [215.9, 279.4] };
export const SAFE_MM = 3;
// 省紙：允許縮小到 90%，一頁放最多張
export const SAVE_MIN_SCALE = 0.9;

export const FONTS = [
  { v: '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif', t: "黑體（系統預設）" },
  { v: '"Noto Serif TC", "PMingLiU", "Songti TC", serif', t: "明體" },
  { v: "Arial, Helvetica, sans-serif", t: "Arial" },
  { v: '"Courier New", Courier, monospace', t: "Courier（等寬）" },
  { v: 'Consolas, "Roboto Mono", monospace', t: "Consolas（等寬）" },
  { v: 'Impact, "Arial Black", sans-serif', t: "Impact（粗）" },
  { v: "Georgia, serif", t: "Georgia" },
];

// localStorage 鍵名（改了會讓使用者既有的資料消失，請勿更動）
export const LS = {
  state: "ticketStudio.state.v2",
  bg: "ticketStudio.bg.v2",
  draw: "ticketStudio.draw.v1",
  view: "ticketStudio.view",
  ui: "ticketStudio.ui",
  moveTipHidden: "ticketStudio.moveTipHidden",
  genAi: "ticketStudio.genAi",
  hello: "ticketStudio.hello",
  aiKey: (provider) => "ticketStudio.aiKey." + provider,
};
export const SHOW_CH = "ticketStudio.show";

// 防偽驗證碼字元：去掉易混淆的 I O 0 1
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 成品尺寸選單
export const SIZES = [
  ["摸彩券（長條）", 215.9, 69.5], ["名片", 90, 54], ["信用卡大小", 85.6, 54], ["餐券／小卡", 90, 50],
  ["入場券", 180, 65], ["明信片", 148, 100], ["4×6 吋相片", 152.4, 101.6], ["A6", 105, 148], ["A5", 148, 210], ["A4", 210, 297],
  // A4 平分成格子（像用 Word 表格做的券），四周留給印表機的邊界
  ["A4 十格（2×5）", 95, 52], ["A4 八格（2×4）", 99, 67], ["A4 十二格（2×6）", 95, 43], ["A4 六格（2×3）", 99, 90], ["A4 十五格（3×5）", 64, 54],
];

// 用途範本
const F_IMPACT = FONTS[5].v;
export const PRESETS = {
  lottery: {
    label: "摸彩券（長條、左右各一個編號）", name: "摸彩券", ticket: { w: 215.9, h: 69.5 }, num: { digits: 6, end: 250 }, data: "seq",
    layout: { paper: "A4", orient: "portrait", cols: 1, rows: 4, gap: 0 }, auto: false,
    fields: [
      { name: "左編號", x: 0.28, y: 0.81, color: "#1f2937" },
      { name: "右編號", x: 0.92, y: 0.88, color: "#1f2937" },
    ],
  },
  bib: {
    label: "號碼牌（運動會、排隊叫號）", name: "號碼牌", ticket: { w: 148, h: 105 }, num: { digits: 3, end: 100 }, data: "seq",
    layout: { paper: "A4", gap: 0 },
    fields: [
      { name: "號碼", x: 0.5, y: 0.55, size: 120, font: F_IMPACT, color: "#111827" },
      { name: "標題", tpl: "2026 運動會", x: 0.5, y: 0.12, size: 16, color: "#374151" },
    ],
  },
  admission: {
    label: "入場券／門票（附 QR Code 與防偽碼）", name: "入場券", ticket: { w: 180, h: 65 }, num: { digits: 5, end: 300 }, data: "seq",
    layout: { paper: "A4", gap: 0 },
    fields: [
      { name: "活動名稱", tpl: "2026 年度活動 入場券", x: 0.06, y: 0.25, size: 20, align: "left" },
      { name: "編號", tpl: "No. {n}", x: 0.06, y: 0.72, size: 14, align: "left" },
      { name: "QR Code", type: "qr", tpl: "{n}-{code}", x: 0.87, y: 0.45, qrSize: 26, color: "#000000" },
      { name: "驗證碼", tpl: "驗證碼 {code}", x: 0.87, y: 0.9, size: 8, bold: false },
    ],
  },
  voucher: {
    label: "餐券／兌換券（小張、一頁很多張）", name: "餐券", ticket: { w: 90, h: 50 }, num: { digits: 4, end: 500 }, data: "seq",
    layout: { paper: "A4", gap: 0 },
    fields: [
      { name: "標題", tpl: "餐券", x: 0.5, y: 0.32, size: 30 },
      { name: "編號", tpl: "No. {n}", x: 0.5, y: 0.72, size: 12, bold: false },
      { name: "驗證碼", tpl: "{code}", x: 0.94, y: 0.9, size: 7, bold: false, align: "right", color: "#6b7280" },
    ],
  },
  listraffle: {
    label: "名單摸彩券（每人一張，A4 十格）", name: "名單摸彩券", ticket: { w: 95, h: 52 }, num: { digits: 3 }, data: "list", replaceList: true,
    list: "小組\t姓名\n腓立比小組\t進發\n腓立比小組\t建志\n毘努伊勒小組\t淑閔\n加利利小組\t阿蘭\n伯特利小組\t惠子\n多加小組\t淑如",
    layout: { paper: "A4", gap: 0 },
    fields: [
      { name: "標題", tpl: "讀經靈修紀錄摸彩券　2026.10月", x: 0.5, y: 0.13, size: 12, color: "#111827" },
      { name: "小組", tpl: "{小組}", x: 0.06, y: 0.3, size: 10, bold: false, align: "left", color: "#374151" },
      { name: "名字", tpl: "{姓名}", x: 0.5, y: 0.65, size: 46, color: "#111827" },
      { name: "編號", tpl: "{n}", x: 0.96, y: 0.92, size: 6.5, bold: false, align: "right", color: "#9ca3af" },
    ],
  },
  badge: {
    label: "名牌／座位卡（匯入名單，每人一張）", name: "名牌", ticket: { w: 90, h: 55 }, num: { digits: 3 }, data: "list",
    list: "姓名\t單位\n王小明\t業務部\n陳美玲\t行政部\n林志豪\t資訊部\n黃雅婷\t財務部",
    layout: { paper: "A4", gap: 0 },
    fields: [
      { name: "姓名", tpl: "{姓名}", x: 0.5, y: 0.45, size: 30 },
      { name: "單位", tpl: "{單位}", x: 0.5, y: 0.76, size: 13, bold: false, color: "#4b5563" },
    ],
  },
};

// 「幫我做一張」的內建風格
export const THEMES = {
  red:    { label: "喜氣紅金", bg: ["#c81e1e", "#7f1d1d"], ink: "#fde68a", sub: "#fef3c7", line: "#fcd34d", stubBg: "#fff7e0", stubInk: "#7f1d1d", stubLine: "#b45309", pattern: "frame" },
  blue:   { label: "清爽藍", bg: ["#eff6ff", "#dbeafe"], ink: "#1e3a8a", sub: "#1d4ed8", line: "#1e40af", stubBg: "#1e3a8a", stubInk: "#ffffff", stubLine: "#bfdbfe", pattern: "stripes" },
  mono:   { label: "簡約黑白（省墨水）", bg: ["#ffffff", "#ffffff"], ink: "#111827", sub: "#374151", line: "#111827", stubBg: "#ffffff", stubInk: "#111827", stubLine: "#111827", pattern: "border" },
  orange: { label: "活潑橘黃", bg: ["#fff7ed", "#fed7aa"], ink: "#9a3412", sub: "#c2410c", line: "#9a3412", stubBg: "#ea580c", stubInk: "#ffffff", stubLine: "#ffedd5", pattern: "dots" },
  xmas:   { label: "聖誕綠紅", bg: ["#166534", "#14532d"], ink: "#ffffff", sub: "#dcfce7", line: "#fca5a5", stubBg: "#b91c1c", stubInk: "#ffffff", stubLine: "#fecaca", pattern: "snow" },
  pink:   { label: "粉嫩可愛", bg: ["#fdf2f8", "#fbcfe8"], ink: "#9d174d", sub: "#be185d", line: "#9d174d", stubBg: "#f9a8d4", stubInk: "#831843", stubLine: "#831843", pattern: "confetti" },
};

// 🤖 AI 畫背景
export const AI_MODELS = {
  gemini: [["gemini-3.1-flash-image", "Gemini 3.1 Flash Image（推薦，快）"], ["gemini-3-pro-image", "Gemini 3 Pro Image（品質最好、較慢）"], ["gemini-2.5-flash-image", "Gemini 2.5 Flash Image（舊版）"]],
  openai: [["gpt-image-2", "GPT Image 2（推薦）"], ["gpt-image-2.5-flare", "GPT Image 2.5 Flare（較新）"], ["gpt-image-1.5", "GPT Image 1.5（舊版）"]],
};
export const AI_KEY_HELP = { gemini: "https://aistudio.google.com/apikey", openai: "https://platform.openai.com/api-keys" };
export const AI_IDEAS = [
  ["春節喜氣", "紅色與金色的春節背景，祥雲、燈籠、梅花，喜氣洋洋"], ["金色派對", "香檳金色的派對背景，彩帶、亮片、柔和光暈，高級感"],
  ["星空夜景", "深藍色星空與銀河，點點星光，夢幻寧靜"], ["聖誕雪景", "聖誕節雪景，松樹、雪花、溫暖燈光，紅綠配色"],
  ["櫻花水彩", "淡粉色櫻花水彩畫風，花瓣飄落，清新柔和"], ["夏日海洋", "清爽的夏日海洋，藍綠色海浪與陽光，明亮"],
  ["科技感", "深色科技感背景，藍紫色光線與幾何線條"],
];
