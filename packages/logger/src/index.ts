import winston from "winston";
import { redact } from "./redact";

export { redact } from "./redact";

const redactFormat = winston.format((info) => {
  // Mutate in place — replacing `info` with a new object would drop the
  // internal Symbol.for('level')/Symbol.for('message') winston attaches,
  // silently breaking every downstream format (json/simple/console output).
  const { level, message, timestamp, component, ...meta } = info;
  const redactedMeta = redact(meta) as Record<string, unknown>;
  for (const key of Object.keys(meta)) {
    delete info[key];
  }
  Object.assign(info, redactedMeta);
  return info;
})();

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat,
    process.env.NODE_ENV === "production" ? winston.format.json() : winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * One structured logger per component (e.g. "auth", "risk", "http") — the
 * `component` field is what lets CloudWatch Logs Insights filter by subsystem
 * once this ships (ARCHITECTURE.md §10.1 Monitoring).
 */
export function createLogger(component: string): Logger {
  const child = baseLogger.child({ component });
  return {
    info: (message, meta) => child.info(message, meta),
    warn: (message, meta) => child.warn(message, meta),
    error: (message, meta) => child.error(message, meta),
    debug: (message, meta) => child.debug(message, meta),
  };
}
