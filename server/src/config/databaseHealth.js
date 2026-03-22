import { prisma } from "./prisma.js";

const PROBE_INTERVAL_MS = Number.parseInt(process.env.DB_HEALTH_INTERVAL_MS || "15000", 10);
const PROBE_TIMEOUT_MS = Number.parseInt(process.env.DB_HEALTH_TIMEOUT_MS || "2000", 10);

const state = {
  ready: false,
  lastCheckedAt: null,
  lastError: "Database probe has not run yet.",
};

let probeInFlight = null;
let probeTimer = null;

function withTimeout(promise, timeoutMs) {
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`database probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

export function getDatabaseHealth() {
  return {
    ready: state.ready,
    lastCheckedAt: state.lastCheckedAt,
    lastError: state.lastError,
  };
}

export async function probeDatabase({ timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (probeInFlight) {
    return probeInFlight;
  }

  probeInFlight = (async () => {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
      state.ready = true;
      state.lastError = null;
    } catch (error) {
      state.ready = false;
      state.lastError = error?.message || "Database probe failed";
    } finally {
      state.lastCheckedAt = new Date().toISOString();
      probeInFlight = null;
    }

    return getDatabaseHealth();
  })();

  return probeInFlight;
}

export function startDatabaseHealthMonitor() {
  if (probeTimer) {
    return;
  }

  void probeDatabase();

  probeTimer = setInterval(() => {
    void probeDatabase();
  }, PROBE_INTERVAL_MS);

  if (typeof probeTimer.unref === "function") {
    probeTimer.unref();
  }
}

export function stopDatabaseHealthMonitor() {
  if (!probeTimer) {
    return;
  }

  clearInterval(probeTimer);
  probeTimer = null;
}
