const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function normalizeIranianPhone(value: string): string {
  let phone = value.trim().replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = persianDigits.indexOf(char);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = arabicDigits.indexOf(char);
    if (arabicIndex >= 0) return String(arabicIndex);
    return char;
  });
  phone = phone.replace(/[\s()-]/g, '');

  if (phone.startsWith('+98')) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith('0098')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('98') && phone.length === 12) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
}

export function isValidIranianPhone(value: string): boolean {
  return /^09\d{9}$/.test(normalizeIranianPhone(value));
}
