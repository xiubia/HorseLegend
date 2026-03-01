import * as THREE from 'three'
import type { World } from './World'

/**
 * 实体基类
 *
 * 轻量级游戏对象容器，持有 THREE.Object3D 作为场景图节点。
 * 所有游戏对象（玩家、敌人、道具等）应继承此类。
 */

let nextEntityId = 1

export abstract class Entity {
    /** 唯一标识 */
    readonly id: string

    /** 场景图根节点 */
    readonly root: THREE.Object3D

    /** 标签集合，用于分组查询 */
    readonly tags: ReadonlySet<string>

    /** 是否活跃（非活跃实体不接收 update） */
    active = true

    protected world: World | null = null

    constructor(tags: string[] = []) {
        this.id = `entity_${nextEntityId++}`
        this.root = new THREE.Object3D()
        this.root.name = this.id
        this.tags = new Set(tags)
    }

    // ── 快捷位置/旋转访问 ──

    get position(): THREE.Vector3 {
        return this.root.position
    }

    get rotation(): THREE.Euler {
        return this.root.rotation
    }

    get scale(): THREE.Vector3 {
        return this.root.scale
    }

    // ── 生命周期 (子类覆写) ──

    /** 添加到世界时调用 */
    onInit(world: World): void {
        this.world = world
    }

    /** 每帧更新 */
    abstract onUpdate(dt: number): void

    /** 从世界移除时调用 */
    onDispose(): void {
        this.world = null
    }

    // ── Horse_Legend 兼容方法 ──

    /** @deprecated 使用 position.set() */
    setPosition(x: number, y: number, z: number): void {
        this.root.position.set(x, y, z)
    }

    /** @deprecated 使用 rotation.set() */
    setRotation(x: number, y: number, z: number): void {
        this.root.rotation.set(x, y, z)
    }

    /** @deprecated 使用 World.add() */
    addToScene(scene: THREE.Scene): void {
        if (this.root.children.length === 0) {
            this.createMesh()
        }
        scene.add(this.root)
    }

    /** @deprecated 使用 World.remove() */
    removeFromScene(scene?: THREE.Scene): void {
        if (scene) scene.remove(this.root)
        else this.root.removeFromParent()
    }

    /** @deprecated 使用 onDispose() */
    destroy(): void {
        this.root.removeFromParent()
        this.onDispose()
    }

    /** @deprecated 使用 root */
    get mesh(): THREE.Object3D {
        return this.root
    }

    /** @deprecated 使用 onUpdate() */
    update(dt: number): void {
        this.onUpdate(dt)
    }

    /** @deprecated 由子类覆写 */
    createMesh(): THREE.Object3D {
        return this.root
    }
}
