import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL_NO_SSL,
  ].filter((value): value is string => !!value && value.trim().length > 0);

  const databaseUrl = candidates[0];
  if (!databaseUrl) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL or connect a Vercel Postgres/Neon database.",
    );
  }

  return databaseUrl;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: process.env.POSTGRES_URL_NO_SSL ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

let initializationPromise: Promise<void> | null = null;

export function initializeDatabase(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        youtube_url TEXT NOT NULL,
        youtube_identifier TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        youtube_video_id TEXT NOT NULL UNIQUE,
        channel_id INTEGER NOT NULL REFERENCES channels(id),
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        youtube_url TEXT NOT NULL,
        published_at TIMESTAMP NOT NULL,
        category TEXT NOT NULL,
        transcript_text TEXT,
        transcript_source TEXT,
        summary_bullets JSONB,
        duration_seconds INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP,
        status TEXT NOT NULL,
        videos_found INTEGER DEFAULT 0,
        videos_created INTEGER DEFAULT 0,
        videos_updated INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        log_text TEXT
      );
    `);
  })();

  return initializationPromise;
}
