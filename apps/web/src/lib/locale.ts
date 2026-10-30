import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function normalizeOtp(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 6);
}

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export function formatNumber(value: string | number) {
  const number = Number(normalizeDigits(String(value)).replace(/,/g, ''));
  return Number.isFinite(number) ? number.toLocaleString('fa-IR') : '۰';
}

export function formatNumericInput(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return '';
  const digits = normalizeDigits(String(value)).replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('fa-IR') : '';
}

export function parseNumericInput(value: string) {
  return normalizeDigits(value).replace(/\D/g, '');
}

export function formatPersianDate(
  value: string | Date,
  timezone = DEFAULT_TIMEZONE,
) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatPersianDateTime(
  value: string | Date,
  timezone = DEFAULT_TIMEZONE,
) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatPersianMonth(value: string) {
  const date = /^\d{4}-\d{2}$/.test(value) ? `${value}-15` : value;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'long',
  }).format(new Date(date));
}

export function isoToJalaliInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const jalali = toJalaali(year, month, day);
  return toPersianDigits(
    `${jalali.jy}/${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')}`,
  );
}

export function jalaliInputToIso(value: string) {
  const normalized = normalizeDigits(value);
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (!isValidJalaaliDate(year, month, day)) return null;
  const gregorian = toGregorian(year, month, day);
  return `${gregorian.gy}-${String(gregorian.gm).padStart(2, '0')}-${String(gregorian.gd).padStart(2, '0')}`;
}

export function formatJalaliDraft(value: string) {
  const digits = normalizeDigits(value).replace(/\D/g, '').slice(0, 8);
  const formatted = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
    .filter(Boolean)
    .join('/');
  return toPersianDigits(formatted);
}
