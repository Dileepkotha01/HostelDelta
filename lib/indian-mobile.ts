export function getIndianMobileDigits(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length <= 10) return digits;
  return '';
}

export function isValidIndianMobileNumber(value: string | null | undefined): boolean {
  return /^[6-9]\d{9}$/.test(getIndianMobileDigits(value));
}

export function toIndianMobileE164(value: string | null | undefined): string {
  const digits = getIndianMobileDigits(value);
  return isValidIndianMobileNumber(digits) ? `+91${digits}` : '';
}
