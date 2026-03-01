/**
 * 马匹实体 — Roblox 风格3D模型 + 速度等级系统
 * 适配模板引擎 Entity 基类（root / onUpdate / onInit）
 */

import * as THREE from 'three'
import { Entity } from '../world/Entity'
import { World } from '../world/World'
import type { HorseConfig, PlayerSnapshot, BuffInstance } from '../data/types/GameTypes'
import { GeometryUtils } from '../utils/GeometryUtils'
import type { MountDef, MountAppearance } from '../data/MountRegistry'
import type { TrailDef } from '../data/TrailRegistry'
import { getPlayerProgress } from '../data/PlayerProgress'
import { getTrainerById } from '../data/TrainerRegistry'

export interface SimpleHorseConfig {
    id: string
    name: string
    bodyColor: string
    maneColor: string
    appearance?: MountAppearance
}

export class Horse extends Entity {
    config: HorseConfig | SimpleHorseConfig
    private _speedLevel = 0
    private currentSpeed = 0
    private targetSpeed = 0
    private isRunning = false
    private progress = 0

    playerId = ''
    playerName = ''
    isHuman = true

    private legAnimTime = 0
    private legMeshes: THREE.Object3D[] = []
    private tailGroup: THREE.Group | null = null
    private headRef: THREE.Mesh | null = null
    private neckRef: THREE.Mesh | null = null

    // 扩展视觉组件
    private leftWing: THREE.Group | null = null
    private rightWing: THREE.Group | null = null
    private hornMesh: THREE.Object3D | null = null
    private armorMeshes: THREE.Object3D[] = []

    externalAnimSpeed = 0

    // 加成
    private mountSpeedBonus = 0
    private mountAccelBonus = 0
    mountCoinBonus = 0
    private trailAccelBonus = 0
    trailCoinBonus = 0
    trailStartSpeedBonus = 0
    talentSpeedBonus = 0
    petSpeedBonus = 0

    constructor(configOrId: HorseConfig | SimpleHorseConfig | string, configArg?: HorseConfig | SimpleHorseConfig) {
        super(['horse'])
        if (typeof configOrId === 'string') {
            this.config = configArg ?? { id: configOrId, name: configOrId, bodyColor: '#8B4513', maneColor: '#4A2500' }
        } else {
            this.config = configOrId
        }
    }

    /** HL 兼容 — 技能设置（模板中简化为空操作） */
    setSkills(_ids: string[], _cooldowns: number[]): void { /* no-op */ }

    // ── HL 战斗系统兼容方法 ──

    private _stamina = 100
    private _maxStamina = 100
    private _speedModifier = 1

    get currentStamina(): number { return this._stamina }
    set currentStamina(v: number) { this._stamina = Math.max(0, Math.min(this._maxStamina, v)) }

    consumeStamina(amount: number): boolean {
        if (this._stamina < amount) return false
        this._stamina -= amount
        return true
    }

    recoverStamina(amount: number): void {
        this._stamina = Math.min(this._maxStamina, this._stamina + amount)
    }

    setAction(_actionId: string, speedMod: number): void {
        this._speedModifier = speedMod
    }

    setSpeedModifier(modifier: number, _durationMs?: number): void {
        this._speedModifier = modifier
    }

    triggerSkillCooldown(_skillId: string, _cooldownMs: number): void { /* no-op */ }

    // ── 速度系统 ──

    get speedLevel(): number { return this._speedLevel }
    set speedLevel(v: number) { this._speedLevel = Math.max(0, v) }

    applyMountStats(mount: MountDef): void {
        this.mountSpeedBonus = mount.stats.speedBonus
        this.mountAccelBonus = mount.stats.acceleration
        this.mountCoinBonus = mount.stats.coinBonus
        this.config = { ...this.config, bodyColor: mount.bodyColor, maneColor: mount.maneColor, appearance: mount.appearance } as SimpleHorseConfig

        // 重新生成模型以应用新外观
        if (this.root.children.length > 0) {
            for (let i = this.root.children.length - 1; i >= 0; i--) {
                this.root.remove(this.root.children[i]);
            }
            this.legMeshes = []
            this.tailGroup = null
            this.headRef = null
            this.neckRef = null
            this.leftWing = null
            this.rightWing = null
            this.hornMesh = null
            this.armorMeshes = []
            this.createMesh()
        }
    }

