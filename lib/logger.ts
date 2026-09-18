// Simple production-ready logger
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  userAgent?: string;
}

class Logger {
  private isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 50; // Keep last 50 logs in memory

  private formatTime(): string {
    return new Date().toISOString();
  }

  private addLog(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: this.formatTime(),
      level,
      message,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Only log to console in development
    if (this.isDev) {
      const style = {
        info: 'color: #0ea5e9',
        warn: 'color: #f59e0b',
        error: 'color: #ef4444',
        debug: 'color: #8b5cf6',
      }[level];
      
      if (data) {
        console.log(`%c[${level.toUpperCase()}] ${message}`, style, data);
      } else {
        console.log(`%c[${level.toUpperCase()}] ${message}`, style);
      }
    }
  }

  info(message: string, data?: unknown): void {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.addLog('error', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.addLog('debug', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
