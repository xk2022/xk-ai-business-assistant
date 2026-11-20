import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API 連線狀態 | XK AI Business Assistant",
  description: "XK AI Business Assistant 本機 API 連線狀態。",
  robots: { index: false, follow: false },
  icons: { icon: "/xk-logo-symbol.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
