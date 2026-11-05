/**
 * Vietnamese lunar calendar (Âm lịch) and public holidays.
 *
 * Conversion follows Hồ Ngọc Đức's algorithm for the Vietnamese lunisolar
 * calendar (UTC+7): new-moon / solar-longitude astronomy, leap-month detection
 * via the "no major solar term" rule. Valid for roughly 1900–2200.
 */

const PI = Math.PI;
const TIME_ZONE = 7;

function int(d: number) {
  return Math.floor(d);
}

/** Julian day number of a Gregorian/Julian calendar date. */
export function jdFromDate(dd: number, mm: number, yy: number) {
  const a = int((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    int((153 * m + 2) / 5) +
    365 * y +
    int(y / 4) -
    int(y / 100) +
    int(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + int((153 * m + 2) / 5) + 365 * y + int(y / 4) - 32083;
  }
  return jd;
}

/** Julian day (days since 1900-01-01 epoch) of the k-th new moon. */
function newMoon(k: number) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 -= 0.0074 * Math.sin(dr * (M - Mpr)) - 0.0004 * Math.sin(dr * (2 * F + M));
  c1 -=
    0.0004 * Math.sin(dr * (2 * F - M)) + 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 +=
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

/** Sun's ecliptic longitude at a given Julian day, in radians. */
function sunLongitude(jdn: number) {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  const omega = 125.04 - 1934.136 * T;
  L = L - 0.00569 - 0.00478 * Math.sin(omega * dr);
  L *= dr;
  L -= PI * 2 * int(L / (PI * 2));
  return L;
}

function sunLongitudeIndex(dayNumber: number) {
  return int((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / PI) * 6);
}

function newMoonDay(k: number) {
  return int(newMoon(k) + 0.5 + TIME_ZONE / 24);
}

function lunarMonth11(yy: number) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = int(off / 29.530588853);
  let nm = newMoonDay(k);
  if (sunLongitudeIndex(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}

function leapMonthOffset(a11: number) {
  const k = int((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitudeIndex(newMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = sunLongitudeIndex(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export type LunarDate = {
  day: number;
  month: number;
  year: number;
  /** true when this month is the leap (nhuận) month */
  leap: boolean;
};

/** Convert a Gregorian date to the Vietnamese lunar date. */
export function solarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = int((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = int((monthStart - a11) / 29);
  let leap = false;
  let lunarMonthNum = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      lunarMonthNum = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (lunarMonthNum > 12) lunarMonthNum -= 12;
  if (lunarMonthNum >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonthNum, year: lunarYear, leap };
}

const CAN = [
  'Giáp',
  'Ất',
  'Bính',
  'Đinh',
  'Mậu',
  'Kỷ',
  'Canh',
  'Tân',
  'Nhâm',
  'Quý',
];
const CHI = [
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
];

/** Can Chi of a lunar year, e.g. 2026 -> "Bính Ngọ". */
export function canChiYear(lunarYear: number) {
  return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
}

/** Can Chi of the day at the given Gregorian date. */
export function canChiDay(dd: number, mm: number, yy: number) {
  const jd = jdFromDate(dd, mm, yy);
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
}

type Holiday = { name: string; official: boolean };

const SOLAR_HOLIDAYS: Record<string, Holiday> = {
  '1/1': { name: 'Tết Dương lịch', official: true },
  '14/2': { name: 'Valentine', official: false },
  '8/3': { name: 'Quốc tế Phụ nữ', official: false },
  '30/4': { name: 'Giải phóng miền Nam', official: true },
  '1/5': { name: 'Quốc tế Lao động', official: true },
  '1/6': { name: 'Quốc tế Thiếu nhi', official: false },
  '2/9': { name: 'Quốc khánh', official: true },
  '20/10': { name: 'Phụ nữ Việt Nam', official: false },
  '20/11': { name: 'Nhà giáo Việt Nam', official: false },
  '24/12': { name: 'Giáng sinh', official: false },
};

const LUNAR_HOLIDAYS: Record<string, Holiday> = {
  '1/1': { name: 'Tết Nguyên đán', official: true },
  '2/1': { name: 'Tết Nguyên đán (mùng 2)', official: true },
  '3/1': { name: 'Tết Nguyên đán (mùng 3)', official: true },
  '15/1': { name: 'Rằm tháng Giêng', official: false },
  '3/3': { name: 'Tết Hàn thực', official: false },
  '10/3': { name: 'Giỗ Tổ Hùng Vương', official: true },
  '15/4': { name: 'Lễ Phật Đản', official: false },
  '5/5': { name: 'Tết Đoan Ngọ', official: false },
  '15/7': { name: 'Lễ Vu Lan', official: false },
  '15/8': { name: 'Tết Trung Thu', official: false },
  '23/12': { name: 'Ông Táo chầu trời', official: false },
};

function daysInLunarMonthEndsYear(dd: number, mm: number, yy: number) {
  // The last day of lunar month 12 is "Giao thừa" (Tết Eve): tomorrow is 1/1.
  const next = new Date(yy, mm - 1, dd + 1);
  const l = solarToLunar(
    next.getDate(),
    next.getMonth() + 1,
    next.getFullYear()
  );
  return l.day === 1 && l.month === 1 && !l.leap;
}

export type DayInfo = {
  lunar: LunarDate;
  /** short label under the solar day: "15" or "1/3" on the 1st of a month */
  lunarLabel: string;
  /** e.g. "15/8 ÂL — Tết Tân Sửu" */
  lunarFull: string;
  holiday?: string;
  /** true for public holidays (nghỉ lễ) */
  officialHoliday: boolean;
  /** 1st or 15th (mùng 1 / rằm) */
  isMajorLunarDay: boolean;
};

const cache = new Map<string, DayInfo>();

/** Everything the calendar needs to know about one Gregorian day. */
export function getDayInfo(dd: number, mm: number, yy: number): DayInfo {
  const key = `${yy}-${mm}-${dd}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const lunar = solarToLunar(dd, mm, yy);
  const lunarLabel =
    lunar.day === 1
      ? `${lunar.day}/${lunar.month}${lunar.leap ? 'n' : ''}`
      : String(lunar.day);
  const lunarFull = `${lunar.day}/${lunar.month}${lunar.leap ? ' nhuận' : ''} ÂL — ${canChiYear(lunar.year)}`;

  const solar = SOLAR_HOLIDAYS[`${dd}/${mm}`];
  const lunarHoliday = lunar.leap
    ? undefined
    : LUNAR_HOLIDAYS[`${lunar.day}/${lunar.month}`];
  const eve =
    !lunar.leap && lunar.month === 12 && daysInLunarMonthEndsYear(dd, mm, yy);
  const holiday = eve
    ? { name: 'Giao thừa', official: true }
    : (lunarHoliday ?? solar);

  const info: DayInfo = {
    lunar,
    lunarLabel,
    lunarFull,
    holiday: holiday?.name,
    officialHoliday: holiday?.official ?? false,
    isMajorLunarDay: lunar.day === 1 || lunar.day === 15,
  };
  if (cache.size > 2000) cache.clear();
  cache.set(key, info);
  return info;
}
