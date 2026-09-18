export function formatNumber(value: number | undefined | null) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  // Use up to 3 decimal places for quantities (e.g., 1.500 kg)
  return safeValue.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export function formatWholeNumber(value: number | undefined | null) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.round(safeValue).toLocaleString('en-IN');
}

export function formatMoney(value: number | undefined | null) {
  // Assuming money is also displayed as whole numbers in this app, or change if needed.
  return formatWholeNumber(value);
}

export function formatPercent(value: number | undefined | null) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  // Let percentages have 1 decimal if needed
  return safeValue.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

export function cleanWholeNumberInput(value: string) {
  // This was stripping decimals entirely: value.split('.')[0]
  // If we want to allow decimals for manual quantity input, we need a new function.
  return value.split('.')[0].replace(/\D/g, '');
}

export function cleanNumberInput(value: string) {
  // Allow numbers and a single decimal point
  const clean = value.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return clean;
}

export function parseWholeNumberInput(value: string) {
  const cleanValue = cleanWholeNumberInput(value);
  return cleanValue ? Number(cleanValue) : 0;
}

export function parseNumberInput(value: string) {
  const cleanValue = cleanNumberInput(value);
  return cleanValue ? Number(cleanValue) : 0;
}
