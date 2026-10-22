/* 探險護照：徽章、各遊戲星數（分難度）、看過的昆蟲。資料來自 progress.js（localStorage）。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const root = document.getElementById("game");
  function draw() {
    const s = Progress.get();
    const seen = Object.entries(s.seen);
    const badges = Progress.badges();
    const starRow = (k) => ["e", "j", "s"].map((l) => {
      const n = s.stars[k + "-" + l] || 0;
      return "<td>" + (n ? "⭐".repeat(n) : "－") + "</td>";
    }).join("");
    root.replaceChildren(el(
      "<div><h2>🏅 徽章（" + badges.filter((b) => b.got).length + " / " + badges.length + "）</h2>" +
      '<div class="cards">' + badges.map((b) => '<div class="tool"' + (b.got ? "" : ' style="opacity:.4"') + '><div class="ico">' + b.icon + "</div><h3>" + esc(b.name) + "</h3><p>" + esc(b.how) + "</p>" +
        '<span class="tag">' + (b.got ? "已獲得" : "還沒拿到") + "</span></div>").join("") + "</div>" +
      "<h2>⭐ 遊戲星星</h2><div class=\"panel\" style=\"overflow-x:auto\"><table class=\"cmp\"><thead><tr><th>遊戲</th><th>國小</th><th>國中</th><th>高中</th></tr></thead><tbody>" +
      Progress.GAMES.map(([k, name]) => "<tr><th>" + esc(name) + "</th>" + starRow(k) + "</tr>").join("") + "</tbody></table></div>" +
      "<h2>📖 看過的昆蟲（" + seen.length + " 種）</h2>" +
      (seen.length ? '<div class="grid" id="seen"></div>' : '<p class="lead">還沒有看過昆蟲，去<a href="/sp">昆蟲小百科</a>逛逛吧！</p>') +
      '<p style="margin-top:28px"><button class="btn danger" id="clear">清除這台裝置的紀錄</button></p></div>'
    ));
    const box = root.querySelector("#seen");
    if (box) {
      seen.slice(-60).reverse().forEach(([id, [ord, name, img]]) => {
        const it = Mu.enrich({ id: +id, ord: Mu.ORDER[ord] ? ord : null, grp: Mu.OTHER[ord] ? ord : null, kind: Mu.OTHER[ord] ? "other" : "insect", name, img, photo: img ? 1 : 0 });
        const a = el('<a class="acard" href="' + Mu.spPage(it) + '"><span class="pic"></span><div class="info"><b>' + esc(name) + "</b><small>" +
          esc(it.ordInfo ? it.ordInfo.folk : it.otherInfo ? it.otherInfo.folk : "") + "</small></div></a>");
        a.querySelector(".pic").replaceWith(Mu.photo(it));
        box.appendChild(a);
      });
    }
    root.querySelector("#clear").onclick = async () => {
      const ok = await Mu.dialog("確定要清除這台裝置上的護照紀錄嗎？清除後無法復原。", [{ label: "取消", value: false }, { label: "清除", value: true, danger: true }]);
      if (ok) { Progress.clear(); draw(); }
    };
  }
  draw();
});
