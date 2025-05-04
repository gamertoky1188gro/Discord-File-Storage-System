import "dotenv/config";
import * as schema from "@shared/schema";
import { Pool } from "pg"; // Use 'import' instead of 'require'
import { drizzle } from "drizzle-orm/node-postgres"; // Use 'import' instead of 'require'

let db: any;
let pool: any;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Neon (serverless) if DATABASE_URL starts with 'postgresql' and contains 'neon.tech'
if (process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.startsWith("postgresql+neon")) {
  import("ws").then((ws) => {
    const { Pool, neonConfig } = require("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-serverless");

    neonConfig.webSocketConstructor = ws.default;
    pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    db = drizzle(pool, { schema });
  });
} else {
  // Local PostgreSQL
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { db, pool };
