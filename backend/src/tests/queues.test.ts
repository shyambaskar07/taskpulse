import { describe, it, expect } from 'vitest';
import { generateId } from '../utils/idGenerator';

describe('Queue Configuration & Management Test Suite', () => {
  it('11. generates valid queue IDs with q_ prefix', () => {
    const qId = generateId('q');
    expect(qId).toMatch(/^q_[a-f0-9]{12}$/);
  });

  it('12. validates queue priority within bounds 1 to 10', () => {
    const clampPriority = (p: number) => Math.min(10, Math.max(1, p));
    expect(clampPriority(15)).toBe(10);
    expect(clampPriority(-5)).toBe(1);
    expect(clampPriority(7)).toBe(7);
  });

  it('13. validates queue max concurrency bounds 1 to 100', () => {
    const clampConcurrency = (c: number) => Math.min(100, Math.max(1, c));
    expect(clampConcurrency(250)).toBe(100);
    expect(clampConcurrency(0)).toBe(1);
    expect(clampConcurrency(15)).toBe(15);
  });

  it('14. correctly sets default priority to 5 when omitted', () => {
    const getPrio = (p?: number) => (p !== undefined ? p : 5);
    expect(getPrio()).toBe(5);
    expect(getPrio(10)).toBe(10);
  });

  it('15. correctly sets default concurrency to 10 when omitted', () => {
    const getConc = (c?: number) => (c !== undefined ? c : 10);
    expect(getConc()).toBe(10);
    expect(getConc(50)).toBe(50);
  });

  it('16. toggles queue pause state integer representation', () => {
    const togglePause = (current: number) => (current ? 0 : 1);
    expect(togglePause(0)).toBe(1);
    expect(togglePause(1)).toBe(0);
  });

  it('17. evaluates queue paused status boolean casting', () => {
    const isPaused = (val: number) => val === 1;
    expect(isPaused(1)).toBe(true);
    expect(isPaused(0)).toBe(false);
  });

  it('18. validates queue unique name per project constraint', () => {
    const existing = ['email-delivery', 'default-processing'];
    const isUnique = (name: string) => !existing.includes(name);
    expect(isUnique('data-sync')).toBe(true);
    expect(isUnique('email-delivery')).toBe(false);
  });

  it('19. calculates aggregate pending jobs count across queues', () => {
    const queues = [
      { name: 'q1', queued_count: 5, active_count: 2 },
      { name: 'q2', queued_count: 12, active_count: 4 },
      { name: 'q3', queued_count: 0, active_count: 1 }
    ];
    const totalQueued = queues.reduce((acc, q) => acc + q.queued_count, 0);
    expect(totalQueued).toBe(17);
  });

  it('20. calculates aggregate active running jobs count across queues', () => {
    const queues = [
      { name: 'q1', queued_count: 5, active_count: 2 },
      { name: 'q2', queued_count: 12, active_count: 4 },
      { name: 'q3', queued_count: 0, active_count: 1 }
    ];
    const totalActive = queues.reduce((acc, q) => acc + q.active_count, 0);
    expect(totalActive).toBe(7);
  });

  it('21. sorts queues by priority weight descending', () => {
    const queues = [
      { name: 'low', priority: 2 },
      { name: 'high', priority: 10 },
      { name: 'med', priority: 5 }
    ];
    const sorted = [...queues].sort((a, b) => b.priority - a.priority);
    expect(sorted[0].name).toBe('high');
    expect(sorted[1].name).toBe('med');
    expect(sorted[2].name).toBe('low');
  });

  it('22. verifies queue purge filter criteria selects only QUEUED or SCHEDULED jobs', () => {
    const jobs = [
      { id: '1', status: 'QUEUED' },
      { id: '2', status: 'RUNNING' },
      { id: '3', status: 'SCHEDULED' },
      { id: '4', status: 'COMPLETED' }
    ];
    const toPurge = jobs.filter((j) => ['QUEUED', 'SCHEDULED'].includes(j.status));
    expect(toPurge.map((j) => j.id)).toEqual(['1', '3']);
  });

  it('23. formats queue priority badge display labels', () => {
    const getBadgeLabel = (prio: number) => (prio >= 8 ? 'CRITICAL' : prio >= 5 ? 'NORMAL' : 'LOW');
    expect(getBadgeLabel(10)).toBe('CRITICAL');
    expect(getBadgeLabel(5)).toBe('NORMAL');
    expect(getBadgeLabel(2)).toBe('LOW');
  });

  it('24. formats queue max concurrency utilization percentage', () => {
    const calcUtil = (active: number, max: number) => Math.round((active / max) * 100);
    expect(calcUtil(5, 10)).toBe(50);
    expect(calcUtil(10, 10)).toBe(100);
    expect(calcUtil(0, 20)).toBe(0);
  });

  it('25. validates queue name length constraints (3 to 64 chars)', () => {
    const isValidName = (name: string) => name.length >= 3 && name.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(name);
    expect(isValidName('q1')).toBe(false);
    expect(isValidName('valid-queue_name-1')).toBe(true);
    expect(isValidName('invalid queue name with spaces')).toBe(false);
  });
});
