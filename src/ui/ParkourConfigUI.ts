/**
 * AI 跑道定制面板 UI
 * 玩家走近跑酷门时弹出，可输入地图描述、选择风格标签和难度
 * 出生点场景描述已移至 SettingsUI（AI 设置面板）
 * UI 风格匹配游戏 Roblox 卡通风格
 */

import { ParkourConfig } from '../data/types/GameTypes';
import { getThemeIds } from '../ai/ThemeRegistry';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

// 主题标签对应的中文名称 & emoji
const THEME_LABELS: Record<string, { label: string; emoji: string }> = {
  meadow:     { label: '草原',     emoji: '🌿' },
  forest:     { label: '森林',     emoji: '🌲' },
  desert:     { label: '沙漠',     emoji: '🏜️' },
  sunset:     { label: '黄昏',     emoji: '🌅' },
  snow:       { label: '雪地',     emoji: '❄️' },
  night:      { label: '夜间',     emoji: '🌙' },
  cherry:     { label: '樱花',     emoji: '🌸' },
  volcano:    { label: '火山',     emoji: '🌋' },
  crystal:    { label: '水晶洞穴', emoji: '💎' },
  neon:       { label: '霓虹都市', emoji: '🏙️' },
  underwater: { label: '海底世界', emoji: '🐠' },
  ancient:    { label: '远古遗迹', emoji: '🏛️' },
  cloud:      { label: '云端天路', emoji: '☁️' },
  lava:       { label: '熔岩地狱', emoji: '🔥' },
  bamboo:     { label: '竹林',     emoji: '🎋' },
  autumn:     { label: '金秋',     emoji: '🍂' },
  candy:      { label: '糖果世界', emoji: '🍭' },
  space:      { label: '太空',     emoji: '🚀' },
  swamp:      { label: '沼泽',     emoji: '🌿' },
};

export class ParkourConfigUI {
  private overlay: HTMLDivElement | null = null;
  private selectedTags: Set<string> = new Set();
  private selectedDifficulty: 'casual' | 'adaptive' | 'extreme' = 'adaptive';
  private onConfirm: ((config: ParkourConfig) => void) | null = null;
  private onCancel: (() => void) | null = null;

  /** 面板是否可见 */
  get isOpen(): boolean {
    return this.overlay !== null && this.overlay.parentElement !== null;
  }

  /**
   * 显示定制面板
   */
  show(callbacks: {
    onConfirm: (config: ParkourConfig) => void;
    onCancel: () => void;
  }): void {
    // 如果面板已经打开，不要重复创建（防止闪烁）
    if (this.isOpen) return;

    this.onConfirm = callbacks.onConfirm;
    this.onCancel = callbacks.onCancel;
    this.selectedTags.clear();
    this.selectedDifficulty = 'adaptive';

    // 移除旧面板
    this.dispose();

    // 创建遮罩
    this.overlay = document.createElement('div');
    this.overlay.id = 'parkour-config-overlay';
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.45);
      z-index: 10000;
      display: flex; justify-content: center; align-items: center;
      font-family: ${FONT};
    `;

    // 阻止鼠标和按键事件穿透到游戏
    const stopAll = (e: Event) => e.stopPropagation();
    this.overlay.addEventListener('mousedown', stopAll);
    this.overlay.addEventListener('mouseup', stopAll);
    this.overlay.addEventListener('click', stopAll);
    this.overlay.addEventListener('keydown', stopAll);
    // 注意：不阻止 keyup 冒泡，让 Input.ts 正确追踪按键释放状态，避免"粘键"

    // 面板容器
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333;
      border: 4px solid #000; border-radius: 20px;
      padding: 16px 20px 14px;
      max-width: 440px; width: 90%;
      box-shadow: 0 8px 0 #000;
      font-family: ${FONT};
      position: relative;
    `;

