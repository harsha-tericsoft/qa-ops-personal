/**
 * Logging Framework for Desktop Connector
 * Simple file-based logging with console output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  duration?: number
  error?: string
}

class Logger {
  private level: LogLevel = 'info'
  private module: string

  constructor(module: string) {
    this.module = module
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }
    return levels[level] >= levels[this.level]
  }

  private formatEntry(level: LogLevel, message: string, duration?: number, error?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      duration,
      error,
    }
  }

  private output(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`
    const duration = entry.duration ? ` (${entry.duration}ms)` : ''
    const error = entry.error ? ` - ${entry.error}` : ''
    const log = `${prefix} ${entry.message}${duration}${error}`

    if (entry.level === 'error') {
      console.error(log)
    } else if (entry.level === 'warn') {
      console.warn(log)
    } else {
      console.log(log)
    }
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message))
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message))
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message))
    }
  }

  error(message: string, error?: Error | string): void {
    if (this.shouldLog('error')) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.output(this.formatEntry('error', message, undefined, errorMsg))
    }
  }

  request(method: string, path: string, statusCode: number, duration: number): void {
    if (this.shouldLog('info')) {
      const message = `${method} ${path} ${statusCode}`
      this.output(this.formatEntry('info', message, duration))
    }
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module)
}

// Global logger instance
export const logger = createLogger('desktop-connector')
