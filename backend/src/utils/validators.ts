export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

export function isValidGSTIN(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());
}

export function isValidTAN(tan: string): boolean {
  return /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/.test(tan.toUpperCase());
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));
}

export function sanitizeGSTIN(gstin: string): string {
  return gstin.replace(/\s/g, '').toUpperCase();
}

export function sanitizePAN(pan: string): string {
  return pan.replace(/\s/g, '').toUpperCase();
}

export function generateClientCode(prefix = 'CL'): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}`;
}
