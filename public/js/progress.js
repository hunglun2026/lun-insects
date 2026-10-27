/* 探險護照的紀錄：看過哪些昆蟲、各遊戲最好幾顆星、徽章。只存在這台裝置的 localStorage，不上傳、不蒐集個資。
   Progress.seen(sp)、Progress.stars(key, n)、Progress.badges()、Progress.get()、Progress.clear() */
window.Progress = (function () {
  "use strict";
  const KEY = "in-progress-v1";
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.seen) return s;
    } catch (e) { /* 無痕模式 */ }
    return { seen: {}, stars: {} };
  }
  function update(fn) {
    const s = get();
    fn(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了，不影響遊戲 */ }
  }
  // seen：{ 物種編號: [目, 名稱, 照片編號, 特有 1/0] }，護照頁直接拿來畫，不必再查 API
  const seen = (sp) => update((s) => { if (!s.seen[sp.id]) s.seen[sp.id] = [sp.ord || sp.grp || "", sp.name, sp.img || "", sp.endemic ? 1 : 0]; });
  const stars = (key, n) => update((s) => { s.stars[key] = Math.max(s.stars[key] || 0, n); });
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } };

  // 各遊戲在護照上顯示的名字（key 要跟各遊戲存星數用的一樣；難度另外記，例如 guess-e）
  const GAMES = [
    ["guess", "猜猜我是誰"], ["guess-timed", "猜我是誰・60 秒"], ["classify", "分類闖關"], ["classify-timed", "分類闖關・60 秒"],
    ["isinsect", "是不是昆蟲"],
  ];
  const LV = { e: "國小", j: "國中", s: "高中" };

  // 小圖鑑的資料在 book.js（護照頁有載入）；沒載入的頁面不算這個徽章
  function bookDone() {
    if (!window.Book) return false;
    const b = Book.get();
    return b.items.length >= 5 && b.items.every((x) => (x.note || "").trim().length >= 10);
  }

  // 徽章：有沒有拿到從紀錄算出來，不另外存，規則改了舊紀錄也會跟著對
  function badges() {
    const s = get();
    const list = Object.values(s.seen);
    const ords = new Set(list.map((x) => x[0]).filter(Boolean));
    const endemic = list.filter((x) => x[3]).length;
    const st = (k) => Math.max(...["e", "j", "s"].map((l) => s.stars[k + "-" + l] || 0));
    const stLv = (k, l) => s.stars[k + "-" + l] || 0;
    const badge = [
      ["👣", "第一步", "在小百科看第 1 種昆蟲", list.length >= 1],
      ["📖", "小小觀察家", "在小百科看過 30 種", list.length >= 30],
      ["🗂️", "分類通", "看過 8 個不同「目」的昆蟲", ords.size >= 8],
      ["🏝️", "台灣寶貝", "看過 5 種台灣特有種", endemic >= 5],
      ["🔍", "猜謎高手", "猜猜我是誰拿到三顆星", st("guess") >= 3],
      ["🧩", "分類達人", "分類闖關拿到三顆星", st("classify") >= 3],
      ["🕷️", "火眼金睛", "是不是昆蟲拿到三顆星", st("isinsect") >= 3],
      ["⚡", "閃電快手", "任一個 60 秒挑戰拿到三顆星", st("guess-timed") >= 3 || st("classify-timed") >= 3],
      ["🎓", "高中挑戰者", "用高中難度在任一遊戲拿到三顆星", GAMES.some(([k]) => stLv(k, "s") >= 3)],
    ];
    return badge.map(([icon, name, how, got]) => ({ icon, name, how, got }));
  }
  return { get, seen, stars, clear, badges, GAMES, LV };
})();
