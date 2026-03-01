/**
 * 输入管理器
 *
 * 追踪键盘按键状态和鼠标位置/按键状态，提供轴映射便利方法。
 * 每帧结束时需调用 update() 清除瞬时状态（keyPressed / keyReleased / mouseDelta）。
 */

export class InputManager {
    private keys = new Map<string, boolean>()
    private keysDown = new Set<string>()
    private keysUp = new Set<string>()
    private mouse = { x: 0, y: 0, dx: 0, dy: 0, left: false, right: false }

    constructor() {
        window.addEventListener('keydown', (e) => {
            if (!this.keys.get(e.code)) this.keysDown.add(e.code)
            this.keys.set(e.code, true)
        })
        window.addEventListener('keyup', (e) => {
            this.keys.set(e.code, false)
            this.keysUp.add(e.code)
        })
        window.addEventListener('mousemove', (e) => {
            this.mouse.dx = e.movementX
            this.mouse.dy = e.movementY
            this.mouse.x = e.clientX
            this.mouse.y = e.clientY
        })
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouse.left = true
            if (e.button === 2) this.mouse.right = true
        })
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.left = false
            if (e.button === 2) this.mouse.right = false
        })
    }

    /** 按键是否持续按住 */
    isKeyDown(code: string): boolean { return !!this.keys.get(code) }

    /** 按键是否在本帧刚按下 */
    isKeyPressed(code: string): boolean { return this.keysDown.has(code) }

    /** 按键是否在本帧刚释放 */
    isKeyReleased(code: string): boolean { return this.keysUp.has(code) }

    /** 获取轴向输入（-1 / 0 / +1） */
    getAxis(axis: 'horizontal' | 'vertical'): number {
        if (axis === 'horizontal') {
            return (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight') ? 1 : 0)
                - (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft') ? 1 : 0)
        }
        return (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown') ? 1 : 0)
            - (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp') ? 1 : 0)
    }

    /** 获取鼠标移动增量 */
    getMouseDelta(): { x: number; y: number } { return { x: this.mouse.dx, y: this.mouse.dy } }

    /** 获取鼠标绝对位置 */
    getMousePosition(): { x: number; y: number } { return { x: this.mouse.x, y: this.mouse.y } }

    /** 鼠标按键是否按住 */
    isMouseButtonDown(button: 'left' | 'right'): boolean { return button === 'left' ? this.mouse.left : this.mouse.right }

    /** 帧末清除瞬时状态，由引擎自动调用 */
    update(): void {
        this.keysDown.clear()
        this.keysUp.clear()
        this.mouse.dx = 0
        this.mouse.dy = 0
    }
}
