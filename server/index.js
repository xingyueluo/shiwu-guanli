/**
 * 拾光清单 · 后端入口
 * 前后端分离：本进程只做两件事 ——
 *   1) 提供 REST API（/api/*）
 *   2) 托管前端静态文件（public/，生产环境下由同一进程或 CDN 提供）
 *
 * 启动：node server/index.js      默认端口 3000（可用环境变量 PORT 覆盖）
 */
'use strict';

const path = require('path');
const express = require('express');

const { register: registerAuth, requireAuth } = require('./routes/auth');
const tasks = require('./routes/tasks');
const focus = require('./routes/focus');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// 简单限流：每个 IP 每分钟最多 300 次请求（防脚本暴力打接口）
const hits = new Map();
app.use('/api/', (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const win = hits.get(key) || { count: 0, start: now };
  if (now - win.start > 60_000) { win.count = 0; win.start = now; }
  win.count += 1;
  hits.set(key, win);
  if (win.count > 300) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  next();
});

// ---- API 路由 ----
const authRouter = express.Router();
registerAuth(authRouter);
app.use('/api/auth', authRouter);

const tasksRouter = express.Router();
tasks.register(tasksRouter, requireAuth);
app.use('/api/tasks', tasksRouter);

const focusRouter = express.Router();
focus.register(focusRouter, requireAuth);
app.use('/api/focus', focusRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// ---- 前端静态文件 ----
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));
// SPA 兜底：非 API 的 GET 一律回 index.html
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ---- 统一错误处理 ----
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`拾光清单已启动: http://localhost:${PORT}`));
