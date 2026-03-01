/**
 * 宠物管理面板 — 全屏模态 UI
 * 参考图片3：左侧宠物网格 + 右侧详情预览 + 装备/取下 + 装备最佳
 */

import * as THREE from 'three';
import {
  getPetById, getPetRarityColor, getPetRarityLabel,
  getPetSpeedBonus, PetDef, PET_MAX_OWNED, PET_MAX_EQUIPPED,
} from '../data/PetRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';
import { Pet } from '../entities/Pet';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class PetUI {
  /** 共享离屏渲染器 — 所有 mini 预览复用同一个，避免创建过多 WebGL 上下文 */
  private static sharedMiniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

  private overlay: HTMLDivElement | null = null;
  isOpen = false;
  private selectedIndex: number = 0; // 选中的宠物在 ownedPets 中的索引

  // 3D 预览（仅详情面板使用一个）
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewMesh: THREE.Object3D | null = null;
  private previewAnimId: number = 0;
  private previewRotation: number = 0;

  // 回调
  private onChangeCallback: (() => void) | null = null;

  /** 装备变化后回调 */
  onChange(cb: () => void) {
    this.onChangeCallback = cb;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.selectedIndex = 0;
    this.render();
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

  /** 重新渲染整个面板（数据变化后调用） */
  private render(): void {
    this.stopPreview();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.55); z-index: 9500;
      display: flex; justify-content: center; align-items: center;
    `;

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
    this.updatePreview();
  }

  // ============ 面板构建 ============

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333; border-radius: 20px;
      width: 780px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏
    panel.appendChild(this.createHeader());

    // 主体区域
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex; gap: 16px; flex: 1; overflow: hidden;
      padding: 16px 20px;
    `;

    // 左侧网格
    body.appendChild(this.createPetGrid());
    // 右侧详情
    body.appendChild(this.createDetailPanel());

    panel.appendChild(body);

    // 底部操作栏
    panel.appendChild(this.createBottomBar());

    return panel;
  }

  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      background: #4FC3F7; color: #FFF; padding: 12px 20px;
      display: flex; justify-content: space-between; align-items: center;
      border-radius: 16px 16px 0 0;
    `;

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    // 爪印图标
    const icon = document.createElement('span');
    icon.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: #FFF; border-radius: 50%;
      font-size: 20px;
    `;
    icon.textContent = '🐾';
    titleWrap.appendChild(icon);

    const title = document.createElement('span');
    title.textContent = '宠物';
    title.style.cssText = 'font-size: 22px; font-weight: 900;';
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border: 3px solid #FFF;
      background: #FF6B6B; color: #fff; border-radius: 50%;
      font-size: 16px; font-weight: bold; cursor: pointer;
      box-shadow: 0 3px 0 rgba(0,0,0,0.3); font-family: ${FONT};
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    header.appendChild(closeBtn);

    return header;
  }

  private createPetGrid(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      flex: 1; overflow-y: auto; min-width: 0;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    `;

    const progress = getPlayerProgress();
    const ownedPets = progress.getOwnedPets();
    const equippedPets = progress.getEquippedPets();

    if (ownedPets.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        grid-column: 1 / -1; text-align: center;
        padding: 40px; color: #999; font-size: 16px;
      `;
      empty.textContent = '还没有宠物，去抽蛋吧！';
      grid.appendChild(empty);
    }

    for (let i = 0; i < ownedPets.length; i++) {
      const petId = ownedPets[i];
      const pet = getPetById(petId);
      const isEquipped = equippedPets.includes(petId);
      const isSelected = i === this.selectedIndex;
      const rarityColor = getPetRarityColor(pet.rarity);

      const card = document.createElement('div');
      card.style.cssText = `
        background: ${isSelected ? 'rgba(79, 195, 247, 0.3)' : '#FFF'};
        border: 3px solid ${isSelected ? '#4FC3F7' : rarityColor};
        border-radius: 12px; padding: 6px;
        text-align: center; cursor: pointer;
        position: relative;
        transition: border-color 0.2s;
        box-shadow: ${isSelected ? '0 0 8px rgba(79,195,247,0.5)' : '0 2px 0 rgba(0,0,0,0.1)'};
      `;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedIndex = i;
        this.render();
      });

      // 宠物预览小图
      const previewDiv = document.createElement('div');
      previewDiv.style.cssText = `
        width: 70px; height: 55px; margin: 0 auto 4px;
        border-radius: 8px; overflow: hidden;
        background: rgba(0,0,0,0.05);
      `;
      card.appendChild(previewDiv);
      this.renderMiniPreview(previewDiv, pet);

      // 倍率
      const mult = document.createElement('div');
      mult.textContent = `${pet.speedMultiplier}x`;
      mult.style.cssText = `
        font-size: 14px; font-weight: 900;
        color: ${rarityColor};
      `;
      card.appendChild(mult);

      // 装备标记
      if (isEquipped) {
        const checkmark = document.createElement('div');
        checkmark.style.cssText = `
          position: absolute; bottom: 4px; right: 4px;
          width: 20px; height: 20px; background: #2ECC71;
          border-radius: 50%; border: 2px solid #FFF;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #FFF;
        `;
        checkmark.textContent = '✓';
        card.appendChild(checkmark);
      }

      grid.appendChild(card);
    }

    container.appendChild(grid);
    return container;
  }

  private createDetailPanel(): HTMLDivElement {
    const detail = document.createElement('div');
    detail.style.cssText = `
      width: 260px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 12px;
    `;

    const progress = getPlayerProgress();
    const ownedPets = progress.getOwnedPets();

    if (ownedPets.length === 0 || this.selectedIndex >= ownedPets.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 40px; color: #999;';
      empty.textContent = '选择一个宠物查看详情';
      detail.appendChild(empty);
      return detail;
    }

    const petId = ownedPets[this.selectedIndex];
    const pet = getPetById(petId);
    const isEquipped = progress.isPetEquipped(petId);
    const rarityColor = getPetRarityColor(pet.rarity);

    // 名称
    const name = document.createElement('div');
    name.textContent = pet.name;
    name.style.cssText = `
      font-size: 22px; font-weight: 900; text-align: center;
      color: #333;
    `;
    detail.appendChild(name);

    // 3D 预览区
    const previewContainer = document.createElement('div');
    previewContainer.id = 'pet-detail-preview';
    previewContainer.style.cssText = `
      width: 200px; height: 160px; margin: 0 auto;
      background: linear-gradient(135deg, ${this.getRarityBg(pet.rarity)});
      border: 3px solid ${rarityColor};
      border-radius: 14px; overflow: hidden;
    `;
    detail.appendChild(previewContainer);

    // 属性信息
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
      background: #FFF; border: 2px solid #EEE;
      border-radius: 10px; padding: 10px;
    `;

    const speedBonus = getPetSpeedBonus(pet.speedMultiplier);

    infoBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="color:#888;">倍率</span>
        <span style="font-weight:900; color:${rarityColor};">${pet.speedMultiplier}x</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="color:#888;">速度加成</span>
        <span style="font-weight:900; color:#2ECC71;">+${speedBonus.toFixed(0)}%</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#888;">品质</span>
        <span style="font-weight:900; color:${rarityColor};">${getPetRarityLabel(pet.rarity)}</span>
      </div>
    `;
    detail.appendChild(infoBox);

    // 装备/取下按钮
    const actionBtn = document.createElement('button');
    if (isEquipped) {
      actionBtn.textContent = '取下';
      actionBtn.style.cssText = `
        background: #E74C3C; color: #FFF;
        border: 3px solid #000; border-radius: 12px;
        padding: 10px; font-size: 18px; font-weight: 900;
        cursor: pointer; box-shadow: 0 3px 0 #000;
        font-family: ${FONT}; width: 100%;
      `;
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.unequipPet(petId);
        if (this.onChangeCallback) this.onChangeCallback();
        this.render();
      });
    } else {
      const equippedCount = progress.getEquippedPets().length;
      const canEquip = equippedCount < PET_MAX_EQUIPPED;
      actionBtn.textContent = canEquip ? '装备' : `已满(${PET_MAX_EQUIPPED}/${PET_MAX_EQUIPPED})`;
      actionBtn.style.cssText = `
        background: ${canEquip ? '#4FC3F7' : '#AAA'}; color: #FFF;
        border: 3px solid #000; border-radius: 12px;
        padding: 10px; font-size: 18px; font-weight: 900;
        cursor: ${canEquip ? 'pointer' : 'not-allowed'};
        box-shadow: 0 3px 0 #000;
        font-family: ${FONT}; width: 100%;
      `;
      if (canEquip) {
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          progress.equipPet(petId);
          if (this.onChangeCallback) this.onChangeCallback();
          this.render();
        });
      }
    }
    detail.appendChild(actionBtn);

    return detail;
  }

  private createBottomBar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.style.cssText = `
      padding: 12px 20px; border-top: 2px solid #EEE;
      display: flex; justify-content: space-between; align-items: center;
    `;

    const progress = getPlayerProgress();
    const ownedCount = progress.getOwnedPetCount();
    const equippedCount = progress.getEquippedPets().length;

    // 左侧统计
    const stats = document.createElement('div');
    stats.style.cssText = 'display: flex; gap: 16px; align-items: center;';

    const equipped = document.createElement('span');
    equipped.innerHTML = `🐾 <b>${equippedCount}/${PET_MAX_EQUIPPED}</b>`;
    equipped.style.cssText = 'font-size: 16px;';
    stats.appendChild(equipped);

    const owned = document.createElement('span');
    owned.innerHTML = `🎒 <b>${ownedCount}/${PET_MAX_OWNED}</b>`;
    owned.style.cssText = 'font-size: 16px;';
    stats.appendChild(owned);

    bar.appendChild(stats);

    // 右侧按钮
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display: flex; gap: 10px;';

    // 装备最佳按钮
    const bestBtn = document.createElement('button');
    bestBtn.textContent = '装备最佳';
    bestBtn.style.cssText = `
      background: linear-gradient(135deg, #4FC3F7, #0288D1);
      color: #FFF; border: 3px solid #000; border-radius: 12px;
      padding: 8px 20px; font-size: 16px; font-weight: 900;
      cursor: pointer; box-shadow: 0 3px 0 #000;
      font-family: ${FONT};
    `;
    bestBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.equipBest();
    });
    btnWrap.appendChild(bestBtn);

    bar.appendChild(btnWrap);

    return bar;
  }

  // ============ 逻辑 ============

  /** 自动装备倍率最高的宠物 */
  private equipBest(): void {
    const progress = getPlayerProgress();
    const ownedPets = progress.getOwnedPets();

    // 先取下所有
    const equipped = progress.getEquippedPets();
    for (const id of equipped) {
      progress.unequipPet(id);
    }

    // 按倍率排序（从高到低）
    const sorted = ownedPets
      .map((id, idx) => ({ id, idx, mult: getPetById(id).speedMultiplier }))
      .sort((a, b) => b.mult - a.mult);

    // 装备前 N 个（去重，每个 id 只装一个）
    const equippedSet = new Set<string>();
    let count = 0;
    for (const item of sorted) {
      if (count >= PET_MAX_EQUIPPED) break;
      if (!equippedSet.has(item.id)) {
        progress.equipPet(item.id);
        equippedSet.add(item.id);
        count++;
      }
    }

    // 如果没填满，允许重复
    if (count < PET_MAX_EQUIPPED) {
      for (const item of sorted) {
        if (count >= PET_MAX_EQUIPPED) break;
        if (!progress.isPetEquipped(item.id)) {
          progress.equipPet(item.id);
          count++;
        }
      }
    }

    if (this.onChangeCallback) this.onChangeCallback();
    this.render();
  }

  // ============ 3D 预览 ============

  private updatePreview(): void {
    const progress = getPlayerProgress();
    const ownedPets = progress.getOwnedPets();
    if (ownedPets.length === 0 || this.selectedIndex >= ownedPets.length) return;

    const pet = getPetById(ownedPets[this.selectedIndex]);
    const container = document.getElementById('pet-detail-preview');
    if (!container) return;

    this.startPreview(container, pet);
  }

  private startPreview(container: HTMLElement, pet: PetDef): void {
    this.stopPreview();

    const w = 200, h = 160;
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(w, h);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.previewRenderer.domElement);

    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.previewCamera.position.set(0, 1, 3);
    this.previewCamera.lookAt(0, 0.5, 0);

    this.previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    this.previewScene.add(dir);

    this.previewMesh = Pet.createPreviewMesh(pet);
    this.previewScene.add(this.previewMesh);

    this.previewRotation = 0;
    const animate = () => {
      if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;
      this.previewAnimId = requestAnimationFrame(animate);
      this.previewRotation += 0.02;
      if (this.previewMesh) {
        this.previewMesh.rotation.y = this.previewRotation;
        this.previewMesh.position.y = 0.5 + Math.sin(this.previewRotation * 2) * 0.08;
      }
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    };
    animate();
  }

  private stopPreview(): void {
    if (this.previewAnimId) {
      cancelAnimationFrame(this.previewAnimId);
      this.previewAnimId = 0;
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewMesh = null;
  }

  /**
   * 用共享离屏渲染器生成静态快照，避免每个卡片创建 WebGL 上下文
   */
  private renderMiniPreview(container: HTMLDivElement, pet: PetDef): void {
    const w = 70, h = 55;
    // 用共享渲染器（创建后立即释放）
    const renderer = PetUI.sharedMiniRenderer;
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.8, 2.8);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    const mesh = Pet.createPreviewMesh(pet);
    mesh.scale.set(0.8, 0.8, 0.8);
    mesh.rotation.y = 0.5; // 固定朝向，好看的角度
    scene.add(mesh);

    renderer.render(scene, camera);

    // 将渲染结果转为静态图片
    const img = document.createElement('img');
    img.src = renderer.domElement.toDataURL();
    img.style.cssText = `width: ${w}px; height: ${h}px; display: block;`;
    container.appendChild(img);
  }

  private getRarityBg(rarity: string): string {
    switch (rarity) {
      case 'common': return '#F5F5F5, #E0E0E0';
      case 'rare': return '#E8F5E9, #C8E6C9';
      case 'epic': return '#E3F2FD, #BBDEFB';
      case 'legendary': return '#FFF9C4, #FFE082';
    }
    return '#FFF, #EEE';
  }
}
