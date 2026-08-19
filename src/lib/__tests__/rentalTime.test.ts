import { describe, it, expect } from 'vitest';
import { formatRentalPeriod, rentalHours, rentalDays, discountPercentForHours, formatTime, formatDuration } from '@/lib/rentalTime';

describe('rentalTime', () => {
  describe('formatRentalPeriod', () => {
    it('formats a rental period with dates only', () => {
      const result = formatRentalPeriod('2026-08-20', '2026-08-25');
      expect(result).toContain('Aug');
      expect(result).toContain('2026');
    });

    it('formats a rental period with times', () => {
      const result = formatRentalPeriod('2026-08-20', '2026-08-25', '10:00', '14:00');
      expect(result).toContain('10:00 AM');
      expect(result).toContain('2:00 PM');
    });
  });

  describe('rentalHours', () => {
    it('calculates hours between dates', () => {
      const hours = rentalHours('2026-08-20', '2026-08-21', '10:00', '10:00');
      expect(hours).toBe(24);
    });

    it('returns minimum 1 hour', () => {
      const hours = rentalHours('2026-08-20', '2026-08-20', '10:00', '10:00');
      expect(hours).toBe(1);
    });
  });

  describe('rentalDays', () => {
    it('calculates inclusive days', () => {
      const days = rentalDays('2026-08-20', '2026-08-25');
      expect(days).toBe(6);
    });
  });

  describe('discountPercentForHours', () => {
    it('returns 0 for less than 7 days', () => {
      expect(discountPercentForHours(48)).toBe(0);
    });

    it('returns 10 for 7+ days', () => {
      expect(discountPercentForHours(168)).toBe(10);
    });

    it('returns 20 for 30+ days', () => {
      expect(discountPercentForHours(720)).toBe(20);
    });
  });

  describe('formatTime', () => {
    it('formats 24h to 12h', () => {
      expect(formatTime('09:00')).toBe('9:00 AM');
      expect(formatTime('14:30')).toBe('2:30 PM');
      expect(formatTime('00:00')).toBe('12:00 AM');
    });

    it('returns empty for null/undefined', () => {
      expect(formatTime(null)).toBe('');
      expect(formatTime(undefined)).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('formats hours only', () => {
      expect(formatDuration(12)).toBe('12 hrs');
    });

    it('formats days and hours', () => {
      expect(formatDuration(36)).toBe('1 d 12 hrs');
    });

    it('formats days only', () => {
      expect(formatDuration(48)).toBe('2 d');
    });
  });
});
