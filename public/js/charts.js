/**
 * 极简 Canvas 图表模块（手写，不依赖 Chart.js）
 * 提供 drawBar（柱状图）与 drawDonut（环形占比图）两个函数。
 * 支持高分屏：按 devicePixelRatio 放大画布再缩放绘制。
 */
const Charts = (() => {
  const COLORS = {
    bar: '#4f7cff', barSoft: 'rgba(79,124,255,.18)',
    grid: 'rgba(120,130,160,.25)', text: '#7b8496',
    donut: ['#ef476f', '#4f7cff', '#f78f1e', '#06a77d'],
  };

  function prep(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  /** 柱状图：labels 字符串数组，values 数值数组 */
  function drawBar(canvas, labels, values, color = COLORS.bar) {
    const { ctx, w, h } = prep(canvas);
    const padL = 34, padR = 12, padT = 16, padB = 30;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const max = Math.max(1, ...values);
    const niceMax = Math.ceil(max / 4) * 4;

    ctx.font = '11px system-ui, sans-serif';
    ctx.strokeStyle = COLORS.grid; ctx.fillStyle = COLORS.text;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(niceMax * (1 - i / 4))), padL - 6, y);
    }

    const slot = plotW / values.length;
    const bw = Math.min(38, slot * 0.55);
    values.forEach((v, i) => {
      const x = padL + slot * i + (slot - bw) / 2;
      const bh = (v / niceMax) * plotH;
      const y = padT + plotH - bh;
      const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
      grad.addColorStop(0, color); grad.addColorStop(1, COLORS.barSoft);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, bw, Math.max(bh, v > 0 ? 3 : 0), 5); ctx.fill();
      if (v > 0) {
        ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(v), x + bw / 2, y - 3);
      }
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(labels[i], padL + slot * i + slot / 2, padT + plotH + 8);
    });
  }

  /** 环形图：items = [{ label, value }] */
  function drawDonut(canvas, items) {
    const { ctx, w, h } = prep(canvas);
    const total = items.reduce((s, it) => s + it.value, 0);
    const cx = h / 2 + 10, cy = h / 2, R = Math.min(w, h) / 2 - 24, r = R * 0.62;

    if (!total) {
      ctx.fillStyle = COLORS.text; ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('暂无数据', w / 2, h / 2);
      return;
    }

    let a0 = -Math.PI / 2;
    items.forEach((it, i) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1); ctx.arc(cx, cy, r, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = COLORS.donut[i % COLORS.donut.length]; ctx.fill();
      a0 = a1;
    });

    ctx.fillStyle = '#1f2430'; ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 8);
    ctx.fillStyle = COLORS.text; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('未完成任务', cx, cy + 12);

    const lx = cx + R + 28;
    ctx.textAlign = 'left';
    items.forEach((it, i) => {
      const y = cy - (items.length - 1) * 11 + i * 22;
      ctx.fillStyle = COLORS.donut[i % COLORS.donut.length];
      roundRect(ctx, lx, y - 5, 10, 10, 3); ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${it.label} ${it.value}`, lx + 16, y);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  return { drawBar, drawDonut };
})();
