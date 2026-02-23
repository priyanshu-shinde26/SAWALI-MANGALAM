export const toMinutes = (time24) => {
  if (!time24) return 0;
  const [hour, minute] = time24.split(":").map(Number);
  return hour * 60 + minute;
};

export const to12Hour = (time24) => {
  if (!time24) return "";
  const [hourRaw, minute] = time24.split(":").map(Number);
  const hour = hourRaw % 12 || 12;
  const meridiem = hourRaw >= 12 ? "PM" : "AM";
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")} ${meridiem}`;
};

export const overlaps = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

export const parseDateLabel = (dateValue) => {
  if (!dateValue) return "-";
  const parsed = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? dateValue
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

export const isSameMonth = (dateValue, year, month) => {
  if (!dateValue) return false;
  const parsed = new Date(`${dateValue}T00:00:00`);
  return parsed.getFullYear() === year && parsed.getMonth() === month;
};
