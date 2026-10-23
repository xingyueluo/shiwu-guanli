/**
 * 任务路由：/api/tasks
 * 任务的「重要 × 紧急」两个布尔维度构成艾森豪威尔四象限：
 *   quadrant 1 = 重要且紧急（立即做）
 *   quadrant 2 = 重要不紧急（计划做）
 *   quadrant 3 = 紧急不重要（委托/快速处理）
 *   quadrant 4 = 不紧急不重要（有空再说）
 */
'use strict';

const { all, get, run } = require('../db');

const QUADRANT_MAP = {
  1: { importance: 1, urgency: 1 },
  2: { importance: 1, urgency: 0 },
  3: { importance: 0, urgency: 1 },
  4: { importance: 0, urgency: 0 },
};

function nowIso() { return new Date().toISOString(); }

function register(router, requireAuth) {
  router.use(requireAuth);

  /** 列表：支持 ?status=todo|doing|done|all & ?quadrant=1..4 & ?q=关键词 & ?tag= */
  router.get('/', (req, res) => {
    const conds = ['user_id = ?'];
    const params = [req.user.id];
    const { status, quadrant, q, tag } = req.query;
    if (status && status !== 'all') { conds.push('status = ?'); params.push(status); }
    if (quadrant && QUADRANT_MAP[quadrant]) {
      conds.push('importance = ?', 'urgency = ?');
      params.push(QUADRANT_MAP[quadrant].importance, QUADRANT_MAP[quadrant].urgency);
    }
    if (tag) { conds.push('tag = ?'); params.push(tag); }
    if (q) { conds.push('(title LIKE ? OR note LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const rows = all(
      `SELECT * FROM tasks WHERE ${conds.join(' AND ')}
       ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
                importance DESC, urgency DESC,
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, id DESC`,
      ...params
    );
    res.json({ tasks: rows.map(toTask) });
  });

  /** 新建 */
  router.post('/', (req, res) => {
    const t = req.body || {};
    const title = String(t.title || '').trim();
    if (!title || title.length > 200) return res.status(400).json({ error: '标题必填且不超过 200 字' });
    const info = run(
      `INSERT INTO tasks (user_id, title, note, tag, importance, urgency, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id, title,
      String(t.note || '').slice(0, 2000),
      String(t.tag || '未分类').slice(0, 20),
      t.importance ? 1 : 0, t.urgency ? 1 : 0,
      validDate(t.dueDate), t.status === 'doing' ? 'doing' : 'todo',
      nowIso(), nowIso()
    );
    res.status(201).json({ task: toTask(get('SELECT * FROM tasks WHERE id = ?', Number(info.lastInsertRowid))) });
  });

  /** 更新（含拖拽换象限：前端传 quadrant 即可） */
  router.put('/:id', (req, res) => {
    const row = ownTask(req, res); if (!row) return;
    const t = req.body || {};
    const next = {
      title: t.title !== undefined ? String(t.title).trim().slice(0, 200) : row.title,
      note: t.note !== undefined ? String(t.note).slice(0, 2000) : row.note,
      tag: t.tag !== undefined ? String(t.tag).slice(0, 20) : row.tag,
      due_date: t.dueDate !== undefined ? validDate(t.dueDate) : row.due_date,
    };
    if (t.quadrant && QUADRANT_MAP[t.quadrant]) {
      next.importance = QUADRANT_MAP[t.quadrant].importance;
      next.urgency = QUADRANT_MAP[t.quadrant].urgency;
    } else {
      if (t.importance !== undefined) next.importance = t.importance ? 1 : 0;
      if (t.urgency !== undefined) next.urgency = t.urgency ? 1 : 0;
    }
    if (!next.title) return res.status(400).json({ error: '标题不能为空' });
    if (t.status !== undefined && ['todo', 'doing', 'done'].includes(t.status)) {
      next.status = t.status;
      next.completed_at = t.status === 'done' ? nowIso() : null;
    }
    const keys = Object.keys(next);
    run(
      `UPDATE tasks SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...keys.map((k) => next[k]), nowIso(), row.id
    );
    res.json({ task: toTask(get('SELECT * FROM tasks WHERE id = ?', row.id)) });
  });

  /** 删除 */
  router.delete('/:id', (req, res) => {
    const row = ownTask(req, res); if (!row) return;
    run('DELETE FROM tasks WHERE id = ?', row.id);
    res.json({ ok: true });
  });

  /** 全部标签（供筛选下拉） */
  router.get('/meta/tags', (req, res) => {
    const rows = all('SELECT DISTINCT tag FROM tasks WHERE user_id = ? ORDER BY tag', req.user.id);
    res.json({ tags: rows.map((r) => r.tag) });
  });
}

function ownTask(req, res) {
  const row = get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  if (!row) { res.status(404).json({ error: '任务不存在' }); return null; }
  return row;
}

function validDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** 数据库行 → 前端 JSON（象限编号在此统一计算） */
function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    tag: row.tag,
    importance: !!row.importance,
    urgency: !!row.urgency,
    quadrant: row.importance ? (row.urgency ? 1 : 2) : (row.urgency ? 3 : 4),
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

module.exports = { register };
