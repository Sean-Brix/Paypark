export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
}
