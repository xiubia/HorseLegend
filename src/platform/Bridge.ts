/**
 * 平台桥接器
 * 处理游戏与外部平台的通信 (iframe)
 */

export interface GameState {
    status: 'running' | 'paused' | 'stopped'
    tick?: number
    fps?: number
    objectCount?: number
}

export interface PlatformMessage {
    type: string
    [key: string]: any
}

type EventHandler = (payload: any) => void

export class Bridge {
    private handlers: Map<string, EventHandler[]> = new Map()
    private isEmbedded: boolean

    constructor() {
        this.isEmbedded = window.parent !== window

        if (this.isEmbedded) {
            window.addEventListener('message', this.handleMessage.bind(this))
        }
    }

    private handleMessage(event: MessageEvent) {
        const data = event.data
        if (!data || typeof data.type !== 'string') return

        // 既触发特定消息事件，也可能保留特定处理
        this.emit(data.type, data)
    }

    private sendToParent(data: Record<string, unknown>) {
        if (this.isEmbedded) {
            window.parent.postMessage(data, '*')
        }
    }

    /** 监听平台事件 */
    on(event: string, handler: EventHandler): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, [])
        }
        this.handlers.get(event)!.push(handler)
    }

    /** 触发平台事件（内部或调试使用） */
    emit(event: string, payload?: any): void {
        const eventHandlers = this.handlers.get(event)
        if (eventHandlers) {
            for (const handler of eventHandlers) {
                handler(payload)
            }
        }
    }

    /** 通知平台游戏已就绪 */
    sendReady(): void {
        console.log('[Bridge] sendReady')
        this.sendToParent({ type: 'ready' })
    }

    /** 发送游戏状态给平台 */
    sendStateChange(state: Partial<GameState>): void {
        this.sendToParent({ type: 'stateChange', state })
    }

    /** 兼容旧版名称的发送状态 */
    sendStatus(status: any): void {
        console.log('[Bridge] sendStatus:', status)
        this.sendToParent({ type: 'stateChange', state: status })
    }

    /** 发送错误信息 */
    sendError(message: string): void {
        this.sendToParent({ type: 'error', message })
    }

    /** 发送日志 */
    sendLog(level: 'info' | 'warn' | 'error', message: string): void {
        this.sendToParent({ type: 'log', level, message })
    }
}
