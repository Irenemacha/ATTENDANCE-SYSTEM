export const TIMETABLE_DAYS = [
  { code: "MON", label: "Monday" },
  { code: "TUE", label: "Tuesday" },
  { code: "WED", label: "Wednesday" },
  { code: "THU", label: "Thursday" },
  { code: "FRI", label: "Friday" },
  { code: "SAT", label: "Saturday" },
  { code: "SUN", label: "Sunday" },
];

export const DAY_LABELS: Record<string, string> = TIMETABLE_DAYS.reduce(
  (labels, day) => {
    labels[day.code] = day.label;
    return labels;
  },
  {} as Record<string, string>,
);

export function dayLabel(code: string) {
  return DAY_LABELS[code] ?? code;
}

export function formatTime(value: string) {
  return value.length > 5 ? value.slice(0, 5) : value;
}
