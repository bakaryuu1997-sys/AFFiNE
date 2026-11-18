export type WeekPickerLocale = 'vi' | 'ja' | 'en';

const WEEK_DAYS_BY_LOCALE: Record<WeekPickerLocale, readonly string[]> = {
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export function getWeekDayLabels(locale: WeekPickerLocale): readonly string[] {
  return WEEK_DAYS_BY_LOCALE[locale] ?? WEEK_DAYS_BY_LOCALE.en;
}
