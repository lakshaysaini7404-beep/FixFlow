
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/user");
const RegistrationOtp = require("../models/registrationOtp");

const {
  safeUser,
  normalizeCategory,
  CATEGORIES,
} = require("../utils/constants");

const { authResponse, signToken } = require("../utils/token");

const {
  sendRegistrationOtpEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

// ==================================================
// CONFIGURATION
// ==================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_WINDOW_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

// ==================================================
// HELPERS
// ==================================================

function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6;
}

function parseLocation(body = {}) {
  const { latitude, longitude } = body;

  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude === "" ||
    longitude === "" ||
    latitude === null ||
    longitude === null
  ) {
    return undefined;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return undefined;
  }

  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}

function parseSkills(skills) {
  const values = Array.isArray(skills)
    ? skills
    : typeof skills === "string"
      ? skills.split(",")
      : [];

  return [
    ...new Set(
      values
        .map((skill) => normalizeCategory(skill))
        .filter(Boolean)
    ),
  ];
}

function validWorkerCategory(category) {
  return Boolean(category) && CATEGORIES.includes(category);
}

function handleDuplicateEmail(error, res) {
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Email is already registered.",
    });
  }

  return null;
}

// ==================================================
// SEND REGISTRATION OTP
// POST /api/auth/send-otp
// Body: { email }
// ==================================================

async function sendRegistrationOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered.",
      });
    }

    let record = await RegistrationOtp.findOne({ email });
    const now = Date.now();

    // An already verified email can finish registration
    // during its existing registration window.
    if (
      record?.verifiedAt &&
      record.expiresAt.getTime() > now
    ) {
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Email already verified. You can complete registration.",
      });
    }

    // Prevent repeated OTP emails.
    if (record?.lastSentAt) {
      const elapsed = now - record.lastSentAt.getTime();

      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (OTP_RESEND_COOLDOWN_MS - elapsed) / 1000
        );

        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
          retryAfterSeconds,
        });
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashValue(otp);

    if (!record) {
      record = new RegistrationOtp({
        email,
        otpHash,
        expiresAt: new Date(now + OTP_EXPIRY_MS),
        verifiedAt: null,
        attempts: 0,
        lastSentAt: new Date(now),
      });
    } else {
      record.otpHash = otpHash;
      record.expiresAt = new Date(now + OTP_EXPIRY_MS);
      record.verifiedAt = null;
      record.attempts = 0;
      record.lastSentAt = new Date(now);
    }

    await record.save();

    // Send OTP through Resend.
    // If email delivery fails, use demo mode when enabled.
    try {
      await sendRegistrationOtpEmail(email, otp);
    } catch (emailError) {
      if (process.env.DEMO_OTP_MODE === "true") {
        console.log("----------------------------------");
        console.log("FIXFLOW DEMO OTP");
        console.log("Email:", email);
        console.log("OTP:", otp);
        console.log("Expires in: 5 minutes");
        console.log("----------------------------------");
      } else {
        await RegistrationOtp.deleteOne({
          _id: record._id,
          otpHash,
          verifiedAt: null,
        }).catch(() => {});

        console.error(
          "Registration OTP email failed:",
          emailError.message
        );

        return res.status(500).json({
          success: false,
          message: "Unable to send the verification email. Please try again.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Verification OTP sent or generated successfully. It expires in 5 minutes.",
      expiresIn: 300,
      resendAfter: 60,
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// VERIFY REGISTRATION OTP
// POST /api/auth/verify-otp
// Body: { email, otp }
// ==================================================

async function verifyRegistrationOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp =
      typeof req.body?.otp === "string"
        ? req.body.otp.trim()
        : "";

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "A valid email and six-digit OTP are required.",
      });
    }

    const record = await RegistrationOtp.findOne({ email });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired. Please request a new OTP.",
      });
    }

    const now = Date.now();

    if (record.expiresAt.getTime() <= now) {
      await RegistrationOtp.deleteOne({ _id: record._id });

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (record.verifiedAt) {
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Email is already verified. You can complete registration.",
      });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect OTP attempts. Please request a new OTP.",
      });
    }

    const submittedHash = hashValue(otp);
    const storedHash = record.otpHash;

    const submittedBuffer = Buffer.from(submittedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    const matches =
      submittedBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(submittedBuffer, storedBuffer);

    if (!matches) {
      record.attempts += 1;
      await record.save();

      const attemptsLeft = Math.max(
        0,
        OTP_MAX_ATTEMPTS - record.attempts
      );

      return res.status(400).json({
        success: false,
        message: "Incorrect OTP.",
        attemptsLeft,
      });
    }

    record.verifiedAt = new Date(now);
    record.expiresAt = new Date(now + REGISTRATION_WINDOW_MS);

    await record.save();

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Email verified successfully. Complete your registration.",
      registrationWindowSeconds: REGISTRATION_WINDOW_MS / 1000,
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// CHECK VERIFIED REGISTRATION
// ==================================================

async function getVerifiedRegistration(email) {
  return RegistrationOtp.findOne({
    email,
    verifiedAt: { $ne: null, $exists: true },
    expiresAt: { $gt: new Date() },
  });
}

async function removeRegistrationOtp(email) {
  try {
    await RegistrationOtp.deleteOne({ email });
  } catch (error) {
    console.error(
      "Registration OTP cleanup failed:",
      error.message
    );
  }
}

// ==================================================
// REGISTER USER
// POST /api/auth/register
// ==================================================

async function register(req, res, next) {
  try {
    const { password, phone, address } = req.body || {};
    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";
    const email = normalizeEmail(req.body?.email);

    if (!name || !isValidEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, valid email, and password are required.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const verifiedOtp = await getVerifiedRegistration(email);

    if (!verifiedOtp) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before registering.",
        requiresEmailVerification: true,
      });
    }

    const location = parseLocation(req.body);

    const userData = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      phone,
      address,
      role: "user",
    };

    if (location) {
      userData.location = location;
    }

    const user = await User.create(userData);

    await removeRegistrationOtp(email);

    return res.status(201).json(
      authResponse(user, "Account created successfully")
    );
  } catch (error) {
    const duplicateResponse = handleDuplicateEmail(error, res);

    if (duplicateResponse) return duplicateResponse;

    return next(error);
  }
}

