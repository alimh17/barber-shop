import { describe, expect, it } from 'vitest';

import {
  formatNumber,
  formatPersianDate,
  isoToJalaliInput,
  jalaliInputToIso,
  normalizeDigits,
  normalizeOtp,
  parseNumericInput,
} from './locale';

describe('Persian locale helpers', () => {
  it('normalizes Persian and Arabic digits for OTP submission', () => {
    expect(normalizeDigits('۱۲۳٤٥۶')).toBe('123456');
    expect(normalizeOtp('۱۲۳۴۵۶')).toBe('123456');
  });

  it('groups numbers in three-digit sections', () => {
    expect(formatNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
    expect(parseNumericInput('۱٬۲۳۴٬۵۶۷')).toBe('1234567');
  });

  it('converts between ISO and Jalali dates', () => {
    expect(isoToJalaliInput('2026-10-29')).toBe('۱۴۰۵/۰۸/۰۷');
    expect(jalaliInputToIso('۱۴۰۵/۰۸/۰۷')).toBe('2026-10-29');
    expect(formatPersianDate('2026-10-29')).toBe('۱۴۰۵/۰۸/۰۷');
  });
});
