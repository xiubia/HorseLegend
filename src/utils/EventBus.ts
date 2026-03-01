/**
 * 类型安全的事件总线
 *
 * 各子系统通过事件通信，避免硬编码依赖。
 * 使用泛型 EventMap 约束事件名与载荷类型。
 *
 * @example
 * ```ts
 * type MyEvents = { score: number; gameOver: { win: boolean } }
 * const bus = new EventBus<MyEvents>()
 * bus.on('score', (v) => console.log(v))  // v 推导为 number
 * bus.emit('score', 42)
 * ```
 */

type Listener<T> = (data: T) => void

export class EventBus<EventMap extends { [key: string]: unknown } = { [key: string]: unknown }> {
    private listeners = new Map<keyof EventMap, Set<Listener<never>>>()

    /** 监听事件 */
    on<K extends keyof EventMap>(event: K, handler: Listener<EventMap[K]>): void {
        let set = this.listeners.get(event)
        if (!set) {
            set = new Set()
            this.listeners.set(event, set)
        }
        set.add(handler as Listener<never>)
    }

    /** 一次性监听 */
    once<K extends keyof EventMap>(event: K, handler: Listener<EventMap[K]>): void {
        const wrapper: Listener<EventMap[K]> = (data) => {
            this.off(event, wrapper)
            handler(data)
        }
        this.on(event, wrapper)
    }

    /** 取消监听 */
    off<K extends keyof EventMap>(event: K, handler: Listener<EventMap[K]>): void {
        this.listeners.get(event)?.delete(handler as Listener<never>)
    }

    /** 触发事件 */
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
        const set = this.listeners.get(event)
        if (!set) return
        for (const fn of set) {
            (fn as Listener<EventMap[K]>)(data)
        }
    }

    /** 移除某事件的全部监听 */
    clear(event?: keyof EventMap): void {
        if (event) {
            this.listeners.delete(event)
        } else {
            this.listeners.clear()
        }
    }
}