    applyTrailStats(trail: TrailDef): void {
        this.trailAccelBonus = trail.stats.accelerationBonus
        this.trailCoinBonus = trail.stats.coinBonus
        this.trailStartSpeedBonus = trail.stats.startSpeedBonus
    }

    applyPetStats(totalBonus: number): void {
        this.petSpeedBonus = totalBonus
    }

    calculateMaxSpeed(): number {
        const base = 5 + this._speedLevel * 0.5
        return base * (1 + this.mountSpeedBonus / 100) * (1 + this.talentSpeedBonus / 100) * (1 + this.petSpeedBonus / 100)
    }

    startRunning(): void {
        this.isRunning = true
        this.targetSpeed = this.calculateMaxSpeed()
    }

    stopRunning(): void {
        this.isRunning = false
        this.targetSpeed = 0
    }

    get speed(): number { return this.currentSpeed }
    get currentProgress(): number { return this.progress }
    set currentProgress(v: number) { this.progress = v }

    reset(): void {
        this.currentSpeed = 0
        this.targetSpeed = 0
        this.progress = 0
        this.isRunning = false
        this.position.set(0, 0, 0)
        this.rotation.set(0, 0, 0)
    }

    resetProgress(): void {
        this.progress = 0
        this.position.set(0, 0, 0)
    }

    setSpeedLevel(level: number): void {
        this._speedLevel = Math.max(0, level)
    }

    getMaxSpeed(): number { return this.calculateMaxSpeed() }
    getAcceleration(): number { return 10 }

    getSnapshot(): PlayerSnapshot {
        return {
            id: this.playerId,
            name: this.playerName,
            isHuman: this.isHuman,
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            progress: this.progress,
            speed: this.currentSpeed,
            stamina: 100,
            maxStamina: 100,
            skills: [],
            activeBuffs: [],
            currentAction: this.isRunning ? 'running' : 'idle',
        }
    }

    // ── 生命周期 ──

    onInit(world: World): void {
        super.onInit(world)
        if (this.root.children.length === 0) this.createMesh()
    }

    onUpdate(dt: number): void {
        if (!this.active) return
        if (this.isRunning) this.targetSpeed = this.calculateMaxSpeed()

        // 平滑速度
        const accel = 10 * (1 + this.mountAccelBonus / 100) * (1 + this.trailAccelBonus / 100)
        if (this.currentSpeed < this.targetSpeed) {
            this.currentSpeed = Math.min(this.targetSpeed, this.currentSpeed + accel * dt)
        } else if (this.currentSpeed > this.targetSpeed) {
            this.currentSpeed = Math.max(this.targetSpeed, this.currentSpeed - accel * 1.5 * dt)
        }
        this.currentSpeed = Math.max(0, this.currentSpeed)

        // 位置
        const dist = this.currentSpeed * dt
        this.position.z += dist
        this.progress += dist

        // 动画
        this.updateAnimation(dt)
    }

    // ── 动画 ──

