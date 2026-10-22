export interface Env {
  DB: D1Database;
  IMG: R2Bucket;
  ASSETS: Fetcher;
  APP_VERSION: string;
  NTFY_TOPIC?: string;
  ADMIN_TOKEN?: string;
}
