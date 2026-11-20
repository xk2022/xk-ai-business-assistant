import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

// Runs built products and a real database. No intercepted or mocked requests.
const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = path.resolve(process.env.EVIDENCE_DIR || path.join(root, 'tests/browser/test-results'));
await mkdir(evidence, { recursive: true });
if (!process.env.DB_URL || !process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
  throw new Error('Set DB_URL, DB_USERNAME and DB_PASSWORD to an isolated test database.');
}
const target = path.join(root, 'backend/ai-business-assistant/target');
const jars = (await readdir(target)).filter((name) => name.endsWith('.jar'));
assert.equal(jars.length, 1, 'Run ./mvnw clean verify first; expected one executable JAR');
let backend;
let frontend;
let browser;
const streams = [];
const errors = [];
function launch(command, args, cwd, logName, env = {}) {
  const log = createWriteStream(path.join(evidence, logName), { flags: 'a' });
  streams.push(log);
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', (error) => errors.push(error));
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function waitFor(url, child, validate) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (errors.length) throw errors[0];
    if (child.exitCode !== null) throw new Error(`Service exited: ${url}; see logs`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && await validate(response)) return;
    } catch { /* service may still be starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
function startBackend() {
  backend = launch('java', ['-jar', path.join(target, jars[0]), '--server.address=127.0.0.1', '--server.port=8080'], root, 'backend.log');
  return waitFor('http://localhost:8080/actuator/health', backend, async (r) => (await r.json()).status === 'UP');
}
async function status(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
}
const result = { backend: 'Spring Boot executable JAR', frontend: 'Next.js production server', mocks: false, requests: [], checks: [] };
try {
  // Fail fast instead of stopping or reusing any user's existing service.
  for (const port of [8080, 3000]) {
    const { createServer } = await import('node:net');
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, resolve); });
    await new Promise((resolve) => probe.close(resolve));
  }
  await startBackend();
  const api = await fetch('http://localhost:8080/api/v1/status');
  assert.equal(api.status, 200);
  assert.deepEqual(await api.json(), { status: 'ok' });
  result.checks.push('actuator UP and HTTP 200 {"status":"ok"}');
  frontend = launch('node', ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], path.join(root, 'frontend/app'), 'frontend.log');
  await waitFor('http://localhost:3000', frontend, async () => true);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url() === 'http://localhost:8080/api/v1/status') result.requests.push({ url: response.url(), status: response.status() });
  });
  await page.goto('http://localhost:3000');
  await status(page, '已連線');
  await page.screenshot({ path: path.join(evidence, '01-connected.png'), fullPage: true });
  result.checks.push('browser connected with real API');
  await stop(backend);
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await status(page, '連線失敗');
  await page.screenshot({ path: path.join(evidence, '02-disconnected.png'), fullPage: true });
  result.checks.push('backend stopped, retry showed connection failure');
  await startBackend();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await status(page, '已連線');
  await page.screenshot({ path: path.join(evidence, '03-reconnected.png'), fullPage: true });
  result.checks.push('same page, backend restarted, retry reconnected without reload');
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Horizontal overflow at ${width}px`);
  }
  result.checks.push('no horizontal overflow at 375/768/1024/1440px');
  assert.deepEqual(pageErrors, [], 'No browser page errors');
  assert.ok(result.requests.length >= 2, 'Observed successful real browser API requests');
  result.outcome = 'PASS';
} catch (error) {
  result.outcome = 'FAIL';
  result.error = error.stack || String(error);
  throw error;
} finally {
  if (browser) await browser.close();
  await stop(frontend);
  await stop(backend);
  for (const stream of streams) stream.end();
  await writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
