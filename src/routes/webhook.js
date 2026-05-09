import { Router } from "express";
import { getDb } from "../db.js";
import { bookingId } from "../utils.js";

const router = Router();

// POST /webhook/:companyId/booking
router.post("/:companyId/booking", async (req, res) => {
  const { companyId } = req.params;
  const apiKey = req.headers["x-api-key"] || req.query.key;

  const db = getDb();
  const company = db.data.companies.find(c => c.id === companyId && c.active);
  if (!company) return res.status(404).json({ success: false, error: "Company not found or inactive" });
  if (company.apiKey !== apiKey) return res.status(401).json({ success: false, error: "Invalid API key" });

  const { customerName, phone, issueType, date, time, city, isEmergency = false, notes } = req.body;
  if (!customerName?.trim()) return res.status(400).json({ success: false, error: "customerName is required" });

  const id = bookingId();
  const now = new Date().toISOString();

  db.data.bookings.push({
    id, companyId,
    customerName: customerName.trim(),
    phone: phone || "", issueType: issueType || "",
    date: date || "", time: time || "", city: city || "",
    status: "Pending", source: "AI Booked",
    isEmergency: !!isEmergency, notes: notes || "",
    createdAt: now, updatedAt: now,
  });

  db.data.activity.push({
    id: Date.now(), companyId, bookingId: id,
    action: "AI booking received", customerName: customerName.trim(),
    createdAt: now,
  });

  await db.write();
  console.log(`📥 Webhook booking: ${id} for ${company.name}`);
  res.status(201).json({ success: true, bookingId: id, message: "Booking created successfully" });
});

export default router;