// ==================================================
// REGISTER WORKER
// POST /api/auth/register-worker
// ==================================================

async function registerWorker(req, res, next) {
  try {
    const { password, phone, address, serviceArea } = req.body || {};

    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";
    const email = normalizeEmail(req.body?.email);

    if (!name || !isValidEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, valid email, and password are required.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const skills = parseSkills(req.body?.skills);
    const primary = normalizeCategory(
      req.body?.category || skills[0] || ""
    );

    if (!validWorkerCategory(primary)) {
      return res.status(400).json({
        success: false,
        message: `Worker category is required. Use one of: ${CATEGORIES.join(", ")}`,
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const verifiedOtp = await getVerifiedRegistration(email);

    if (!verifiedOtp) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before registering.",
        requiresEmailVerification: true,
      });
    }

    const uniqueSkills = [
      ...new Set([primary, ...skills]),
    ];

    const location = parseLocation(req.body);

    const workerData = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      phone,
      address,
      serviceArea: serviceArea || address,
      category: primary,
      skills: uniqueSkills,
      role: "worker",
      isApproved: true,
    };

    if (location) {
      workerData.location = location;
    }

    const worker = await User.create(workerData);

    await removeRegistrationOtp(email);

    return res.status(201).json(
      authResponse(worker, "Worker account created successfully")
    );
  } catch (error) {
    const duplicateResponse = handleDuplicateEmail(error, res);

    if (duplicateResponse) return duplicateResponse;

    return next(error);
  }
}

// ==================================================
// LOGIN
// POST /api/auth/login
// ==================================================

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Valid email and password are required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json(
      authResponse(user, "Login successful")
    );
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// CURRENT USER
// GET /api/auth/me
// ==================================================

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// LOGOUT
// POST /api/auth/logout
// ==================================================

async function logout(_req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}

// ==================================================
// UPDATE PROFILE
// PATCH /api/auth/profile
// ==================================================

async function updateProfile(req, res, next) {
  try {
    const allowedFields = [
      "name",
      "phone",
      "address",
      "serviceArea",
      "profileImage",
    ];

    const updates = {};

    for (const key of allowedFields) {
      if (req.body?.[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.name !== undefined) {
      if (
        typeof updates.name !== "string" ||
        !updates.name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      updates.name = updates.name.trim();
    }

    const location = parseLocation(req.body || {});

    if (location) {
      updates.location = location;
    }

    if (req.user.role === "worker") {
      if (req.body?.category !== undefined) {
        const category = normalizeCategory(req.body.category);

        if (!validWorkerCategory(category)) {
          return res.status(400).json({
            success: false,
            message: "Invalid worker category.",
          });
        }

        updates.category = category;
      }

      if (req.body?.skills !== undefined) {
        updates.skills = parseSkills(req.body.skills);
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// CHANGE PASSWORD
// POST /api/auth/change-password
// ==================================================

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in.",
      });
    }

    const matches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!matches) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ==================================================

async function forgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "This email is not registered with FixFlow.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = hashValue(resetToken);
    user.resetPasswordExpires = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MS
    );

    await user.save();

    const clientUrl = process.env.CLIENT_URL;

    if (!clientUrl) {
      throw new Error("CLIENT_URL is missing from .env");
    }

    const resetUrl =
      `${clientUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your registered email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to send the reset email. Please try again later.",
    });
  }
}

// ==================================================
// RESET PASSWORD
// POST /api/auth/reset-password/:token
// Body: { password }
// ==================================================

async function resetPassword(req, res, next) {
  try {
    const token = req.params?.token || req.body?.token;
    const password = req.body?.password;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const hashedToken = hashValue(token);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired.",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

// ==================================================
// GOOGLE AUTHENTICATION CALLBACK
// ==================================================

async function googleCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect(
        `${process.env.CLIENT_URL}/?error=google-login-failed`
      );
    }

    const token = signToken(req.user);

    return res.redirect(
      `${process.env.CLIENT_URL}/google-success?token=${token}`
    );
  } catch (error) {
    console.error("Google callback error:", error);

    return res.redirect(
      `${process.env.CLIENT_URL}/?error=google-login-failed`
    );
  }
}

// ==================================================
// EXPORT CONTROLLERS
// ==================================================

module.exports = {
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
};
