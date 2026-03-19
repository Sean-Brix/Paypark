export function sendSuccess(res, data, message = "OK", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function toHttpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
