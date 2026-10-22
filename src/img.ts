import type { Env } from "./env";

// 照片：/img/<600|240>/<iNaturalist 照片編號>.webp，從 R2 讀。檔名內容不會變，所以瀏覽器與機房都長快取。
export async function serveImage(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const m = url.pathname.match(/^\/img\/(600|240)\/([0-9]+)\.webp$/);
  if (!m) return new Response("not found", { status: 404 });
  const cacheKey = new Request(url.origin + url.pathname);
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;
  const obj = await env.IMG.get(`${m[1]}/${m[2]}.webp`);
  if (!obj) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  const res = new Response(obj.body, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", etag: obj.httpEtag },
  });
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}

// 批次上傳（本機 tools/upload_images.py 呼叫）：multipart，欄位名＝R2 物件名（600/<代號>.webp）。
// 寫完把主照片有 600 圖的物種標 photo=1，網站與遊戲才會用它（同一種的其他照片也一起傳，但不影響標記）。
export async function uploadImages(req: Request, env: Env): Promise<Response> {
  const form = await req.formData();
  const keys: number[] = [];
  const puts: Promise<unknown>[] = [];
  // 同時寫入整批：逐張 await 一張要 0.7 秒（2026-10-21 實測），100 張就要 2 分多鐘
  for (const [name, val] of form.entries()) {
    if (!/^(600|240)\/[0-9]+\.webp$/.test(name) || typeof val === "string") continue;
    puts.push(env.IMG.put(name, await (val as File).arrayBuffer(), { httpMetadata: { contentType: "image/webp" } }));
    if (name.startsWith("600/")) keys.push(+name.slice(4, -5));
  }
  await Promise.all(puts);
  // 一次 UPDATE 的參數上限 100 個，分段標記
  let marked = 0;
  for (let i = 0; i < keys.length; i += 90) {
    const part = keys.slice(i, i + 90);
    const r = await env.DB.prepare(`UPDATE species SET photo=1 WHERE img IN (${part.map(() => "?").join(",")})`).bind(...part).run();
    marked += r.meta.changes ?? 0;
  }
  return Response.json({ stored: keys.length, marked });
}
