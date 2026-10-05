export interface CalendarLabels {
  today: string;
  clear: string;
}

export interface CalendarLocale extends CalendarLabels {
  dayNames: string[];
  dayNamesShort: string[];
  dayNamesMin: string[];
  monthNames: string[];
  monthNamesShort: string[];
  dateFormat: string;
  firstDayOfWeek: number;
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const clean = (value: string): string => capitalize(value.replace(/\.$/, ''));

const weekdays = (lang: string, weekday: 'long' | 'short' | 'narrow'): string[] => {
  const format = new Intl.DateTimeFormat(lang, { weekday, timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, index) => clean(format.format(new Date(Date.UTC(2023, 0, 1 + index)))));
};

const monthList = (lang: string, month: 'long' | 'short'): string[] => {
  const format = new Intl.DateTimeFormat(lang, { month, timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, index) => clean(format.format(new Date(Date.UTC(2023, index, 1)))));
};

export const calendarLocale = (lang: string, labels: CalendarLabels): CalendarLocale => ({
  ...labels,
  dayNames: weekdays(lang, 'long'),
  dayNamesShort: weekdays(lang, 'short'),
  dayNamesMin: weekdays(lang, 'narrow'),
  monthNames: monthList(lang, 'long'),
  monthNamesShort: monthList(lang, 'short'),
  dateFormat: 'dd/mm/yy',
  firstDayOfWeek: 0,
});
