// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ===== uploads (รองรับทั้ง local และ deploy) ===== */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

/* -------------------- auth (admin-only) -------------------- */
function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token');
  if (token && token === process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

/* -------------------- helpers: mapping --------------------- */
const projectOut = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description ?? '',
  imageDataUrl: p.imageDataUrl ?? '',
  dateISO: p.dateISO ?? '',
  tags: p.tagsText ? JSON.parse(p.tagsText) : [],
  links: p.linksText ? JSON.parse(p.linksText) : [],
  marketEnabled: Boolean(p.marketEnabled ?? false),
});

const projectIn = (b) => {
  const base = {
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    imageDataUrl: b.imageDataUrl ?? null,
    dateISO: b.dateISO ?? null,
    tagsText: JSON.stringify(b.tags ?? []),
    linksText: JSON.stringify(b.links ?? []),
  };
  if (typeof b.marketEnabled === 'boolean') base.marketEnabled = b.marketEnabled;
  return base;
};

const itemOut = (it) => ({
  id: it.id,
  title: it.title,
  description: it.description ?? '',
  imageDataUrl: it.imageDataUrl ?? '',
  dateISO: it.dateISO ?? '',
  price: typeof it.price === 'number' ? it.price : null,
  stock: typeof it.stock === 'number' ? it.stock : 0,
  marketEnabled: Boolean(it.marketEnabled ?? false),
});

const itemIn = (b) => {
  const base = {
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    imageDataUrl: b.imageDataUrl ?? null,
    dateISO: b.dateISO ?? null,
    price: typeof b.price === 'number' ? b.price : null,
    stock: typeof b.stock === 'number' ? b.stock : 0,
  };
  if (typeof b.marketEnabled === 'boolean') base.marketEnabled = b.marketEnabled;
  return base;
};

/* -------------------- Upload API --------------------------- */
// ส่งไฟล์ฟิลด์ "image" + ต้องมี header x-admin-token
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

/* -------------------- Projects ----------------------------- */
app.get('/api/projects', async (_req, res) => {
  const rows = await prisma.project.findMany({ orderBy: { dateISO: 'desc' } });
  res.json(rows.map(projectOut));
});

app.post('/api/projects', requireAdmin, async (req, res) => {
  const saved = await prisma.project.create({ data: projectIn(req.body) });
  res.json(projectOut(saved));
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const saved = await prisma.project.update({ where: { id }, data: projectIn(req.body) });
  res.json(projectOut(saved));
});

app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  await prisma.project.delete({ where: { id } });
  res.json({ ok: true });
});

/* -------------------- Items (market) ----------------------- */
app.get('/api/items', async (_req, res) => {
  const rows = await prisma.item.findMany({ orderBy: { dateISO: 'desc' } });
  res.json(rows.map(itemOut));
});

app.post('/api/items', requireAdmin, async (req, res) => {
  const saved = await prisma.item.create({ data: itemIn(req.body) });
  res.json(itemOut(saved));
});

app.put('/api/items/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const saved = await prisma.item.update({ where: { id }, data: itemIn(req.body) });
  res.json(itemOut(saved));
});

app.delete('/api/items/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  await prisma.item.delete({ where: { id } });
  res.json({ ok: true });
});

/* -------------------- Market toggle ------------------------ */
app.post('/api/market/toggle', requireAdmin, async (req, res) => {
  const { type, id, enabled } = req.body;
  try {
    if (type === 'project') {
      const p = await prisma.project.update({
        where: { id },
        data: { marketEnabled: !!enabled },
      });
      return res.json(projectOut(p));
    }
    if (type === 'item') {
      const it = await prisma.item.update({
        where: { id },
        data: { marketEnabled: !!enabled },
      });
      return res.json(itemOut(it));
    }
    return res.status(400).json({ error: 'invalid type' });
  } catch (e) {
    return res.status(400).json({ error: String(e) });
  }
});

/* -------------------- Orders (basic) ----------------------- */
app.post('/api/orders', async (req, res) => {
  try {
    const { itemId, qty } = req.body || {};
    const q = Number(qty || 1);
    if (!itemId || q <= 0) return res.status(400).json({ error: 'invalid payload' });

    const it = await prisma.item.findUnique({ where: { id: itemId } });
    if (!it || !it.marketEnabled) return res.status(404).json({ error: 'item not available' });

    const currentStock = typeof it.stock === 'number' ? it.stock : 0;
    if (currentStock < q) return res.status(400).json({ error: 'out of stock' });

    const unit = typeof it.price === 'number' ? it.price : 0;
    const amount = unit * q;

    const order = await prisma.$transaction(async (tx) => {
      await tx.item.update({ where: { id: itemId }, data: { stock: currentStock - q } });
      return tx.order.create({
        data: { id: crypto.randomUUID(), itemId, qty: q },
      });
    });

    res.json({ ok: true, order, amount });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* -------------------- SPA fallback ------------------------- */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* -------------------- start & graceful shutdown ------------- */
const port = process.env.PORT || 5173;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
