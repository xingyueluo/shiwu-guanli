/**
 * 认证工具：全部基于 Node 内置 crypto 实现，不引入第三方 JWT 库（答辩时好讲解）
 *
 * 1. 密码存储：scrypt(密码, 随机盐) —— 慢哈希，抗彩虹表、抗暴力破解
 * 2. 会话令牌：自实现 JWT 风格 token = base64(头部).base64(载荷).HMAC-SHA256签名
 *    载荷里带用户 id 和过期时间，签名保证不可篡改，服务端无需存 session。
 */
'use strict';

const crypto = require('crypto');

// 生产环境务必设置环境变量 JWT_SECRET；未设置时用随机密钥（重启后需重新登录）
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天有效期

/** 用密码+盐生成 scrypt 散列（hex 字符串） */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/** 注册时调用：生成随机盐并返回 { salt, hash } */
function makeSaltAndHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPassword(password, salt) };
}

/** 登录时校验（timingSafeEqual 防时序攻击） */
function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

/** 签发 token：payload = { uid, username, exp } */
function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

/** 校验 token：合法且未过期则返回 payload，否则返回 null */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expect = sign(`${header}.${body}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { makeSaltAndHash, verifyPassword, signToken, verifyToken };
