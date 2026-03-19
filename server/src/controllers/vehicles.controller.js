import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";

function toFrontendVehicle(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    sub: row.sub,
    priceKey: row.priceKey,
    color: row.color,
    icon: row.icon,
    enabled: row.enabled,
  };
}

export async function listVehicles(req, res) {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: "asc" },
  });

  return sendSuccess(res, vehicles.map(toFrontendVehicle), "Vehicles loaded");
}

export async function updateVehicle(req, res) {
  const { id } = req.params;
  const payload = req.body || {};

  const existing = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!existing) {
    throw toHttpError(`Vehicle not found for id ${id}`, 404);
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.label !== undefined ? { label: payload.label } : {}),
      ...(payload.sub !== undefined ? { sub: payload.sub } : {}),
      ...(payload.priceKey !== undefined ? { priceKey: payload.priceKey } : {}),
      ...(payload.color !== undefined ? { color: payload.color } : {}),
      ...(payload.icon !== undefined ? { icon: payload.icon } : {}),
      ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
    },
  });

  return sendSuccess(res, toFrontendVehicle(updated), "Vehicle updated");
}
