const COUNT_WIDTH = 6;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(value) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function nextDay(value) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + 1,
    0,
    0,
    0,
    0
  );
}

function getDateKey(value) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function extractDateKey(controlNumber) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-\d{3,4}-\d{6}$/.exec(String(controlNumber || ""));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function buildTimeSegment(value) {
  return `${pad2(value.getHours())}${pad2(value.getMinutes())}`;
}

export function formatControlNumber(value, count) {
  const sequence = String(count).padStart(COUNT_WIDTH, "0");

  return [
    value.getFullYear(),
    pad2(value.getMonth() + 1),
    pad2(value.getDate()),
    buildTimeSegment(value),
    sequence,
  ].join("-");
}

export async function generateControlNumber({
  prisma,
  date = new Date(),
  activeControlNumbers = [],
}) {
  const dayStart = startOfDay(date);
  const dayEnd = nextDay(date);
  const dateKey = getDateKey(date);

  const transactionCount = await prisma.transaction.count({
    where: {
      timestamp: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });

  const activeCount = activeControlNumbers.reduce((total, controlNumber) => {
    return total + (extractDateKey(controlNumber) === dateKey ? 1 : 0);
  }, 0);

  return formatControlNumber(date, transactionCount + activeCount + 1);
}
