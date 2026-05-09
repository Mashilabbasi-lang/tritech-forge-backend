import { Router } from "express";
import { getDb } from "../db.js";
import { requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/stats
router.get("/", requireSuperAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  res.json({
    success: true,
    stats: {
      totalCompanies: db.data.companies.filter(c => c.active).length,
      totalBookings: db.data.bookings.length,
      pendingBookings: db.data.bookings.filter(b => b.status === "Pending").length,
      todayBookings: db.data.bookings.filter(b => b.date === today).length,
    },
  });
});

export default router;
