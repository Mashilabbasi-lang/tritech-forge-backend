import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../db.js";
import { requireSuperAdmin, requireAuth } from "../middleware/auth.js";
import { nanoid, apiKeyGen } from "../utils.js";

const router = Router();

// GET /api/companies
router.get("/", requireAuth, async (req, res) => {
  const pool = getPool();

  if (req.user.role === "superadmin") {
    const { rows } = await pool.query(`
      SELECT c.*,
        COUNT(b.id)::int as booking_count,
        SUM(CASE WHEN b.status = 'Pending' THEN 1 ELSE 0 END)::int as pending_count
      FROM companies c
      LEFT JOIN bookings b ON b.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return res.json({ success: true, companies: rows.map(formatCompany) });
  }

  if (req.user.companyId) {
    const { rows } = await pool.query("SELECT * FROM companies WHERE id = $1", [req.user.companyId]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "Company not found" });
    return res.json({ success: true, companies: [formatCompany(rows[0])] });
  }

  res.status(403).json({ success: false, error: "Access denied" });
});

// POST /api/companies
router.post("/", requireSuperAdmin, async (req, res) => {
  const { name, industry, phone, email, address } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: "Company name is required" });

  const pool = getPool();
  const id = nanoid();
  const apiKey = apiKeyGen();

  await pool.query(
    "INSERT INTO companies (id, name, industry, phone, email, address, api_key) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, name.trim(), industry || "Other", phone || "", email || "", address || "", apiKey]
  );

  // Create company user
  const username = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) + nanoid().slice(0, 4);
  const password = apiKeyGen().slice(0, 12);
  await pool.query(
    "INSERT INTO users (id, username, password_hash, role, company_id) VALUES ($1,$2,$3,'company',$4)",
    [nanoid(), username, bcrypt.hashSync(password, 10), id]
  );

  const { rows } = await pool.query("SELECT * FROM companies WHERE id = $1", [id]);
  res.status(201).json({ success: true, company: formatCompany(rows[0]), credentials: { username, password } });
});

// PUT /api/companies/:companyId
router.put("/:companyId", requireSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const pool = getPool();
  const { rows: existing } = await pool.query("SELECT * FROM companies WHERE id = $1", [companyId]);
  if (!existing[0]) return res.status(404).json({ success: false, error: "Company not found" });

  const { name, industry, phone, email, address, active } = req.body;
  const c = existing[0];
  await pool.query(
    "UPDATE companies SET name=$1, industry=$2, phone=$3, email=$4, address=$5, active=$6, updated_at=NOW() WHERE id=$7",
    [name ?? c.name, industry ?? c.industry, phone ?? c.phone, email ?? c.email, address ?? c.address, active !== undefined ? active : c.active, companyId]
  );

  const { rows } = await pool.query("SELECT * FROM companies WHERE id = $1", [companyId]);
  res.json({ success: true, company: formatCompany(rows[0]) });
});

// DELETE /api/companies/:companyId
router.delete("/:companyId", requireSuperAdmin, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT id FROM companies WHERE id = $1", [req.params.companyId]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "Company not found" });
  await pool.query("DELETE FROM companies WHERE id = $1", [req.params.companyId]);
  res.json({ success: true, message: "Company deleted" });
});

// GET /api/companies/:companyId/credentials
router.get("/:companyId/credentials", requireSuperAdmin, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT username FROM users WHERE company_id = $1 AND role = 'company'", [req.params.companyId]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "No user found" });
  res.json({ success: true, username: rows[0].username });
});

// POST /api/companies/:companyId/reset-password
router.post("/:companyId/reset-password", requireSuperAdmin, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM users WHERE company_id = $1 AND role = 'company'", [req.params.companyId]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "No user found" });
  const newPassword = apiKeyGen().slice(0, 12);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [bcrypt.hashSync(newPassword, 10), rows[0].id]);
  res.json({ success: true, username: rows[0].username, password: newPassword });
});

function formatCompany(c) {
  return {
    id: c.id, name: c.name, industry: c.industry,
    phone: c.phone, email: c.email, address: c.address,
    apiKey: c.api_key, active: c.active,
    bookingCount: c.booking_count || 0,
    pendingCount: c.pending_count || 0,
    createdAt: c.created_at,
  };
}

export default router;
