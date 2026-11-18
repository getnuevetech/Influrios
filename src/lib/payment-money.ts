/**
 * Payment Standard money: dollars with two decimal places.
 * Public values are never expressed in cents. Arithmetic uses a private
 * hundredths scale so floating-point cannot corrupt totals.
 */

export type Dollar = string & { readonly __dollar: unique symbol };

const DOLLAR_RE = /^-?\d+\.\d{2}$/;

function asDollar(value: string): Dollar {
  if (!DOLLAR_RE.test(value)) {
    throw new Error(`Money must be dollars with exactly two decimals (got ${JSON.stringify(value)}).`);
  }
  return value as Dollar;
}

/** Private scale: 1 dollar = 100 hundredths. Never export as "cents". */
function toHundredths(amount: Dollar): number {
  const negative = amount.startsWith("-");
  const raw = negative ? amount.slice(1) : amount;
  const [whole, fraction] = raw.split(".");
  const units = Number(whole) * 100 + Number(fraction);
  return negative ? -units : units;
}

function fromHundredths(units: number): Dollar {
  if (!Number.isInteger(units)) {
    throw new Error("Money scale must stay on whole hundredths.");
  }
  const negative = units < 0;
  const abs = Math.abs(units);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return asDollar(`${negative ? "-" : ""}${whole}.${fraction}`);
}

/** Parse user/admin input into a Dollar. Accepts 19, 19.5, 19.50, $19.50. */
export function parseDollar(input: string | number): Dollar {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Money amount is not finite.");
    return fromHundredths(Math.round(input * 100));
  }
  const cleaned = input.trim().replace(/,/g, "").replace(/^\$/, "");
  if (!cleaned) throw new Error("Money amount is required.");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Money amount is not a valid dollar value: ${JSON.stringify(input)}`);
  }
  const [whole, fraction = "0"] = cleaned.split(".");
  return asDollar(`${whole}.${fraction.padEnd(2, "0")}`);
}

export function dollar(input: string | number): Dollar {
  return parseDollar(input);
}

export function isDollar(value: unknown): value is Dollar {
  return typeof value === "string" && DOLLAR_RE.test(value);
}

export function zeroDollar(): Dollar {
  return asDollar("0.00");
}

export function addDollars(...amounts: Dollar[]): Dollar {
  return fromHundredths(amounts.reduce((sum, amount) => sum + toHundredths(amount), 0));
}

export function subDollars(left: Dollar, right: Dollar): Dollar {
  return fromHundredths(toHundredths(left) - toHundredths(right));
}

export function mulDollarByRatio(amount: Dollar, numerator: number, denominator: number): Dollar {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error("Ratio must use positive integer denominator.");
  }
  return fromHundredths(Math.trunc((toHundredths(amount) * numerator) / denominator));
}

export function compareDollars(left: Dollar, right: Dollar): number {
  return toHundredths(left) - toHundredths(right);
}

export function dollarsEqual(left: Dollar, right: Dollar): boolean {
  return toHundredths(left) === toHundredths(right);
}

export function sumDollars(amounts: readonly Dollar[]): Dollar {
  return addDollars(...amounts);
}

/**
 * Deterministic largest-remainder split over dollar amounts.
 * Weights are basis points that must total 10_000 (100%).
 * Residual hundredths go to earlier shares with the largest remainders.
 */
export function allocateDollarsByWeight(total: Dollar, weightsBps: number[]): Dollar[] | null {
  const units = toHundredths(total);
  if (units < 0) return null;
  if (weightsBps.length === 0) return null;
  if (weightsBps.some((weight) => !Number.isInteger(weight) || weight < 0)) return null;
  if (weightsBps.reduce((sum, weight) => sum + weight, 0) !== 10_000) return null;
  if (units === 0) return weightsBps.map(() => zeroDollar());

  const amounts = weightsBps.map((weight) => Math.floor((units * weight) / 10_000));
  let left = units - amounts.reduce((sum, amount) => sum + amount, 0);
  const order = weightsBps
    .map((weight, index) => ({ index, remainder: (units * weight) % 10_000 }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of order) {
    if (left <= 0) break;
    amounts[row.index] += 1;
    left -= 1;
  }
  if (left !== 0 || amounts.reduce((sum, amount) => sum + amount, 0) !== units) return null;
  return amounts.map(fromHundredths);
}

export function formatDollar(amount: Dollar, currency = "USD"): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/** Adapter bridge only: providers that require minor units. Not a domain field. */
export function dollarToProviderMinorUnits(amount: Dollar): number {
  return toHundredths(amount);
}

export function providerMinorUnitsToDollar(units: number): Dollar {
  return fromHundredths(units);
}
