import pg from "pg";
import bcrypt from "bcryptjs";
import { nanoid } from "./utils.js";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) throw new Error("Database not initialized");
  return pool;
}

export async function initDb() {
  const isRailway = process.env.DATABASE_URL?.includes("railway.internal") || 
                    process.env.DATABASE_URL?.includes("rlwy.net");
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRailway ? false : { rejectUnauthorized: false },
  });

  await pool.query("SELECT 1");
  console.log("✅ PostgreSQL connected");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'company',
      company_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT 'Other',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      api_key TEXT UNIQUE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      issue_type TEXT DEFAULT '',
      date TEXT DEFAULT '',
      time TEXT DEFAULT '',
      city TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      source TEXT NOT NULL DEFAULT 'Manual',
      is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      company_id TEXT NOT NULL,
      booking_id TEXT,
      action TEXT NOT NULL,
      customer_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT DEFAULT '',
      content TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      author TEXT DEFAULT 'TriTech Forge Team',
      published BOOLEAN NOT NULL DEFAULT FALSE,
      cover_color TEXT DEFAULT 'from-blue-600 to-indigo-800',
      image_url TEXT,
      published_at TEXT,
      reading_time INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const adminUsername = process.env.ADMIN_USERNAME || "superadmin";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
  const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", [adminUsername]);

  if (rows.length === 0) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    await pool.query(
      "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, 'superadmin')",
      [nanoid(), adminUsername, hash]
    );
    console.log(`✅ Superadmin created: ${adminUsername}`);
  }

  console.log("✅ Database initialized");
}
