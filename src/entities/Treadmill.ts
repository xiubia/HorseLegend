/**
 * 跑步机实体 — Roblox 风格训练设备
 * 适配模板引擎 Entity 基类
 */

import * as THREE from 'three'
import { Entity } from '../world/Entity'
import { World } from '../world/World'
import { TREADMILL_CONFIGS } from '../data/PlayerProgress'
import { GeometryUtils } from '../utils/GeometryUtils'

export interface TreadmillConfig {
    level: number
    position: { x: number; z: number }
}

export class Treadmill extends Entity {
    readonly level: number
    readonly speedGain: number
    readonly unlockCost: number
    isUnlocked = false
    isTraining = false

    private beltOffset = 0
    private glowMesh: THREE.Mesh | null = null
    private stripeMeshes: THREE.Mesh[] = []
    private readonly WIDTH = 2
    private readonly LENGTH = 4

    constructor(configOrId: TreadmillConfig | string, configArg?: TreadmillConfig) {
        super(['treadmill'])
        const config = typeof configOrId === 'string' ? (configArg ?? { level: 1, position: { x: 0, z: 0 } }) : configOrId
        this.level = config.level
        const cfg = TREADMILL_CONFIGS.find(t => t.level === config.level)
        this.speedGain = cfg?.speedGain ?? 1
        this.unlockCost = cfg?.unlockCost ?? 0
        this.position.set(config.position.x, 0, config.position.z)
    }

    onInit(world: World): void {
        super.onInit(world)
        if (this.root.children.length === 0) this.createMesh()
    }

    onUpdate(dt: number): void {
        if (!this.active) return

        // 传送带条纹动画
        if (this.isTraining && this.stripeMeshes.length > 0) {
            const beltSpeed = 2 + this.speedGain * 0.8
            const stripeSpacing = (this.LENGTH - 0.8) / this.stripeMeshes.length
            const halfBeltZ = (this.LENGTH - 0.8) / 2

            this.beltOffset += dt * beltSpeed
            if (this.beltOffset > stripeSpacing) this.beltOffset -= stripeSpacing

            for (let i = 0; i < this.stripeMeshes.length; i++) {
                const baseZ = (i / this.stripeMeshes.length - 0.5) * (this.LENGTH - 0.8)
                let newZ = baseZ - this.beltOffset
                if (newZ < -halfBeltZ) newZ += (this.LENGTH - 0.8)
                this.stripeMeshes[i].position.z = newZ
            }
        }

        // 发光效果
        if (this.glowMesh) {
            const mat = this.glowMesh.material as THREE.MeshBasicMaterial
            if (this.isUnlocked) {
                mat.opacity = (Math.sin(performance.now() * 0.003) * 0.3 + 0.7) * 0.5
                mat.color.setHex(0x00ff00)
            } else {
                mat.opacity = 0.3
                mat.color.setHex(0xff0000)
            }
        }
    }

    isPlayerOn(playerPos: THREE.Vector3): boolean {
        return Math.abs(playerPos.x - this.position.x) < this.WIDTH / 2 &&
            Math.abs(playerPos.z - this.position.z) < this.LENGTH / 2
    }

    getBounds() {
        return {
            minX: this.position.x - this.WIDTH / 2,
            maxX: this.position.x + this.WIDTH / 2,
            minZ: this.position.z - this.LENGTH / 2,
            maxZ: this.position.z + this.LENGTH / 2,
        }
    }

    startTraining(): void { if (this.isUnlocked) this.isTraining = true }
    stopTraining(): void { this.isTraining = false }

    setUnlocked(unlocked: boolean): void {
        this.isUnlocked = unlocked
        const platform = this.root.getObjectByName('platform') as THREE.Mesh | null
        if (platform) (platform.material as THREE.MeshToonMaterial).color.setHex(unlocked ? 0x4CAF50 : 0x666666)
    }

    getSpeedGain(): number { return this.isUnlocked ? this.speedGain : 0 }
    getCenterPosition(): THREE.Vector3 { return this.position.clone() }
    getFacingRotationY(): number { return this.root.rotation.y }

    getLevelColor(): number {
        return [0x808080, 0x4CAF50, 0x2196F3, 0x9C27B0, 0xFFD700][this.level - 1] || 0x808080
    }

    getInfoText(): string {
        return this.isUnlocked
            ? `Lv${this.level} 跑步机\n速度 +${this.speedGain}/秒`
            : `Lv${this.level} 跑步机\n需要 ${this.unlockCost} 奖杯解锁`
    }

    createMesh(): THREE.Object3D {
        if (this.root.children.length > 0) return this.root
        const levelColors = [0xC0C0C0, 0x32CD32, 0x00FFFF, 0xFF00FF, 0xFFD700]
        const frameColor = levelColors[this.level - 1] || 0x808080

        // 底座
        const platform = new THREE.Mesh(
            GeometryUtils.createRoundedBox(this.WIDTH, 0.4, this.LENGTH, 0.1),
            new THREE.MeshToonMaterial({ color: this.isUnlocked ? frameColor : 0x555555 })
        )
        platform.name = 'platform'
        platform.position.y = 0.2
        platform.castShadow = true
        this.root.add(platform)

        // 传送带
        const belt = new THREE.Mesh(
            GeometryUtils.createRoundedBox(this.WIDTH - 0.4, 0.05, this.LENGTH - 0.4, 0.02),
            new THREE.MeshToonMaterial({ color: 0x222222 })
        )
        belt.position.y = 0.41
        this.root.add(belt)

        // 条纹
        this.stripeMeshes = []
        for (let i = 0; i < 6; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(this.WIDTH - 0.5, 0.02, 0.2),
                new THREE.MeshToonMaterial({ color: 0x444444 })
            )
            stripe.position.y = 0.44
            stripe.position.z = (i / 6 - 0.5) * (this.LENGTH - 0.8)
            this.root.add(stripe)
            this.stripeMeshes.push(stripe)
        }

        // 扶手
        const railMat = new THREE.MeshToonMaterial({ color: frameColor })
        const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 16)
        for (const x of [-(this.WIDTH / 2 - 0.2), this.WIDTH / 2 - 0.2]) {
            const pillar = new THREE.Mesh(pillarGeo, railMat)
            pillar.position.set(x, 1.0, this.LENGTH / 2 - 0.3)
            this.root.add(pillar)
        }

        const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, this.WIDTH - 0.2, 16), railMat)
        crossBar.rotation.z = Math.PI / 2
        crossBar.position.set(0, 1.6, this.LENGTH / 2 - 0.3)
        this.root.add(crossBar)

        // 控制面板
        const panel = new THREE.Mesh(GeometryUtils.createRoundedBox(0.8, 0.5, 0.2, 0.05), new THREE.MeshToonMaterial({ color: 0x111111 }))
        panel.position.set(0, 1.5, this.LENGTH / 2 - 0.25)
        panel.rotation.x = -0.3
        this.root.add(panel)

        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x00FF00 }))
        screen.position.set(0, 1.5, this.LENGTH / 2 - 0.15)
        screen.rotation.x = -0.3
        this.root.add(screen)

        // 发光
        this.glowMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            new THREE.MeshBasicMaterial({ color: this.isUnlocked ? 0x00ff00 : 0xff0000, transparent: true, opacity: 0.8 })
        )
        this.glowMesh.position.set(0, 2.0, this.LENGTH / 2 - 0.3)
        this.root.add(this.glowMesh)

        this.root.position.copy(this.position)
        return this.root
    }
}
