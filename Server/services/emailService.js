
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const FROM_EMAIL =
  process.env.BREVO_SENDER_EMAIL || "lakshay.saini7404@gmail.com";

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "FixFlow",
        email: FROM_EMAIL,
      },
      to: [{ email: to }],
      replyTo: {
        email: FROM_EMAIL,
        name: "FixFlow Support",
      },
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Brevo email failed:", data);
    throw new Error(
      data.message || `Brevo email failed with status ${response.status}`
    );
  }

  console.log("FixFlow email sent successfully:", data.messageId);
  return data;
}

// Registration OTP email
async function sendRegistrationOtpEmail(email, otp) {
  return sendEmail({
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
}

// Password reset email
async function sendPasswordResetEmail(email, resetUrl) {
  return sendEmail({
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
}

module.exports = {
  sendRegistrationOtpEmail,
  sendPasswordResetEmail,
};
