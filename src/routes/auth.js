import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, error: "Username and password required" });

  const db = getDb();
  const user = db.data.users.find(u => u.username === username.trim());

  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ success: false, error: "Invalid username or password" });

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.companyId || null,
  });

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, companyId: user.companyId || null },
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

  const db = getDb();
  const user = db.data.users.find(u => u.id === req.user.id);

  if (!bcrypt.compareSync(currentPassword, user.passwordHash))
    return res.status(401).json({ success: false, error: "Current password is incorrect" });

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  await db.write();

  res.json({ success: true, message: "Password updated successfully" });
});

export default router;
