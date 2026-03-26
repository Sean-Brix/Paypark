/**
 * ESC/POS Receipt Generation Utility
 * Generates thermal receipt commands compatible with 58mm POS printers
 */

export interface ReceiptData {
  vehicleType: string;
  amount: number;
  controlNumber: string;
  timestamp?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

const RECEIPT_CHARS = 32;
const DEFAULT_RECEIPT_TITLE = "CVSU-CCAT PAY-PARKING";
const DEFAULT_RECEIPT_FOOTER = "Thank You!";
const RECEIPT_COPIES = ["GUARD COPY", "DRIVER COPY"];

function fitText(text: string, width: number = RECEIPT_CHARS): string {
  if (text.length <= width) {
    return text;
  }

  if (width <= 1) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 1)}.`;
}

function center(text: string, width: number = RECEIPT_CHARS): string {
  const trimmed = String(text);

  if (trimmed.length >= width) {
    return trimmed.slice(0, width);
  }

  const left = Math.floor((width - trimmed.length) / 2);
  return `${" ".repeat(left)}${trimmed}`;
}

function line(left: string, right: string, width: number = RECEIPT_CHARS): string {
  const maxLeft = Math.floor(width * 0.56);
  const l = fitText(left, maxLeft);
  const r = fitText(right, Math.max(1, width - l.length - 1));
  const spaces = Math.max(1, width - l.length - r.length);

  return `${l}${" ".repeat(spaces)}${r}`;
}

function resolveReceiptTitle(value?: string): string {
  const trimmed = String(value || "").trim();

  if (!trimmed || /^paypark$/i.test(trimmed)) {
    return DEFAULT_RECEIPT_TITLE;
  }

  return trimmed.toUpperCase();
}

function resolveReceiptFooter(value?: string): string {
  const trimmed = String(value || "").trim();

  if (
    !trimmed ||
    /^thank you for parking with us$/i.test(trimmed) ||
    /^drive safe\.?$/i.test(trimmed) ||
    /^drive safely\.?$/i.test(trimmed)
  ) {
    return DEFAULT_RECEIPT_FOOTER;
  }

  return trimmed;
}

function buildReceiptCopyText(data: ReceiptData, copyLabel: string): string {
  const divider = "-".repeat(RECEIPT_CHARS);

  return [
    center(resolveReceiptTitle(data.receiptHeader)),
    divider,
    line("AMOUNT:", data.amount.toFixed(2)),
    "",
    "CONTROL NUMBER:",
    center(data.controlNumber),
    divider,
    center(copyLabel),
    center(resolveReceiptFooter(data.receiptFooter)),
  ].join("\n");
}

function buildReceiptText(data: ReceiptData): string {
  return RECEIPT_COPIES.map((copyLabel) => buildReceiptCopyText(data, copyLabel)).join(
    "\n\n\n"
  );
}

export function buildEscPosReceipt(data: ReceiptData): Buffer {
  const receiptText = buildReceiptText(data);
  const init = Buffer.from([0x1b, 0x40]);
  const normal = Buffer.from([0x1b, 0x21, 0x00]);
  const lineSpacing = Buffer.from([0x1b, 0x33, 0x20]);
  const text = Buffer.from(`${receiptText}\n\n`, "ascii");
  const feed = Buffer.from([0x1b, 0x64, 0x03]);
  const cut = Buffer.from([0x1d, 0x56, 0x00]);

  return Buffer.concat([init, normal, lineSpacing, text, feed, cut]);
}

export function buildPrintPayload(data: ReceiptData): {
  vehicleType: string;
  amount: number;
  controlNumber: string;
  timestamp: string;
  receiptHeader?: string;
  receiptFooter?: string;
} {
  const now = data.timestamp ? new Date(data.timestamp) : new Date();

  return {
    vehicleType: data.vehicleType,
    amount: data.amount,
    controlNumber: data.controlNumber,
    timestamp: now.toISOString(),
    receiptHeader: data.receiptHeader,
    receiptFooter: data.receiptFooter,
  };
}
