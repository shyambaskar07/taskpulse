import { Router, Request, Response } from 'express';
import { queryOne, query } from '../db/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateId } from '../utils/idGenerator';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'taskpulse_jwt_secret_dev_key';

authRouter.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await queryOne(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

authRouter.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const userId = generateId('usr');
  const passwordHash = bcrypt.hashSync(password, 10);
  const userRole = role || 'OPERATOR';

  await query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)`,
    [userId, email, passwordHash, name, userRole]
  );

  const token = jwt.sign(
    { userId, email, role: userRole, name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(201).json({
    token,
    user: { id: userId, email, name, role: userRole }
  });
});
