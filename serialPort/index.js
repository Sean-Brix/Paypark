import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import axios from "axios";

const SERVER_URL = process.env.PAYPARK_WEBHOOK_URL || "https://paypark-656a.onrender.com/api/payments/webhook";
const COM_PORT = process.env.PAYPARK_COM_PORT || "COM7";
const BAUD_RATE = 9600;

function mapValidCoinAmount(value) {
  const normalized = Number(value);

  // Accept exact coins and up to +3 noisy pulse overshoot.
  if (normalized >= 5 && normalized <= 8) {
    return 5.0;
  }

  if (normalized >= 10 && normalized <= 13) {
    return 10.0;
  }

  if (normalized >= 20 && normalized <= 23) {
    return 20.0;
  }

  return 0.0;
}

function parseCoinCandidate(line) {
  const amountMatch = line.match(/^Amount:\s*PHP\s*([0-9]+(?:\.[0-9]+)?)$/i);
  if (amountMatch) {
    return Number.parseFloat(amountMatch[1]);
  }

  const pulsesMatch = line.match(/^Pulses:\s*(\d+)$/i);
  if (pulsesMatch) {
    return Number.parseInt(pulsesMatch[1], 10);
  }

  // New simplified Arduino output format: "5.00", "10.00", "20.00"
  const numericLineMatch = line.match(/^\d+(?:\.\d+)?$/);
  if (numericLineMatch) {
    return Number.parseFloat(line);
  }

  return null;
}

const port = new SerialPort({
  path: COM_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

console.log(`Listening on ${COM_PORT}...`);

parser.on('data', async (rawLine) => {
  const line = rawLine.trim();
  console.log('Received:', line);

  if (!line || /^READY$/i.test(line) || /^Unknown coin$/i.test(line)) {
    return;
  }

  const candidate = parseCoinCandidate(line);
  if (candidate === null) {
    return;
  }

  const coinAmount = mapValidCoinAmount(candidate);
  if (coinAmount <= 0) {
    console.log(`Ignored invalid coin value: ${candidate}`);
    return;
  }

  try {
    const response = await axios.post(SERVER_URL, {
      coinAmount,
    });

    console.log('Sent to server:', response.status, response.data);
  } catch (error) {
    if (error.response) {
      console.error('Server error:', error.response.status, error.response.data);
    } else {
      console.error('Request failed:', error.message);
    }
  }
});

port.on('error', (err) => {
  console.error('Serial port error:', err.message);
});