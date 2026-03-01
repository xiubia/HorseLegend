import * as THREE from 'three';

export interface PlayerTelemetry {
  laneBias: number; // -1 (Left) to 1 (Right)
  sideUsage: { left: number; center: number; right: number }; // Percentage
  avgSpeed: number;
  crashCount: number;
  recentCrashes: string[];
  playTime: number;
  style: 'safe' | 'balanced' | 'aggressive' | 'erratic';
}

export class PlayerBehaviorTracker {
  private positionHistory: { t: number; x: number; z: number }[] = [];
  private collisions: { t: number; type: string }[] = [];
  private startTime: number;
  private lastRecordTime: number = 0;
  
  // Config
  private readonly HISTORY_WINDOW = 30000; // Keep last 30s of data for analysis
  private readonly RECORD_INTERVAL = 200; // Record position every 200ms

  constructor() {
    this.startTime = Date.now();
  }

  update(x: number, z: number, speed: number) {
    const now = Date.now();
    if (now - this.lastRecordTime > this.RECORD_INTERVAL) {
      this.positionHistory.push({ t: now, x, z });
      this.lastRecordTime = now;
      
      // Prune old history
      const cutoff = now - this.HISTORY_WINDOW;
      if (this.positionHistory.length > 0 && this.positionHistory[0].t < cutoff) {
        this.positionHistory = this.positionHistory.filter(p => p.t >= cutoff);
      }
    }
  }

  recordCollision(type: string) {
    this.collisions.push({ t: Date.now(), type });
  }

  getTelemetry(): PlayerTelemetry {
    if (this.positionHistory.length === 0) {
      return this.getEmptyTelemetry();
    }

    const totalSamples = this.positionHistory.length;
    let sumX = 0;
    let leftCount = 0;
    let rightCount = 0;
    let centerCount = 0;

    // Analyze Position History
    for (const pos of this.positionHistory) {
      sumX += pos.x;
      
      if (pos.x < -1.5) leftCount++;
      else if (pos.x > 1.5) rightCount++;
      else centerCount++;
    }

    const avgX = sumX / totalSamples;
    // Normalize avgX to -1...1 (assuming track width approx +/- 4)
    const laneBias = Math.max(-1, Math.min(1, avgX / 3));

    const sideUsage = {
      left: leftCount / totalSamples,
      center: centerCount / totalSamples,
      right: rightCount / totalSamples
    };

    // Determine Style
    let style: PlayerTelemetry['style'] = 'balanced';
    const switchRate = this.calculateLaneSwitchRate();
    
    if (this.collisions.length > 3) {
      style = 'erratic'; // Crashes a lot
    } else if (Math.abs(laneBias) > 0.6) {
      style = 'safe'; // Sticks to one side
    } else if (switchRate > 0.5) {
      style = 'aggressive'; // Moves a lot
    }

    return {
      laneBias,
      sideUsage,
      avgSpeed: 0, // TODO: track speed
      crashCount: this.collisions.length,
      recentCrashes: this.collisions.slice(-3).map(c => c.type),
      playTime: (Date.now() - this.startTime) / 1000,
      style
    };
  }

  private calculateLaneSwitchRate(): number {
    if (this.positionHistory.length < 5) return 0;
    
    let switches = 0;
    let lastSide = 0; // -1, 0, 1
    
    for (const pos of this.positionHistory) {
      let side = 0;
      if (pos.x < -1.5) side = -1;
      else if (pos.x > 1.5) side = 1;
      
      if (side !== lastSide && lastSide !== 0) { // Only count crossing center or explicit switch
        switches++;
      }
      lastSide = side;
    }
    
    return switches / this.positionHistory.length;
  }

  private getEmptyTelemetry(): PlayerTelemetry {
    return {
      laneBias: 0,
      sideUsage: { left: 0, center: 1, right: 0 },
      avgSpeed: 0,
      crashCount: 0,
      recentCrashes: [],
      playTime: 0,
      style: 'balanced'
    };
  }
  
  reset() {
    this.positionHistory = [];
    this.collisions = [];
    this.startTime = Date.now();
  }
}
