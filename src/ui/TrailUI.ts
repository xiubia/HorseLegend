/**
 * 尾迹选择面板 — 全屏模态 UI
 * 左侧 2 列网格浏览 + 右侧 3D 预览 + 属性面板 + 解锁/装备按钮
 * UI 风格参照参考图：深色卡片、金色锁头、流动渐变预览
 */

import * as THREE from 'three';
import {
  getAllTrails, getTrailById, getTrailRarityColor, getTrailRarityLabel,
  TrailDef,
} from '../data/TrailRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';
import { TrailEffect } from '../entities/TrailEffect';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class TrailUI {
  private overlay: HTMLDivElement | null = null;
  private isOpen = false;
  private selectedTrailId: string = '';

  // 3D 预览
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewAnimId: number = 0;
  private previewRotation: number = 0;
  private previewTrailEffect: TrailEffect | null = null;

  // 回调
  private onEquipCallback: ((trailId: string) => void) | null = null;

  onEquip(cb: (trailId: string) => void) {
    this.onEquipCallback = cb;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const progress = getPlayerProgress();
    this.selectedTrailId = progress.getEquippedTrail();

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.55); z-index: 9500;
      display: flex; justify-content: center; align-items: center;
    `;

    // 阻止事件穿透
    const stopAll = (e: Event) => e.stopPropagation();
    this.overlay.addEventListener('mousedown', stopAll);
    this.overlay.addEventListener('mouseup', stopAll);
    this.overlay.addEventListener('keydown', stopAll);
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === this.overlay) this.hide();
    });

    const panel = this.createPanel();
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // 启动 3D 预览
    this.startPreview();
    this.updatePreviewTrail();
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopPreview();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  dispose(): void {
    this.hide();
  }

  // ============ UI 构建 ============

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #3A3A3A; color: #fff; border-radius: 20px;
      padding: 20px 24px; width: 720px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #555; box-shadow: 0 8px 0 #222;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      display: flex; align-items: center; gap: 8px;
    `;

    const starIcon = document.createElement('div');
    starIcon.innerHTML = '&#11088;';
    starIcon.style.cssText = `font-size: 24px;`;

    const titleText = document.createElement('div');
    titleText.textContent = '尾迹';
    titleText.style.cssText = `
      font-size: 24px; font-weight: 900; color: #4DD8FF;
      text-shadow: 1px 1px 0 #000;
      background: linear-gradient(90deg, #4DD8FF, #50E6FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    `;

    title.appendChild(starIcon);
    title.appendChild(titleText);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border: 3px solid #000;
      background: #FF6B6B; color: #fff; border-radius: 50%;
      font-size: 16px; font-weight: bold; cursor: pointer;
      box-shadow: 0 3px 0 #000; font-family: ${FONT};
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // 主体区域：左侧网格 + 右侧预览
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex; gap: 16px; flex: 1; overflow: hidden;
    `;

    body.appendChild(this.createLeftGrid());
    body.appendChild(this.createRightPreview());

    panel.appendChild(body);
    return panel;
  }

  private createLeftGrid(): HTMLDivElement {
    const left = document.createElement('div');
    left.id = 'trail-grid-container';
    left.style.cssText = `
      flex: 0 0 320px; overflow-y: auto; overflow-x: hidden;
      padding-right: 8px;
    `;

    // 自定义滚动条
    const style = document.createElement('style');
    style.textContent = `
      #trail-grid-container::-webkit-scrollbar { width: 6px; }
      #trail-grid-container::-webkit-scrollbar-track { background: #2A2A2A; border-radius: 3px; }
      #trail-grid-container::-webkit-scrollbar-thumb { background: #666; border-radius: 3px; }
    `;
    left.appendChild(style);

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    `;

    const progress = getPlayerProgress();
    const equippedId = progress.getEquippedTrail();

    for (const trail of getAllTrails()) {
      const card = this.createTrailCard(trail, equippedId, progress.isTrailUnlocked(trail.id));
      grid.appendChild(card);
    }

    left.appendChild(grid);
    return left;
  }

  private createTrailCard(trail: TrailDef, equippedId: string, unlocked: boolean): HTMLDivElement {
    const card = document.createElement('div');
    const isSelected = trail.id === this.selectedTrailId;
    const isEquipped = trail.id === equippedId;

    card.style.cssText = `
      border: 3px solid ${isSelected ? '#FFD700' : '#555'};
      border-radius: 12px; padding: 8px; cursor: pointer;
      background: ${isSelected ? '#4A4A3A' : '#2A2A2A'};
      box-shadow: ${isSelected ? '0 0 10px rgba(255,215,0,0.5)' : '0 2px 0 #111'};
      transition: all 0.15s; text-align: center;
      position: relative; min-height: 110px;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 6px;
    `;

    // 尾迹颜色波浪预览
    if (trail.particleStyle !== 'none') {
      const preview = document.createElement('div');
      preview.style.cssText = `
        width: 100%; height: 55px; border-radius: 8px;
        background: linear-gradient(135deg, ${trail.primaryColor}88 0%, ${trail.secondaryColor}88 50%, transparent 100%);
        position: relative; overflow: hidden;
      `;

      // 流动波浪效果（CSS 动画）
      const wave = document.createElement('div');
      wave.style.cssText = `
        position: absolute; top: 0; left: -100%; width: 300%; height: 100%;
        background: linear-gradient(90deg, transparent 0%, ${trail.primaryColor}44 30%, ${trail.secondaryColor}66 50%, ${trail.primaryColor}44 70%, transparent 100%);
        animation: trailWave 2s linear infinite;
      `;
      preview.appendChild(wave);

      // 注入动画 CSS
      if (!document.getElementById('trail-wave-style')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'trail-wave-style';
        animStyle.textContent = `
          @keyframes trailWave {
            0% { transform: translateX(0); }
            100% { transform: translateX(33.33%); }
          }
        `;
        document.head.appendChild(animStyle);
      }

      if (!unlocked) {
        preview.style.filter = 'grayscale(60%) brightness(0.6)';
      }

      card.appendChild(preview);
    } else {
      // 无尾迹
      const noTrail = document.createElement('div');
      noTrail.style.cssText = `
        width: 100%; height: 55px; border-radius: 8px;
        background: #1A1A1A; display: flex; align-items: center;
        justify-content: center; color: #666; font-size: 13px;
      `;
      noTrail.textContent = '无';
      card.appendChild(noTrail);
    }

    // 锁头图标（未解锁时）
    if (!unlocked) {
      const lock = document.createElement('div');
      lock.innerHTML = '&#128274;';
      lock.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
      `;
      card.appendChild(lock);
    }

    // 底部价格/状态
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = `
      display: flex; align-items: center; justify-content: center; gap: 4px;
      font-size: 12px; font-weight: bold;
    `;

    if (isEquipped) {
      bottomBar.innerHTML = `<span style="color: #2ECC40;">&#9989; 已装备</span>`;
    } else if (unlocked) {
      bottomBar.innerHTML = `<span style="color: #4DD8FF;">已拥有</span>`;
    } else if (trail.unlockCost > 0) {
      bottomBar.innerHTML = `<span style="color: #FFD700;">&#127942;</span><span style="color: #DDD;">${trail.unlockCost}</span>`;
    } else {
      bottomBar.innerHTML = `<span style="color: #2ECC40;">免费</span>`;
    }
    card.appendChild(bottomBar);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedTrailId = trail.id;
      this.refreshUI();
      this.updatePreviewTrail();
    });

    return card;
  }

  private createRightPreview(): HTMLDivElement {
    const right = document.createElement('div');
    right.id = 'trail-preview-container';
    right.style.cssText = `
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 10px;
    `;

    // 尾迹名称
    const nameEl = document.createElement('div');
    nameEl.id = 'trail-name-display';
    nameEl.style.cssText = `
      font-size: 18px; font-weight: 900; color: #FFF;
      text-align: right; width: 100%;
    `;
    right.appendChild(nameEl);

    // 3D 预览画布
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'trail-preview-canvas-wrap';
    canvasWrap.style.cssText = `
      width: 100%; height: 200px;
      border: 3px solid #555; border-radius: 14px;
      background: radial-gradient(ellipse at center, #2A2A3A 0%, #1A1A2A 100%);
      overflow: hidden; position: relative;
    `;
    right.appendChild(canvasWrap);

    // 属性面板
    const statsPanel = document.createElement('div');
    statsPanel.id = 'trail-stats-panel';
    statsPanel.style.cssText = `
      width: 100%; background: #2A2A2A; border: 3px solid #555;
      border-radius: 14px; padding: 12px 16px;
    `;
    right.appendChild(statsPanel);

    // 操作按钮
    const actionDiv = document.createElement('div');
    actionDiv.id = 'trail-action-div';
    actionDiv.style.cssText = `
      width: 100%; display: flex; justify-content: center;
    `;
    right.appendChild(actionDiv);

    // 延迟填充内容
    requestAnimationFrame(() => {
      this.updateNameDisplay();
      this.updateStatsPanel();
      this.updateActionButton();
    });

    return right;
  }

  // ============ 刷新 UI ============

  private refreshUI(): void {
    if (!this.overlay) return;

    // 重建左侧网格
    const gridContainer = this.overlay.querySelector('#trail-grid-container');
    if (gridContainer) {
      // 保留 style 标签
      const styleTag = gridContainer.querySelector('style');
      gridContainer.innerHTML = '';
      if (styleTag) gridContainer.appendChild(styleTag);

      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      `;
      const progress = getPlayerProgress();
      const equippedId = progress.getEquippedTrail();
      for (const trail of getAllTrails()) {
        const card = this.createTrailCard(trail, equippedId, progress.isTrailUnlocked(trail.id));
        grid.appendChild(card);
      }
      gridContainer.appendChild(grid);
    }

    this.updateNameDisplay();
    this.updateStatsPanel();
    this.updateActionButton();
  }

  private updateNameDisplay(): void {
    if (!this.overlay) return;
    const nameEl = this.overlay.querySelector('#trail-name-display') as HTMLDivElement;
    if (!nameEl) return;

    const trail = getTrailById(this.selectedTrailId);
    const rarityColor = getTrailRarityColor(trail.rarity);

    nameEl.innerHTML = `
      <span>${trail.name}</span>
      <span style="font-size: 12px; padding: 2px 8px; border-radius: 8px; background: ${rarityColor}; color: #fff; margin-left: 8px;">${getTrailRarityLabel(trail.rarity)}</span>
    `;
  }

  private updateStatsPanel(): void {
    if (!this.overlay) return;
    const panel = this.overlay.querySelector('#trail-stats-panel') as HTMLDivElement;
    if (!panel) return;

    const trail = getTrailById(this.selectedTrailId);

    panel.innerHTML = `
      ${this.makeStatRow('加速度:', trail.stats.accelerationBonus)}
      ${this.makeStatRow('金币获取:', trail.stats.coinBonus)}
      ${this.makeStatRow('起步速度:', trail.stats.startSpeedBonus)}
    `;
  }

  private makeStatRow(label: string, value: number): string {
    const valueStr = Number.isInteger(value) ? `${value}%` : `${value}%`;
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0;">
        <div style="font-size: 14px; font-weight: bold; color: #CCC;">${label}</div>
        <div style="font-size: 16px; font-weight: 900; color: #2ECC40;">${valueStr}</div>
      </div>
    `;
  }

  private updateActionButton(): void {
    if (!this.overlay) return;
    const actionDiv = this.overlay.querySelector('#trail-action-div') as HTMLDivElement;
    if (!actionDiv) return;
    actionDiv.innerHTML = '';

    const progress = getPlayerProgress();
    const trail = getTrailById(this.selectedTrailId);
    const equipped = progress.getEquippedTrail() === trail.id;
    const unlocked = progress.isTrailUnlocked(trail.id);

    if (equipped) {
      const btn = this.createActionBtn('&#9989; 已装备', '#4A6A4A', false);
      actionDiv.appendChild(btn);
    } else if (unlocked) {
      const btn = this.createActionBtn('装备', '#4DD8FF', true);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.equipTrail(trail.id);
        if (this.onEquipCallback) this.onEquipCallback(trail.id);
        this.refreshUI();
        this.updatePreviewTrail();
      });
      actionDiv.appendChild(btn);
    } else {
      const canAfford = progress.totalTrophies >= trail.unlockCost;
      const btn = this.createActionBtn(
        `&#127942; ${trail.unlockCost}`,
        canAfford ? '#5AB85A' : '#555555',
        canAfford,
      );
      btn.style.minWidth = '180px';
      if (canAfford) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (progress.unlockTrail(trail.id, trail.unlockCost)) {
            // 解锁后自动装备
            progress.equipTrail(trail.id);
            if (this.onEquipCallback) this.onEquipCallback(trail.id);
            this.refreshUI();
            this.updatePreviewTrail();
          }
        });
      }

      actionDiv.appendChild(btn);

      // 显示当前奖杯数
      const trophyInfo = document.createElement('div');
      trophyInfo.style.cssText = `
        font-size: 12px; color: ${canAfford ? '#2ECC40' : '#FF6B6B'}; margin-left: 12px;
        display: flex; align-items: center;
      `;
      trophyInfo.textContent = `当前: &#127942;${progress.totalTrophies}`;
      trophyInfo.innerHTML = `当前: &#127942;${progress.totalTrophies}`;
      actionDiv.appendChild(trophyInfo);
    }
  }

  private createActionBtn(text: string, bg: string, enabled: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = text;
    btn.style.cssText = `
      padding: 10px 32px; border: 3px solid #000; border-radius: 12px;
      background: ${bg}; color: #fff; font-size: 16px; font-weight: 900;
      cursor: ${enabled ? 'pointer' : 'default'};
      box-shadow: 0 4px 0 #000; font-family: ${FONT};
      opacity: ${enabled ? '1' : '0.6'};
      transition: transform 0.1s;
    `;
    if (enabled) {
      btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(2px)'; });
      btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
    }
    return btn;
  }

  // ============ 3D 预览 ============

  private startPreview(): void {
    if (!this.overlay) return;
    const canvasWrap = this.overlay.querySelector('#trail-preview-canvas-wrap') as HTMLDivElement;
    if (!canvasWrap) return;

    const w = canvasWrap.clientWidth || 300;
    const h = canvasWrap.clientHeight || 200;

    this.previewScene = new THREE.Scene();
    this.previewScene.background = null;

    // 灯光
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.previewScene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(3, 5, 3);
    this.previewScene.add(dir);

    // 相机
    this.previewCamera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.previewCamera.position.set(0, 3, 6);
    this.previewCamera.lookAt(0, 1, 0);

    // 渲染器
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(w, h);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasWrap.appendChild(this.previewRenderer.domElement);
    this.previewRenderer.domElement.style.cssText = 'width:100%; height:100%; display:block;';

    // 地面圆盘
    const floorGeo = new THREE.CylinderGeometry(2, 2, 0.1, 32);
    const floorMat = new THREE.MeshToonMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.05;
    this.previewScene.add(floor);

    // 创建尾迹特效实例
    this.previewTrailEffect = new TrailEffect(this.previewScene);

    this.previewRotation = 0;
    this.animatePreview();
  }

  private animatePreview = (): void => {
    this.previewAnimId = requestAnimationFrame(this.animatePreview);
    if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;

    this.previewRotation += 0.02;

    // 模拟尾迹在旋转台上旋转
    if (this.previewTrailEffect) {
      const r = 0.8;
      const x = Math.cos(this.previewRotation) * r;
      const z = Math.sin(this.previewRotation) * r;
      const fakePos = new THREE.Vector3(x, 0, z);
      this.previewTrailEffect.update(fakePos, 6, 0.016);
    }

    this.previewRenderer.render(this.previewScene, this.previewCamera);
  };

  private stopPreview(): void {
    cancelAnimationFrame(this.previewAnimId);
    if (this.previewTrailEffect) {
      this.previewTrailEffect.dispose();
      this.previewTrailEffect = null;
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
  }

  private updatePreviewTrail(): void {
    if (!this.previewTrailEffect) return;

    const trail = getTrailById(this.selectedTrailId);
    this.previewTrailEffect.setTrail(trail);
  }
}
