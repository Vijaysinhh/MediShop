/**
 * Performance monitoring utility for debugging slow operations
 * Logs warnings for operations exceeding thresholds
 */

interface PerformanceMark {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private marks: Map<string, PerformanceMark> = new Map();
  private readonly slowThreshold = 1000; // 1 second
  private readonly criticalThreshold = 3000; // 3 seconds

  /**
   * Start tracking a performance metric
   */
  start(label: string) {
    this.marks.set(label, {
      label,
      startTime: performance.now(),
    });
  }

  /**
   * End tracking and log result
   */
  end(label: string) {
    const mark = this.marks.get(label);
    if (!mark) {
      console.warn(`[Perf] No start mark found for: ${label}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - mark.startTime;
    mark.endTime = endTime;
    mark.duration = duration;

    // Log with appropriate level based on duration
    if (duration > this.criticalThreshold) {
      console.error(`[Perf] CRITICAL ${label}: ${duration.toFixed(2)}ms`);
    } else if (duration > this.slowThreshold) {
      console.warn(`[Perf] SLOW ${label}: ${duration.toFixed(2)}ms`);
    } else {
      console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Measure a function execution time
   */
  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Get all recorded marks
   */
  getMarks(): PerformanceMark[] {
    return Array.from(this.marks.values());
  }

  /**
   * Clear all marks
   */
  clear() {
    this.marks.clear();
  }

  /**
   * Get summary of all marks
   */
  getSummary() {
    const marks = this.getMarks();
    const summary = {
      totalMarks: marks.length,
      totalTime: marks.reduce((sum, m) => sum + (m.duration || 0), 0),
      slowest: marks.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0],
      fastest: marks.sort((a, b) => (a.duration || 0) - (b.duration || 0))[0],
    };
    return summary;
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };
