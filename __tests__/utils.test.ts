import { formatCurrency, formatDate, formatExpiry, getOrderStateColor, calculateDistanceKm, isOnline } from '../src/lib/utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format INR currency correctly', () => {
      expect(formatCurrency(100)).toContain('100');
      expect(formatCurrency(1234.56)).toContain('1,234.56');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toContain('0');
    });

    it('should handle negative values', () => {
      expect(formatCurrency(-500)).toContain('500');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const result = formatDate('2026-01-15T00:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('2026');
    });
  });

  describe('formatExpiry', () => {
    it('should show "Expired" for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      expect(formatExpiry(past.toISOString())).toBe('Expired');
    });

    it('should show days left for near expiry', () => {
      const future = new Date();
      future.setDate(future.getDate() + 15);
      const result = formatExpiry(future.toISOString());
      expect(result).toMatch(/d left/);
    });

    it('should show months left for medium expiry', () => {
      const future = new Date();
      future.setDate(future.getDate() + 90);
      const result = formatExpiry(future.toISOString());
      expect(result).toMatch(/mo left/);
    });

    it('should show years left for far expiry', () => {
      const future = new Date();
      future.setDate(future.getDate() + 400);
      const result = formatExpiry(future.toISOString());
      expect(result).toMatch(/y left/);
    });
  });

  describe('getOrderStateColor', () => {
    it('should return safe for settled/confirmed states', () => {
      expect(getOrderStateColor('SETTLED')).toBe('safe');
      expect(getOrderStateColor('DELIVERED_CONFIRMED')).toBe('safe');
      expect(getOrderStateColor('REFUNDED')).toBe('safe');
    });

    it('should return danger for disputed', () => {
      expect(getOrderStateColor('DISPUTED')).toBe('danger');
    });

    it('should return pending for in-progress states', () => {
      expect(getOrderStateColor('POOLING_ACTIVE')).toBe('pending');
      expect(getOrderStateColor('DISPATCHED')).toBe('pending');
      expect(getOrderStateColor('DELIVERED_PENDING_SCAN')).toBe('pending');
    });
  });

  describe('calculateDistanceKm', () => {
    it('should return 0 for same coordinates', () => {
      expect(calculateDistanceKm(28.6, 77.2, 28.6, 77.2)).toBe(0);
    });

    it('should calculate distance between two cities correctly', () => {
      const dist = calculateDistanceKm(28.6139, 77.2090, 19.0760, 72.8777);
      // Delhi to Mumbai is approximately 1150km
      expect(dist).toBeGreaterThan(1100);
      expect(dist).toBeLessThan(1200);
    });
  });

  describe('isOnline', () => {
    it('should return true when connected', () => {
      expect(isOnline({ isConnected: true })).toBe(true);
    });

    it('should return false when disconnected', () => {
      expect(isOnline({ isConnected: false })).toBe(false);
    });

    it('should return true for null state', () => {
      expect(isOnline(null)).toBe(true);
    });
  });
});
