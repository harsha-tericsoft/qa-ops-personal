/**
 * Performance monitoring utility for tracking request latencies.
 */

export interface PerfStage {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private stages: PerfStage[] = [];
  private lastTime: number;

  constructor() {
    this.lastTime = Date.now();
  }

  mark(stageName: string, metadata?: Record<string, any>) {
    const now = Date.now();
    const duration = now - this.lastTime;

    this.stages.push({
      name: stageName,
      startTime: this.lastTime,
      duration,
      metadata,
    });

    this.lastTime = now;
  }

  getSummary() {
    const totalTime = this.stages.reduce((sum, s) => sum + s.duration, 0);
    return {
      totalTime,
      stages: this.stages,
      breakdown: this.stages.map((s) => ({
        name: s.name,
        duration: s.duration,
        percentage: ((s.duration / totalTime) * 100).toFixed(1) + '%',
        metadata: s.metadata,
      })),
    };
  }

  log() {
    const summary = this.getSummary();
    console.log('\n=== PERFORMANCE PROFILE ===');
    console.log(`Total Time: ${summary.totalTime}ms\n`);

    for (const stage of summary.breakdown) {
      const padding = ' '.repeat(30 - stage.name.length);
      console.log(
        `${stage.name}${padding} ${String(stage.duration).padStart(5)}ms (${stage.percentage})`
      );
      if (stage.metadata) {
        Object.entries(stage.metadata).forEach(([key, value]) => {
          console.log(`  └─ ${key}: ${value}`);
        });
      }
    }
    console.log('===========================\n');
  }
}
