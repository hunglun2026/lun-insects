import type { Env } from "./env";

// ntfy：對 https://ntfy.sh/<主題> 送一則訊息，手機 App 訂閱同主題就會跳通知。
// 主題名當密碼用（公開主題，知道名稱的人都收得到），所以放 secret，不進程式碼。
export async function notifyError(env: Env, title: string, body: string): Promise<void> {
  if (!env.NTFY_TOPIC) return;
  try {
    await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
      method: "POST",
      // header 只能放 ASCII，中文標題用 RFC 2047 編碼
      headers: { Title: `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(title)))}?=`, Priority: "high", Tags: "warning" },
      body: body.slice(0, 1000),
    });
  } catch {
    // 通知失敗不能再讓同步本身失敗
  }
}
