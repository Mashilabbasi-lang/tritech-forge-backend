import { Router } from "express";
import { getPool } from "../db.js";
import { requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireSuperAdmin, async (req, res) => {
  const pool = getPool();
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM companies WHERE active = TRUE) as total_companies,
      COUNT(*)::int as total_bookings,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END)::int as pending_bookings,
      SUM(CASE WHEN date = $1 THEN 1 ELSE 0 END)::int as today_bookings
    FROM bookings
  `, [today]);

  const s = rows[0];
  res.json({ success: true, stats: { totalCompanies: s.total_companies, totalBookings: s.total_bookings, pendingBookings: s.pending_bookings, todayBookings: s.today_bookings } });
});

export default router;
