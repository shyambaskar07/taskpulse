import { randomUUID } from 'crypto';

export function generateId(prefix: string = ''): string {
  const uuid = randomUUID().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}_${uuid}` : uuid;
}
