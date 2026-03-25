import dotenv from "dotenv";
import { app } from "./app.js";
import { prisma } from "./config/prisma.js";
import { startDatabaseHealthMonitor, stopDatabaseHealthMonitor } from "./config/databaseHealth.js";
import {
  publishPaymentPaid,
  publishPaymentOpen,
  publishPaymentStatus,
  startPaymentMqttBridge,
  stopPaymentMqttBridge,
} from "./config/mqtt.js";
import {
  configurePaymentRealtime,
  recordPaymentCoin,
} from "./services/payment.service.js";

dotenv.config();

const port = Number(process.env.PORT || 4000);

configurePaymentRealtime({
  publishPaid: publishPaymentPaid,
  publishOpen: publishPaymentOpen,
  publishStatus: publishPaymentStatus,
});

const server = app.listen(port, () => {
  console.log(`Paypark API listening on http://localhost:${port}`);
});

startDatabaseHealthMonitor();
startPaymentMqttBridge({ onCoinMessage: recordPaymentCoin });

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  stopDatabaseHealthMonitor();

  server.close(async () => {
    try {
      await stopPaymentMqttBridge();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
