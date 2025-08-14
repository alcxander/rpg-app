// lib/logger.ts

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

/** 
 * Current minimum log level 
 * (Change here or override via process.env.NEXT_PUBLIC_LOG_LEVEL)
 */
const DEFAULT_LEVEL: LogLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || "debug"

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

/** 
 * Checks if a log should be printed given the current config 
 */
function shouldLog(level: LogLevel) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[DEFAULT_LEVEL]
}

/** 
 * Formats time as `HH:MM:SS.mmm`
 */
function timestamp() {
  const now = new Date()
  return now.toISOString().split("T")[1].replace("Z", "")
}

/** 
 * Pretty-print helper
 */
function fmtArgs(args: any[]) {
  return args.map((a) => (typeof a === "object" ? JSON.parse(JSON.stringify(a, null, 2)) : a))
}

/**
 * Creates a namespaced logger.
 * @param source Name of the module/hook/component
 */
export function createLogger(source: string) {
  return {
    debug: (...args: any[]) => {
      if (shouldLog("debug")) console.debug(`[${timestamp()}] [${source}]`, ...fmtArgs(args))
    },
    info: (...args: any[]) => {
      if (shouldLog("info")) console.info(`[${timestamp()}] [${source}]`, ...fmtArgs(args))
    },
    warn: (...args: any[]) => {
      if (shouldLog("warn")) console.warn(`[${timestamp()}] [${source}]`, ...fmtArgs(args))
    },
    error: (...args: any[]) => {
      if (shouldLog("error")) console.error(`[${timestamp()}] [${source}]`, ...fmtArgs(args))
    },
  }
}
