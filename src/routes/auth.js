import { Router } from "express";
import bcrypt from "bcryptjs";
import { getPool } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, error: "Username and password required" });

  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username.trim()]);
  const user = rows[0];

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ success: false, error: "Invalid username or password" });

  const token = signToken({
    id: user.id, username: user.username,
    role: user.role, companyId: user.company_id || null,
  });

  res.json({
    success: true, token,
    user: { id: user.id, username: user.username, role: user.role, companyId: user.company_id || null },
  });
});

// GET /api/auth/verify
router.get("/verify", requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, error: "Both passwords required" });
  if (newPassword.length < 6)
    return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });

  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const user = rows[0];

  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ success: false, error: "Current password is incorrect" });

  const newHash = bcrypt.hashSync(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, req.user.id]);

  res.json({ success: true, message: "Password updated successfully" });
});

export default router;
