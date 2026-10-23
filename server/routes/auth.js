/**
 * 认证路由：/api/auth/register | /api/auth/login | /api/auth/me
 */
'use strict';

const { all, get, run } = require('../db');
const { makeSaltAndHash, verifyPassword, signToken, verifyToken } = require('../auth');

/** 从 Authorization: Bearer <token> 头解析当前用户；挂在 req.user 上 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: '登录已过期，请重新登录' });
  const user = get('SELECT id, username FROM users WHERE id = ?', payload.uid);
  if (!user) return res.status(401).json({ error: '用户不存在' });
  req.user = user;
  next();
}

function register(router) {
  router.post('/register', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!/^[\w\u4e00-\u9fa5-]{2,24}$/.test(username)) {
      return res.status(400).json({ error: '用户名需为 2-24 位中英文、数字或下划线' });
    }
    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: '密码长度需在 6-72 位之间' });
    }
    if (get('SELECT id FROM users WHERE username = ?', username)) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }
    const { salt, hash } = makeSaltAndHash(password);
    const info = run(
      'INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)',
      username, hash, salt, new Date().toISOString()
    );
    const token = signToken({ uid: Number(info.lastInsertRowid), username });
    res.status(201).json({ token, user: { id: Number(info.lastInsertRowid), username } });
  });

  router.post('/login', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = get('SELECT * FROM users WHERE username = ?', username);
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = signToken({ uid: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
}

module.exports = { register, requireAuth };
