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

const PRINTER_DOTS = 384; // 58mm thermal printer width
const RECEIPT_CHARS = 32; // Characters per line
const LOGO_MAX_DOTS = Math.floor(PRINTER_DOTS * 0.56); // ~215px
const LOGO_MAX_HEIGHT = 92;
const LOGO_THRESHOLD = 168;

// ─── TEXT FORMATTING ───────────────────────────────────────────

/**
 * Fit text to width, truncate with ellipsis if needed
 */
function fitText(text: string, width: number = RECEIPT_CHARS): string {
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  return `${text.slice(0, width - 1)}.`;
}

/**
 * Center text horizontally
 */
function center(text: string, width: number = RECEIPT_CHARS): string {
  const trimmed = String(text);
  if (trimmed.length >= width) {
    return trimmed.slice(0, width);
  }
  const left = Math.floor((width - trimmed.length) / 2);
  return `${" ".repeat(left)}${trimmed}`;
}

/**
 * Create two-column line (left label, right value)
 */
function line(
  left: string,
  right: string,
  width: number = RECEIPT_CHARS
): string {
  const maxLeft = Math.floor(width * 0.56);
  const l = fitText(left, maxLeft);
  const r = fitText(right, Math.max(1, width - l.length - 1));
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(spaces)}${r}`;
}

// ─── RECEIPT GENERATION ────────────────────────────────────────

/**
 * Generate ESC/POS text receipt
 */
function buildReceiptText(data: ReceiptData): string {
  const now = data.timestamp ? new Date(data.timestamp) : new Date();
  const divider = "-".repeat(RECEIPT_CHARS);

  const content = [
    center("PAYPARK"),
    center("Parking Receipt"),
    divider,
    line("Date", now.toLocaleDateString("en-CA")),
    line("Time", now.toLocaleTimeString("en-GB", { hour12: false })),
    line("Ticket", data.controlNumber),
    line("Vehicle", data.vehicleType),
    line("Amount", `PHP ${data.amount.toFixed(2)}`),
    line("Status", "PAID"),
    divider,
    center(data.receiptHeader || "Thank you for parking!"),
    center(data.receiptFooter || "Drive safe."),
    "",
    "",
    "",
  ].join("\n");

  return content;
}

/**
 * Generate complete ESC/POS receipt with logo placeholder
 * Logo will be handled server-side if available
 */
export function buildEscPosReceipt(data: ReceiptData): Buffer {
  const receiptText = buildReceiptText(data);

  // ESC/POS commands
  const init = Buffer.from([0x1b, 0x40]); // Initialize printer
  const normal = Buffer.from([0x1b, 0x21, 0x00]); // Normal text mode
  const text = Buffer.from(receiptText, "ascii");
  const feed = Buffer.from([0x1b, 0x64, 0x03]); // Feed 3 lines
  const cut = Buffer.from([0x1d, 0x56, 0x00]); // Cut paper

  return Buffer.concat([init, normal, text, feed, cut]);
}

/**
 * Build receipt data for sending to server
 * Server will optionally add logo and print
 */
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
