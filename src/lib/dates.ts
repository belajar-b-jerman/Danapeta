export function getCurrentPeriod(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function toIsoDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

