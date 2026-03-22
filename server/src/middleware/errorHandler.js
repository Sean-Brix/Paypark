function isDatabaseUnavailableError(err) {
  const code = String(err?.code || "").toUpperCase();
  const name = String(err?.name || "");
  const message = String(err?.message || "").toLowerCase();

  if (["P1001", "P1002", "P1008", "P1017"].includes(code)) {
    return true;
  }

  if (name.includes("PrismaClientInitializationError") || name.includes("PrismaClientRustPanicError")) {
    return true;
  }

  if (message.includes("pool timeout") || message.includes("failed to retrieve a connection from pool")) {
    return true;
  }

  if (message.includes("can't reach database server") || message.includes("connection refused")) {
    return true;
  }

  return false;
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const status = isDatabaseUnavailableError(err) ? 503 : err.status || 500;
  const message = isDatabaseUnavailableError(err)
    ? "Database is temporarily unavailable. Please retry shortly."
    : err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
}
