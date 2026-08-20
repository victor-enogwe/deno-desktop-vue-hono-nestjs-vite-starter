export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  LOG = "log",
  ASCII = "ascii",
  PRINT = "print",
  PRINTF = "printf",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
  SILENT = "silent",
}

export const LogLevelNum: Record<`${LogLevel}`, number> = {
  trace: 10,
  debug: 20,
  log: 25,
  ascii: 26,
  print: 27,
  printf: 28,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
};
