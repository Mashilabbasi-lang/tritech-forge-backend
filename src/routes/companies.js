import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { requireSuperAdmin, requireAuth } from "../middleware/auth.js";
import { nanoid, apiKeyGen } from "../utils.js";

const router = Router();

// GET /api/companies
router.get("/", requireAuth, (req, res) => {
  const db = getDb();

  if (req.user.role === "superadmin") {
    const companies = db.data.companies.map(c => ({
      ...formatCompany(c),
      bookingCount: db.data.bookings.filter(b => b.companyId === c.id).length,
      pendingCount: db.data.bookings.filter(b => b.companyId === c.id && b.status === "Pending").length,
    }));
    return res.json({ success: true, companies });
  }

  if (req.user.companyId) {
    const company = db.data.companies.find(c => c.id === req.user.companyId);
    if (!company) return res.status(404).json({ success: false, error: "Company not found" });
    return res.json({ success: true, companies: [formatCompany(company)] });
  }

  res.status(403).json({ success: false, error: "Access denied" });
});

// POST /api/companies
router.post("/", requireSuperAdmin, async (req, res) => {
  const { name, industry, phone, email, address } = req.body;
  if (!name?.trim())
    return res.status(400).json({ success: false, error: "Company name is required" });

  const db = getDb();
  const id = nanoid();
  const apiKey = apiKeyGen();

  const company = {
    id, name: name.trim(),
    industry: industry || "Other",
    phone: phone || "", email: email || "", address: address || "",
    apiKey, active: true,
    createdAt: new Date().toISOString(),
  };
  db.data.companies.push(company);

  // Create company user
  const username = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) + nanoid().slice(0, 4);
  const password = apiKeyGen().slice(0, 12);
  db.data.users.push({
    id: nanoid(), username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: "company", companyId: id,
    createdAt: new Date().toISOString(),
  });

  await db.write();
  res.status(201).json({ success: true, company: formatCompany(company), credentials: { username, password } });
});

// PUT /api/companies/:companyId
router.put("/:companyId", requireSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const db = getDb();
  const company = db.data.companies.find(c => c.id === companyId);
  if (!company) return res.status(404).json({ success: false, error: "Company not found" });

  const { name, industry, phone, email, address, active } = req.body;
  if (name !== undefined) company.name = name;
  if (industry !== undefined) company.industry = industry;
  if (phone !== undefined) company.phone = phone;
  if (email !== undefined) company.email = email;
  if (address !== undefined) company.address = address;
  if (active !== undefined) company.active = active;
  company.updatedAt = new Date().toISOString();

  await db.write();
  res.json({ success: true, company: formatCompany(company) });
});

// DELETE /api/companies/:companyId
router.delete("/:companyId", requireSuperAdmin, async (req, res) => {
  const { companyId } = req.params;
  const db = getDb();
  const idx = db.data.companies.findIndex(c => c.id === companyId);
  if (idx === -1) return res.status(404).json({ success: false, error: "Company not found" });

  db.data.companies.splice(idx, 1);
  db.data.bookings = db.data.bookings.filter(b => b.companyId !== companyId);
  db.data.activity = db.data.activity.filter(a => a.companyId !== companyId);
  db.data.users = db.data.users.filter(u => u.companyId !== companyId);
  await db.write();

  res.json({ success: true, message: "Company deleted" });
});

// GET /api/companies/:companyId/credentials
router.get("/:companyId/credentials", requireSuperAdmin, (req, res) => {
  const db = getDb();
  const user = db.data.users.find(u => u.companyId === req.params.companyId && u.role === "company");
  if (!user) return res.status(404).json({ success: false, error: "No user found" });
  res.json({ success: true, username: user.username });
});

// POST /api/companies/:companyId/reset-password
router.post("/:companyId/reset-password", requireSuperAdmin, async (req, res) => {
  const db = getDb();
  const user = db.data.users.find(u => u.companyId === req.params.companyId && u.role === "company");
  if (!user) return res.status(404).json({ success: false, error: "No user found" });

  const newPassword = apiKeyGen().slice(0, 12);
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  await db.write();

  res.json({ success: true, username: user.username, password: newPassword });
});

function formatCompany(c) {
  return {
    id: c.id, name: c.name, industry: c.industry,
    phone: c.phone, email: c.email, address: c.address,
    apiKey: c.apiKey, active: c.active,
    bookingCount: 0, pendingCount: 0,
    createdAt: c.createdAt,
  };
}

export default router;
