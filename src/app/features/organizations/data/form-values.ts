const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isDay = (value: string): boolean => DAY.test(value.trim());

export const endOfDay = (day: string): string => new Date(`${day.trim()}T23:59:59`).toISOString();

export const isFutureDay = (day: string): boolean =>
  isDay(day) && new Date(endOfDay(day)).getTime() > Date.now();

export const wholeNumber = (value: string): number | null => {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
};
