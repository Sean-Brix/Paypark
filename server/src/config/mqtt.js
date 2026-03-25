import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";
import { parse as parseDotenv } from "dotenv";

let mqttClient = null;
let legacyBrokerEnv = null;

function getLegacyBrokerEnv() {
  if (legacyBrokerEnv !== null) {
    return legacyBrokerEnv;
  }

  try {
    const configDir = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(configDir, "../../.env");
    legacyBrokerEnv = parseDotenv(readFileSync(envPath, "utf8"));
  } catch {
    legacyBrokerEnv = {};
  }

  return legacyBrokerEnv;
}

function getBrokerConfig() {
  const legacyEnv = getLegacyBrokerEnv();

  return {
    host: process.env.MQTT_URL || process.env.PAYPARK_MQTT_URL || "",
    port: Number.parseInt(
      process.env.MQTT_PORT || process.env.PAYPARK_MQTT_PORT || "8883",
      10
    ),
    username:
      process.env.MQTT_USERNAME ||
      process.env.PAYPARK_MQTT_USERNAME ||
      legacyEnv.username ||
      "",
    password:
      process.env.MQTT_PASSWORD ||
      process.env.PAYPARK_MQTT_PASSWORD ||
      legacyEnv.password ||
      "",
  };
}

export function getMqttTopics() {
  return {
    open: process.env.MQTT_PAYMENT_OPEN_TOPIC || "paypark/payment/open",
    paying: process.env.MQTT_PAYMENT_PAYING_TOPIC || "paypark/payment/paying",
    paid: process.env.MQTT_PAYMENT_PAID_TOPIC || "paypark/payment/paid",
    status: process.env.MQTT_PAYMENT_STATUS_TOPIC || "paypark/payment/status",
  };
}

function isConfigured() {
  const { host, port, username, password } = getBrokerConfig();
  return Boolean(host && port && username && password);
}

function buildBrokerUrl() {
  const { host, port } = getBrokerConfig();
  return `mqtts://${host}:${port}`;
}

function toMqttPayload(payload) {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "number") {
    return String(payload);
  }

  if (typeof payload === "boolean") {
    return payload ? "1" : "0";
  }

  return JSON.stringify(payload);
}

function publishMessage(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      reject(new Error("MQTT client is not connected"));
      return;
    }

    mqttClient.publish(topic, toMqttPayload(payload), { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function startPaymentMqttBridge({ onCoinMessage } = {}) {
  const topics = getMqttTopics();

  if (!isConfigured()) {
    console.warn("MQTT bridge disabled: missing broker configuration.");
    return () => {};
  }

  if (mqttClient) {
    return () => stopPaymentMqttBridge();
  }

  const brokerConfig = getBrokerConfig();
  mqttClient = mqtt.connect(buildBrokerUrl(), {
    username: brokerConfig.username,
    password: brokerConfig.password,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    clean: true,
    clientId: `paypark-server-${Math.random().toString(16).slice(2, 10)}`,
  });

  mqttClient.on("connect", () => {
    console.log(`MQTT connected: ${buildBrokerUrl()}`);
    mqttClient.subscribe(topics.paying, { qos: 1 }, (error) => {
      if (error) {
        console.error(`MQTT subscribe failed for ${topics.paying}:`, error);
        return;
      }
      console.log(`MQTT subscribed: ${topics.paying}`);
    });
  });

  mqttClient.on("reconnect", () => {
    console.log("MQTT reconnecting...");
  });

  mqttClient.on("error", (error) => {
    console.error(`MQTT error: ${error.message}`);
  });

  mqttClient.on("message", async (topic, buffer) => {
    if (topic !== topics.paying || typeof onCoinMessage !== "function") {
      return;
    }

    try {
      const payload = JSON.parse(buffer.toString("utf8"));
      await onCoinMessage(payload);
    } catch (error) {
      console.error(`MQTT message handling failed: ${error.message}`);
    }
  });

  return () => stopPaymentMqttBridge();
}

export async function publishPaymentPaid(payload) {
  return publishMessage(getMqttTopics().paid, payload);
}

export async function publishPaymentOpen(payload) {
  return publishMessage(getMqttTopics().open, payload);
}

export async function publishPaymentStatus(payload) {
  return publishMessage(getMqttTopics().status, payload);
}

export function stopPaymentMqttBridge() {
  return new Promise((resolve) => {
    if (!mqttClient) {
      resolve();
      return;
    }

    const client = mqttClient;
    mqttClient = null;

    client.end(true, {}, () => {
      console.log("MQTT disconnected.");
      resolve();
    });
  });
}
