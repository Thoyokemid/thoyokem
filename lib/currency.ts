export function toIDR(amount: number, currency: string, usdIdrRate: number): number {
  if (currency === 'USD') return amount * usdIdrRate;
  return amount;
}

export async function fetchUsdIdrRate(): Promise<number> {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return 15800;
    const data = await res.json();
    return parseFloat(data.usd_idr_rate) || 15800;
  } catch {
    return 15800;
  }
}
