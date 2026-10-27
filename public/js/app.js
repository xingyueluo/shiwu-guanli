/**
 * 主逻辑：视图路由、任务 CRUD、四象限拖拽、番茄钟接线、统计渲染
 * 组织方式：按「认证 → 路由 → 任务 → 象限 → 专注 → 统计」分区，每区一个 init。
 */
(() => {
  'use strict';
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const QUADRANT_NAMES = { 1: '① 立即做', 2: '② 计划做', 3: '③ 委托办', 4: '④ 有空说' };

  let me = null;            // 当前用户 {id, username}
  let tasksCache = [];      // 当前视图共享的任务数据
  let editingId = null;     // 弹窗正在编辑的任务 id（null=新建）

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg, ok = true) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast ${ok ? 'toast-ok' : 'toast-err'}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  /* ---------------- 认证视图 ---------------- */
  let authMode = 'login';
  function initAuth() {
    $('#auth-switch-link').addEventListener('click', (e) => {
      e.preventDefault();
      authMode = authMode === 'login' ? 'register' : 'login';
      $('#auth-submit').textContent = authMode === 'login' ? '登 录' : '注 册';
      $('#auth-switch-text').textContent = authMode === 'login' ? '还没有账号？' : '已有账号？';
      $('#auth-switch-link').textContent = authMode === 'login' ? '立即注册' : '去登录';
      $('#auth-error').textContent = '';
    });

    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('#auth-username').value.trim();
      const password = $('#auth-password').value;
      $('#auth-submit').disabled = true;
      try {
        const data = authMode === 'login' ? await API.login(username, password) : await API.register(username, password);
        API.setToken(data.token);
        me = data.user;
        enterApp();
      } catch (err) {
        $('#auth-error').textContent = err.message;
      } finally {
        $('#auth-submit').disabled = false;
      }
    });

    window.addEventListener('auth:expired', () => {
      me = null;
      $('#app-view').classList.add('hidden');
      $('#auth-view').classList.remove('hidden');
      toast('登录已过期，请重新登录', false);
    });
  }

  async function enterApp() {
    $('#auth-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#side-user').textContent = me.username;
    $('#side-avatar').textContent = me.username[0].toUpperCase();
    switchView(localStorage.getItem('swgl_view') || 'today');
    await refreshAll();
  }

  function initLogout() {
    $('#logout-btn').addEventListener('click', () => {
      API.setToken('');
      location.reload();
    });
  }

  /* ---------------- 视图路由 ---------------- */
  function switchView(name) {
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $(`#view-${name}`).classList.remove('hidden');
    localStorage.setItem('swgl_view', name);
    if (name === 'stats') loadStats();
    if (name === 'pomodoro') loadPomoSide();
  }

  function initNav() {
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  }

  /* ---------------- 数据刷新 ---------------- */
  async function refreshAll() {
    try {
      const [{ tasks }, summary] = await Promise.all([API.tasks(), API.summary()]);
      tasksCache = tasks;
      renderToday(tasks, summary);
      renderList(tasks);
      renderMatrix(tasks);
      refreshTagFilter();
      refreshPomoTaskSelect();
    } catch (e) { toast(e.message, false); }
  }

  /* ---------------- 任务卡片（共用渲染函数） ---------------- */
  function taskCard(t, draggable = false) {
    const li = document.createElement('li');
    li.className = `task-card st-${t.status}`;
    li.dataset.id = t.id;
    if (draggable) li.draggable = true;

    const overdue = t.dueDate && t.status !== 'done' && t.dueDate < localToday();
    li.innerHTML = `
      <button class="check" title="完成/取消完成">${t.status === 'done' ? '✓' : ''}</button>
      <div class="tc-main">
        <div class="tc-title">${esc(t.title)}</div>
        <div class="tc-meta">
          <span class="chip chip-q q${t.quadrant}">${QUADRANT_NAMES[t.quadrant]}</span>
          <span class="chip">${esc(t.tag)}</span>
          ${t.dueDate ? `<span class="chip ${overdue ? 'chip-overdue' : ''}">📅 ${t.dueDate.slice(5)}${overdue ? ' 已逾期' : ''}</span>` : ''}
          ${t.status === 'doing' ? '<span class="chip chip-doing">进行中</span>' : ''}
        </div>
      </div>
      <div class="tc-btns">
        <button class="icon-btn" data-act="start" title="${t.status === 'doing' ? '暂停' : '开始做'}">${t.status === 'doing' ? '⏸' : '▶'}</button>
        <button class="icon-btn" data-act="pomo" title="用番茄钟做这件事">🍅</button>
        <button class="icon-btn" data-act="edit" title="编辑">✏️</button>
        <button class="icon-btn" data-act="del" title="删除">🗑️</button>
      </div>`;

    li.querySelector('.check').addEventListener('click', () => toggleDone(t));
    li.querySelectorAll('.icon-btn').forEach((b) => b.addEventListener('click', () => onCardAction(b.dataset.act, t)));
    if (draggable) {
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(t.id));
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
    }
    return li;
  }

  async function onCardAction(act, t) {
    try {
      if (act === 'edit') return openModal(t);
      if (act === 'del') {
        if (!confirm(`删除任务「${t.title}」？`)) return;
        await API.deleteTask(t.id);
        toast('已删除');
      }
      if (act === 'start') {
        await API.updateTask(t.id, { status: t.status === 'doing' ? 'todo' : 'doing' });
      }
      if (act === 'pomo') {
        switchView('pomodoro');
        const sel = $('#pomo-task-select');
        refreshPomoTaskSelect();
        sel.value = String(t.id);
        toast(`已选择「${t.title}」，点开始吧 🍅`);
      }
      await refreshAll();
    } catch (e) { toast(e.message, false); }
  }

  async function toggleDone(t) {
    try {
      await API.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });
      await refreshAll();
    } catch (e) { toast(e.message, false); }
  }

  /* ---------------- 今日焦点 ---------------- */
  function renderToday(tasks, s) {
    $('#today-date').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const open = tasks.filter((t) => t.status !== 'done');
    const cards = [
      { n: s.tasks.open, label: '待办任务', icon: '📌' },
      { n: s.tasks.done, label: '累计完成', icon: '✅' },
      { n: s.tasks.overdue, label: '已逾期', icon: '⏰', warn: s.tasks.overdue > 0 },
      { n: s.focus.minutes, label: '今日专注(分钟)', icon: '🍅' },
    ];
    $('#today-cards').innerHTML = cards.map((c) => `
      <div class="stat-card ${c.warn ? 'warn' : ''}">
        <span class="sc-icon">${c.icon}</span>
        <div><b>${c.n}</b><span>${c.label}</span></div>
      </div>`).join('');

    const byQ = { 1: 0, 2: 0, 3: 0, 4: 0 };
    open.forEach((t) => byQ[t.quadrant]++);
    $('#today-quadrants').innerHTML = Object.entries(byQ).map(([q, n]) => `
      <div class="mq mq${q}"><b>${n}</b><span>${QUADRANT_NAMES[q]}</span></div>`).join('');

    const list = $('#today-list');
    list.innerHTML = '';
    const priority = open.filter((t) => t.quadrant === 1)
      .concat(open.filter((t) => t.quadrant === 2))
      .concat(open.filter((t) => t.quadrant === 3))
      .concat(open.filter((t) => t.quadrant === 4))
      .slice(0, 8);
    if (!priority.length) {
      list.innerHTML = '<li class="empty">今日无事，好好休息 🌿 或点右上角新建任务</li>';
    } else {
      priority.forEach((t) => list.appendChild(taskCard(t)));
    }
  }

  /* ---------------- 任务列表 ---------------- */
  function initListToolbar() {
    let deb = null;
    $('#search-input').addEventListener('input', () => {
      clearTimeout(deb);
      deb = setTimeout(refreshTagFilterAndList, 300);
    });
    $('#filter-status').addEventListener('change', refreshTagFilterAndList);
    $('#filter-tag').addEventListener('change', () => renderList(filteredTasks()));
  }

  function filteredTasks() {
    const q = $('#search-input').value.trim();
    const st = $('#filter-status').value;
    const tag = $('#filter-tag').value;
    return tasksCache.filter((t) => {
      if (st === 'active' && t.status === 'done') return false;
      if (st !== 'all' && st !== 'active' && t.status !== st) return false;
      if (tag && t.tag !== tag) return false;
      if (q && !(t.title.includes(q) || (t.note || '').includes(q))) return false;
      return true;
    });
  }

  async function refreshTagFilterAndList() {
    renderList(filteredTasks());
  }

  async function refreshTagFilter() {
    try {
      const { tags } = await API.tags();
      const sel = $('#filter-tag');
      const cur = sel.value;
      sel.innerHTML = '<option value="">全部标签</option>' + tags.map((t) => `<option>${esc(t)}</option>`).join('');
      sel.value = tags.includes(cur) ? cur : '';
    } catch { /* 忽略 */ }
  }

  function renderList(tasks) {
    const ul = $('#list-tasks');
    ul.innerHTML = '';
    $('#list-empty').classList.toggle('hidden', tasks.length > 0);
    tasks.forEach((t) => ul.appendChild(taskCard(t)));
  }

  /* ---------------- 四象限 ---------------- */
  function renderMatrix(tasks) {
    for (let q = 1; q <= 4; q++) $(`#q${q}`).innerHTML = '';
    tasks.forEach((t) => {
      if (t.status === 'done') return; // 矩阵只展示未完成
      $(`#q${t.quadrant}`).appendChild(taskCard(t, true));
    });
  }

  function initMatrixDnd() {
    $$('.q-cell').forEach((cell) => {
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', async (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        const id = Number(e.dataTransfer.getData('text/plain'));
        const quadrant = Number(cell.dataset.quadrant);
        try {
          await API.updateTask(id, { quadrant });
          toast(`已移到象限 ${quadrant}`);
          await refreshAll();
        } catch (err) { toast(err.message, false); }
      });
    });
  }

  /* ---------------- 任务弹窗 ---------------- */
  function initModal() {
    const modal = $('#task-modal');
    $$('[data-action="new-task"]').forEach((b) => b.addEventListener('click', () => openModal(null)));
    $('#task-cancel').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    $('#task-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('#f-title').value.trim();
      if (!title) { $('#task-form-error').textContent = '标题不能为空'; return; }
      const payload = {
        title,
        note: $('#f-note').value,
        tag: $('#f-tag').value.trim() || '未分类',
        dueDate: $('#f-due').value || null,
        quadrant: Number($('[name="quadrant"]:checked').value),
      };
      try {
        if (editingId) await API.updateTask(editingId, payload);
        else await API.createTask(payload);
        modal.close();
        toast(editingId ? '已更新' : '已创建');
        await refreshAll();
      } catch (err) { $('#task-form-error').textContent = err.message; }
    });
  }

  function openModal(t) {
    editingId = t ? t.id : null;
    $('#task-modal-title').textContent = t ? '编辑任务' : '新建任务';
    $('#f-title').value = t ? t.title : '';
    $('#f-note').value = t ? t.note : '';
    $('#f-tag').value = t ? t.tag : '';
    $('#f-due').value = t && t.dueDate ? t.dueDate : '';
    const q = t ? t.quadrant : 2;
    $(`[name="quadrant"][value="${q}"]`).checked = true;
    $('#task-form-error').textContent = '';
    $('#task-modal').showModal();
    $('#f-title').focus();
  }

  /* ---------------- 番茄钟接线 ---------------- */
  function initPomodoro() {
    Pomodoro.init(async (doneMode, minutes) => {
      if (doneMode !== 'focus') { toast('休息结束，开始下一个番茄？'); return; }
      const taskId = Number($('#pomo-task-select').value) || null;
      try {
        await API.logFocus(minutes, taskId);
        toast('🍅 完成一个番茄，已记录！');
        await Promise.all([loadPomoSide(), refreshAll()]);
      } catch (e) { toast(e.message, false); }
    });
  }

  function refreshPomoTaskSelect() {
    const sel = $('#pomo-task-select');
    const cur = sel.value;
    const open = tasksCache.filter((t) => t.status !== 'done');
    sel.innerHTML = '<option value="">不关联具体任务</option>' +
      open.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur && cur)) sel.value = cur;
  }

  async function loadPomoSide() {
    try {
      const [s, h] = await Promise.all([API.summary(), API.focusSessions()]);
      $('#pomo-today').innerHTML = s.focus.sessions
        ? '🍅'.repeat(Math.min(s.focus.sessions, 12)) + ` <span class="muted">${s.focus.sessions} 个 · ${s.focus.minutes} 分钟</span>`
        : '<span class="muted">今天还没有番茄，开始第一个吧</span>';
      const ul = $('#pomo-history');
      ul.innerHTML = h.sessions.length
        ? h.sessions.map((x) => {
            const d = new Date(x.finishedAt);
            const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            return `<li><span class="hl-dot">🍅</span><span class="hl-main">${esc(x.taskTitle || '通用专注')}</span><span class="hl-meta">${x.minutes} 分钟 · ${hm}</span></li>`;
          }).join('')
        : '<li class="muted">暂无记录</li>';
    } catch { /* 忽略 */ }
  }

  /* ---------------- 统计 ---------------- */
  async function loadStats() {
    try {
      const [s, w] = await Promise.all([API.summary(), API.weekly()]);
      $('#stats-cards').innerHTML = `
        <div class="stat-card"><span class="sc-icon">✅</span><div><b>${s.tasks.done}</b><span>累计完成</span></div></div>
        <div class="stat-card"><span class="sc-icon">🍅</span><div><b>${s.focus.minutes}</b><span>今日专注分钟</span></div></div>
        <div class="stat-card"><span class="sc-icon">📈</span><div><b>${s.tasks.total ? Math.round((s.tasks.done / s.tasks.total) * 100) : 0}%</b><span>总完成率</span></div></div>`;
      const labels = w.days.map((d) => d.date.slice(5));
      Charts.drawBar($('#chart-done'), labels, w.days.map((d) => d.done));
      Charts.drawBar($('#chart-focus'), labels, w.days.map((d) => d.focusMinutes), '#06a77d');
      const qn = { 1: '① 立即做', 2: '② 计划做', 3: '③ 委托办', 4: '④ 有空说' };
      Charts.drawDonut($('#chart-quadrant'), s.quadrants.map((q) => ({ label: qn[q.quadrant], value: q.count })));
    } catch (e) { toast(e.message, false); }
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function localToday() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    initAuth(); initNav(); initLogout(); initListToolbar();
    initMatrixDnd(); initModal(); initPomodoro();
    if (API.token) {
      try {
        const { user } = await API.me();
        me = user;
        return enterApp();
      } catch { API.setToken(''); }
    }
    $('#auth-view').classList.remove('hidden');
  }

  boot();
})();
