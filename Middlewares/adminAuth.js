const jwt = require("jsonwebtoken");
const Admin = require("../Model/Admin");

const COOKIE_NAME = "floriva_admin_token";

const readCookie = (header, name) => {
  if (!header) return "";
  const parts = String(header).split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const headerToken = req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    const token = headerToken || readCookie(req.headers.cookie, COOKIE_NAME);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found",
      });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = { authenticateAdmin, COOKIE_NAME, readCookie };
