export function normalizeCustomerPin(pin: string): string {
  return (pin ?? '').replace(/\s+/g, '').toUpperCase();
}

export function validateCustomerPin(pin: string): string | null {
  const normalized = normalizeCustomerPin(pin);
  if (!normalized) return 'Customer PIN is required.';
  if (normalized.length < 4) return 'Customer PIN must be at least 4 characters.';
  return null;
}
