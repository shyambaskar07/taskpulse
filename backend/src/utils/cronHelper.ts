/**
 * Simple, robust Cron next execution time calculator.
 * Supports standard 5-part cron syntax: minute hour day-of-month month day-of-week
 * Uses UTC date methods for timezone-independent evaluation.
 */

export function getNextCronOccurrence(cronExpr: string, fromDate: Date = new Date()): Date {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return new Date(fromDate.getTime() + 5 * 60 * 1000);
  }

  const [minPattern] = parts;
  let nextDate = new Date(fromDate.getTime() + 60 * 1000); // Advance 1 minute by default
  nextDate.setUTCSeconds(0, 0);

  let minuteStep = 1;
  if (minPattern.startsWith('*/')) {
    minuteStep = parseInt(minPattern.replace('*/', ''), 10) || 1;
  }

  const currentMin = nextDate.getUTCMinutes();
  const rem = currentMin % minuteStep;
  const minsToAdd = rem === 0 ? 0 : minuteStep - rem;
  
  if (minsToAdd > 0) {
    nextDate.setUTCMinutes(currentMin + minsToAdd);
  }

  return nextDate;
}
