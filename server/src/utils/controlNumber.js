const COUNT_WIDTH = 6;
const DEFAULT_TIME_ZONE = "Asia/Manila";
const CONTROL_NUMBER_TIME_ZONE =
  process.env.PAYPARK_TIME_ZONE || DEFAULT_TIME_ZONE;
const dateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CONTROL_NUMBER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getDateTimeParts(value) {
  const parts = dateTimePartsFormatter.formatToParts(value).reduce(
    (result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    },
    {}
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimeZoneOffsetMs(value) {
  const parts = getDateTimeParts(value);
  const timeZoneTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    value.getMilliseconds()
  );

  return timeZoneTimestamp - value.getTime();
}

function zonedTimeToDate({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
}) {
  const utcTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  );
  const firstPass = utcTimestamp - getTimeZoneOffsetMs(new Date(utcTimestamp));
  const secondPass = utcTimestamp - getTimeZoneOffsetMs(new Date(firstPass));

  return new Date(secondPass);
}

function startOfDay(value) {
  const parts = getDateTimeParts(value);

  return zonedTimeToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  });
}

function nextDay(value) {
  const parts = getDateTimeParts(value);

  return zonedTimeToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day + 1,
  });
}

function getDateKey(value) {
  const parts = getDateTimeParts(value);

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function extractDateKey(controlNumber) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-\d{3,4}-\d{6}$/.exec(String(controlNumber || ""));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function buildTimeSegment(value) {
  const parts = getDateTimeParts(value);

  return `${pad2(parts.hour)}${pad2(parts.minute)}`;
}

export function formatControlNumber(value, count) {
  const parts = getDateTimeParts(value);
  const sequence = String(count).padStart(COUNT_WIDTH, "0");

  return [
    parts.year,
    pad2(parts.month),
    pad2(parts.day),
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
