
const express = require("express");
const rateLimit = require("express-rate-limit");
const passport = require("../config/passport");
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  register,
  registerWorker,
  login,
  me,
  logout,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  googleCallback,
  sendRegistrationOtp,
  verifyRegistrationOtp,
} = require("../controllers/authController");

const router = express.Router();

// General authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

// OTP sending rate limiter
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later.",
  },
});

// OTP verification rate limiter
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP verification attempts. Please try again later.",
  },
});

// ========================================
// EMAIL OTP VERIFICATION
// ========================================

router.post(
  "/send-otp",
  otpSendLimiter,
  sendRegistrationOtp
);

router.post(
  "/verify-otp",
  otpVerifyLimiter,
  verifyRegistrationOtp
);

// ========================================
// REGISTRATION
// ========================================

router.post(
  "/register",
  authLimiter,
  register
);

router.post(
  "/register-worker",
  authLimiter,
  registerWorker
);

// ========================================
// LOGIN / LOGOUT
// ========================================

router.post(
  "/login",
  authLimiter,
  login
);

router.get(
  "/me",
  authenticateToken,
  me
);

router.post(
  "/logout",
  authenticateToken,
  logout
);

// ========================================
// PROFILE
// ========================================

router.patch(
  "/profile",
  authenticateToken,
  updateProfile
);

// ========================================
// PASSWORD MANAGEMENT
// ========================================

router.post(
  "/change-password",
  authenticateToken,
  changePassword
);

router.post(
  "/forgot-password",
  authLimiter,
  forgotPassword
);

router.post(
  "/reset-password/:token",
  authLimiter,
  resetPassword
);

// ========================================
// GOOGLE AUTHENTICATION
// ========================================

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${
      process.env.CLIENT_URL || "http://localhost:5173"
    }/?error=google-login-failed`,
  }),
  googleCallback
);

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;