    private updateAnimation(dt: number): void {
        const animSpeed = Math.max(this.currentSpeed, this.externalAnimSpeed)
        const t = performance.now() * 0.001

        if (animSpeed > 0.1) {
            const bobSpeed = animSpeed * 2
            this.root.position.y = Math.abs(Math.sin(t * bobSpeed)) * 0.08

            this.legAnimTime += dt * animSpeed * 3
            const swing = Math.sin(this.legAnimTime) * 0.3
            if (this.legMeshes.length === 4) {
                this.legMeshes[0].rotation.x = swing
                this.legMeshes[3].rotation.x = swing
                this.legMeshes[1].rotation.x = -swing
                this.legMeshes[2].rotation.x = -swing
            }

            if (this.headRef) this.headRef.rotation.x = 0.05 + Math.sin(this.legAnimTime) * 0.05
            if (this.neckRef) this.neckRef.rotation.z = Math.sin(this.legAnimTime * 0.7) * 0.03
            if (this.tailGroup) this.tailGroup.rotation.z = Math.sin(t * 3) * 0.15
        } else {
            const breathSpeed = 1.2
            this.root.position.y = Math.sin(t * breathSpeed) * 0.015

            for (const leg of this.legMeshes) {
                leg.rotation.x *= 0.85
                if (Math.abs(leg.rotation.x) < 0.001) leg.rotation.x = 0
            }
            if (this.tailGroup) this.tailGroup.rotation.z = Math.sin(t * 1.5) * 0.07
            if (this.headRef) this.headRef.rotation.x = 0.05 + Math.sin(t * breathSpeed) * 0.015
            if (this.neckRef) {
                this.neckRef.rotation.z *= 0.9
                if (Math.abs(this.neckRef.rotation.z) < 0.001) this.neckRef.rotation.z = 0
            }
        }

        // 动态附加组件动画（翅膀等）
        if (this.leftWing && this.rightWing) {
            // 奔跑时拍打快，静止时呼吸式缓动
            const flapSpeed = animSpeed > 0.1 ? 8 : 2;
            const flapAmp = animSpeed > 0.1 ? 0.5 : 0.15;
            const flap = Math.sin(t * flapSpeed) * flapAmp;
            // 恶魔之翼或飞马翼稍微有些角度差异，统一通过 Z 轴和 Y 轴旋转
            this.leftWing.rotation.z = flap;
            this.rightWing.rotation.z = -flap;
        }

        // 装甲材质发光呼吸效果 (如果在特定部位使用了特殊材质，可以在此遍历更新 emissiveIntensity)
        if (this.armorMeshes.length > 0) {
            const glow = 0.5 + Math.sin(t * 3) * 0.3;
            // 这里为了简化，我们查找材质如果是发光的则更新
            for (const am of this.armorMeshes) {
                if ('material' in am) {
                    const mat = (am as THREE.Mesh).material as THREE.MeshToonMaterial;
                    if (mat.emissive && mat.emissive.getHex() !== 0x000000) {
                        mat.emissiveIntensity = glow;
                    }
                }
            }
        }
    }

    // ── 3D 模型 ──

