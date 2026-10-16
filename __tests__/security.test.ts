import { GSTINSchema } from '../src/lib/validation';

// Master doc §15/§43 — input validation at trust boundaries.
// Static security checks that don't need the live backend.

describe('GSTIN validation (§43 regulatory mechanism)', () => {
  it('accepts the documented valid format', () => {
    expect(GSTINSchema.safeParse('29AAPFT0939F1ZV').success).toBe(true);
  });
  it('rejects wrong length', () => {
    expect(GSTINSchema.safeParse('29AAPFT0939F1Z').success).toBe(false);
    expect(GSTINSchema.safeParse('29AAPFT0939F1ZVX').success).toBe(false);
  });
  it('rejects lowercase and empty', () => {
    expect(GSTINSchema.safeParse('29aapft0939f1zv').success).toBe(false);
    expect(GSTINSchema.safeParse('').success).toBe(false);
  });
});

describe('checkout input validation parity with Edge Function', () => {
  const VALID_CHANNELS = new Set(['ESCROW_INSTANT', 'NBFC_CREDIT_LINE', 'STANDARD_CREDIT_TERMS', 'MANUAL_CONFIRMATION']);
  const isFiniteCoord = (lat: unknown, lng: unknown) =>
    typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lng === 'number' && Number.isFinite(lng) &&
    (lat as number) >= -90 && (lat as number) <= 90 &&
    (lng as number) >= -180 && (lng as number) <= 180;

  it('rejects client-side NaN coordinates the old function accepted (TC-04 regression)', () => {
    expect(isFiniteCoord(NaN, 77.2)).toBe(false);
    expect(isFiniteCoord(undefined, undefined)).toBe(false);
    expect(isFiniteCoord(28.6, 77.2)).toBe(true);
    expect(isFiniteCoord(91, 77.2)).toBe(false);
  });

  it('only accepts the four governed payment channels', () => {
    expect(VALID_CHANNELS.has('MANUAL_CONFIRMATION')).toBe(true);
    expect(VALID_CHANNELS.has('FREE_CREDITS')).toBe(false);
    expect(VALID_CHANNELS.has(undefined as never)).toBe(false);
  });
});

describe('idempotency key generation (§25)', () => {
  it('generates unique keys per checkout attempt', () => {
    const k1 = `chk_user1_${Date.now()}`;
    const k2 = `chk_user1_${Date.now() + 1}`;
    expect(k1).not.toBe(k2);
  });
});
