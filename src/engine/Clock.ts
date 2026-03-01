/**
 * 游戏时钟
 *
 * 提供精确的帧时间管理，支持固定步长物理更新、时间缩放和暂停。
 * 独立于 Three.js Clock，获得更确定性的行为。
 */
export class Clock {
    /** 上一帧到当前帧的时间 (秒) */
    deltaTime = 0

    /** 游戏启动以来的总时间 (秒，受 timeScale 影响) */
    elapsedTime = 0

    /** 已渲染帧数 */
    frameCount = 0

    /** 当前 FPS（每秒更新一次） */
    fps = 0

    /** 时间缩放倍率，0 = 暂停 */
    timeScale = 1

    /** 固定步长时长 (秒) */
    readonly fixedDeltaTime: number

    /** 累积器 - 用于固定步长分配 */
    private accumulator = 0

    /** 最大帧时间限制，防止螺旋下降 */
    private readonly maxDelta: number

    private prevTimestamp = 0
    private fpsFrameCount = 0
    private fpsTimer = 0

    constructor(fixedStep = 1 / 60, maxDelta = 0.1) {
        this.fixedDeltaTime = fixedStep
        this.maxDelta = maxDelta
    }

    /**
     * 每帧调用，计算 deltaTime 并更新统计
     * @returns 本帧需要执行的固定步长次数
     */
    tick(timestamp: number): number {
        if (this.prevTimestamp === 0) {
            this.prevTimestamp = timestamp
            return 0
        }

        const rawDelta = (timestamp - this.prevTimestamp) / 1000
        this.prevTimestamp = timestamp

        // 限制最大帧时间
        const clampedDelta = Math.min(rawDelta, this.maxDelta)
        this.deltaTime = clampedDelta * this.timeScale
        this.elapsedTime += this.deltaTime
        this.frameCount++

        // FPS 统计
        this.fpsFrameCount++
        this.fpsTimer += rawDelta
        if (this.fpsTimer >= 1) {
            this.fps = this.fpsFrameCount
            this.fpsFrameCount = 0
            this.fpsTimer -= 1
        }

        // 固定步长累积
        this.accumulator += this.deltaTime
        let steps = 0
        while (this.accumulator >= this.fixedDeltaTime) {
            this.accumulator -= this.fixedDeltaTime
            steps++
        }
        return steps
    }

    /** 重置时钟状态 */
    reset(): void {
        this.deltaTime = 0
        this.elapsedTime = 0
        this.frameCount = 0
        this.fps = 0
        this.accumulator = 0
        this.prevTimestamp = 0
        this.fpsFrameCount = 0
        this.fpsTimer = 0
    }
}
