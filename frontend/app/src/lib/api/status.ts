export type ApiStatus = { status: "ok" };
export const STATUS_TIMEOUT_MS = 5_000;

export function getApiOrigin(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("API 位址設定無效，請設定完整的 http 或 https origin。");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("API 位址只能包含 origin，請移除路徑、查詢參數與帳密。");
  }
  return url.origin;
}

export async function getApiStatus({
  signal,
  timeoutMs = STATUS_TIMEOUT_MS,
}: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ApiStatus> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = async (): Promise<ApiStatus> => {
      const response = await fetch(new URL("/api/v1/status", getApiOrigin()), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      if (response.status !== 200) throw new Error(`API 回應 HTTP ${response.status}。`);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("API 回應不是有效的 JSON。");
      }
      if (
        typeof body !== "object" || body === null ||
        !("status" in body) || body.status !== "ok"
      ) {
        throw new Error("API 回應不符合預期格式（status: ok）。");
      }
      return { status: "ok" };
    };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("連線逾時（5 秒），請確認後端後重試。"));
        controller.abort();
      }, timeoutMs);
    });
    return await Promise.race([request(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
