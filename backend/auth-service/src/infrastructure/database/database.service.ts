import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {
    this.initializePool();
  }

  private initializePool(): void {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const database = this.configService.get<string>('DB_NAME', 'auth');
    const user = this.configService.get<string>('DB_USER', 'auth');
    const password = this.configService.get<string>('DB_PASSWORD', 'auth_password');
    const max = this.configService.get<number>('DB_POOL_SIZE', 10);

    this.pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error(`Unexpected database pool error: ${err.message}`, err.stack);
    });

    this.logger.log(`Database pool initialized: ${host}:${port}/${database}`);
  }

  async getConnection(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }
}
