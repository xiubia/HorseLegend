/**
 * UI 管理器
 *
 * 管理 DOM 面板的创建、显示/隐藏和层级。
 * 所有 UI 面板覆盖在 Three.js Canvas 之上。
 */

export interface PanelOptions {
    /** 面板 CSS 类名 */
    className?: string
    /** 初始样式 */
    style?: Partial<CSSStyleDeclaration>
    /** 初始 HTML */
    html?: string
    /** 是否默认可见 */
    visible?: boolean
}

export class UIManager {
    private container: HTMLElement
    private panels = new Map<string, HTMLElement>()
    private zBase = 1000

    constructor(container: HTMLElement) {
        this.container = container
    }

    /** 创建一个 DOM 面板 */
    createPanel(id: string, options: PanelOptions = {}): HTMLElement {
        if (this.panels.has(id)) return this.panels.get(id)!

        const el = document.createElement('div')
        el.id = `ui-${id}`
        el.style.position = 'absolute'
        el.style.zIndex = String(this.zBase + this.panels.size)
        el.style.pointerEvents = 'auto'

        if (options.className) el.className = options.className
        if (options.html) el.innerHTML = options.html
        if (options.style) Object.assign(el.style, options.style)
        if (options.visible === false) el.style.display = 'none'

        this.container.appendChild(el)
        this.panels.set(id, el)
        return el
    }

    /** 获取面板 */
    getPanel(id: string): HTMLElement | undefined {
        return this.panels.get(id)
    }

    /** 显示面板 */
    show(id: string): void {
        const el = this.panels.get(id)
        if (el) el.style.display = ''
    }

    /** 隐藏面板 */
    hide(id: string): void {
        const el = this.panels.get(id)
        if (el) el.style.display = 'none'
    }

    /** 切换面板可见性 */
    toggle(id: string): void {
        const el = this.panels.get(id)
        if (!el) return
        el.style.display = el.style.display === 'none' ? '' : 'none'
    }

    /** 销毁面板 */
    removePanel(id: string): void {
        const el = this.panels.get(id)
        if (el) {
            el.remove()
            this.panels.delete(id)
        }
    }

    /** 创建 FPS 调试面板 */
    createDebugPanel(): HTMLElement {
        return this.createPanel('debug', {
            style: {
                top: '8px',
                right: '8px',
                padding: '6px 10px',
                background: 'rgba(0,0,0,0.7)',
                color: '#0f0',
                fontFamily: 'monospace',
                fontSize: '12px',
                borderRadius: '4px',
                lineHeight: '1.6',
            },
            html: 'FPS: --',
        })
    }

    /** 更新调试面板 */
    updateDebug(fps: number, entityCount: number): void {
        const el = this.panels.get('debug')
        if (el) el.textContent = `FPS: ${fps} | Entities: ${entityCount}`
    }

    /** 销毁所有面板 */
    dispose(): void {
        for (const el of this.panels.values()) el.remove()
        this.panels.clear()
    }
}
