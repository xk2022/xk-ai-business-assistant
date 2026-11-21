# XK AI Business Assistant

第一個開發任務：Next.js 頁面直接從瀏覽器查詢 Spring Boot 的 `GET /api/v1/status`，顯示「連線中」、「已連線」或「連線失敗」，並支援不重新整理頁面的「重試」。本階段不需要 OpenAI API Key。

技術依據：[Week 03 已確認規格（固定版本）](https://github.com/xk2022/xplore-kaleidoscope/tree/61a33e38946ad60195f8a386c7802f9810f6174e/doc/01_business-plan/week-03)。

## 環境與目錄

需要 Git、Java **21 JDK**、Node.js **24**、npm、Docker Engine / Docker Desktop（含 Compose v2）、curl。Maven 由已提交的 Maven Wrapper 下載，不必全域安裝。

| 位置 | 內容 |
| --- | --- |
| `backend/ai-business-assistant/` | Spring Boot 3.5.14、Flyway、JPA、Actuator |
| `frontend/app/` | Next.js App Router、TypeScript、瀏覽器 API client |
| `compose.yml` | PostgreSQL 17 / pgvector 0.8.5、具名 volume、healthcheck |
| `tests/browser/` | Playwright 真實前後端停止／恢復驗收 |
| [`docs/verification/`](docs/verification/README.md) | 本次驗收紀錄與畫面 |

## 從全新 clone 啟動

從預設分支取得產品程式：

```bash
git clone https://github.com/xk2022/xk-ai-business-assistant.git
cd xk-ai-business-assistant
cp .env.example .env
```

編輯 `.env`，將 `POSTGRES_PASSWORD` 與 `DB_PASSWORD` 設為相同的本機密碼。此檔不會納入 Git。`POSTGRES_DB` / `POSTGRES_USER` 須分別對應 `DB_URL` 的資料庫名稱 / `DB_USERNAME`。預設資料庫埠為 5432；若更改 `POSTGRES_PORT`，也要更新 `DB_URL`。既有 volume 的帳密不會因修改環境變數自動變更。

終端機 A，從產品庫根目錄啟動資料庫及後端：

```bash
set -a
source .env
set +a
java -version
node --version
docker compose config --quiet
docker compose up -d --wait postgres
cd backend/ai-business-assistant
./mvnw spring-boot:run
```

Flyway 會在後端啟動時執行 `V1__enable_vector.sql`。PostgreSQL 只綁定 `127.0.0.1`，資料保存在 Compose 專案的 `postgres_data` 具名 volume。

終端機 B，從產品庫根目錄啟動前端：

```bash
set -a
source .env
set +a
cd frontend/app
npm ci
npm run dev
```

開啟 <http://localhost:3000>。`NEXT_PUBLIC_API_BASE_URL` 預設 `http://localhost:8080`，只填 origin，不含 `/api/v1`；它是公開、建置時的設定，變更後須重新啟動開發伺服器或重新 build。`CORS_ALLOWED_ORIGINS` 預設 `http://localhost:3000`；如需多個來源以逗號分隔。使用 `127.0.0.1:3000` 開頁面時，須明確將該來源加入 CORS。

「已連線」表示最近一次瀏覽器請求成功取得 HTTP 200 及符合契約的 `{"status":"ok"}`；不表示資料庫健康，也不是持續監控。請求及 JSON 讀取有逾時保護。服務是否健康請另外檢查 Actuator，它包含資料庫健康指標。

終端機 C：

```bash
curl --fail http://localhost:8080/actuator/health
# {"status":"UP"}
curl --fail http://localhost:8080/api/v1/status
# {"status":"ok"}
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SHOW server_version;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SELECT version, description, success FROM flyway_schema_history;
SQL
```

可在終端機 A 用 Ctrl+C 停止後端，再於頁面按「重試」，確認「連線失敗」；重新執行 `./mvnw spring-boot:run` 後，在同一頁按「重試」應恢復「已連線」。

## 測試

建議執行完整驗收腳本。它建立唯一 Compose 專案及**全新獨立測試 volume**，使用 55432 埠；不存取開發資料庫，也不移除任何 volume。先停止占用 8080 / 3000 的開發伺服器，讓腳本啟動 production 成品。

```bash
# 從產品庫根目錄
./scripts/verify-local.sh
# 若 55432 已占用：
# TEST_POSTGRES_PORT=55433 ./scripts/verify-local.sh
```

腳本執行：空庫檢查、`./mvnw --batch-mode clean verify`、SQL 版本與 migration 驗證、`npm ci`、lint、型別檢查、前端單元測試、production build，以及 Playwright。首次會下載 Maven / npm 相依套件與 Chromium。Linux 若缺少 Chromium 系統函式庫，依 Playwright 的錯誤提示安裝（`npx playwright install-deps chromium`）。

Playwright 啟動真實 JAR 與 Next.js production server，確認 Actuator UP 與 API JSON，再依序驗證成功、停止後端後失敗、重新啟動後同頁重試成功；不攔截 API、不用 mock。自動保留成功／失敗／恢復截圖與 JSON 結果於 `tests/browser/test-results/`（Git 忽略）。指定 `EVIDENCE_DIR=/absolute/path` 可另存。測試完成或失敗會停止所啟動的服務；測試 volume 名稱會顯示於終端機，資料仍保留。

若只執行後端測試，須先提供指向**獨立測試庫**的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`，再執行：

```bash
cd backend/ai-business-assistant
./mvnw --batch-mode clean verify
```

若只執行前端檢查：

```bash
cd frontend/app
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## 安全停止服務

前後端終端機各按 Ctrl+C，再於產品庫根目錄執行：

```bash
docker compose down
```

`down` 會停止並移除容器與專案網路，保留資料 volume。不要使用 `down -v` 或 `docker volume prune`，以免刪除資料。開發時先建立功能分支，檢查通過後再依授權合併。此專案的 CI 不包含部署。
