/**
 * Names shown with the Vietnamese lunar calendar, in the three supported
 * languages. The calendar itself is the Vietnamese one in every language; only
 * the labels change.
 */
export type LunarLocale = 'vi' | 'en' | 'ja';

/** Heavenly stems (Can), in cycle order starting at Giáp. */
export const CAN: Record<LunarLocale, string[]> = {
  vi: ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'],
  en: ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'],
  ja: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
};

/** Earthly branches (Chi), in cycle order starting at Tý. */
export const CHI: Record<LunarLocale, string[]> = {
  vi: [
    'Tý',
    'Sửu',
    'Dần',
    'Mão',
    'Thìn',
    'Tỵ',
    'Ngọ',
    'Mùi',
    'Thân',
    'Dậu',
    'Tuất',
    'Hợi',
  ],
  en: [
    'Zi',
    'Chou',
    'Yin',
    'Mao',
    'Chen',
    'Si',
    'Wu',
    'Wei',
    'Shen',
    'You',
    'Xu',
    'Hai',
  ],
  ja: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
};

/** Words around a lunar date: "15/8 ÂL — Bính Ngọ". */
export const LUNAR_WORDS: Record<
  LunarLocale,
  {
    /** short mark for a leap month on the label of the 1st */
    leapMark: string;
    /** inserted after the date of a leap month */
    leapWord: string;
    /** turns `date` and `yearName` into the full text */
    full: (date: string, yearName: string) => string;
    /** heading of the lunar line in the journal sidebar */
    heading: string;
    /** "day Quý Mùi" */
    day: (dayName: string) => string;
  }
> = {
  vi: {
    leapMark: 'n',
    leapWord: ' nhuận',
    full: (date, yearName) => `${date} ÂL — ${yearName}`,
    heading: 'Âm lịch',
    day: dayName => `Ngày ${dayName}`,
  },
  en: {
    leapMark: 'L',
    leapWord: ' (leap)',
    full: (date, yearName) => `Lunar ${date} — ${yearName}`,
    heading: 'Lunar calendar',
    day: dayName => `Day ${dayName}`,
  },
  ja: {
    leapMark: '閏',
    leapWord: '（閏）',
    full: (date, yearName) => `旧暦 ${date} — ${yearName}`,
    heading: '旧暦',
    day: dayName => `${dayName}の日`,
  },
};

/** Holiday names, keyed `day/month` of the Gregorian or the lunar calendar. */
export const SOLAR_HOLIDAY_NAMES: Record<
  LunarLocale,
  Record<string, string>
> = {
  vi: {
    '1/1': 'Tết Dương lịch',
    '14/2': 'Valentine',
    '8/3': 'Quốc tế Phụ nữ',
    '30/4': 'Giải phóng miền Nam',
    '1/5': 'Quốc tế Lao động',
    '1/6': 'Quốc tế Thiếu nhi',
    '2/9': 'Quốc khánh',
    '20/10': 'Phụ nữ Việt Nam',
    '20/11': 'Nhà giáo Việt Nam',
    '24/12': 'Giáng sinh',
  },
  en: {
    '1/1': "New Year's Day",
    '14/2': "Valentine's Day",
    '8/3': "International Women's Day",
    '30/4': 'Reunification Day',
    '1/5': "International Workers' Day",
    '1/6': "International Children's Day",
    '2/9': 'National Day',
    '20/10': "Vietnamese Women's Day",
    '20/11': "Vietnamese Teachers' Day",
    '24/12': 'Christmas Eve',
  },
  ja: {
    '1/1': '元日',
    '14/2': 'バレンタインデー',
    '8/3': '国際女性デー',
    '30/4': '南部解放記念日',
    '1/5': 'メーデー',
    '1/6': '国際子どもの日',
    '2/9': '独立記念日',
    '20/10': 'ベトナム女性の日',
    '20/11': 'ベトナム教師の日',
    '24/12': 'クリスマスイブ',
  },
};

export const LUNAR_HOLIDAY_NAMES: Record<
  LunarLocale,
  Record<string, string>
> = {
  vi: {
    '1/1': 'Tết Nguyên đán',
    '2/1': 'Tết Nguyên đán (mùng 2)',
    '3/1': 'Tết Nguyên đán (mùng 3)',
    '15/1': 'Rằm tháng Giêng',
    '3/3': 'Tết Hàn thực',
    '10/3': 'Giỗ Tổ Hùng Vương',
    '15/4': 'Lễ Phật Đản',
    '5/5': 'Tết Đoan Ngọ',
    '15/7': 'Lễ Vu Lan',
    '15/8': 'Tết Trung Thu',
    '23/12': 'Ông Táo chầu trời',
  },
  en: {
    '1/1': 'Lunar New Year (Tết)',
    '2/1': 'Lunar New Year (day 2)',
    '3/1': 'Lunar New Year (day 3)',
    '15/1': 'Lantern Festival',
    '3/3': 'Cold Food Festival',
    '10/3': 'Hung Kings Commemoration',
    '15/4': "Buddha's Birthday",
    '5/5': 'Dragon Boat Festival',
    '15/7': 'Vu Lan (Ullambana)',
    '15/8': 'Mid-Autumn Festival',
    '23/12': 'Kitchen Gods Day',
  },
  ja: {
    '1/1': 'テト（旧正月）',
    '2/1': 'テト（2日目）',
    '3/1': 'テト（3日目）',
    '15/1': '上元節',
    '3/3': '寒食節',
    '10/3': 'フン王の命日',
    '15/4': '仏誕節',
    '5/5': '端午節',
    '15/7': '盂蘭盆（ヴーラン）',
    '15/8': '中秋節',
    '23/12': '竈神の日',
  },
};

export const NEW_YEARS_EVE: Record<LunarLocale, string> = {
  vi: 'Giao thừa',
  en: "Lunar New Year's Eve",
  ja: '大晦日',
};
