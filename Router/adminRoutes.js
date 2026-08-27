const express = require("express");
const { login, getMe, changePassword, logout } = require("../Controllers/adminController");
const { authenticateAdmin } = require("../Middlewares/adminAuth");

const router = express.Router();

router.post("/admin/login", login);
router.get("/admin/logout", logout);
router.post("/admin/logout", logout);
router.get("/admin/me", authenticateAdmin, getMe);
router.put("/admin/password", authenticateAdmin, changePassword);

module.exports = router;
