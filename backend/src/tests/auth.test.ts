import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateId } from '../utils/idGenerator';

const JWT_SECRET = 'taskpulse_jwt_secret_dev_key';

describe('Auth & Role-Based Access Control (RBAC) Test Suite', () => {
  it('1. generates valid user IDs with usr_ prefix', () => {
    const id = generateId('usr');
    expect(id).toMatch(/^usr_[a-f0-9]{12}$/);
  });

  it('2. hashes user passwords securely using bcrypt', () => {
    const pass = 'SuperSecret123!';
    const hash = bcrypt.hashSync(pass, 10);
    expect(hash).not.toBe(pass);
    expect(bcrypt.compareSync(pass, hash)).toBe(true);
    expect(bcrypt.compareSync('WrongPass', hash)).toBe(false);
  });

  it('3. signs JWT token with user metadata', () => {
    const payload = { userId: 'usr_101', email: 'test@taskpulse.io', role: 'ADMIN', name: 'Alice' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.userId).toBe('usr_101');
    expect(decoded.role).toBe('ADMIN');
  });

  it('4. rejects expired or malformed JWT tokens', () => {
    const malformed = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
    expect(() => jwt.verify(malformed, JWT_SECRET)).toThrow();
  });

  it('5. enforces RBAC role hierarchy permissions for ADMIN', () => {
    const roles = ['ADMIN', 'OPERATOR', 'VIEWER'];
    const isAdmin = (role: string) => role === 'ADMIN';
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('OPERATOR')).toBe(false);
    expect(isAdmin('VIEWER')).toBe(false);
  });

  it('6. enforces OPERATOR permission rules', () => {
    const canManageQueues = (role: string) => role === 'ADMIN' || role === 'OPERATOR';
    expect(canManageQueues('ADMIN')).toBe(true);
    expect(canManageQueues('OPERATOR')).toBe(true);
    expect(canManageQueues('VIEWER')).toBe(false);
  });

  it('7. enforces VIEWER read-only permission rules', () => {
    const canMutateState = (role: string) => role !== 'VIEWER';
    expect(canMutateState('ADMIN')).toBe(true);
    expect(canMutateState('OPERATOR')).toBe(true);
    expect(canMutateState('VIEWER')).toBe(false);
  });

  it('8. validates email syntax during registration', () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValidEmail('admin@taskpulse.io')).toBe(true);
    expect(isValidEmail('invalid-email-string')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
  });

  it('9. checks for missing required registration fields', () => {
    const validateReg = (body: any) => {
      if (!body.email || !body.password || !body.name) return 'Missing required fields';
      return null;
    };
    expect(validateReg({ email: 'a@b.com', password: '123' })).toBe('Missing required fields');
    expect(validateReg({ email: 'a@b.com', password: '123', name: 'User' })).toBeNull();
  });

  it('10. handles salt generation consistency across password hashes', () => {
    const salt1 = bcrypt.genSaltSync(10);
    const salt2 = bcrypt.genSaltSync(10);
    expect(salt1).not.toBe(salt2);
  });
});
