const jwt = require("jsonwebtoken");
const Admin = require("../Model/Admin");
const { COOKIE_NAME } = require("../Middlewares/adminAuth");

const generateAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id, role: "admin", username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const isFormLogin = (req) =>
  String(req.headers["content-type"] || "").includes("application/x-www-form-urlencoded");

const DEFAULT_ADMIN_USERNAME = "florivaadmin";
const DEFAULT_ADMIN_PASSWORD = "giftsFLORIVA#321";
const LEGACY_ADMIN_USERNAME = "admin";

exports.seedDefaultAdmin = async () => {
  const targetUsername = (
    process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME
  ).toLowerCase();
  const targetPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const legacyAdmin = await Admin.findOne({
    username: LEGACY_ADMIN_USERNAME,
  }).select("+password");

  if (legacyAdmin) {
    legacyAdmin.username = targetUsername;
    legacyAdmin.password = targetPassword;
    await legacyAdmin.save();
    console.log(`Legacy admin migrated (username: ${targetUsername})`);
    return;
  }

  const count = await Admin.countDocuments();
  if (count === 0) {
    await Admin.create({
      username: targetUsername,
      password: targetPassword,
      name: "Admin",
    });
    console.log(`Default admin created (username: ${targetUsername})`);
    return;
  }

  if (process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD) {
    const admin =
      (await Admin.findOne({ username: targetUsername }).select("+password")) ||
      (await Admin.findOne().select("+password"));

    if (admin) {
      admin.username = targetUsername;
      admin.password = targetPassword;
      await admin.save();
      console.log(`Admin credentials updated from env (username: ${targetUsername})`);
    }
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      if (isFormLogin(req)) {
        return res.redirect(302, "/api/cms?error=" + encodeURIComponent("Username and password are required"));
      }
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const admin = await Admin.findOne({
      username: username.trim().toLowerCase(),
    }).select("+password");

    if (!admin || !(await admin.comparePassword(password))) {
      if (isFormLogin(req)) {
        return res.redirect(302, "/api/cms?error=" + encodeURIComponent("Invalid username or password"));
      }
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = generateAdminToken(admin);
    const host = String(req.headers.host || "");
    const cookieBase = {
      secure:
        host.includes("florivagifts.com") ||
        req.secure ||
        req.headers["x-forwarded-proto"] === "https",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    try {
      res.cookie("floriva_admin_token", token, { ...cookieBase, httpOnly: true });
      res.cookie("floriva_seo_js_token", token, { ...cookieBase, httpOnly: false });
    } catch (cookieError) {
      console.error("Admin cookie not set:", cookieError);
    }

    if (isFormLogin(req)) {
      return res.redirect(302, "/seo-cms/?v=8");
    }

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("Admin login failed:", error);
    if (isFormLogin(req)) {
      return res.redirect(
        302,
        "/api/cms?error=" + encodeURIComponent(error.message || "Login failed")
      );
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  if (String(req.headers.accept || "").includes("text/html")) {
    return res.redirect(302, "/seo-cms/");
  }
  res.json({ success: true });
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.admin._id,
      username: req.admin.username,
      name: req.admin.name,
    },
  });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const admin = await Admin.findById(req.admin._id).select("+password");
    if (!admin || !(await admin.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
