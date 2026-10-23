/**
 * 番茄钟模块（被 app.js 调用，也可独立讲解）
 * 实现要点：
 *  - 用「结束时间戳 - 当前时间」计算剩余秒数，setInterval 只做显示刷新，
 *    这样即使浏览器节流标签页、切后台，计时也不会漂移。
 *  - 暂停时记录剩余秒数，恢复时重新计算结束时间戳。
 *  - 专注模式走完 25 分钟后调用 onComplete 回调（由 app.js 上报后端并播放提示）。
 */
const Pomodoro = (() => {
  const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  let mode = 'focus';
  let total = MODES[mode];
  let endAt = null;      // 运行中：这一轮何时结束
  let remain = total;    // 暂停/未开始：剩余秒数
  let timerId = null;

  const $ = (id) => document.getElementById(id);
  const timeEl = () => $('pomo-time');
  const ringEl = () => $('pomo-ring');
  const hintEl = () => $('pomo-hint');

  const RING_LEN = 2 * Math.PI * 88;

  function fmt(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function render() {
    timeEl().textContent = fmt(remain);
    const frac = total ? remain / total : 0;
    const ring = ringEl();
    ring.style.strokeDasharray = RING_LEN;
    ring.style.strokeDashoffset = RING_LEN * (1 - frac);
    ring.classList.toggle('ring-danger', mode === 'focus' && remain <= 60 && remain > 0);
  }

  function tick() {
    if (endAt) remain = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    render();
    if (remain <= 0) finish();
  }

  function start() {
    if (timerId) return;
    endAt = Date.now() + remain * 1000;
    timerId = setInterval(tick, 250);
    $('pomo-start').classList.add('hidden');
    $('pomo-pause').classList.remove('hidden');
    hintEl().textContent = mode === 'focus' ? '专注中，屏蔽干扰 💪' : '休息一下，看看远处 👀';
  }

  function pause() {
    clearInterval(timerId); timerId = null;
    endAt = null;
    $('pomo-start').classList.remove('hidden');
    $('pomo-pause').classList.add('hidden');
    hintEl().textContent = '已暂停';
  }

  function reset() {
    pause();
    remain = total;
    render();
    hintEl().textContent = '';
  }

  function setMode(m) {
    mode = m in MODES ? m : 'focus';
    total = MODES[mode];
    reset();
    document.querySelectorAll('.pomo-mode').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === mode));
  }

  let onComplete = null;
  function finish() {
    pause();
    const doneMode = mode;
    const minutes = Math.round(total / 60);
    remain = total;
    render();
    beep(doneMode === 'focus');
    if (onComplete) onComplete(doneMode, minutes);
  }

  /** 用 WebAudio 合成「叮-叮」提示音，无需音频文件 */
  function beep(isFocus) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = isFocus ? [880, 1175] : [660, 523];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02 + i * 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22 + i * 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.25); o.stop(ctx.currentTime + 0.3 + i * 0.25);
      });
    } catch { /* 浏览器限制时静默忽略 */ }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(isFocus ? '🍅 番茄完成！' : '⏰ 休息结束', {
        body: isFocus ? '该起来活动一下啦' : '准备好就开始下一个番茄',
      });
    }
  }

  function init(cb) {
    onComplete = cb;
    document.querySelectorAll('.pomo-mode').forEach((b) =>
      b.addEventListener('click', () => setMode(b.dataset.mode)));
    document.querySelectorAll('.pomo-btns .btn')[0].addEventListener('click', start);
    $('pomo-pause').addEventListener('click', pause);
    $('pomo-reset').addEventListener('click', reset);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    render();
  }

  return { init, reset, setMode, get mode() { return mode; } };
})();
