import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";

const DEFAULT_KIOSK_ID = "KIOSK-001";

const DEFAULT_SETTINGS = {
  kioskName: "Paypark Kiosk",
  location: "Main Entrance",
  carPrice: 50,
  motorcyclePrice: 30,
  ebikePrice: 20,
  openTime: "06:00",
  closeTime: "22:00",
  receiptHeader: "Paypark",
  receiptFooter: "Thank you for parking with us",
  systemVersion: "1.0.0",
};

function toFrontendSettings(row) {
  return {
    kioskId: row.kioskId,
    kioskName: row.kioskName,
    location: row.location,
    carPrice: Number(row.carPrice),
    motorcyclePrice: Number(row.motorcyclePrice),
    ebikePrice: Number(row.ebikePrice),
    operatingHours: {
      open: row.openTime,
      close: row.closeTime,
    },
    receiptHeader: row.receiptHeader,
    receiptFooter: row.receiptFooter,
    systemVersion: row.systemVersion,
  };
}

export async function getSettings(req, res) {
  const kioskId = req.query.kioskId || DEFAULT_KIOSK_ID;

  let settings = await prisma.settings.findUnique({
    where: { kioskId },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        kioskId,
        ...DEFAULT_SETTINGS,
      },
    });
  }

  return sendSuccess(res, toFrontendSettings(settings), "Settings loaded");
}

export async function updateSettings(req, res) {
  const payload = req.body || {};
  const kioskId = payload.kioskId || req.query.kioskId || DEFAULT_KIOSK_ID;

  const updateData = {
    ...(payload.kioskName !== undefined ? { kioskName: payload.kioskName } : {}),
    ...(payload.location !== undefined ? { location: payload.location } : {}),
    ...(payload.carPrice !== undefined ? { carPrice: payload.carPrice } : {}),
    ...(payload.motorcyclePrice !== undefined ? { motorcyclePrice: payload.motorcyclePrice } : {}),
    ...(payload.ebikePrice !== undefined ? { ebikePrice: payload.ebikePrice } : {}),
    ...(payload.receiptHeader !== undefined ? { receiptHeader: payload.receiptHeader } : {}),
    ...(payload.receiptFooter !== undefined ? { receiptFooter: payload.receiptFooter } : {}),
    ...(payload.systemVersion !== undefined ? { systemVersion: payload.systemVersion } : {}),
    ...(payload.operatingHours?.open !== undefined ? { openTime: payload.operatingHours.open } : {}),
    ...(payload.operatingHours?.close !== undefined ? { closeTime: payload.operatingHours.close } : {}),
  };

  const updated = await prisma.settings.upsert({
    where: { kioskId },
    update: updateData,
    create: {
      kioskId,
      ...DEFAULT_SETTINGS,
      ...updateData,
    },
  });

  return sendSuccess(res, toFrontendSettings(updated), "Settings updated");
}
