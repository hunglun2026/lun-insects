/* 出題產生器：猜我是誰、分類闖關、是不是昆蟲、學習單、出題投影共用。
   Qgen.poolFor({ lv, ord }) → 這個難度看得到的物種（指定目就只取那一目；非昆蟲一律放進來給「是不是昆蟲」）
   Qgen.make(pool, types, n, lv) → [{ kind, item, q, choices[], answer, explain }]
   Qgen.toRound(q) → Quiz.run 用的回合格式
   所有題目都是選擇題、答案唯一；choices 是顯示文字，answer 是正確答案文字。 */
(function () {
  "use strict";
  const { shuffle, esc } = Mu;

  const KINDS = {
    name: { name: "看照片選名字", ok: (it) => it.kind === "insect" },
    order: { name: "屬於哪一類（目）", ok: (it, lv) => it.kind === "insect" && Mu.ordersFor(lv).some((o) => o.id === it.ord) },
    meta: { name: "完全還是不完全變態", ok: (it, lv) => it.kind === "insect" && !!it.ordInfo && (it.ordInfo.meta !== "none" || lv === "s") },
    insect: { name: "是不是昆蟲", ok: () => true },
  };

  // 看照片選名字的干擾選項：國小挑別的目（一看就不同），國中挑同一目，高中挑同一科（最像）
  function nameChoices(it, pool, lv) {
    const k = Mu.LEVELS[lv].choices - 1;
    const ins = pool.filter((x) => x.kind === "insect" && x.id !== it.id && x.name !== it.name);
    const tiers = lv === "e" ? [ins.filter((x) => x.ord !== it.ord), ins]
      : lv === "j" ? [ins.filter((x) => x.ord === it.ord), ins]
        : [ins.filter((x) => x.fam && x.fam === it.fam), ins.filter((x) => x.ord === it.ord), ins];
    const names = new Set([it.name]);
    for (const tier of tiers) for (const x of shuffle(tier)) { if (names.size > k) break; names.add(x.name); }
    return shuffle([...names]);
  }

  // 分類闖關的干擾選項。高中專挑容易混的（蜂與虻、蛾與石蛾、草蛉與蜻蛉…）
  const CONFUSE = [["Hymenoptera", "Diptera"], ["Lepidoptera", "Trichoptera"], ["Neuroptera", "Megaloptera", "Odonata"],
    ["Orthoptera", "Mantodea", "Phasmida", "Blattodea"], ["Hemiptera", "Coleoptera"], ["Ephemeroptera", "Plecoptera", "Trichoptera"], ["Dermaptera", "Blattodea", "Coleoptera"]];
  function orderChoices(ord, lv) {
    const k = Mu.LEVELS[lv].choices - 1;
    let others = shuffle(Mu.ordersFor(lv).map((o) => o.id).filter((o) => o !== ord));
    if (lv === "s") {
      const near = new Set(CONFUSE.filter((g) => g.includes(ord)).flat());
      others = others.filter((o) => near.has(o)).concat(others.filter((o) => !near.has(o)));
    }
    return shuffle([ord].concat(others.slice(0, k)));
  }
  const ordLabel = (id, lv) => { const o = Mu.ORDER[id]; return lv === "e" ? o.folk : o.zh + "（" + o.folk + "）"; };

  function build(kind, it, pool, lv) {
    const o = it.ordInfo;
    if (kind === "name") {
      return { q: "照片裡的是哪一種昆蟲？", choices: nameChoices(it, pool, lv), answer: it.name,
        explain: "是「" + esc(it.name) + "」" + (o ? "，屬於" + esc(o.zh) + "（" + esc(o.folk) + "）" : "") + "。" };
    }
    if (kind === "order") {
      return { q: "照片裡的昆蟲屬於哪一類？", choices: orderChoices(it.ord, lv).map((x) => ordLabel(x, lv)), answer: ordLabel(it.ord, lv),
        explain: "牠是「" + esc(it.name) + "」，屬於" + esc(o.zh) + "（" + esc(o.folk) + "）：" + esc(o.hint) + "。" };
    }
    if (kind === "meta") {
      const types = lv === "s" ? ["full", "half", "none"] : ["full", "half"];
      const mt = Mu.META_TYPE[o.meta];
      return { q: "「" + it.name + "」的一生是哪一種？", choices: types.map((t) => Mu.META_TYPE[t].name), answer: mt.name,
        explain: esc(o.zh) + "（" + esc(o.folk) + "）是" + esc(mt.name) + "：" + esc(mt.steps.join("→")) + "。" + esc(mt.hint) + "。" };
    }
    // 是不是昆蟲
    const yes = it.kind === "insect";
    const g = it.otherInfo || {};
    // 名字先不給：「人面蜘蛛」「蜈蚣」一看名字就知道答案，答完才揭曉
    return { q: "照片裡的這隻小動物是昆蟲嗎？", choices: ["是昆蟲", "不是昆蟲"], answer: yes ? "是昆蟲" : "不是昆蟲",
      explain: "牠是「" + esc(it.name) + "」，" + (yes ? "屬於" + esc(o ? o.folk : "昆蟲") + "。"
        : "屬於" + esc(g.zh || "") + "（" + esc(g.folk || "") + "），" + esc(g.why || "") + "。") + esc(Mu.INSECT_RULE) + "。" };
  }

  function make(pool, types, n, lv) {
    const out = [];
    let t = 0;
    // 「是不是昆蟲」要一半左右是非昆蟲，其他題型只用昆蟲；依題型輪流出
    const ins = shuffle(pool.filter((x) => x.kind === "insect"));
    const oth = shuffle(pool.filter((x) => x.kind === "other"));
    let oi = 0;
    for (const it of ins) {
      if (out.length >= n) break;
      for (let j = 0; j < types.length; j++) {
        const kind = types[(t + j) % types.length];
        let item = it;
        if (kind === "insect" && Math.random() < 0.5 && oth.length) item = oth[oi++ % oth.length];
        if (KINDS[kind].ok(item, lv)) {
          out.push(Object.assign({ kind, item }, build(kind, item, pool, lv)));
          t = (t + j + 1) % types.length;
          break;
        }
      }
    }
    return out;
  }

  async function poolFor(o) {
    const lv = o.lv || Mu.level();
    return (await Mu.species()).filter((s) => s.kind === "other" || (Mu.inLevel(s, lv) && (!o.ord || s.ord === o.ord)));
  }

  const toRound = (q) => ({
    item: q.item, prompt: esc(q.q), options: q.choices.map((c) => ({ id: c, label: c })), answer: q.answer, explain: q.explain,
  });

  window.Qgen = { KINDS, make, poolFor, toRound, nameChoices, orderChoices, ordLabel };
})();
