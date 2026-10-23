/**
 * API 冒烟测试：注册→登录→建任务→改象限→完成→番茄记录→统计
 * 运行：node scripts/smoke-test.js   （需服务器已在 3000 端口启动）
 */
'use strict';
const BASE = 'http://localhost:3000/api';
let token = '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓', msg);
}

(async () => {
  const user = 'tester' + Date.now().toString(36).slice(-6);
  console.log('1. 注册');
  const reg = await call('POST', '/auth/register', { username: user, password: 'test123456' });
  token = reg.token;
  assert(!!token, '注册返回 token');

  console.log('2. 登录');
  const login = await call('POST', '/auth/login', { username: user, password: 'test123456' });
  token = login.token;
  assert(!!login.user.id, '登录返回用户');

  console.log('3. 越权检查');
  await call('GET', '/auth/me').then((r) => assert(r.user.username === user, 'me 返回自己'));

  console.log('4. 建任务');
  const t1 = await call('POST', '/tasks', { title: '复习 Web 期末考点', importance: true, urgency: true, tag: '学习', dueDate: '2026-10-25' });
  const t2 = await call('POST', '/tasks', { title: '每天跑步 30 分钟', importance: true, urgency: false, tag: '健康' });
  assert(t1.task.quadrant === 1, '重要且紧急 => 象限1');
  assert(t2.task.quadrant === 2, '重要不紧急 => 象限2');

  console.log('5. 更新（拖拽换象限）');
  const upd = await call('PUT', `/tasks/${t2.task.id}`, { quadrant: 3 });
  assert(upd.task.quadrant === 3, '象限2 => 象限3');

  console.log('6. 完成任务');
  const done = await call('PUT', `/tasks/${t1.task.id}`, { status: 'done' });
  assert(done.task.status === 'done' && done.task.completedAt, '完成并记录时间');

  console.log('7. 列表筛选');
  const list = await call('GET', '/tasks?status=done');
  assert(list.tasks.length === 1 && list.tasks[0].id === t1.task.id, 'status=done 只含已完成');
  const search = await call('GET', '/tasks?q=' + encodeURIComponent('跑步'));
  assert(search.tasks.length === 1, '关键词搜索命中');

  console.log('8. 番茄记录');
  await call('POST', '/focus/sessions', { minutes: 25, taskId: t2.task.id });
  const hist = await call('GET', '/focus/sessions');
  assert(hist.sessions.length === 1 && hist.sessions[0].taskTitle === '每天跑步 30 分钟', '番茄关联任务标题');

  console.log('9. 统计');
  const s = await call('GET', '/focus/summary');
  assert(s.focus.minutes === 25, '今日专注 25 分钟');
  assert(s.tasks.done === 1, '累计完成 1');
  const w = await call('GET', '/focus/weekly');
  assert(w.days.length === 7, '周统计 7 天');

  console.log('10. 删除与鉴权');
  await call('DELETE', `/tasks/${t2.task.id}`);
  token = '';
  try { await call('GET', '/tasks'); assert(false, '未登录应被拒绝'); }
  catch (e) { assert(String(e.message).includes('401'), '未登录访问被拒绝(401)'); }

  console.log('\n全部通过 ✅');
})().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
