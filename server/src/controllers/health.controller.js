export async function getHealth(req, res) {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
