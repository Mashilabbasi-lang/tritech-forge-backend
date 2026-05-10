import { Router } from "express";
import { getPool } from "../db.js";
import { bookingId } from "../utils.js";

const router = Router();

router.post("/:companyId/booking", async (req, res) => {
  const { companyId } = req.params;
  const apiKey = req.headers["x-api-key"] || req.query.key;
  const pool = getPool();

  const { rows } = await pool.query("SELECT * FROM companies WHERE id = $1 AND active = TRUE", [companyId]);
  const company = rows[0];
  if (!company) return res.status(404).json({ success: false, error: "Company not found or inactive" });
  if (company.api_key !== apiKey) return res.status(401).json({ success: false, error: "Invalid API key" });

  const { customerName, phone, issueType, date, time, city, isEmergency = false, notes } = req.body;
  if (!customerName?.trim()) return res.status(400).json({ success: false, error: "customerName is required" });

  const id = bookingId();
  await pool.query(
    "INSERT INTO bookings (id, company_id, customer_name, phone, issue_type, date, time, city, status, source, is_emergency, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending','AI Booked',$9,$10)",
    [id, companyId, customerName.trim(), phone || "", issueType || "", date || "", time || "", city || "", !!isEmergency, notes || ""]
  );
  await pool.query(
    "INSERT INTO activity_log (company_id, booking_id, action, customer_name) VALUES ($1,$2,'AI booking received',$3)",
    [companyId, id, customerName.trim()]
  );

  console.log(`📥 Webhook booking: ${id} for ${company.name}`);
  res.status(201).json({ success: true, bookingId: id, message: "Booking created successfully" });
});

export default router;
