import Image from "next/image";
import { ApiStatusPanel } from "@/components/sections/api-status";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <Image src="/xk-logo-symbol.svg" alt="XK" width={44} height={44} priority />
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">XK AI Business Assistant</p>
            <p className="mt-0.5 text-xs text-slate-500">商務 AI 助理</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <p className="text-xs font-semibold tracking-widest text-blue-600">系統連線</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">確認服務已準備就緒</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">查看瀏覽器與後端 API 的即時連線狀態。服務恢復後，按下「重試」即可重新連線。</p>
        <div className="mt-9"><ApiStatusPanel /></div>
        <p className="mt-6 text-center text-xs leading-6 text-slate-400">Xplore Kaleidoscope · XK AI Business Assistant</p>
      </main>
    </div>
  );
}
