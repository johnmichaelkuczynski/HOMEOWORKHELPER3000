import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User, RegisterRequest, LoginRequest } from '@shared/schema';

export class AuthService {
  async register(data: RegisterRequest): Promise<User> {
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(data.username);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await storage.createUser({
      username: data.username,
      password: hashedPassword,
      tokenBalance: 0
    });

    return user;
  }

  async login(data: LoginRequest): Promise<User> {
    // Find user
    const user = await storage.getUserByUsername(data.username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password (skip for special users: jmkuczynski, randyjohnson)
    const isSpecialUser = user.username === 'jmkuczynski' || user.username === 'randyjohnson';
    
    if (!isSpecialUser) {
      if (!data.password) {
        throw new Error('Password is required');
      }
      const isValid = await bcrypt.compare(data.password, user.password);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }
    }

    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return storage.getUserById(id);
  }
}

export const authService = new AuthService();