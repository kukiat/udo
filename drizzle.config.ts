import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Migrations run over the direct connection (port 5432), falling back to
// DATABASE_URL if DIRECT_URL is not set.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: url!,
  },
});
