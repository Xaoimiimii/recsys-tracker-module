import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { Pool } from 'pg';
// import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';

// dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient {
    constructor(config: ConfigService) {
        const pool = new Pool({
            connectionString: config.get<string>('DATABASE_URL'),
        });
        const adapter = new PrismaPg(pool, { schema: 'webconfig' });
        super({ adapter });
    }
}