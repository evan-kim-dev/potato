/**
 * Smoke-test web APIs against a running or programmatic import path.
 * Run: npx tsx scripts/smoke-api.mjs  (from web/) after `npm run build` we use fetch to localhost if DEV, else import handlers.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  handle(req, res, parse(req.url, true));
});

await new Promise((resolve) => server.listen(3456, resolve));
const base = "http://127.0.0.1:3456";

async function check(name, fn) {
  try {
    await fn();
    console.log("OK ", name);
  } catch (e) {
    console.log("BAD", name, e.message);
  }
}

await check("GET /api/weather", async () => {
  const r = await fetch(`${base}/api/weather`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  if (!Array.isArray(j.cities) || !j.cities.length) throw new Error("no cities");
});

await check("GET /api/beaches", async () => {
  const r = await fetch(`${base}/api/beaches`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  if (!Array.isArray(j.beaches) || !j.beaches.length) throw new Error("no beaches");
});

await check("GET /api/forecast", async () => {
  const r = await fetch(`${base}/api/forecast`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  if (!j.situation?.length) throw new Error("no situation");
  if (j.stub && !j.situation.some((s) => s.data)) throw new Error("stub empty");
});

await check("POST /api/plan", async () => {
  const r = await fetch(`${base}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "영월 1박2일 조용한 숲길", prefs: "한산·숨은, 친환경·생태" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  if (!j.plan?.steps?.length) throw new Error("no plan steps");
});

await check("POST /api/chat", async () => {
  const r = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "정선에서 한산한 반나절 코스 짧게" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  if (!j.reply) throw new Error("empty reply");
});

server.close();
process.exit(0);
