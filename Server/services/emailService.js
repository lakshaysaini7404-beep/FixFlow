
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Send registration OTP
async function sendRegistrationOtpEmail(email, otp) {
  const info = await transporter.sendMail({
    from: `"FixFlow Support" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Verify your email - FixFlow",
    text: `Your FixFlow email verification OTP is ${otp}. It expires in 5 minutes. Do not share this OTP with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb;">Welcome to FixFlow!</h2>
        <p>Your email verification OTP is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; padding: 15px 0;">
          ${otp}
        </div>
        <p>This OTP expires in <strong>5 minutes</strong>.</p>
        <p style="color: #6b7280; font-size: 13px;">
          Do not share this OTP with anyone.
        </p>
        <p>Thanks,<br/>FixFlow Support</p>
      </div>
    `,
  });

  console.log("Registration OTP email sent:", info.messageId);
  return info;
}

// Send password reset email
async function sendPasswordResetEmail(email, resetUrl) {
  const info = await transporter.sendMail({
    from: `"FixFlow Support" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Reset your FixFlow password",
    text: `Open this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb;">Reset your FixFlow password</h2>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 22px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Reset Password
          </a>
        </p>
        <p>This link expires in <strong>15 minutes</strong>.</p>
        <p style="color: #6b7280; font-size: 13px;">
          If you did not request a password reset, you can ignore this email.
        </p>
        <p>Thanks,<br/>FixFlow Support</p>
      </div>
    `,
  });

  console.log("Password reset email sent:", info.messageId);
  return info;
}

module.exports = {
  sendRegistrationOtpEmail,
  sendPasswordResetEmail,
};
