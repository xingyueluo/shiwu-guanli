/**
 * 专注与统计路由：/api/focus
 *   POST /sessions   上报一条完成的番茄（前端番茄钟走完后调用）
 *   GET  /summary    今日概览：任务分布、完成数、专注分钟数
 *   GET  /weekly     近 7 天：每天完成的任务数 + 专注分钟数（画折线/柱状图用）
 */
'use strict';

const { all, get, run } = require('../db');

function register(router, requireAuth) {
  router.use(requireAuth);

  router.post('/sessions', (req, res) => {
    const minutes = Number(req.body.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 240) {
      return res.status(400).json({ error: '专注时长需为 1-240 的整数分钟' });
    }
    let taskId = req.body.taskId ? Number(req.body.taskId) : null;
    if (taskId && !get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', taskId, req.user.id)) {
      taskId = null; // 关联的任务被删了就记为通用专注
    }
    const info = run(
      'INSERT INTO focus_sessions (user_id, task_id, minutes, finished_at) VALUES (?, ?, ?, ?)',
      req.user.id, taskId, minutes, new Date().toISOString()
    );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  /** 最近 10 条专注记录（番茄页侧栏） */
  router.get('/sessions', (req, res) => {
    const rows = all(`
      SELECT f.id, f.minutes, f.finished_at, t.title AS task_title
      FROM focus_sessions f LEFT JOIN tasks t ON t.id = f.task_id
      WHERE f.user_id = ? ORDER BY f.id DESC LIMIT 10`, req.user.id);
    res.json({ sessions: rows.map((r) => ({
      id: r.id, minutes: r.minutes, finishedAt: r.finished_at, taskTitle: r.task_title,
    })) });
  });

  router.get('/summary', (req, res) => {
    const uid = req.user.id;
    const today = localDate(0);
    const counts = get(`
      SELECT
        COUNT(*)                                                   AS total,
        SUM(status = 'done')                                       AS done,
        SUM(status != 'done' AND due_date IS NOT NULL AND due_date < ?)  AS overdue,
        SUM(status != 'done')                                      AS open
      FROM tasks WHERE user_id = ?`, today, uid) || {};
    const quadrants = all(`
      SELECT importance, urgency, COUNT(*) AS n
      FROM tasks WHERE user_id = ? AND status != 'done'
      GROUP BY importance, urgency`, uid);
    const focusToday = get(
      "SELECT COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions FROM focus_sessions WHERE user_id = ? AND substr(finished_at, 1, 10) = ?",
      uid, today
    );
    res.json({
      today,
      tasks: {
        total: counts.total || 0, done: counts.done || 0,
        overdue: counts.overdue || 0, open: counts.open || 0,
      },
      quadrants: quadrants.map((r) => ({
        quadrant: r.importance ? (r.urgency ? 1 : 2) : (r.urgency ? 3 : 4),
        count: r.n,
      })),
      focus: focusToday,
    });
  });

  router.get('/weekly', (req, res) => {
    const uid = req.user.id;
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(localDate(-i));
    const doneRows = all(`
      SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n
      FROM tasks WHERE user_id = ? AND status = 'done' AND completed_at IS NOT NULL
        AND substr(completed_at, 1, 10) >= ?
      GROUP BY d`, uid, days[0]);
    const focusRows = all(`
      SELECT substr(finished_at, 1, 10) AS d, SUM(minutes) AS m
      FROM focus_sessions WHERE user_id = ? AND substr(finished_at, 1, 10) >= ?
      GROUP BY d`, uid, days[0]);
    const doneMap = Object.fromEntries(doneRows.map((r) => [r.d, r.n]));
    const focusMap = Object.fromEntries(focusRows.map((r) => [r.d, r.m]));
    res.json({ days: days.map((d) => ({ date: d, done: doneMap[d] || 0, focusMinutes: focusMap[d] || 0 })) });
  });
}

/** 本地时区的 YYYY-MM-DD（避免 toISOString 的 UTC 偏移把「今天」算错） */
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = { register };
