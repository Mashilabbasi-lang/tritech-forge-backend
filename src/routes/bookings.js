import { Router } from "express";
import { getDb } from "../db.js";
import { requireCompanyAccess } from "../middleware/auth.js";
import { bookingId } from "../utils.js";

const router = Router();

// GET /api/companies/:companyId/bookings
router.get("/:companyId/bookings", requireCompanyAccess, (req, res) => {
  const { companyId } = req.params;
  const { search, status } = req.query;
  const db = getDb();

  let bookings = db.data.bookings.filter(b => b.companyId === companyId);

  if (status) bookings = bookings.filter(b => b.status === status);
  if (search) {
    const s = search.toLowerCase();
    bookings = bookings.filter(b =>
      b.customerName?.toLowerCase().includes(s) ||
      b.phone?.includes(s) ||
      b.issueType?.toLowerCase().includes(s) ||
      b.id?.toLowerCase().includes(s)
    );
  }

  bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, bookings });
});

// POST /api/companies/:companyId/bookings
router.post("/:companyId/bookings", requireCompanyAccess, async (req, res) => {
  const { companyId } = req.params;
  const { customerName, phone, issueType, date, time, city, status = "Pending", source = "Manual", isEmergency = false, notes } = req.body;

  if (!customerName?.trim())
    return res.status(400).json({ success: false, error: "Customer name is required" });

  const db = getDb();
  const id = bookingId();
  const now = new Date().toISOString();

  const booking = {
    id, companyId,
    customerName: customerName.trim(),
    phone: phone || "", issueType: issueType || "",
    date: date || "", time: time || "", city: city || "",
    status, source, isEmergency: !!isEmergency,
    notes: notes || "",
    createdAt: now, updatedAt: now,
  };

  db.data.bookings.push(booking);
  db.data.activity.push({
    id: Date.now(), companyId, bookingId: id,
    action: "Booking created", customerName: customerName.trim(),
    createdAt: now,
  });
  await db.write();

  res.status(201).json({ success: true, booking });
});

// PUT /api/companies/:companyId/bookings/:bookingId
router.put("/:companyId/bookings/:bookingId", requireCompanyAccess, async (req, res) => {
  const { companyId, bookingId: bId } = req.params;
  const db = getDb();
  const booking = db.data.bookings.find(b => b.id === bId && b.companyId === companyId);
  if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

  const oldStatus = booking.status;
  const { customerName, phone, issueType, date, time, city, status, source, isEmergency, notes } = req.body;

  if (customerName !== undefined) booking.customerName = customerName;
  if (phone !== undefined) booking.phone = phone;
  if (issueType !== undefined) booking.issueType = issueType;
  if (date !== undefined) booking.date = date;
  if (time !== undefined) booking.time = time;
  if (city !== undefined) booking.city = city;
  if (status !== undefined) booking.status = status;
  if (source !== undefined) booking.source = source;
  if (isEmergency !== undefined) booking.isEmergency = !!isEmergency;
  if (notes !== undefined) booking.notes = notes;
  booking.updatedAt = new Date().toISOString();

  if (status && status !== oldStatus) {
    db.data.activity.push({
      id: Date.now(), companyId, bookingId: bId,
      action: `Status changed to ${status}`,
      customerName: booking.customerName,
      createdAt: new Date().toISOString(),
    });
  }

  await db.write();
  res.json({ success: true, booking });
});

// DELETE /api/companies/:companyId/bookings/:bookingId
router.delete("/:companyId/bookings/:bookingId", requireCompanyAccess, async (req, res) => {
  const { companyId, bookingId: bId } = req.params;
  const db = getDb();
  const idx = db.data.bookings.findIndex(b => b.id === bId && b.companyId === companyId);
  if (idx === -1) return res.status(404).json({ success: false, error: "Booking not found" });

  const booking = db.data.bookings[idx];
  db.data.bookings.splice(idx, 1);
  db.data.activity.push({
    id: Date.now(), companyId, bookingId: bId,
    action: "Booking deleted", customerName: booking.customerName,
    createdAt: new Date().toISOString(),
  });
  await db.write();

  res.json({ success: true, message: "Booking deleted" });
});

// GET /api/companies/:companyId/stats
router.get("/:companyId/stats", requireCompanyAccess, (req, res) => {
  const { companyId } = req.params;
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const bookings = db.data.bookings.filter(b => b.companyId === companyId);

  res.json({
    success: true,
    stats: {
      total: bookings.length,
      today: bookings.filter(b => b.date === today).length,
      pending: bookings.filter(b => b.status === "Pending").length,
      confirmed: bookings.filter(b => b.status === "Confirmed").length,
      inProgress: bookings.filter(b => b.status === "In Progress").length,
      completed: bookings.filter(b => b.status === "Completed").length,
      cancelled: bookings.filter(b => b.status === "Cancelled").length,
      emergency: bookings.filter(b => b.isEmergency).length,
    },
  });
});

// GET /api/companies/:companyId/activity
router.get("/:companyId/activity", requireCompanyAccess, (req, res) => {
  const { companyId } = req.params;
  const db = getDb();
  const activity = db.data.activity
    .filter(a => a.companyId === companyId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);

  res.json({ success: true, activity });
});

export default router;
