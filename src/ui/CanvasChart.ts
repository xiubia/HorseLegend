/**
 * Canvas2D 柱状图绘制工具
 * 纯前端实现，无第三方依赖，卡通描边风格
 */

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export interface BarChartOptions {
  data: number[];
  labels: string[];
  width: number;
  height: number;
  barColor?: string;
  highlightIndex?: number;   // 高亮指定柱（如最新一局）
  bestLine?: number;         // 个人最佳虚线值
  title?: string;
}

/**
 * 绘制柱状图，返回 HTMLCanvasElement
 */
export function drawBarChart(opts: BarChartOptions): HTMLCanvasElement {
  const {
    data,
    labels,
    width,
    height,
    barColor = '#54A0FF',
    highlightIndex,
    bestLine,
    title,
  } = opts;

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 布局参数
  const padLeft = 50;
  const padRight = 16;
  const padTop = title ? 32 : 16;
  const padBottom = 36;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // 计算 Y 轴范围
  const maxVal = Math.max(...data, bestLine || 0, 1);
  const niceMax = getNiceMax(maxVal);

  // 背景
  ctx.fillStyle = '#FFFDF5';
  roundRect(ctx, 0, 0, width, height, 12, true, false);

  // 标题
  if (title) {
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);
  }

  // Y 轴网格线 + 刻度
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const val = (niceMax / gridCount) * i;
    const y = padTop + chartH - (val / niceMax) * chartH;
    // 网格线
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
    // 刻度值
    ctx.fillStyle = '#999';
    ctx.fillText(formatNum(val), padLeft - 6, y);
  }

  // 绘制柱体
  if (data.length === 0) return canvas;
  const barGap = 6;
  const totalGap = barGap * (data.length + 1);
  const barW = Math.min(32, (chartW - totalGap) / data.length);

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    const barH = Math.max(2, (val / niceMax) * chartH);
    const x = padLeft + barGap + i * (barW + barGap);
    const y = padTop + chartH - barH;

    const isHighlight = highlightIndex !== undefined && i === highlightIndex;
    const color = isHighlight ? '#FFD700' : barColor;

    // 柱体填充（圆角顶部）
    ctx.fillStyle = color;
    roundRectTop(ctx, x, y, barW, barH, Math.min(4, barW / 2));
    ctx.fill();

    // 描边
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    roundRectTop(ctx, x, y, barW, barH, Math.min(4, barW / 2));
    ctx.stroke();

    // 柱顶数值
    if (val > 0) {
      ctx.font = `bold 9px ${FONT}`;
      ctx.fillStyle = isHighlight ? '#B8860B' : '#555';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatNum(val), x + barW / 2, y - 3);
    }

    // 底部标签
    ctx.font = `bold 9px ${FONT}`;
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(labels[i] || '', x + barW / 2, padTop + chartH + 6);
  }

  // 个人最佳虚线
  if (bestLine !== undefined && bestLine > 0) {
    const bestY = padTop + chartH - (bestLine / niceMax) * chartH;
    ctx.strokeStyle = '#FF5252';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, bestY);
    ctx.lineTo(padLeft + chartW, bestY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 标注
    ctx.font = `bold 9px ${FONT}`;
    ctx.fillStyle = '#FF5252';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`最佳 ${formatNum(bestLine)}`, padLeft + chartW - 60, bestY - 3);
  }

  return canvas;
}

// ============ 辅助函数 ============

function getNiceMax(max: number): number {
  if (max <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, fill: boolean, stroke: boolean
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function roundRectTop(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
