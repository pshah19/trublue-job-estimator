// Money helpers. Values are dollars; every line item is rounded to cents
// so results are deterministic and reproducible.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Round a price UP to the nearest increment (e.g. $5) so rounding never erodes margin. */
export function roundUpTo(n: number, increment: number): number {
  if (!increment || increment <= 0) return round2(n);
  return round2(Math.ceil(round2(n) / increment - 1e-9) * increment);
}

export function sum(values: number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}

export function pct(n: number): number {
  return Math.round(n * 1000) / 10; // 0.4567 → 45.7
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function fmtMoney(n: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function fmtPct(fraction: number): string {
  return `${pct(fraction).toFixed(1)}%`;
}
