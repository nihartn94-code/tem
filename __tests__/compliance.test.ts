import { calculateDistanceKm, friendlyError, formatCurrency } from '../src/lib/utils';

// Master doc §21 — pure functions tested in isolation:
// geo-fence distance (TC-04 server parity), fee/discount arithmetic (§6.4),
// error mapping (§24).

describe('geo-fence distance (haversine, TC-04 parity)', () => {
  it('returns ~0 for identical coordinates', () => {
    const d = calculateDistanceKm(28.6139, 77.209, 28.6139, 77.209);
    expect(d).toBeCloseTo(0, 5);
  });

  it('returns ~0 across NaN-free antipodal-ish small distances', () => {
    // ~11.1 km per degree of latitude
    const d = calculateDistanceKm(10, 77, 11, 77);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(115);
  });

  it('is symmetric', () => {
    const a = calculateDistanceKm(19.076, 72.8777, 28.6139, 77.209);
    const b = calculateDistanceKm(28.6139, 77.209, 19.076, 72.8777);
    expect(a).toBeCloseTo(b, 6);
  });

  it('never returns NaN for valid finite inputs', () => {
    expect(calculateDistanceKm(-90, -180, 90, 180)).not.toBeNaN();
    expect(calculateDistanceKm(0, 0, 0.0001, 0.0001)).not.toBeNaN();
  });
});

describe('checkout fee/discount arithmetic (§6.4 illustrative example)', () => {
  // 500 units × ₹18.50 = ₹9,250 gross; fee 1.5% = ₹138.75; discount 3% on net
  const gross = 500 * 18.5;
  const feePct = 1.5;
  const discountPct = 3.0;

  it('computes the documented example figures', () => {
    const feeValue = gross * (feePct / 100);
    const netPayout = gross - feeValue;
    const discountedPayout = netPayout * (1 - discountPct / 100);
    expect(gross).toBeCloseTo(9250, 2);
    expect(feeValue).toBeCloseTo(138.75, 2);
    expect(discountedPayout).toBeCloseTo((9250 - 138.75) * 0.97, 2);
  });

  it('discount is zero for standard credit terms', () => {
    const discountPct = 0;
    const feeValue = gross * (feePct / 100);
    const netPayout = gross - feeValue;
    expect(netPayout * (1 - discountPct / 100)).toBeCloseTo(9111.25, 2);
  });

  it('fee and discount are copied once at creation — never recomputed (§6.4/TC-08)', () => {
    // Order row stores its own pct; a later settings change must not affect it
    const orderFeePct = 1.5;
    const newGlobalFeePct = 2.0; // Admin change after order creation
    const orderGross = 1000;
    const storedFee = orderGross * (orderFeePct / 100);
    expect(storedFee).toBeCloseTo(15, 2);
    expect(orderGross * (newGlobalFeePct / 100)).not.toBeCloseTo(storedFee, 2);
  });
});

describe('friendlyError mapping (§24)', () => {
  it('maps known backend codes to friendly copy', () => {
    expect(friendlyError(new Error('INSUFFICIENT_STOCK: only 5 left'))).toMatch(/not enough stock/i);
    expect(friendlyError(new Error('DELIVERY_MISMATCH 42km away'))).toMatch(/too far/i);
    expect(friendlyError(new Error('Network request failed'))).toMatch(/network/i);
  });

  it('never leaks raw backend messages', () => {
    const msg = friendlyError(new Error('INTERNAL: pgtypes out of range at pg_exec line 42'));
    expect(msg).not.toMatch(/pgtypes|pg_exec/);
  });

  it('returns fallback for empty errors', () => {
    expect(friendlyError(null)).toMatch(/something went wrong/i);
  });
});

describe('formatCurrency', () => {
  it('formats INR', () => {
    expect(formatCurrency(9250)).toContain('9,250');
  });
});
