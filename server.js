import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || "changeme";
const MAX_POINTS = Number(process.env.MAX_POINTS || 1000);

const history = [];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/ingest", (req, res) => {
  const key = req.query.key || req.body.key;
  if (key !== API_KEY) return res.status(401).json({ ok: false, msg: "bad key" });

  const t = Number(req.body.t);
  const h = Number(req.body.h);
  if (!Number.isFinite(t) || !Number.isFinite(h)) {
    return res.status(400).json({ ok:false, msg:"bad payload" });
  }
  const row = { ts: Date.now(), t, h };
  history.push(row);
  if (history.length > MAX_POINTS) history.splice(0, history.length - MAX_POINTS);
  res.json({ ok:true, size:history.length });
});

app.post("/ingest-csv", (req, res) => {
  const key = req.query.key;
  if (key !== API_KEY) return res.status(401).json({ ok: false, msg: "bad key" });

  const raw = (req.body && Object.keys(req.body).length ? Object.keys(req.body)[0] : "").trim();
  const parts = raw.split(",").map(Number);
  if (parts.length !== 2 || parts.some(v => !Number.isFinite(v))) {
    return res.status(400).json({ ok:false, msg:"expected 't,h' in body" });
  }
  const [t,h] = parts;
  const row = { ts: Date.now(), t, h };
  history.push(row);
  if (history.length > MAX_POINTS) history.splice(0, history.length - MAX_POINTS);
  res.json({ ok:true, size:history.length });
});

app.get("/api/latest", (req, res) => {
  res.json(history.length ? history[history.length - 1] : null);
});

app.get("/api/history", (req, res) => {
  res.json(history);
});

app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
