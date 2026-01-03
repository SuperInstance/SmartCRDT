/**
 * Sample TypeScript file for import parsing tests
 * Demonstrates various import patterns and dependencies
 */

import { Injectable, Logger } from '@core/decorators';
import { Config, ConfigManager } from '@core/config';
import { HttpClient } from '@utils/http';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { join } from 'path';

// Dynamic import
const loadModule = async (moduleName: string) => {
  const module = await import(moduleName);
  return module.default;
};

// Internal imports
import { UserService } from './services/UserService';
import { validateEmail, validatePhone } from './utils/validators';
import { APIError } from './errors';

export interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone: string;
}

@Injectable()
export class UserController {
  private readonly logger: Logger;
  private readonly config: Config;
  private readonly http: HttpClient;

  constructor(
    private userService: UserService,
    configManager: ConfigManager
  ) {
    this.logger = new Logger('UserController');
    this.config = configManager.getConfig();
    this.http = new HttpClient(this.config);
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone }: CreateUserRequest = req.body;

      // Validate input
      if (!validateEmail(email)) {
        throw new APIError('Invalid email format', 400);
      }

      if (!validatePhone(phone)) {
        throw new APIError('Invalid phone format', 400);
      }

      // Create user
      const userData: UserData = await this.userService.create({
        name,
        email,
        phone
      });

      this.logger.info(`User created: ${userData.id}`);

      res.status(201).json({
        success: true,
        data: userData
      });
    } catch (error) {
      this.logger.error('Error creating user', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const userData = await this.userService.findById(id);

      if (!userData) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      this.logger.error('Error getting user', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async importUsersFromFile(filePath: string): Promise<void> {
    try {
      const absolutePath = join(process.cwd(), filePath);
      const fileContent = await fs.promises.readFile(absolutePath, 'utf-8');
      const users = JSON.parse(fileContent);

      for (const user of users) {
        await this.userService.create(user);
      }

      this.logger.info(`Imported ${users.length} users from file`);
    } catch (error) {
      this.logger.error('Error importing users', error);
      throw error;
    }
  }
}
