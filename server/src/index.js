import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import './lib/db.js'; // initialise schema + defaults on boot
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import pricingRoutes from './routes/pricing.js';
import quoteRoutes from './routes/quotes.js';
import activityRoutes from './routes/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Required behind a reverse proxy (e.g. Render, Heroku) so Express sees the
// real client protocol — otherwise secure cookies never get set because the
// proxy's internal connection to this process looks like plain HTTP.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// In dev the Vite server (5173) calls the API (3000) cross-origin.
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// Throttle auth endpoints to blunt brute-force (per-IP) in addition to the
// per-account lockout enforced in the auth route.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/activity', activityRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, product: 'Vetcos Quote Tool' }));

// --- serve the built frontend in production ---------------------------------
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback: send index.html for any non-API route.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(
      '<h1>Vetcos Quote Tool API</h1><p>Frontend not built yet. Run <code>npm run build</code>, or use the Vite dev server on port 5173.</p>'
    );
  });
}

// Centralised error handler.
app.use((err, req, res, next) => {
  console.error('[vetcos] error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`\n  Vetcos Quote Tool server running at http://localhost:${PORT}\n`);
});
