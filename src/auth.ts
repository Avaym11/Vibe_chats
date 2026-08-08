import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'genz-vibesphere-super-secret-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    avatar_url: string;
    vibe_tag: string;
    status_message: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    req.user = decoded as any;
    next();
  });
}

export async function handleRegister(req: Request, res: Response) {
  try {
    const { username, email, password, avatar_url, bio, vibe_tag, status_message } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
    }

    // Check existing
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email is already taken.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const defaultAvatar = avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
    const defaultVibe = vibe_tag || '✨ Main Character';
    const defaultStatus = status_message || 'Vibing in VibeSphere ⚡';

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, avatar_url, bio, vibe_tag, status_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, avatar_url, bio, vibe_tag, status_message, created_at`,
      [username, email, password_hash, defaultAvatar, bio || '', defaultVibe, defaultStatus]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url, vibe_tag: user.vibe_tag, status_message: user.status_message },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Server error during registration' });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [usernameOrEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url, vibe_tag: user.vibe_tag, status_message: user.status_message },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Logged in successfully!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        bio: user.bio,
        vibe_tag: user.vibe_tag,
        status_message: user.status_message,
        created_at: user.created_at
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error during login' });
  }
}

export async function handleGetProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await pool.query(
      'SELECT id, username, email, avatar_url, bio, vibe_tag, status_message, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleUpdateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { bio, vibe_tag, status_message, avatar_url } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET bio = COALESCE($1, bio),
           vibe_tag = COALESCE($2, vibe_tag),
           status_message = COALESCE($3, status_message),
           avatar_url = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id, username, email, avatar_url, bio, vibe_tag, status_message, created_at`,
      [bio, vibe_tag, status_message, avatar_url, req.user.id]
    );

    const updatedUser = result.rows[0];
    const newToken = jwt.sign(
      {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        vibe_tag: updatedUser.vibe_tag,
        status_message: updatedUser.status_message
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Profile updated!', user: updatedUser, token: newToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
