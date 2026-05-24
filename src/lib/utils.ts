export type BranchSettings = {
  maxKdsScreens: number;
  vatRate: number;
  serviceChargeRate: number;
};

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
