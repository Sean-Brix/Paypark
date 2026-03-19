import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

const DEFAULT_KIOSK_ID = "KIOSK-001";

const seedSettings = {
  kioskId: DEFAULT_KIOSK_ID,
  kioskName: "Paypark Main Kiosk",
  location: "Main Entrance",
  carPrice: 50,
  motorcyclePrice: 30,
  ebikePrice: 20,
  openTime: "06:00",
  closeTime: "22:00",
  receiptHeader: "PAYPARK",
  receiptFooter: "Thank you for parking with us",
  systemVersion: "1.0.0",
};

const seedVehicles = [
  {
    id: "VEH-001",
    type: "E-Bike",
    label: "E-BIKE",
    sub: "Electric Bicycle",
    priceKey: "ebikePrice",
    color: "#14B8A6",
    icon: "Bike",
    enabled: true,
  },
  {
    id: "VEH-002",
    type: "Motorcycle",
    label: "MOTORCYCLE",
    sub: "2-Wheel Motor Vehicle",
    priceKey: "motorcyclePrice",
    color: "#F59E0B",
    icon: "Bike",
    enabled: true,
  },
  {
    id: "VEH-003",
    type: "Car",
    label: "CAR",
    sub: "4-Wheel Vehicle",
    priceKey: "carPrice",
    color: "#3B82F6",
    icon: "Car",
    enabled: true,
  },
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function main() {
  const adminPasswordHash = await bcrypt.hash("123456", 10);

  const adminRows = [
    {
      id: "ADM-001",
      username: "admin",
      passwordHash: adminPasswordHash,
      displayName: "Administrator",
      role: "Admin",
      initials: "AD",
      createdAt: new Date(),
      lastLogin: null,
    },
  ];

  const transactionRows = [
    {
      id: "TXN-SEED-0001",
      type: "Car",
      amount: 50,
      timestamp: hoursAgo(2),
      status: "Success",
      kioskId: DEFAULT_KIOSK_ID,
      controlNumber: "CTRL-SEED-0001",
    },
    {
      id: "TXN-SEED-0002",
      type: "Motorcycle",
      amount: 30,
      timestamp: hoursAgo(1),
      status: "Success",
      kioskId: DEFAULT_KIOSK_ID,
      controlNumber: "CTRL-SEED-0002",
    },
    {
      id: "TXN-SEED-0003",
      type: "E-Bike",
      amount: 20,
      timestamp: hoursAgo(0.5),
      status: "Success",
      kioskId: DEFAULT_KIOSK_ID,
      controlNumber: "CTRL-SEED-0003",
    },
  ];

  const expenseRows = [
    {
      id: "EXP-001",
      label: "Printer Paper",
      amount: 120,
      date: hoursAgo(24),
      category: "Supplies",
      description: "Thermal receipt paper roll",
    },
    {
      id: "EXP-002",
      label: "Kiosk Cleaning",
      amount: 200,
      date: hoursAgo(48),
      category: "Maintenance",
      description: "Weekly kiosk maintenance",
    },
  ];

  await prisma.settings.upsert({
    where: { kioskId: seedSettings.kioskId },
    update: seedSettings,
    create: seedSettings,
  });

  for (const row of adminRows) {
    await prisma.admin.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  for (const row of seedVehicles) {
    await prisma.vehicle.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  for (const row of transactionRows) {
    await prisma.transaction.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  for (const row of expenseRows) {
    await prisma.expense.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  console.log("Seed complete:", {
    settings: 1,
    admins: adminRows.length,
    vehicles: seedVehicles.length,
    transactions: transactionRows.length,
    expenses: expenseRows.length,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });