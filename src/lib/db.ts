
import { Pool } from "pg";

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        // Cloud PostgreSQL (Neon)
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 10000,
      }
    : {
        // Local PostgreSQL
        host: process.env.PGHOST ?? "127.0.0.1",
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
      }
);

export default pool;
