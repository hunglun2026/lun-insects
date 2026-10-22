/* 猜猜我是誰：看昆蟲照片選名字。
   國小：最常見的 200 種，三選一，干擾選項是別類的昆蟲；國中：常見 700 種，四選一，干擾選項同一目；
   高中：全部，四選一，干擾選項同一科（長得最像），選項下附學名。 */
Mu.boot(function () {
  Quiz.page({
    key: "guess", title: "猜猜我是誰", timed: true,
    intro: {
      e: "看照片，猜猜牠是哪一種昆蟲。三選一，都是台灣很常見的昆蟲。",
      j: "四選一，選項都是同一類的昆蟲，要看清楚花紋和形狀。",
      s: "選項都是同一科、長得很像的昆蟲，選項下面附學名。",
    },
    async rounds(n, lv) {
      const pool = await Qgen.poolFor({ lv });
      return Qgen.make(pool, ["name"], n, lv).map((q) => {
        const r = Qgen.toRound(q);
        if (lv === "s") {
          const sci = Object.fromEntries(pool.map((x) => [x.name, x.sci]));
          r.options.forEach((o) => (o.sub = sci[o.label] || ""));
        }
        return r;
      });
    },
  });
});
