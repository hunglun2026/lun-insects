/* 我的小圖鑑的資料：只存在這台裝置的 localStorage。小百科（加入）與小圖鑑頁共用。
   Book.get() → { title, items:[{ id, name, ord, img, note }] }；add(sp)、has(id)、save(state) */
window.Book = (function () {
  "use strict";
  const KEY = "in-book-v1";
  const MAX = 12;
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && Array.isArray(s.items)) return s;
    } catch (e) { /* 無痕模式 */ }
    return { title: "我的昆蟲小圖鑑", items: [] };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  const has = (id) => get().items.some((x) => x.id === id);
  // 回傳 "added"、"exists"、"full"
  function add(sp) {
    const s = get();
    if (s.items.some((x) => x.id === sp.id)) return "exists";
    if (s.items.length >= MAX) return "full";
    s.items.push({ id: sp.id, name: sp.name, ord: sp.ord || sp.grp || "", img: sp.img || "", note: "" });
    save(s);
    return "added";
  }
  return { get, save, add, has, MAX };
})();
