function timestamp() {
  return new Date().toISOString();
}

export function createLogger(scope) {
  const prefix = `[${scope}]`;

  return {
    info: (message, ...args) => console.log(`${timestamp()} INFO  ${prefix} ${message}`, ...args),
    warn: (message, ...args) => console.warn(`${timestamp()} WARN  ${prefix} ${message}`, ...args),
    error: (message, ...args) =>
      console.error(`${timestamp()} ERROR ${prefix} ${message}`, ...args),
  };
}
