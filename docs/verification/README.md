# Week 03 API 連線驗收

驗收日期：2026-11-20（UTC）。來源規格固定於公司文件庫 commit `61a33e38946ad60195f8a386c7802f9810f6174e`；本次未修改公司文件庫或官網。

## 實際執行結果

完整執行 `scripts/verify-local.sh`，exit code **0**，使用 Spring Boot executable JAR、Next.js production server 及 Chromium；整合驗收未攔截 API，未使用 mock。

| 驗收項目 | 結果 |
| --- | --- |
| 空庫啟動 | 全新具名 volume，migration 前 public 資料表數為 0 |
| `./mvnw --batch-mode clean verify` | 5 個 MVC/CORS + 3 個真實 PostgreSQL/Spring 整合測試通過，無失敗或跳過 |
| Flyway | V1 `enable vector`，success = true |
| `SHOW server_version` | `17.10 (Debian 17.10-1.pgdg12+1)` |
| vector extversion | `0.8.5` |
| 真實向量寫入／讀回 | temporary table 插入 `[1,0,0]`，讀回相同值；距離為 `1.4142135623730951` |
| `/actuator/health` | HTTP 200，`{"status":"UP"}`，包含資料庫健康指標 |
| `/api/v1/status` | HTTP 200，`{"status":"ok"}` |
| `npm ci`、lint、typecheck | 全部通過 |
| 前端單元測試 | 19 個通過，含 HTTP／JSON／網路錯誤、請求及 body 逾時、取消與 origin 驗證 |
| `npm run build` | Next.js production build 通過（Webpack） |
| 真實瀏覽器成功／失敗／恢復 | 全部通過，恢復時使用同一頁按重試，未重新整理 |
| 響應式版面 | 375、768、1024、1440px 均無水平溢出 |
| 瀏覽器頁面執行錯誤 | 無 |

映像：`pgvector/pgvector:0.8.5-pg17-bookworm`。

實際 RepoDigest：`pgvector/pgvector@sha256:d2ef61f42ef767baa5a1475393303cc235bcd92febd9d7014eddb48b41f3bad0`。

測試使用 `xk-verify-1795139591-5581_postgres_data`（55433 埠）；較早的後端驗收使用 `xk-week03-acceptance_postgres_data`（55432 埠）。兩者皆為本次建立的獨立測試 volume。已停止本次所有服務及容器，保留 volume，未刪除任何既有資料。

## 畫面與可機讀結果

- [正常連線](01-connected.png)
- [停止後端後重試失敗](02-disconnected.png)
- [重新啟動後，同頁重試恢復](03-reconnected.png)
- [Playwright 結果](browser-results.json)

## 執行環境與重現

Java 21.0.13.1 JDK、Maven 3.9.11、Node.js 24.22.1、npm 11.9.0、Next.js 16.4.6、React 19.3.1、Spring Boot 3.5.14、Playwright 1.58.2。

一般開發電腦使用根目錄 README 的指令及 `./scripts/verify-local.sh` 即可。本次雲端環境有以下限制，均已處理後完成實測：

- 預裝 Java 缺少編譯工具，另以完整 Temurin 21 JDK 驗證，未降版。
- Maven 需套用環境 HTTP proxy 與系統 CA；設定留在 `/tmp`，未提交任何環境憑證。
- npm cache 與 Chromium 下載位置改至可寫入的 `/tmp`。
- 沙箱限制編譯 worker、IPC 及服務監聽；完整驗收在自動核准的執行環境完成，Next.js 使用支援的 Webpack 模式。

完整腳本的環境專用覆寫為 `JAVA_HOME`、`MAVEN_USER_HOME`、`MAVEN_OPTS`、`MAVEN_ARGS`、`npm_config_cache`、`PLAYWRIGHT_BROWSERS_PATH`，並設定 `TEST_POSTGRES_PORT=55433`、`EVIDENCE_DIR` 指向本目錄。這些環境專用路徑不影響一般本機啟動。

本機驗收已完成；GitHub Actions 尚未在遠端執行。workflow 只執行檢查與保存驗收結果，不包含部署。
