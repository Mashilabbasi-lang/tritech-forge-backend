import { Router } from "express";
import { getPool } from "../db.js";
import { requireCompanyAccess } from "../middleware/auth.js";
import { bookingId } from "../utils.js";

const router = Router();

// GET /api/companies/:companyId/bookings
router.get("/:companyId/bookings", requireCompanyAccess, async (req, res) => {
  const { companyId } = req.params;
  const { search, status } = req.query;
  const pool = getPool();

  let query = "SELECT * FROM bookings WHERE company_id = $1";
  const params = [companyId];
  let idx = 2;

  if (status) { query += ` AND status = $${idx++}`; params.push(status); }
  if (search) {
    query += ` AND (customer_name ILIKE $${idx} OR phone ILIKE $${idx} OR issue_type ILIKE $${idx} OR id ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }
  query += " ORDER BY created_at DESC LIMIT 200";

  const { rows } = await pool.query(query, params);
  res.json({ success: true, bookings: rows.map(formatBooking) });
});

// POST /api/companies/:companyId/bookings
router.post("/:companyId/bookings", requireCompanyAccess, async (req, res) => {
  const { companyId } = req.params;
  const { customerName, phone, issueType, date, time, city, status = "Pending", source = "Manual", isEmergency = false, notes } = req.body;
  if (!customerName?.trim()) return res.status(400).json({ success: false, error: "Customer name is required" });

  const pool = getPool();
  const id = bookingId();
  await pool.query(
    "INSERT INTO bookings (id, company_id, customer_name, phone, issue_type, date, time, city, status, source, is_emergency, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [id, companyId, customerName.trim(), phone || "", issueType || "", date || "", time || "", city || "", status, source, !!isEmergency, notes || ""]
  );
  await pool.query(
    "INSERT INTO activity_log (company_id, booking_id, action, customer_name) VALUES ($1,$2,$3,$4)",
    [companyId, id, "Booking created", customerName.trim()]
  );
  const { rows } = await pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
  res.status(201).json({ success: true, booking: formatBooking(rows[0]) });
});

// PUT /api/companies/:companyId/bookings/:bookingId
router.put("/:companyId/bookings/:bookingId", requireCompanyAccess, async (req, res) => {
  const { companyId, bookingId: bId } = req.params;
  const pool = getPool();
  const { rows: existing } = await pool.query("SELECT * FROM bookings WHERE id = $1 AND company_id = $2", [bId, companyId]);
  if (!existing[0]) return res.status(404).json({ success: false, error: "Booking not found" });

  const b = existing[0];
  const { customerName, phone, issueType, date, time, city, status, source, isEmergency, notes } = req.body;
  const newStatus = status ?? b.status;

  await pool.query(
    "UPDATE bookings SET customer_name=$1, phone=$2, issue_type=$3, date=$4, time=$5, city=$6, status=$7, source=$8, is_emergency=$9, notes=$10, updated_at=NOW() WHERE id=$11 AND company_id=$12",
    [customerName ?? b.customer_name, phone ?? b.phone, issueType ?? b.issue_type, date ?? b.date, time ?? b.time, city ?? b.city, newStatus, source ?? b.source, isEmergency !== undefined ? !!isEmergency : b.is_emergency, notes ?? b.notes, bId, companyId]
  );

  if (newStatus !== b.status) {
    await pool.query(
      "INSERT INTO activity_log (company_id, booking_id, action, customer_name) VALUES ($1,$2,$3,$4)",
      [companyId, bId, `Status changed to ${newStatus}`, b.customer_name]
    );
  }

  const { rows } = await pool.query("SELECT * FROM bookings WHERE id = $1", [bId]);
  res.json({ success: true, booking: formatBooking(rows[0]) });
});

// DELETE /api/companies/:companyId/bookings/:bookingId
router.delete("/:companyId/bookings/:bookingId", requireCompanyAccess, async (req, res) => {
  const { companyId, bookingId: bId } = req.params;
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM bookings WHERE id = $1 AND company_id = $2", [bId, companyId]);
  if (!rows[0]) return res.status(404).json({ success: false, error: "Booking not found" });
  await pool.query("DELETE FROM bookings WHERE id = $1 AND company_id = $2", [bId, companyId]);
  await pool.query("INSERT INTO activity_log (company_id, booking_id, action, customer_name) VALUES ($1,$2,$3,$4)", [companyId, bId, "Booking deleted", rows[0].customer_name]);
  res.json({ success: true, message: "Booking deleted" });
});

// GET /api/companies/:companyId/stats
router.get("/:companyId/stats", requireCompanyAccess, async (req, res) => {
  const { companyId } = req.params;
  const pool = getPool();
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int as total,
      SUM(CASE WHEN date = $2 THEN 1 ELSE 0 END)::int as today,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END)::int as pending,
      SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END)::int as confirmed,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END)::int as in_progress,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)::int as completed,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END)::int as cancelled,
      SUM(CASE WHEN is_emergency = TRUE THEN 1 ELSE 0 END)::int as emergency
    FROM bookings WHERE company_id = $1
  `, [companyId, today]);

  const s = rows[0];
  res.json({ success: true, stats: { total: s.total, today: s.today, pending: s.pending, confirmed: s.confirmed, inProgress: s.in_progress, completed: s.completed, cancelled: s.cancelled, emergency: s.emergency } });
});

// GET /api/companies/:companyId/activity
router.get("/:companyId/activity", requireCompanyAccess, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM activity_log WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50",
    [req.params.companyId]
  );
  res.json({ success: true, activity: rows.map(a => ({ id: a.id, action: a.action, bookingId: a.booking_id, customerName: a.customer_name, createdAt: a.created_at })) });
});

function formatBooking(b) {
  return {
    id: b.id, companyId: b.company_id, customerName: b.customer_name,
    phone: b.phone, issueType: b.issue_type, date: b.date, time: b.time,
    city: b.city, status: b.status, source: b.source,
    isEmergency: b.is_emergency, notes: b.notes,
    createdAt: b.created_at, updatedAt: b.updated_at,
  };
}

export default router;
