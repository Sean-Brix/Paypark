import { getDatabaseHealth, probeDatabase } from "../config/databaseHealth.js";

const STALE_THRESHOLD_MS = Number.parseInt(process.env.DB_HEALTH_STALE_MS || "5000", 10);
const REQUEST_PROBE_TIMEOUT_MS = Number.parseInt(process.env.DB_REQUEST_PROBE_TIMEOUT_MS || "1200", 10);

function isStale(lastCheckedAt) {
  if (!lastCheckedAt) {
    return true;
  }

  const checkedAtMs = Date.parse(lastCheckedAt);
  if (!Number.isFinite(checkedAtMs)) {
    return true;
  }

  return Date.now() - checkedAtMs > STALE_THRESHOLD_MS;
}

export async function requireDatabase(req, res, next) {
  const current = getDatabaseHealth();

  if (!current.ready || isStale(current.lastCheckedAt)) {
    await probeDatabase({ timeoutMs: REQUEST_PROBE_TIMEOUT_MS });
  }

  const latest = getDatabaseHealth();
  if (latest.ready) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: "Database is temporarily unavailable. Please retry shortly.",
    details: latest.lastError || "No active database connection",
  });
}
