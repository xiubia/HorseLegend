/**
 * 卡牌选择 UI
 * 底部滑入 3 张卡牌，玩家点选后回调
 */

import { CardDef, CardCategory } from '../systems/CardSystem';

// 卡牌类别对应的颜色方案
const CATEGORY_STYLES: Record<CardCategory, { border: string; bg: string; glow: string }> = {
  buff: { border: '#4CAF50', bg: 'rgba(76,175,80,0.15)', glow: '0 0 12px rgba(76,175,80,0.4)' },
  reward: { border: '#FFD700', bg: 'rgba(255,215,0,0.15)', glow: '0 0 12px rgba(255,215,0,0.4)' },
  trap: { border: '#FF4444', bg: 'rgba(255,68,68,0.15)', glow: '0 0 12px rgba(255,68,68,0.4)' },
};

export type CardPickCallback = (card: CardDef) => void;

/**
 * 显示卡牌选择界面
 * @returns 一个 remove 函数，用于强制关闭
 */
export function showCardPicker(
  cards: CardDef[],
  taunt: string,
  onPick: CardPickCallback
): () => void {
  // 注入动画 CSS（仅一次）
  injectAnimationCSS();

  // 容器
  const overlay = document.createElement('div');
  overlay.id = 'card-picker-overlay';
  overlay.style.cssText = `
    position: fixed; bottom: 0; left: 0; width: 100%; z-index: 3000;
    pointer-events: none;
    font-family: 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif;
  `;

  // 嘲讽文本
  const tauntEl = document.createElement('div');
  tauntEl.style.cssText = `
    text-align: center; padding: 10px 20px; margin-bottom: 8px;
    color: #FFD700; font-size: 18px; font-weight: 900;
    text-shadow: 0 2px 8px rgba(0,0,0,0.6);
    animation: cardFadeIn 0.4s ease-out;
    pointer-events: none;
  `;
  tauntEl.textContent = `"${taunt}"`;
  overlay.appendChild(tauntEl);

  // 卡牌容器
  const cardRow = document.createElement('div');
  cardRow.style.cssText = `
    display: flex; justify-content: center; gap: 16px;
    padding: 10px 20px 20px;
    pointer-events: auto;
  `;

  // 创建 3 张卡牌
  cards.forEach((card, index) => {
    const cardEl = createCardElement(card, index, () => {
      // 选中效果
      cardEl.style.transform = 'scale(1.15) translateY(-10px)';
      cardEl.style.boxShadow = '0 0 30px rgba(255,255,255,0.5)';

      // 禁用其他卡牌
      const allCards = cardRow.querySelectorAll('.card-item');
      allCards.forEach((el, i) => {
        if (i !== index) {
          (el as HTMLElement).style.opacity = '0.3';
          (el as HTMLElement).style.pointerEvents = 'none';
          (el as HTMLElement).style.transform = 'scale(0.9)';
        }
      });

      // 延迟后移除并回调
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          onPick(card);
        }, 300);
      }, 400);
    });
    cardRow.appendChild(cardEl);
  });

  overlay.appendChild(cardRow);
  document.body.appendChild(overlay);

  // 返回强制移除函数
  return () => {
    overlay.remove();
  };
}

/** 创建单张卡牌 DOM 元素 */
function createCardElement(card: CardDef, index: number, onClick: () => void): HTMLElement {
  const style = CATEGORY_STYLES[card.category];

  const el = document.createElement('div');
  el.className = 'card-item';
  el.style.cssText = `
    width: 140px;
    background: ${style.bg};
    backdrop-filter: blur(8px);
    border: 3px solid ${style.border};
    border-radius: 16px;
    padding: 16px 12px;
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.3s;
    box-shadow: ${style.glow};
    animation: cardSlideUp 0.4s ease-out ${index * 0.1}s both;
    user-select: none;
  `;

  // 类别标签
  const categoryLabel = card.category === 'buff' ? '增益' :
                        card.category === 'reward' ? '奖励' : 'AI陷阱';
  const categoryColor = card.category === 'trap' ? '#FF4444' :
                         card.category === 'reward' ? '#FFD700' : '#4CAF50';

  el.innerHTML = `
    <div style="font-size: 11px; color: ${categoryColor}; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px;">
      ${categoryLabel}
    </div>
    <div style="font-size: 40px; margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      ${card.icon}
    </div>
    <div style="font-size: 18px; font-weight: 900; color: #FFF; margin-bottom: 6px; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">
      ${card.name}
    </div>
    <div style="font-size: 13px; color: #DDD; margin-bottom: 4px;">
      ${card.desc}
    </div>
    ${card.cost ? `<div style="font-size: 11px; color: #FF8888; font-weight: 700;">${card.cost}</div>` : ''}
  `;

  // 悬停效果
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'translateY(-8px) scale(1.05)';
    el.style.boxShadow = `${style.glow}, 0 8px 25px rgba(0,0,0,0.3)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
    el.style.boxShadow = style.glow;
  });

  el.addEventListener('click', onClick);
  return el;
}

/** 注入动画 CSS（仅首次） */
function injectAnimationCSS(): void {
  if (document.getElementById('card-picker-anim')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'card-picker-anim';
  styleEl.textContent = `
    @keyframes cardSlideUp {
      0% {
        opacity: 0;
        transform: translateY(80px) scale(0.8);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes cardFadeIn {
      0% { opacity: 0; transform: translateY(20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);
}
