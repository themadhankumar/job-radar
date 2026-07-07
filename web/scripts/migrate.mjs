import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  process.stdout.write(`applying ${file}... `);
  await client.query(readFileSync(join(dir, file), "utf8"));
  console.log("ok");
}
await client.end();
