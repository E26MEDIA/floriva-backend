const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const DEFAULT_ORIGINS = [
  "https://florivagifts.com",
  "https://www.florivagifts.com",
  "https://admin.florivagifts.com",
  "https://api.florivagifts.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:7000",
];

const buildAllowedOrigins = () => {
  const fromEnv = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.API_URL,
    process.env.CORS_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
};

const corsMiddleware = cors({
  origin(origin, callback) {
    const allowed = buildAllowedOrigins();
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    // Same-host API CMS (https://api.florivagifts.com/seo-cms/) must be able to POST /api
    try {
      const { hostname } = new URL(origin);
      if (hostname === "api.florivagifts.com" || hostname === "localhost" || hostname === "127.0.0.1") {
        callback(null, true);
        return;
      }
    } catch {
      // ignore invalid Origin
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Token", "x-access-token"],
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please wait and try again." },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Please wait before trying again." },
});

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // The SEO CMS is a small HTML/JS app on this API host. Helmet's default CSP
  // blocks it from loading /seo-cms/app.js, so the Sign in button does nothing.
  contentSecurityPolicy: false,
});

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  otpLimiter,
  buildAllowedOrigins,
};