    createMesh(): THREE.Object3D {
        if (this.root.children.length > 0) return this.root

        let bodyColorStr = '#8B4513'
        let maneColorStr = '#4A2500'
        let appearanceConfig: MountAppearance | undefined

        if ('appearance' in this.config) {
            bodyColorStr = (this.config as any).appearance?.bodyColor || (this.config as any).bodyColor || '#8B4513'
            maneColorStr = (this.config as any).appearance?.maneColor || (this.config as any).maneColor || '#4A2500'
            appearanceConfig = (this.config as any).appearance as MountAppearance
        } else if ('bodyColor' in this.config) {
            bodyColorStr = this.config.bodyColor
            maneColorStr = this.config.maneColor
            appearanceConfig = (this.config as SimpleHorseConfig).appearance
        }

        const bodyMat = new THREE.MeshToonMaterial({ color: new THREE.Color(bodyColorStr) })
        const maneMat = new THREE.MeshToonMaterial({ color: new THREE.Color(maneColorStr) })
        const hoofMat = new THREE.MeshToonMaterial({ color: 0x3D2B1F })
        const noseMat = new THREE.MeshToonMaterial({ color: 0xC8A898 })
        const eyeWhiteMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF })
        const eyeBlackMat = new THREE.MeshToonMaterial({ color: 0x111111 })
        const shineMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF, emissive: 0xFFFFFF, emissiveIntensity: 0.6 })

        // 身体
        const body = new THREE.Mesh(GeometryUtils.createRoundedBox(0.65, 0.5, 1.15, 0.12), bodyMat)
        body.position.y = 0.85
        body.castShadow = true
        this.root.add(body)

        // 颈部
        const neck = new THREE.Mesh(GeometryUtils.createRoundedBox(0.3, 0.6, 0.3, 0.06), bodyMat)
        neck.position.set(0, 1.15, 0.52)
        neck.rotation.x = -0.45
        this.root.add(neck)
        this.neckRef = neck

        // 头部
        const head = new THREE.Mesh(GeometryUtils.createRoundedBox(0.38, 0.34, 0.52, 0.08), bodyMat)
        head.position.set(0, 1.45, 0.85)
        head.rotation.x = 0.05
        this.root.add(head)
        this.headRef = head

        // 鼻口
        const snout = new THREE.Mesh(GeometryUtils.createRoundedBox(0.28, 0.16, 0.2, 0.05), noseMat)
        snout.position.set(0, 1.35, 1.12)
        this.root.add(snout)

        // 鼻孔
        const nostrilGeo = new THREE.SphereGeometry(0.024, 6, 6)
        const nostrilMat = new THREE.MeshToonMaterial({ color: 0x555555 })
        for (const xOff of [-0.06, 0.06]) {
            const n = new THREE.Mesh(nostrilGeo, nostrilMat)
            n.position.set(xOff, 1.35, 1.23)
            this.root.add(n)
        }

        // 眼睛
        const makeEye = (xSign: number) => {
            const white = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), eyeWhiteMat)
            white.position.set(xSign * 0.18, 1.5, 1.0)
            white.scale.set(0.5, 1, 0.8)
            this.root.add(white)
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeBlackMat)
            pupil.position.set(xSign * 0.19, 1.5, 1.03)
            pupil.scale.set(0.4, 1, 0.8)
            this.root.add(pupil)
            const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), shineMat)
            shine.position.set(xSign * 0.185, 1.52, 1.05)
            this.root.add(shine)
        }
        makeEye(-1)
        makeEye(1)

        // 耳朵
        const earGeo = new THREE.ConeGeometry(0.07, 0.2, 4)
        for (const e of [{ x: -0.1, rz: -0.2 }, { x: 0.1, rz: 0.2 }]) {
            const ear = new THREE.Mesh(earGeo, bodyMat)
            ear.position.set(e.x, 1.72, 0.8)
            ear.rotation.set(-0.3, 0, e.rz)
            this.root.add(ear)
        }
        const earInnerGeo = new THREE.ConeGeometry(0.04, 0.12, 4)
        const earInnerMat = new THREE.MeshToonMaterial({ color: 0xFFCCCC })
        for (const e of [{ x: -0.1, rz: -0.2 }, { x: 0.1, rz: 0.2 }]) {
            const earIn = new THREE.Mesh(earInnerGeo, earInnerMat)
            earIn.position.set(e.x, 1.7, 0.82)
            earIn.rotation.set(-0.3, 0, e.rz)
            this.root.add(earIn)
        }

        // 鬃毛
        const maneTop = new THREE.Mesh(GeometryUtils.createRoundedBox(0.12, 0.16, 0.38, 0.03), maneMat)
        maneTop.position.set(0, 1.68, 0.76)
        maneTop.rotation.x = -0.2
        this.root.add(maneTop)

        for (let i = 0; i < 4; i++) {
            const tri = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 3), maneMat)
            const tFrac = i / 3
            tri.position.set(0, 1.45 - tFrac * 0.35, 0.62 - tFrac * 0.25)
            tri.rotation.set(-0.5 + tFrac * 0.2, 0, 0)
            this.root.add(tri)
        }

        const bang = new THREE.Mesh(GeometryUtils.createRoundedBox(0.16, 0.12, 0.1, 0.02), maneMat)
        bang.position.set(0, 1.62, 1.02)
        this.root.add(bang)

        // 腿部
        const legGeo = GeometryUtils.createRoundedBox(0.12, 0.6, 0.12, 0.03)
        const hoofGeo = GeometryUtils.createRoundedBox(0.14, 0.08, 0.16, 0.02)
        const legDefs = [
            { x: -0.22, z: 0.38 }, { x: 0.22, z: 0.38 },
            { x: -0.22, z: -0.38 }, { x: 0.22, z: -0.38 },
        ]
        this.legMeshes = []
        for (const ld of legDefs) {
            const lg = new THREE.Group()
            lg.add(new THREE.Mesh(legGeo, bodyMat))
            const hoof = new THREE.Mesh(hoofGeo, hoofMat)
            hoof.position.y = -0.3
            lg.add(hoof)
            lg.position.set(ld.x, 0.35, ld.z)
            this.root.add(lg)
            this.legMeshes.push(lg)
        }

        // 尾巴
        const tailGroupNode = new THREE.Group()
        tailGroupNode.position.set(0, 0.75, -0.6)
        const tail = new THREE.Mesh(GeometryUtils.createRoundedBox(0.08, 0.5, 0.08, 0.03), maneMat)
        tail.position.set(0, -0.2, -0.05)
        tail.rotation.x = 0.4
        tailGroupNode.add(tail)
        const tailTip = new THREE.Mesh(GeometryUtils.createRoundedBox(0.16, 0.22, 0.12, 0.04), maneMat)
        tailTip.position.set(0, -0.45, -0.18)
        tailTip.rotation.x = 0.6
        tailGroupNode.add(tailTip)
        this.root.add(tailGroupNode)
        this.tailGroup = tailGroupNode

        // 马鞍
        const saddleMat = new THREE.MeshToonMaterial({ color: 0xA0522D })
        const goldMat = new THREE.MeshToonMaterial({ color: 0xDAA520 })
        const saddle = new THREE.Mesh(GeometryUtils.createRoundedBox(0.52, 0.06, 0.42, 0.02), saddleMat)
        saddle.position.set(0, 1.16, 0.05)
        this.root.add(saddle)
        const trimGeo = GeometryUtils.createRoundedBox(0.54, 0.02, 0.04, 0.005)
        for (const zOff of [0.2, -0.16]) {
            const trim = new THREE.Mesh(trimGeo, goldMat)
            trim.position.set(0, 1.19, zOff)
            this.root.add(trim)
        }
        const pommel = new THREE.Mesh(GeometryUtils.createRoundedBox(0.16, 0.14, 0.07, 0.02), saddleMat)
        pommel.position.set(0, 1.24, 0.24)
        this.root.add(pommel)
        const pommelTrim = new THREE.Mesh(GeometryUtils.createRoundedBox(0.18, 0.02, 0.03, 0.005), goldMat)
        pommelTrim.position.set(0, 1.3, 0.24)
        this.root.add(pommelTrim)

        // 缰绳
        const reinMat = new THREE.MeshToonMaterial({ color: 0x5C3A1E })
        const reinGeo = GeometryUtils.createRoundedBox(0.02, 0.02, 0.5, 0.005)
        for (const xOff of [-0.12, 0.12]) {
            const rein = new THREE.Mesh(reinGeo, reinMat)
            rein.position.set(xOff, 1.25, 0.55)
            rein.rotation.x = -0.35
            this.root.add(rein)
        }

        // 骑手
        this.addRider()

        // ── 附加外观层 (MountAppearance) ──
        if (appearanceConfig) {
            // 1. 体型缩放
            if (appearanceConfig.scale) {
                this.root.scale.setScalar(appearanceConfig.scale);
            }

            // 2. 马角 (Horn)
            if (appearanceConfig.horn === 'unicorn') {
                const hornGeo = new THREE.ConeGeometry(0.04, 0.4, 6);
                const hornMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF, emissive: 0x88EEFF, emissiveIntensity: 0.6 });
                const horn = new THREE.Mesh(hornGeo, hornMat);
                horn.position.set(0, 1.7, 1.05);
                horn.rotation.x = 0.9;
                this.headRef?.add(horn); // Attach to head
                this.hornMesh = horn;
            } else if (appearanceConfig.horn === 'demon') {
                const hornGeo = new THREE.ConeGeometry(0.05, 0.3, 4);
                const hornMat = new THREE.MeshToonMaterial({ color: 0x111111, emissive: 0xFF2200, emissiveIntensity: 0.8 });
                for (const xSide of [-1, 1]) {
                    const dHorn = new THREE.Mesh(hornGeo, hornMat);
                    dHorn.position.set(xSide * 0.15, 1.75, 0.85);
                    dHorn.rotation.set(-0.3, 0, xSide * 0.5);
                    this.headRef?.add(dHorn);
                }
            }

            // 3. 翅膀 (Wings)
            if (appearanceConfig.wings === 'pegasus' || appearanceConfig.wings === 'demon') {
                const isDemon = appearanceConfig.wings === 'demon';
                const wingColor = isDemon ? 0x221122 : 0xFFFFFF;
                const wingEmissive = isDemon ? 0x000000 : 0xEEEEFF;
                const wingMat = new THREE.MeshToonMaterial({ color: wingColor, emissive: wingEmissive, emissiveIntensity: 0.3, side: THREE.DoubleSide });

                this.leftWing = new THREE.Group();
                this.rightWing = new THREE.Group();

                // 构造简易翅膀 (由两段扁平圆角盒构成)
                const createWingPanel = () => {
                    const wGroup = new THREE.Group();
                    const mainWing = new THREE.Mesh(GeometryUtils.createRoundedBox(0.04, 0.6, 0.8, 0.02), wingMat);
                    mainWing.position.set(0.1, 0.3, -0.2); // 重心偏移
                    mainWing.rotation.x = 0.2;
                    mainWing.rotation.z = -0.3;
                    wGroup.add(mainWing);

                    if (!isDemon) { // 羽毛层次
                        const subWing = new THREE.Mesh(GeometryUtils.createRoundedBox(0.03, 0.4, 0.5, 0.01), wingMat);
                        subWing.position.set(0.15, 0.2, -0.4);
                        subWing.rotation.z = -0.4;
                        wGroup.add(subWing);
                    }
                    return wGroup;
                }

                const lw = createWingPanel();
                this.leftWing.add(lw);
                this.leftWing.position.set(-0.35, 1.0, 0.4);
                this.root.add(this.leftWing);

                const rw = createWingPanel();
                rw.scale.x = -1; // 镜像
                this.rightWing.add(rw);
                this.rightWing.position.set(0.35, 1.0, 0.4);
                this.root.add(this.rightWing);
            }

            // 4. 马铠 (Armor)
            if (appearanceConfig.armor && appearanceConfig.armor !== 'none') {
                let armorMat: THREE.MeshToonMaterial;
                switch (appearanceConfig.armor) {
                    case 'gold': armorMat = new THREE.MeshToonMaterial({ color: 0xFFD700 }); break;
                    case 'iron': armorMat = new THREE.MeshToonMaterial({ color: 0xA0A0A0 }); break;
                    case 'crystal': armorMat = new THREE.MeshToonMaterial({ color: 0x88CCFF, opacity: 0.8, transparent: true }); break;
                    case 'magma': armorMat = new THREE.MeshToonMaterial({ color: 0x222222, emissive: 0xFF4500, emissiveIntensity: 0.8 }); break;
                    case 'shadow': armorMat = new THREE.MeshToonMaterial({ color: 0x111122, emissive: 0x4B0082, emissiveIntensity: 0.5 }); break;
                    default: armorMat = new THREE.MeshToonMaterial({ color: 0xAAAAAA });
                }

                // 头甲
                const headArmor = new THREE.Mesh(GeometryUtils.createRoundedBox(0.42, 0.2, 0.55, 0.04), armorMat);
                headArmor.position.set(0, 0.1, 0); // 相对于 headRef
                this.headRef?.add(headArmor);
                this.armorMeshes.push(headArmor);

                // 胸甲/颈甲
                const chestArmor = new THREE.Mesh(GeometryUtils.createRoundedBox(0.35, 0.4, 0.35, 0.04), armorMat);
                chestArmor.position.set(0, -0.1, 0);
                this.neckRef?.add(chestArmor);
                this.armorMeshes.push(chestArmor);

                // 臀甲
                const buttArmor = new THREE.Mesh(GeometryUtils.createRoundedBox(0.68, 0.4, 0.4, 0.05), armorMat);
                buttArmor.position.set(0, 0.9, -0.3); // 相对于 root
                this.root.add(buttArmor);
                this.armorMeshes.push(buttArmor);
            }
        }

        // 默认朝向 Z+
        this.root.rotation.y = 0
        return this.root
    }

    private addRider(): void {
        const progress = getPlayerProgress()
        const equippedTrainerId = progress.getEquippedTrainer()

        let shirtColor = 0x4FC3F7
        let pantsColor = 0x5C6BC0
        let hairColor = 0x3E2723
        let hasTrainerHat = false
        let hatColor = 0x000000

        if (equippedTrainerId) {
            const trainer = getTrainerById(equippedTrainerId)
            shirtColor = new THREE.Color(trainer.bodyColor).getHex()
            pantsColor = new THREE.Color(trainer.accentColor).getHex()
            hairColor = new THREE.Color(trainer.accentColor).getHex()
            hasTrainerHat = true
            hatColor = new THREE.Color(trainer.accentColor).getHex()
        }

        const skinMat = new THREE.MeshToonMaterial({ color: 0xF3C98B })
        const hairMat = new THREE.MeshToonMaterial({ color: hairColor })
        const shirtMat = new THREE.MeshToonMaterial({ color: shirtColor })
        const pantsMat = new THREE.MeshToonMaterial({ color: pantsColor })
        const bootsMat = new THREE.MeshToonMaterial({ color: 0x6D4C41 })
        const eyeMat = new THREE.MeshToonMaterial({ color: 0x111111 })
        const mouthMat = new THREE.MeshToonMaterial({ color: 0x333333 })

        // 躯干
        const torso = new THREE.Mesh(GeometryUtils.createRoundedBox(0.32, 0.32, 0.18, 0.02), shirtMat)
        torso.position.set(0, 1.35, 0.05)
        this.root.add(torso)

        if (hasTrainerHat) {
            const collar = new THREE.Mesh(GeometryUtils.createRoundedBox(0.34, 0.06, 0.20, 0.01), new THREE.MeshToonMaterial({ color: hatColor }))
            collar.position.set(0, 1.52, 0.05)
            this.root.add(collar)
        }

        // 头
        const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 16), skinMat)
        headMesh.position.set(0, 1.68, 0.05)
        this.root.add(headMesh)

        // 眼睛
        for (const xSign of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), eyeMat)
            eye.position.set(xSign * 0.065, 1.7, 0.165)
            this.root.add(eye)
            const shine = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshToonMaterial({ color: 0xFFFFFF }))
            shine.position.set(xSign * 0.055, 1.715, 0.166)
            this.root.add(shine)
        }

        // 微笑
        const smileShape = new THREE.Shape()
        smileShape.moveTo(-0.035, 0)
        smileShape.quadraticCurveTo(0, -0.02, 0.035, 0)
        const smile = new THREE.Mesh(new THREE.ShapeGeometry(smileShape), mouthMat)
        smile.position.set(0, 1.65, 0.166)
        this.root.add(smile)

        // 头发/帽子
        if (hasTrainerHat) {
            const hatMat = new THREE.MeshToonMaterial({ color: hatColor })
            const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), hatMat)
            brim.position.set(0, 1.84, 0.05)
            this.root.add(brim)
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.14, 16), hatMat)
            top.position.set(0, 1.92, 0.05)
            this.root.add(top)
        } else {
            const hairCap = new THREE.Mesh(GeometryUtils.createRoundedBox(0.34, 0.14, 0.34, 0.04), hairMat)
            hairCap.position.set(0, 1.83, 0.04)
            this.root.add(hairCap)
            const bangs = new THREE.Mesh(GeometryUtils.createRoundedBox(0.28, 0.06, 0.06, 0.015), hairMat)
            bangs.position.set(0, 1.78, 0.16)
            this.root.add(bangs)
        }

        // 手臂
        for (const side of [-1, 1]) {
            const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), shirtMat)
            upperArm.position.set(side * 0.21, 1.35, 0.1)
            upperArm.rotation.set(-0.5, 0, side * 0.15)
            this.root.add(upperArm)
            const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), skinMat)
            foreArm.position.set(side * 0.22, 1.25, 0.22)
            foreArm.rotation.set(-0.3, 0, side * 0.1)
            this.root.add(foreArm)
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), skinMat)
            hand.position.set(side * 0.22, 1.2, 0.28)
            this.root.add(hand)
        }

        // 腿部
        for (const side of [-1, 1]) {
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 8), pantsMat)
            thigh.position.set(side * 0.14, 1.15, 0.05)
            thigh.rotation.z = side * 0.3
            this.root.add(thigh)
            const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), pantsMat)
            shin.position.set(side * 0.2, 1.02, 0.05)
            shin.rotation.z = side * 0.1
            this.root.add(shin)
            const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), bootsMat)
            boot.position.set(side * 0.22, 0.94, 0.05)
            this.root.add(boot)
        }
    }
}
