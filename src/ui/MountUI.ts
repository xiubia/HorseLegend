/**
 * 坐骑选择面板 — 全屏模态 UI
 * 左侧网格浏览 + 右侧 3D 预览 + 属性面板 + 解锁/装备按钮
 * UI 风格匹配游戏 Roblox 卡通风格
 */

import * as THREE from 'three';
import { getAllMounts, getMountById, getRarityColor, getRarityLabel, MountDef } from '../data/MountRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';
import { Horse, SimpleHorseConfig } from '../entities/Horse';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class MountUI {
  private overlay: HTMLDivElement | null = null;
  private isOpen = false;
  private selectedMountId: string = '';

  // 3D 预览
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewMesh: THREE.Object3D | null = null;
  private previewHorseInstance: Horse | null = null;
  private previewAnimId: number = 0;
  private previewRotation: number = 0;

  // 回调
  private onEquipCallback: ((mountId: string) => void) | null = null;

  onEquip(cb: (mountId: string) => void) {
    this.onEquipCallback = cb;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const progress = getPlayerProgress();
    this.selectedMountId = progress.getEquippedMount();

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
    this.updatePreviewHorse();
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
      background: #FFF9E6; color: #333; border-radius: 20px;
      padding: 20px 24px; width: 720px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
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
    title.innerHTML = '🐴 坐骑';
    title.style.cssText = `
      font-size: 24px; font-weight: 900; color: #000;
      text-shadow: 1px 1px 0 #ccc;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
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
    left.id = 'mount-grid-container';
    left.style.cssText = `
      flex: 0 0 340px; overflow-y: auto; overflow-x: hidden;
      padding-right: 8px;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    `;

    const progress = getPlayerProgress();
    const equippedId = progress.getEquippedMount();

    for (const mount of getAllMounts()) {
      const card = this.createMountCard(mount, equippedId, progress.isMountUnlocked(mount.id));
      grid.appendChild(card);
    }

    left.appendChild(grid);
    return left;
  }

  private createMountCard(mount: MountDef, equippedId: string, unlocked: boolean): HTMLDivElement {
    const card = document.createElement('div');
    const isSelected = mount.id === this.selectedMountId;
    const isEquipped = mount.id === equippedId;
    const rarityColor = getRarityColor(mount.rarity);

    card.style.cssText = `
      border: 3px solid ${isSelected ? '#FFD700' : rarityColor};
      border-radius: 12px; padding: 8px; cursor: pointer;
      background: ${isSelected ? '#FFF3D0' : (unlocked ? '#FFFFFF' : '#E8E8E8')};
      box-shadow: ${isSelected ? '0 0 8px rgba(255,215,0,0.6)' : '0 2px 0 #999'};
      transition: all 0.15s; text-align: center;
      position: relative; min-height: 100px;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 4px;
    `;

    // 马匹颜色预览色块
    const colorPreview = document.createElement('div');
    colorPreview.style.cssText = `
      width: 50px; height: 40px; border-radius: 8px;
      background: linear-gradient(135deg, ${mount.bodyColor} 60%, ${mount.maneColor} 100%);
      border: 2px solid #000; margin-bottom: 2px;
    `;

    // 不透明锁定蒙版
    if (!unlocked) {
      colorPreview.style.filter = 'grayscale(100%)';
      colorPreview.style.opacity = '0.5';
    }

    card.appendChild(colorPreview);

    // 名称
    const nameEl = document.createElement('div');
    nameEl.textContent = mount.name;
    nameEl.style.cssText = `
      font-size: 13px; font-weight: bold; color: #000;
    `;
    card.appendChild(nameEl);

    // 状态标签
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size: 11px; font-weight: bold;`;
    if (isEquipped) {
      statusEl.textContent = '✅ 已乘骑';
      statusEl.style.color = '#2ECC40';
    } else if (unlocked) {
      statusEl.textContent = '已拥有';
      statusEl.style.color = '#4488FF';
    } else {
      statusEl.textContent = `🔒 🏆${mount.unlockCost}`;
      statusEl.style.color = '#999';
    }
    card.appendChild(statusEl);

    // 稀有度小标
    const rarityBadge = document.createElement('div');
    rarityBadge.textContent = getRarityLabel(mount.rarity);
    rarityBadge.style.cssText = `
      position: absolute; top: 4px; right: 4px;
      font-size: 9px; padding: 1px 5px; border-radius: 6px;
      background: ${rarityColor}; color: #fff; font-weight: bold;
    `;
    card.appendChild(rarityBadge);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedMountId = mount.id;
      this.refreshUI();
      this.updatePreviewHorse();
    });

    return card;
  }

  private createRightPreview(): HTMLDivElement {
    const right = document.createElement('div');
    right.id = 'mount-preview-container';
    right.style.cssText = `
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 10px;
    `;

    // 3D 预览画布
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'mount-preview-canvas-wrap';
    canvasWrap.style.cssText = `
      width: 100%; height: 200px;
      border: 3px solid #000; border-radius: 14px;
      background: linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%);
      overflow: hidden; position: relative;
    `;
    right.appendChild(canvasWrap);

    // 属性面板
    const statsPanel = document.createElement('div');
    statsPanel.id = 'mount-stats-panel';
    statsPanel.style.cssText = `
      width: 100%; background: #FFF; border: 3px solid #000;
      border-radius: 14px; padding: 12px 16px;
    `;
    right.appendChild(statsPanel);

    // 操作按钮
    const actionDiv = document.createElement('div');
    actionDiv.id = 'mount-action-div';
    actionDiv.style.cssText = `
      width: 100%; display: flex; justify-content: center;
    `;
    right.appendChild(actionDiv);

    // 延迟填充内容（需要 DOM 就绪后）
    requestAnimationFrame(() => {
      this.updateStatsPanel();
      this.updateActionButton();
    });

    return right;
  }

  // ============ 刷新 UI ============

  private refreshUI(): void {
    if (!this.overlay) return;

    // 重建左侧网格
    const gridContainer = this.overlay.querySelector('#mount-grid-container');
    if (gridContainer) {
      gridContainer.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      `;
      const progress = getPlayerProgress();
      const equippedId = progress.getEquippedMount();
      for (const mount of getAllMounts()) {
        const card = this.createMountCard(mount, equippedId, progress.isMountUnlocked(mount.id));
        grid.appendChild(card);
      }
      gridContainer.appendChild(grid);
    }

    this.updateStatsPanel();
    this.updateActionButton();
  }

  private updateStatsPanel(): void {
    if (!this.overlay) return;
    const panel = this.overlay.querySelector('#mount-stats-panel') as HTMLDivElement;
    if (!panel) return;

    const mount = getMountById(this.selectedMountId);
    const rarityColor = getRarityColor(mount.rarity);

    panel.innerHTML = `
      <div style="font-size: 18px; font-weight: 900; color: #000; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
        ${mount.name}
        <span style="font-size: 12px; padding: 2px 8px; border-radius: 8px; background: ${rarityColor}; color: #fff;">${getRarityLabel(mount.rarity)}</span>
      </div>
      ${this.makeStatBar('加速度', mount.stats.acceleration, 80, '#FF9F43')}
      ${this.makeStatBar('极速加成', mount.stats.speedBonus, 40, '#54A0FF')}
      ${this.makeStatBar('金币加成', mount.stats.coinBonus, 35, '#FECA57')}
    `;
  }

  private makeStatBar(label: string, value: number, max: number, color: string): string {
    const pct = Math.round((value / max) * 100);
    return `
      <div style="display: flex; align-items: center; margin: 6px 0; gap: 8px;">
        <div style="width: 70px; font-size: 13px; font-weight: bold; color: #555;">${label}</div>
        <div style="flex: 1; height: 14px; background: #EEE; border-radius: 7px; border: 2px solid #000; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 5px; transition: width 0.3s;"></div>
        </div>
        <div style="width: 40px; text-align: right; font-size: 13px; font-weight: bold; color: #000;">${value}%</div>
      </div>
    `;
  }

  private updateActionButton(): void {
    if (!this.overlay) return;
    const actionDiv = this.overlay.querySelector('#mount-action-div') as HTMLDivElement;
    if (!actionDiv) return;
    actionDiv.innerHTML = '';

    const progress = getPlayerProgress();
    const mount = getMountById(this.selectedMountId);
    const equipped = progress.getEquippedMount() === mount.id;
    const unlocked = progress.isMountUnlocked(mount.id);

    if (equipped) {
      const btn = this.createActionBtn('✅ 已装备', '#95E1D3', false);
      actionDiv.appendChild(btn);
    } else if (unlocked) {
      const btn = this.createActionBtn('装备', '#54A0FF', true);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.equipMount(mount.id);
        if (this.onEquipCallback) this.onEquipCallback(mount.id);
        this.refreshUI();
        this.updatePreviewHorse();
      });
      actionDiv.appendChild(btn);
    } else {
      const canAfford = progress.totalTrophies >= mount.unlockCost;
      const btn = this.createActionBtn(
        `解锁 🏆${mount.unlockCost}`,
        canAfford ? '#FECA57' : '#CCCCCC',
        canAfford
      );
      if (canAfford) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (progress.unlockMount(mount.id, mount.unlockCost)) {
            // 解锁后自动装备
            progress.equipMount(mount.id);
            if (this.onEquipCallback) this.onEquipCallback(mount.id);
            this.refreshUI();
            this.updatePreviewHorse();
          }
        });
      }

      // 显示当前奖杯数
      const trophyInfo = document.createElement('div');
      trophyInfo.style.cssText = `
        font-size: 12px; color: ${canAfford ? '#2ECC40' : '#FF6B6B'}; margin-left: 12px;
        display: flex; align-items: center;
      `;
      trophyInfo.textContent = `当前: 🏆${progress.totalTrophies}`;

      actionDiv.appendChild(btn);
      actionDiv.appendChild(trophyInfo);
    }
  }

  private createActionBtn(text: string, bg: string, enabled: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 32px; border: 3px solid #000; border-radius: 12px;
      background: ${bg}; color: #000; font-size: 16px; font-weight: 900;
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
    const canvasWrap = this.overlay.querySelector('#mount-preview-canvas-wrap') as HTMLDivElement;
    if (!canvasWrap) return;

    const w = canvasWrap.clientWidth || 300;
    const h = canvasWrap.clientHeight || 200;

    this.previewScene = new THREE.Scene();
    this.previewScene.background = null; // 透明背景，使用 CSS 渐变

    // 灯光
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.previewScene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 3);
    this.previewScene.add(dir);

    // 相机
    this.previewCamera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.previewCamera.position.set(0, 2.5, 6);
    this.previewCamera.lookAt(0, 0.8, 0);

    // 渲染器
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(w, h);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasWrap.appendChild(this.previewRenderer.domElement);
    this.previewRenderer.domElement.style.cssText = 'width:100%; height:100%; display:block;';

    // 地面圆盘
    const floorGeo = new THREE.CylinderGeometry(2, 2, 0.1, 32);
    const floorMat = new THREE.MeshToonMaterial({ color: 0x8BC34A });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.05;
    this.previewScene.add(floor);

    this.previewRotation = 0;
    this.animatePreview();
  }

  private animatePreview = (): void => {
    this.previewAnimId = requestAnimationFrame(this.animatePreview);
    if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;

    this.previewRotation += 0.008;
    if (this.previewMesh) {
      this.previewMesh.rotation.y = this.previewRotation;
    }

    // 触发实体内的动画更新以便可以在 UI 里看到翅膀呼吸等特效
    if (this.previewHorseInstance) {
      this.previewHorseInstance.onUpdate(0.016); // 模拟 60fps dt
    }

    this.previewRenderer.render(this.previewScene, this.previewCamera);
  };

  private stopPreview(): void {
    cancelAnimationFrame(this.previewAnimId);
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewMesh = null;
  }

  private updatePreviewHorse(): void {
    if (!this.previewScene) return;

    // 移除旧模型
    if (this.previewMesh) {
      this.previewScene.remove(this.previewMesh);
      this.previewMesh = null;
    }

    const mount = getMountById(this.selectedMountId);
    const config: SimpleHorseConfig = {
      id: mount.id,
      name: mount.name,
      bodyColor: mount.bodyColor,
      maneColor: mount.maneColor,
      appearance: mount.appearance,
    };

    const tempHorse = new Horse(mount.id, config);
    const mesh = tempHorse.createMesh();
    mesh.position.set(0, 0, 0);
    mesh.rotation.y = this.previewRotation;

    this.previewMesh = mesh;
    this.previewHorseInstance = tempHorse;
    this.previewScene.add(mesh);
  }
}
