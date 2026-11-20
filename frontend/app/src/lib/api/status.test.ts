import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiOrigin, getApiStatus } from "./status";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("API status contract", () => {
  it("requests the configured browser origin and accepts HTTP 200 with status ok", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8090");
    fetchMock.mockResolvedValueOnce(new Response('{"status":"ok"}', { status: 200 }));
    await expect(getApiStatus()).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenLastCalledWith(new URL("http://localhost:8090/api/v1/status"), expect.objectContaining({ method: "GET", cache: "no-store", credentials: "omit" }));
  });

  it.each([201, 404, 503])("rejects HTTP %s even with an ok body", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response('{"status":"ok"}', { status }));
    await expect(getApiStatus()).rejects.toThrow(`HTTP ${status}`);
  });

  it.each(['{"status":"down"}', '{}', 'null', '[]', '"ok"'])('rejects non-contract JSON %s', async (body) => {
    fetchMock.mockResolvedValueOnce(new Response(body));
    await expect(getApiStatus()).rejects.toThrow("不符合預期格式");
  });

  it("rejects invalid JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>unavailable</html>"));
    await expect(getApiStatus()).rejects.toThrow("不是有效的 JSON");
  });

  it("propagates browser network failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getApiStatus()).rejects.toThrow("Failed to fetch");
  });

  it("times out a stalled connection and aborts its request", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_, options) => {
      requestSignal = options?.signal ?? undefined;
      return new Promise(() => {});
    });
    const check = expect(getApiStatus({ timeoutMs: 50 })).rejects.toThrow("連線逾時");
    await vi.advanceTimersByTimeAsync(50);
    await check;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("also times out a stalled response body", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start() {} })));
    const check = expect(getApiStatus({ timeoutMs: 50 })).rejects.toThrow("連線逾時");
    await vi.advanceTimersByTimeAsync(50);
    await check;
  });

  it("forwards caller cancellation", async () => {
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_, options) => {
      requestSignal = options?.signal ?? undefined;
      return new Promise((_, reject) => requestSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    });
    const controller = new AbortController();
    const check = getApiStatus({ signal: controller.signal });
    controller.abort();
    await expect(check).rejects.toThrow("Aborted");
    expect(requestSignal?.aborted).toBe(true);
  });
});

describe("API origin configuration", () => {
  it.each(["localhost:8080", "http://localhost:8080/api/v1", "http://localhost:8080?key=x", "http://user:secret@localhost:8080", "ftp://localhost:8080"])("rejects invalid origin %s", (origin) => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", origin);
    expect(() => getApiOrigin()).toThrow();
  });
});
