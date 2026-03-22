import { getDatabaseHealth } from "../config/databaseHealth.js";

export async function getHealth(req, res) {
  const db = getDatabaseHealth();

  res.json({
    success: true,
    status: db.ready ? "ok" : "degraded",
    services: {
      database: db,
    },
    timestamp: new Date().toISOString(),
  });
}
