/**
 * 数据库层：使用 Node.js 内置的 node:sqlite（Node 22.5+ 自带，无需原生编译依赖）
 *
 * 为什么选 node:sqlite 而不是 better-sqlite3？
 *   better-sqlite3 是 C++ 原生模块，在免费云部署时需要现场编译，经常失败；
 *   node:sqlite 是 Node 官方内置模块，开箱即用，API 与社区习惯一致。
 *
 * 三张表：
 *   users            用户（账号、密码散列、盐）
 *   tasks            任务（重要度 × 紧急度 两个维度决定艾森豪威尔四象限）
 *   focus_sessions   番茄专注记录（可关联到某个任务，用于统计）
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'app.db');
const db = new DatabaseSync(DB_FILE);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  salt          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  note         TEXT    NOT NULL DEFAULT '',
  tag          TEXT    NOT NULL DEFAULT '未分类',
  importance   INTEGER NOT NULL DEFAULT 1,   -- 1=重要 0=不重要
  urgency      INTEGER NOT NULL DEFAULT 0,   -- 1=紧急 0=不紧急
  due_date     TEXT,                          -- 截止日期 YYYY-MM-DD，可为空
  status       TEXT    NOT NULL DEFAULT 'todo',  -- todo | doing | done
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  minutes    INTEGER NOT NULL,
  finished_at TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_user   ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_focus_user   ON focus_sessions(user_id);
`);

/** 把 JS 值转成 sqlite 能接受的值（boolean 会被拒绝，需转成 0/1） */
function bind(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

/** 执行查询并返回全部结果行 */
function all(sql, ...params) {
  return db.prepare(sql).all(...params.map(bind));
}

/** 执行查询并返回第一行（无结果返回 undefined） */
function get(sql, ...params) {
  return db.prepare(sql).get(...params.map(bind));
}

/** 执行写入，返回 { changes, lastInsertRowid } */
function run(sql, ...params) {
  return db.prepare(sql).run(...params.map(bind));
}

module.exports = { db, all, get, run, DB_FILE };
