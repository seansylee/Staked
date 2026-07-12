import { daysUntilWindowEnd, hoursUntilWindowEnd, nextWindowBoundary, windowEndLabel } from '@/utils/dates';

// The financial boundary is UTC midnight; these tests must pass under any
// runtime timezone (run with TZ=UTC, TZ=America/Los_Angeles, TZ=Pacific/Kiritimati).

describe('nextWindowBoundary', () => {
  it('daily window closes at the next UTC midnight', () => {
    const ref = new Date('2024-01-03T15:30:00Z');
    expect(nextWindowBoundary('daily', ref).toISOString()).toBe('2024-01-04T00:00:00.000Z');
  });

  it('weekly window closes at the next ISO-week Monday, UTC midnight', () => {
    const wednesday = new Date('2024-01-03T15:30:00Z');
    expect(nextWindowBoundary('weekly', wednesday).toISOString()).toBe('2024-01-08T00:00:00.000Z');
  });

  it('weekly boundary just before Monday UTC midnight stays in the current week', () => {
    const sundayNight = new Date('2024-01-07T23:59:59Z');
    expect(nextWindowBoundary('weekly', sundayNight).toISOString()).toBe('2024-01-08T00:00:00.000Z');
  });

  it('monthly window closes at the first of the next month, UTC midnight', () => {
    const ref = new Date('2024-01-15T12:00:00Z');
    expect(nextWindowBoundary('monthly', ref).toISOString()).toBe('2024-02-01T00:00:00.000Z');
  });
});

describe('hoursUntilWindowEnd / daysUntilWindowEnd', () => {
  it('counts hours to the UTC boundary regardless of runtime timezone', () => {
    const ref = new Date('2024-01-03T18:00:00Z');
    expect(hoursUntilWindowEnd('daily', ref)).toBe(6);
  });

  it('returns 0 days on the last day of a weekly window', () => {
    const sundayNoonUtc = new Date('2024-01-07T12:00:00Z');
    expect(daysUntilWindowEnd('weekly', sundayNoonUtc)).toBe(0);
  });
});

describe('windowEndLabel', () => {
  it('gives a concrete clock time when the boundary is within a day', () => {
    const ref = new Date('2024-01-03T18:00:00Z');
    const label = windowEndLabel('daily', ref);
    expect(label).toMatch(/^(midnight|\d{1,2}(:\d{2})? (AM|PM))( tomorrow)?$/);
  });

  it('gives a day name and time when the boundary is within a week', () => {
    const wednesday = new Date('2024-01-03T15:30:00Z');
    const label = windowEndLabel('weekly', wednesday);
    expect(label).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (midnight|\d{1,2}(:\d{2})? (AM|PM))$/);
  });

  it('gives a calendar date when the boundary is further out', () => {
    const ref = new Date('2024-01-05T12:00:00Z');
    const label = windowEndLabel('monthly', ref);
    expect(label).toMatch(/^(Jan|Feb) \d{1,2}$/);
  });
});
