"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, RotateCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiOrigin, getApiStatus } from "@/lib/api/status";

type Connection =
  | { state: "connecting" }
  | { state: "connected"; checkedAt: string }
  | { state: "failed"; message: string; checkedAt: string };

const checkedAt = () => new Date().toLocaleTimeString("zh-TW", { hour12: false });

export function ApiStatusPanel() {
  const [connection, setConnection] = useState<Connection>({ state: "connecting" });
  const activeRequest = useRef<AbortController | null>(null);

  const check = () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    getApiStatus({ signal: controller.signal }).then(
      () => {
        if (!controller.signal.aborted) setConnection({ state: "connected", checkedAt: checkedAt() });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof TypeError
            ? "無法取得 API 回應。請確認後端已啟動，且允許目前的前端來源。"
            : error instanceof Error ? error.message : "連線失敗，請稍後重試。";
          setConnection({ state: "failed", message, checkedAt: checkedAt() });
        }
      },
    );
  };

  useEffect(() => {
    check();
    return () => activeRequest.current?.abort();
  }, []);

  let origin: string;
  try { origin = getApiOrigin(); }
  catch { origin = "API 位址設定無效"; }

  const { state } = connection;
  const label = state === "connecting" ? "連線中" : state === "connected" ? "已連線" : "連線失敗";
  const Icon = state === "connecting" ? LoaderCircle : state === "connected" ? CircleCheck : CircleX;

  return (
    <section aria-labelledby="connection-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
        <h2 id="connection-heading" className="font-semibold text-slate-900">API 連線狀態</h2>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">本機開發環境</span>
      </div>
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-4">
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${state === "connected" ? "bg-emerald-50 text-emerald-700" : state === "failed" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600"}`}>
            <Icon aria-hidden="true" className={`size-6 ${state === "connecting" ? "motion-safe:animate-spin" : ""}`} />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">{label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {state === "connecting" ? "正在向後端確認連線，最多等待 5 秒。" :
                state === "connected" ? "瀏覽器已成功取得 API 回應。" : connection.message}
            </p>
          </div>
        </div>
        <dl className="mt-8 grid gap-5 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <dt className="mb-1 text-xs font-medium text-slate-500">API 位址</dt>
            <dd className="break-all font-mono text-xs leading-6 text-slate-700">{origin}/api/v1/status</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium text-slate-500">回應結果</dt>
            <dd className="font-mono text-xs leading-6 text-slate-700">{state === "connected" ? '{"status":"ok"}' : "—"}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-500">{state === "connecting" ? "正在查詢最新狀態…" : `最後檢查：${connection.checkedAt}`}</p>
          <Button onClick={() => { setConnection({ state: "connecting" }); check(); }} disabled={state === "connecting"}>
            <RotateCw aria-hidden="true" />重試
          </Button>
        </div>
      </div>
      <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-xs leading-5 text-slate-500 sm:px-8">
        <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>「已連線」代表瀏覽器取得符合契約的 API 回應。應用程式與資料庫健康狀態請透過 /actuator/health 確認。</p>
      </div>
    </section>
  );
}
