import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";
import bcrypt from "bcryptjs";
import { nanoid } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "../data");
const DB_PATH = join(DATA_DIR, "tritech.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, {
  users: [],
  companies: [],
  bookings: [],
  activity: [],
});

export async function initDb() {
  await db.read();

  // Ensure all collections exist
  db.data.users ??= [];
  db.data.companies ??= [];
  db.data.bookings ??= [];
  db.data.activity ??= [];
  db.data.blogPosts ??= [];

  // Seed superadmin
  const adminUsername = process.env.ADMIN_USERNAME || "superadmin";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
  const existing = db.data.users.find(u => u.username === adminUsername);

  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.data.users.push({
      id: nanoid(),
      username: adminUsername,
      passwordHash: hash,
      role: "superadmin",
      companyId: null,
      createdAt: new Date().toISOString(),
    });
    await db.write();
    console.log(`✅ Superadmin created: ${adminUsername}`);
  }

  console.log("✅ Database initialized:", DB_PATH);
}

export function getDb() {
  return db;
}
