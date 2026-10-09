import { describe, expect, it } from 'vitest';
import { isValidIranianPhone, normalizeIranianPhone } from './phone.util.js';

describe('Iranian phone normalization', () => {
  it.each([
    ['09123456789', '09123456789'],
    ['+989123456789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['989123456789', '09123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['٠٩١٢٣٤٥٦٧٨٩', '09123456789'],
    ['0912 345 6789', '09123456789'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeIranianPhone(input)).toBe(expected);
    expect(isValidIranianPhone(input)).toBe(true);
  });

  it.each(['123', '0912345678', '08123456789', '+12025550123'])
    ('rejects invalid Iranian mobile number %s', (phone) => {
      expect(isValidIranianPhone(phone)).toBe(false);
    });
});