    // 关闭按钮（右上角 X）
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute; top: 10px; right: 14px;
      width: 28px; height: 28px;
      border: 2px solid #000; border-radius: 8px;
      background: #FFF; color: #000;
      font-size: 14px; font-weight: 900;
      cursor: pointer; font-family: ${FONT};
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 0 #000; transition: transform 0.1s;
    `;
    closeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      closeBtn.style.transform = 'translateY(1px)';
      closeBtn.style.boxShadow = '0 1px 0 #000';
    });
    closeBtn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      closeBtn.style.transform = '';
      closeBtn.style.boxShadow = '0 2px 0 #000';
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispose();
      if (this.onCancel) this.onCancel();
    });
    panel.appendChild(closeBtn);

    // 标题
    const title = document.createElement('div');
    title.style.cssText = `
      text-align: center; margin-bottom: 10px;
    `;
    title.innerHTML = `
      <div style="font-size: 20px; font-weight: 900; color: #000;
        text-shadow: 1px 1px 0 #ccc;">
        🎨 AI 跑道定制
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #888; margin-top: 2px;">
        描述你想要的世界，AI 将为你创造
      </div>
    `;
    panel.appendChild(title);

    // ---- 地图描述 ----
    panel.appendChild(this.makeLabel('🗺️ 地图描述'));
    const mapTextarea = this.makeTextarea(
      '例如：穿越火山岩浆的危险赛道，两侧有喷发的火焰和熔岩河流...',
      200,
      2
    );
    const mapCountLabel = document.createElement('div');
    mapCountLabel.style.cssText = 'text-align: right; font-size: 10px; color: #999; margin-top: 1px; font-weight: 700;';
    mapCountLabel.textContent = '0/200';
    mapTextarea.addEventListener('input', () => {
      mapCountLabel.textContent = `${mapTextarea.value.length}/200`;
    });
    panel.appendChild(mapTextarea);
    panel.appendChild(mapCountLabel);
    this.addSpacer(panel, 8);

    // ---- 快捷风格标签 ----
    panel.appendChild(this.makeLabel('🏷️ 快捷风格'));
    const tagsContainer = document.createElement('div');
    tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 2px;';

    const themeIds = getThemeIds();
    const tagButtons: Map<string, HTMLButtonElement> = new Map();
    for (const id of themeIds) {
      const info = THEME_LABELS[id] || { label: id, emoji: '🎮' };
      const btn = this.makeTagChip(`${info.emoji} ${info.label}`, false);
      tagButtons.set(id, btn);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedTags.has(id)) {
          this.selectedTags.delete(id);
          this.applyTagStyle(btn, false);
        } else {
          this.selectedTags.add(id);
          this.applyTagStyle(btn, true);
        }
      });
      tagsContainer.appendChild(btn);
    }
    panel.appendChild(tagsContainer);
    this.addSpacer(panel, 8);

    // ---- 难度选择 ----
    panel.appendChild(this.makeLabel('⚡ 难度'));
    const diffContainer = document.createElement('div');
    diffContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center; margin-bottom: 2px;';

    const diffOptions: { key: 'casual' | 'adaptive' | 'extreme'; emoji: string; label: string }[] = [
      { key: 'casual', emoji: '🌿', label: '休闲' },
      { key: 'adaptive', emoji: '🤖', label: 'AI自适应' },
      { key: 'extreme', emoji: '🔥', label: '极限挑战' },
    ];

    const diffButtons: Map<string, HTMLButtonElement> = new Map();
    for (const opt of diffOptions) {
      const btn = this.makeDiffButton(opt.emoji, opt.label, opt.key === this.selectedDifficulty);
      diffButtons.set(opt.key, btn);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedDifficulty = opt.key;
        // 更新所有按钮样式
        for (const [k, b] of diffButtons) {
          this.applyDiffStyle(b, k === opt.key);
        }
      });
      diffContainer.appendChild(btn);
    }
    panel.appendChild(diffContainer);
    this.addSpacer(panel, 12);

    // ---- 按钮区 ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px;';

    btnRow.appendChild(this.makeActionButton('🚀 AI生成', '#FFD700', '#000', () => {
      this.confirmConfig(mapTextarea.value);
    }));
    btnRow.appendChild(this.makeActionButton('🎲 随机生成', '#54A0FF', '#FFF', () => {
      this.confirmConfig('');
    }));
    panel.appendChild(btnRow);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  /**
   * 销毁面板
   */
  dispose(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  // ============ 私有方法 ============

  private confirmConfig(mapDesc: string): void {
    const config: ParkourConfig = {};

    if (mapDesc.trim()) config.mapDescription = mapDesc.trim();
    if (this.selectedTags.size > 0) config.selectedTags = [...this.selectedTags];
    config.difficulty = this.selectedDifficulty;

    this.dispose();
    if (this.onConfirm) this.onConfirm(config);
  }

  private addSpacer(parent: HTMLElement, height: number): void {
    const spacer = document.createElement('div');
    spacer.style.height = `${height}px`;
    parent.appendChild(spacer);
  }

  // ---- UI 组件工厂 ----

  private makeLabel(text: string): HTMLDivElement {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = `
      font-size: 12px; font-weight: 900; color: #666;
      margin-bottom: 5px; letter-spacing: 1px;
      font-family: ${FONT};
    `;
    return label;
  }

  private makeTextarea(placeholder: string, maxLength: number, rows: number): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.placeholder = placeholder;
    ta.maxLength = maxLength;
    ta.rows = rows;
    ta.style.cssText = `
      width: 100%; box-sizing: border-box;
      padding: 8px 12px;
      background: #FFFFFF;
      border: 3px solid #000;
      border-radius: 12px;
      color: #333;
      font-size: 13px;
      font-family: ${FONT};
      font-weight: 700;
      resize: none;
      outline: none;
      transition: border-color 0.15s;
    `;
    // 焦点高亮 - 金色边框
    ta.addEventListener('focus', () => { ta.style.borderColor = '#FFD700'; });
    ta.addEventListener('blur', () => { ta.style.borderColor = '#000'; });
    // 阻止事件穿透到游戏 Input 系统（keydown 阻止新按键注册，keyup 放行让粘键释放）
    ta.addEventListener('mousedown', (e) => e.stopPropagation());
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    return ta;
  }

  private makeTagChip(text: string, active: boolean): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.textContent = text;
    this.applyTagStyle(chip, active);
    chip.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      chip.style.transform = 'translateY(2px)';
      chip.style.boxShadow = '0 1px 0 #000';
    });
    chip.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      chip.style.transform = '';
      chip.style.boxShadow = '0 2px 0 #000';
    });
    return chip;
  }

  private applyTagStyle(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = `
      padding: 4px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-family: ${FONT};
      font-size: 12px;
      font-weight: 700;
      border: 2px solid #000;
      box-shadow: 0 2px 0 #000;
      transition: transform 0.1s;
      background: ${active ? '#FFD700' : '#FFF'};
      color: #000;
    `;
  }

  private makeDiffButton(emoji: string, label: string, active: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 1px;">${emoji}</div>
      <div style="font-size: 11px; font-weight: 900;">${label}</div>
    `;
    this.applyDiffStyle(btn, active);
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      btn.style.transform = 'translateY(2px)';
      btn.style.boxShadow = '0 1px 0 #000';
    });
    btn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      btn.style.transform = '';
      btn.style.boxShadow = '0 3px 0 #000';
    });
    return btn;
  }

  private applyDiffStyle(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = `
      flex: 1;
      padding: 8px 6px;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      font-family: ${FONT};
      border: 2px solid #000;
      box-shadow: 0 2px 0 #000;
      transition: transform 0.1s;
      background: ${active ? '#FFD700' : '#FFF'};
      color: #000;
    `;
  }

  private makeActionButton(text: string, bg: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      font-family: ${FONT};
      font-size: 15px;
      font-weight: 900;
      border: 3px solid #000;
      box-shadow: 0 3px 0 #000;
      background: ${bg};
      color: ${color};
      transition: transform 0.1s;
    `;
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      btn.style.transform = 'translateY(2px)';
      btn.style.boxShadow = '0 1px 0 #000';
    });
    btn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 0 #000';
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
}
