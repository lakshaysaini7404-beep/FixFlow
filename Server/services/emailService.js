const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send registration OTP
async function sendRegistrationOtpEmail(email, otp) {
  const result = await transporter.sendMail({
    from: `"FixFlow Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email - FixFlow",
    text: `Your FixFlow email verification OTP is ${otp}. It expires in 5 minutes. Do not share this OTP with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;background:#f8fafc;border-radius:12px">
        <div style="text-align:center">
          <h1 style="color:#2563eb">FixFlow</h1>
          <h2 style="color:#0f172a">Verify Your Email</h2>
          <p style="color:#475569">Use the OTP below to verify your email address.</p>
          <div style="background:#ffffff;padding:20px;border-radius:10px;margin:24px 0">
            <h1 style="letter-spacing:10px;color:#2563eb;margin:0">${otp}</h1>
          </div>
          <p style="color:#64748b">This OTP expires in <strong>5 minutes</strong>.</p>
          <p style="color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email.</p>
          <p style="color:#94a3b8;font-size:12px">FixFlow - Maintenance Management System</p>
        </div>
      </div>
    `,
  });

  console.log("Registration OTP email accepted:", result.messageId);
  return result;
}

// Existing password reset email
async function sendPasswordResetEmail(email, resetUrl) {
  const result = await transporter.sendMail({
    from: `"FixFlow Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your FixFlow password",
    text: `Open this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px">
        <h2>FixFlow Password Reset</h2>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetUrl}"
             style="background:#2563eb;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px">
             Reset Password
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  console.log("Password reset email accepted:", result.messageId);
  return result;
}

module.exports = {
  sendRegistrationOtpEmail,
  sendPasswordResetEmail,
};