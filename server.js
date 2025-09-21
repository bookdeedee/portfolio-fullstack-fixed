// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import multer from 'multer';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ===== uploads (local/deploy) ===== */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

/* ===== multer ===== */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

/* -------------------- Auth utils -------------------- */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';          // plaintext (dev)
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ''; // bcrypt (prod)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** cookie options: บน localhost ไม่บังคับ secure */
function cookieOptsFromReq(req) {
  const host = (req.hostname || '').toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost');

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isLocal, // ถ้าเป็น localhost -> false (เพื่อให้เบราว์เซอร์ตั้งคุกกี้ให้)
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 วัน
    path: '/',
  };
}

/** auth middleware: cookie JWT หรือโหมด legacy x-admin-token */
function requireAdmin(req, res, next) {
  const cookieToken = req.cookies?.auth;
  const fromCookie = cookieToken ? verifyJwt(cookieToken) : null;
  if (fromCookie && fromCookie.role === 'admin' && fromCookie.email === ADMIN_EMAIL) {
    req.admin = fromCookie;
    return next();
  }
  const legacy = req.header('x-admin-token');
  if (legacy && legacy === process.env.ADMIN_TOKEN) {
    req.admin = { role: 'admin', email: ADMIN_EMAIL, legacy: true };
    return next();
  }
  return res.status(401).json({ error: 'unauthorized' });
}

/* -------------------- Auth routes (match frontend) --------- */
// POST /api/admin/login  {email, password}
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing credentials' });

  if (!ADMIN_EMAIL || email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  let ok = false;
  if (ADMIN_PASSWORD_HASH) {
    ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  } else if (ADMIN_PASSWORD !== '') {
    ok = password === ADMIN_PASSWORD;
  }

  if (!ok) return res.status(401).json({ error: 'invalid email or password' });

  const token = signJwt({ role: 'admin', email: ADMIN_EMAIL });
  res.cookie('auth', token, cookieOptsFromReq(req));
  res.json({ ok: true });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('auth', { path: '/' });
  res.json({ ok: true });
});

// GET /api/admin/me
app.get('/api/admin/me', (req, res) => {
  const t = req.cookies?.auth;
  if (!t) return res.json({ authenticated: false });
  const payload = verifyJwt(t);
  return res.json({ authenticated: !!payload });
});

/* -------------------- Upload API -------------------- */
// ส่งไฟล์ฟิลด์ "image" + ต้องผ่าน requireAdmin
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

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
      const p = await prisma.project.update({ where: { id }, data: { marketEnabled: !!enabled } });
      return res.json(projectOut(p));
    }
    if (type === 'item') {
      const it = await prisma.item.update({ where: { id }, data: { marketEnabled: !!enabled } });
      return res.json(itemOut(it));
    }
    return res.status(400).json({ error: 'invalid type' });
  } catch (e) {
    return res.status(400).json({ error: String(e) });
  }
});

/* -------------------- Orders (basic demo) ------------------ */
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
      return tx.order.create({ data: { id: crypto.randomUUID(), itemId, qty: q } });
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

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
