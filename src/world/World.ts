import * as THREE from 'three'

/**
 * 世界容器
 *
 * 封装 THREE.Scene，提供游戏对象注册/查询、光照创建等便利方法。
 */

import type { Entity } from '../world/Entity'

export class World {
    readonly scene: THREE.Scene

    private entities = new Map<string, Entity>()
    private tagIndex = new Map<string, Set<string>>()

    constructor() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x0a0a1a)
    }

    // ── 实体管理 ──

    /** 注册实体到世界 */
    add(entity: Entity): void {
        this.entities.set(entity.id, entity)
        this.scene.add(entity.root)

        // 更新标签索引
        for (const tag of entity.tags) {
            let set = this.tagIndex.get(tag)
            if (!set) {
                set = new Set()
                this.tagIndex.set(tag, set)
            }
            set.add(entity.id)
        }

        entity.onInit(this)
    }

    /** 按 ID 移除实体 */
    remove(id: string): void {
        const entity = this.entities.get(id)
        if (!entity) return

        entity.onDispose()
        this.scene.remove(entity.root)

        for (const tag of entity.tags) {
            this.tagIndex.get(tag)?.delete(id)
        }
        this.entities.delete(id)
    }

    /** 按 ID 获取实体 */
    get(id: string): Entity | undefined {
        return this.entities.get(id)
    }

    /** 按标签查询实体 */
    findByTag(tag: string): Entity[] {
        const ids = this.tagIndex.get(tag)
        if (!ids) return []
        const result: Entity[] = []
        for (const id of ids) {
            const e = this.entities.get(id)
            if (e) result.push(e)
        }
        return result
    }

    /** 更新所有活跃实体 */
    update(dt: number): void {
        for (const entity of this.entities.values()) {
            if (entity.active) entity.onUpdate(dt)
        }
    }

    // ── 光照工厂 ──

    createAmbientLight(color = 0xffffff, intensity = 0.5): THREE.AmbientLight {
        const light = new THREE.AmbientLight(color, intensity)
        this.scene.add(light)
        return light
    }

    createDirectionalLight(
        color = 0xffffff,
        intensity = 1,
        position: THREE.Vector3Like = { x: 5, y: 10, z: 5 },
    ): THREE.DirectionalLight {
        const light = new THREE.DirectionalLight(color, intensity)
        light.position.set(position.x, position.y, position.z)
        light.castShadow = true
        light.shadow.mapSize.setScalar(2048)
        light.shadow.camera.near = 0.5
        light.shadow.camera.far = 50
        const d = 15
        light.shadow.camera.left = -d
        light.shadow.camera.right = d
        light.shadow.camera.top = d
        light.shadow.camera.bottom = -d
        this.scene.add(light)
        return light
    }

    createPointLight(
        color = 0xffffff,
        intensity = 1,
        position: THREE.Vector3Like = { x: 0, y: 5, z: 0 },
        distance = 20,
    ): THREE.PointLight {
        const light = new THREE.PointLight(color, intensity, distance)
        light.position.set(position.x, position.y, position.z)
        this.scene.add(light)
        return light
    }

    // ── 清理 ──

    /** 清空世界中所有实体和子对象 */
    clear(): void {
        for (const [id] of this.entities) {
            this.remove(id)
        }
        // 移除残余（灯光等直接添加的对象）
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0]
            this.scene.remove(child)
        }
    }

    /** 获取实体数量 */
    get entityCount(): number {
        return this.entities.size
    }
}
