export type BranchSettings = {
  maxKdsScreens: number;
  vatRate: number;
  serviceChargeRate: number;
};

// Wraps an async operation so its wall-clock duration is logged. The scope acts
// as a correlation id so overlapping logs (e.g. concurrent requests) stay
// readable.
export type Timed = <T>(label: string, fn: () => Promise<T>) => Promise<T>;

export function makeTimer(scope: string): Timed {
  return async (label, fn) => {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const ms = (performance.now() - start).toFixed(1);
      console.log(`[${scope}] ${label}: ${ms}ms`);
    }
  };
}

const THB = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

/** Format a numeric amount (string from Drizzle numeric, or number) as currency. */
export function formatPrice(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return THB.format(Number.isFinite(value) ? value : 0);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcVat(subtotal: number, rate: number): number {
  return round2(subtotal * rate);
}

export function calcServiceCharge(subtotal: number, rate: number): number {
  return round2(subtotal * rate);
}

export type BillTotals = {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  discount: number;
  total: number;
};

/**
 * Compute bill totals. Service charge applies to subtotal; VAT applies to
 * (subtotal + service charge); discount is subtracted from the final total.
 */
export function calcTotals(
  subtotal: number,
  settings: Pick<BranchSettings, "vatRate" | "serviceChargeRate">,
  discount = 0,
): BillTotals {
  const serviceCharge = calcServiceCharge(subtotal, settings.serviceChargeRate);
  const vat = calcVat(subtotal + serviceCharge, settings.vatRate);
  const total = round2(subtotal + serviceCharge + vat - discount);
  return { subtotal: round2(subtotal), serviceCharge, vat, discount, total };
}
