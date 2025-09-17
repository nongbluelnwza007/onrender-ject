// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || "changeme";
const MONGODB_URI = process.env.MONGODB_URI || "";
const TTL_DAYS = Number(process.env.TTL_DAYS || 0); // 0 = ไม่ลบอัตโนมัติ

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* ------------ MongoDB ------------ */
let db = null;
let readings = null;

async function initMongo() {
  if (!MONGODB_URI) {
    console.warn("[Mongo] MONGODB_URI not set. Using in-memory store.");
    return;
  }
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  db = client.db();                 // ใช้ DB จาก URI
  readings = db.collection("readings");
  await readings.createIndex({ ts: -1 });

  // (ออปชัน) เก็บตามอายุด้วย TTL (ใช้ฟิลด์ createdAt ที่เป็น Date)
  if (TTL_DAYS > 0) {
    const seconds = Math.floor(TTL_DAYS * 24 * 60 * 60);
    await readings.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: seconds, name: "ttl_createdAt" }
    );
  }
  console.log("[Mongo] connected");
}
await initMongo();

/* ------ in-memory fallback ------ */
const memory = []; // { ts:number, t:number, h:number, createdAt:Date }
function saveLocal(doc) {
  memory.push(doc);
  if (memory.length > 5000) memory.shift();
}

/* ------------- helpers ------------- */
function requireKey(req, res, next) {
  const key = req.query.key || req.get("x-api-key");
  if (API_KEY && key !== API_KEY) {
    return res.status(401).json({ ok: false, msg: "bad key" });
  }
  next();
}

/* ------------- routes ------------- */
app.get("/healthz", (_req, res) => res.send("ok"));

/** POST /ingest?key=...  body: { t:number, h:number } */
app.post("/ingest", requireKey, async (req, res) => {
  const { t, h } = req.body || {};
  if (typeof t !== "number" || typeof h !== "number") {
    return res.status(400).json({ ok: false, msg: "expected JSON {t:number, h:number}" });
  }
  const doc = { ts: Date.now(), t, h, createdAt: new Date() };
  try {
    if (readings) {
      const r = await readings.insertOne(doc);
      return res.json({ ok: true, id: r.insertedId.toString() });
    } else {
      saveLocal(doc);
      return res.json({ ok: true, id: null, mode: "memory" });
    }
  } catch (e) {
    console.error("[ingest]", e);
    return res.status(500).json({ ok: false, msg: "db error" });
  }
});

/** POST /ingest-csv?key=...  body: "t,h"  (text/plain) */
app.post("/ingest-csv", requireKey, express.text({ type: "*/*" }), async (req, res) => {
  const text = (req.body || "").trim();
  const parts = text.split(",");
  if (parts.length !== 2) {
    return res.status(400).json({ ok: false, msg: "expected 't,h' in body" });
  }
  const t = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(t) || !Number.isFinite(h)) {
    return res.status(400).json({ ok: false, msg: "t,h must be numbers" });
  }
  const doc = { ts: Date.now(), t, h, createdAt: new Date() };
  try {
    if (readings) {
      const r = await readings.insertOne(doc);
      return res.json({ ok: true, id: r.insertedId.toString() });
    } else {
      saveLocal(doc);
      return res.json({ ok: true, id: null, mode: "memory" });
    }
  } catch (e) {
    console.error("[ingest-csv]", e);
    return res.status(500).json({ ok: false, msg: "db error" });
  }
});

/** GET /api/history?limit=200 */
app.get("/api/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 2000);
  try {
    if (readings) {
      const rows = await readings.find({})
        .sort({ ts: -1 })
        .limit(limit)
        .toArray();
      rows.reverse(); // ให้เก่า → ใหม่
      return res.json(rows);
    } else {
      const rows = memory.slice(-limit);
      return res.json(rows);
    }
  } catch (e) {
    console.error("[history]", e);
    return res.status(500).json({ ok: false, msg: "db error" });
  }
});

/** GET /api/latest */
app.get("/api/latest", async (_req, res) => {
  try {
    if (readings) {
      const doc = await readings.find({}).sort({ ts: -1 }).limit(1).next();
      return res.json(doc || null);
    } else {
      return res.json(memory.length ? memory[memory.length - 1] : null);
    }
  } catch (e) {
    console.error("[latest]", e);
    return res.status(500).json({ ok: false, msg: "db error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
