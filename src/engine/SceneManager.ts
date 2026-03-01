/**
 * 场景管理器
 *
 * 栈式场景管理：支持 push/pop/switch 操作，
 * 只有栈顶场景接收 update 调用，支持场景叠加（如暂停菜单覆盖游戏场景）。
 */

import type { Engine } from './Engine'

/** 游戏场景接口 - 所有场景必须实现 */
export interface GameScene {
    /** 进入场景时调用，可访问引擎所有子系统 */
    onEnter(engine: Engine): void

    /** 每帧渲染更新 (可变步长) */
    onUpdate(dt: number): void

    /** 固定步长物理更新 */
    onFixedUpdate?(fixedDt: number): void

    /** 离开场景时调用 */
    onExit(): void

    /** 场景被压入后台（有新场景 push 到栈顶） */
    onPause?(): void

    /** 恢复到栈顶 */
    onResume?(): void

    /** 兼容别名：初始化（由 onEnter 内部调用） */
    onInit?(): void

    /** 兼容别名：销毁（由 onExit 内部调用） */
    onDestroy?(): void
}

export class SceneManager {
    private stack: GameScene[] = []
    private engine: Engine | null = null

    /** 绑定引擎实例 */
    bind(engine: Engine): void {
        this.engine = engine
    }

    /** 获取当前活跃场景 (栈顶) */
    get current(): GameScene | null {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null
    }

    /** 获取场景栈深度 */
    get depth(): number {
        return this.stack.length
    }

    /**
     * 切换场景（清空栈后推入新场景）
     * 常用于主场景间的切换。
     */
    switch(scene: GameScene): void {
        // 弹出所有场景
        while (this.stack.length > 0) {
            const top = this.stack.pop()!
            top.onDestroy?.()
            top.onExit()
        }
        this.pushInternal(scene)
    }

    /**
     * 将场景压入栈顶
     * 当前栈顶场景会收到 onPause 调用，新场景收到 onEnter。
     * 常用于暂停菜单、对话框等覆盖层。
     */
    push(scene: GameScene): void {
        this.current?.onPause?.()
        this.pushInternal(scene)
    }

    /**
     * 弹出栈顶场景
     * 被弹出的场景收到 onExit，露出的下一层收到 onResume。
     */
    pop(): GameScene | null {
        if (this.stack.length === 0) return null
        const removed = this.stack.pop()!
        removed.onDestroy?.()
        removed.onExit()
        this.current?.onResume?.()
        return removed
    }

    /** 每帧更新栈顶场景 */
    update(dt: number): void {
        this.current?.onUpdate(dt)
    }

    /** 固定步长更新栈顶场景 */
    fixedUpdate(fixedDt: number): void {
        this.current?.onFixedUpdate?.(fixedDt)
    }

    /** 销毁所有场景 */
    dispose(): void {
        while (this.stack.length > 0) {
            const popped = this.stack.pop()!
            popped.onDestroy?.()
            popped.onExit()
        }
    }

    private pushInternal(scene: GameScene): void {
        this.stack.push(scene)
        if (this.engine) {
            scene.onEnter(this.engine)
            scene.onInit?.()
        }
    }
}
