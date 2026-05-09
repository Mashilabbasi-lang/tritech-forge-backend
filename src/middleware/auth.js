import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "tritech-secret-key-change-in-production";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin access required" });
    }
    next();
  });
}

export function requireCompanyAccess(req, res, next) {
  requireAuth(req, res, () => {
    const { companyId } = req.params;
    if (req.user.role === "superadmin") return next();
    if (req.user.role === "company" && req.user.companyId === companyId) return next();
    return res.status(403).json({ success: false, error: "Access denied" });
  });
}
