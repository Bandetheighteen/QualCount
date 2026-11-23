/**
 * India-aware Rupee currency formatting utilities.
 */

export function formatRupee(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatRupeeCompact(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || amount === 0) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) {
    const cr = abs / 10000000;
    return `${sign}₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (abs >= 100000) {
    const l = abs / 100000;
    return `${sign}₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(0)}k`;
  }
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}
