import type { Env } from "./env";
import { ftsQuery } from "./tokens";

const json = (data: unknown, cache: string) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

// 邊緣快取：同機房的相同請求直接回存好的結果，不查 D1。
// 鍵帶 APP_VERSION（部署新版自動換新）與完整查詢字串；照片上傳後前端 meta 的 photos 會變，前端把它帶在 m 參數。
async function edge(url: URL, env: Env, ctx: ExecutionContext, cache: string, build: () => Promise<unknown>) {
  const key = new Request(`${url.origin}${url.pathname}?app=${encodeURIComponent(env.APP_VERSION)}&${url.searchParams}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = json(await build(), cache);
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

const int = (v: string | null, d: number, lo: number, hi: number) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// 物種清單的精簡欄位：整份一次給前端（約 1,700 種），遊戲與小百科都在瀏覽器裡篩選出題
const SP_LIST = "id, kind, grp, sci, zh, alt, ord, fam, fam_zh, endemic, alien, prot, lv, rank, obs, img, photo, months, spec, stages IS NOT NULL AS st, json_extract(photos, '$[0].by') AS by, json_extract(photos, '$[0].lic') AS lic";

// 標本篩選：目、縣市、物種、年代（十年）、關鍵字。回傳 [FROM＋WHERE 片段, 參數]
function specFilter(p: URLSearchParams): [string, unknown[]] {
  const w: string[] = [];
  const args: unknown[] = [];
  const q = ftsQuery(p.get("q") ?? "");
  let from = "specimens s";
  if (q) { from = "specimens_fts f JOIN specimens s ON s.n = f.rowid"; w.push("specimens_fts MATCH ?"); args.push(q); }
  if (p.get("ord")) { w.push("s.ord = ?"); args.push(p.get("ord")); }
  if (p.get("county")) { w.push("s.county = ?"); args.push(p.get("county")); }
  if (p.get("sp")) { w.push("s.sp = ?"); args.push(+p.get("sp")!); }
  if (p.get("dec")) { const d = int(p.get("dec"), 0, 1800, 2100); w.push("s.year BETWEEN ? AND ?"); args.push(d, d + 9); }
  if (p.get("tw") === "1") w.push("s.country = '台灣'");
  return [`${from} WHERE ${w.length ? w.join(" AND ") : "1=1"}`, args];
}

export async function handleApi(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const p = url.searchParams;
  const path = url.pathname;

  if (path === "/api/meta") {
    return edge(url, env, ctx, "public, max-age=60, s-maxage=300", async () => {
      const m = await env.DB.prepare("SELECT k, v FROM meta").all<{ k: string; v: string }>();
      const meta = Object.fromEntries(m.results.map((r) => [r.k, r.v]));
      const c = await env.DB.prepare(
        "SELECT sum(kind='insect') AS insects, sum(kind='other') AS others, sum(photo) AS photos FROM species WHERE pool=1",
      ).first<{ insects: number; others: number; photos: number }>();
      return {
        version: env.APP_VERSION, species: +(meta.species_count ?? 0), specimens: +(meta.specimens_count ?? 0),
        insects: c?.insects ?? 0, others: c?.others ?? 0, photos: c?.photos ?? 0,
        importedAt: meta.specimens_imported_at ?? null,
        orders: meta.orders ? JSON.parse(meta.orders) : [],
      };
    });
  }

  // 全部出題池物種（有照片的）。m＝照片數，照片補上後快取鍵就換新
  if (path === "/api/species") {
    return edge(url, env, ctx, "public, max-age=600, s-maxage=86400", async () => {
      const r = await env.DB.prepare(`SELECT ${SP_LIST} FROM species WHERE pool=1 AND photo=1 ORDER BY kind, rank, n`).all();
      return { items: r.results.map((x: any) => ({ ...x, months: JSON.parse(x.months || "[]") })) };
    });
  }

  // 物種詳情：別名、全部照片與作者、紅皮書、成長階段照片、白話介紹，加上標本館的縣市與年代統計
  const one = path.match(/^\/api\/sp\/(\d+)$/);
  if (one) {
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const id = +one[1];
      const it: any = await env.DB.prepare("SELECT s.*, a.text AS ai_text, a.src AS ai_src FROM species s LEFT JOIN ai_plain a ON a.id = s.id WHERE s.id = ?").bind(id).first();
      if (!it) return { item: null };
      for (const k of ["months", "photos", "stages"]) it[k] = it[k] ? JSON.parse(it[k]) : null;
      const counties = await env.DB.prepare("SELECT county, count(*) AS n FROM specimens WHERE sp = ? AND county IS NOT NULL GROUP BY county ORDER BY n DESC").bind(id).all();
      const years = await env.DB.prepare("SELECT min(year) AS y0, max(year) AS y1 FROM specimens WHERE sp = ?").bind(id).first();
      return { item: it, spec: { counties: counties.results, ...years } };
    });
  }

  // 標本列表：依館內編號往後翻頁（after＝上一頁最後一筆的 n）
  if (path === "/api/specimens") {
    return edge(url, env, ctx, "public, max-age=600, s-maxage=86400", async () => {
      const [fw, args] = specFilter(p);
      const after = int(p.get("after"), 0, 0, 1e9);
      const r = await env.DB.prepare(`SELECT s.* FROM ${fw} AND s.n > ? ORDER BY s.n LIMIT 30`).bind(...args, after).all();
      return { items: r.results };
    });
  }

  // 標本統計（標本館探究）：符合條件的總數、各縣市、每十年、各目、最多的物種
  if (path === "/api/spec/stats") {
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const [fw, args] = specFilter(p);
      const run = (sql: string) => env.DB.prepare(sql).bind(...args).all();
      const [total, counties, decades, orders, top, abroad] = await Promise.all([
        env.DB.prepare(`SELECT count(*) AS n FROM ${fw}`).bind(...args).first<{ n: number }>(),
        run(`SELECT s.county, count(*) AS n FROM ${fw} AND s.county IS NOT NULL GROUP BY s.county`),
        run(`SELECT (s.year / 10) * 10 AS decade, count(*) AS n FROM ${fw} AND s.year IS NOT NULL GROUP BY decade ORDER BY decade`),
        run(`SELECT s.ord, count(*) AS n FROM ${fw} GROUP BY s.ord ORDER BY n DESC`),
        run(`SELECT s.sci, max(s.zh) AS zh, max(s.sp) AS sp, count(*) AS n FROM ${fw} AND s.sci IS NOT NULL GROUP BY s.sci ORDER BY n DESC LIMIT 10`),
        run(`SELECT s.country, count(*) AS n FROM ${fw} AND s.country != '台灣' GROUP BY s.country ORDER BY n DESC LIMIT 8`),
      ]);
      return { total: total?.n ?? 0, counties: counties.results, decades: decades.results, orders: orders.results, top: top.results, abroad: abroad.results };
    });
  }

  return json({ error: "not found" }, "no-store");
}
