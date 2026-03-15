const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send a password reset email.
 * @param {string} to - Recipient email
 * @param {string} token - Reset token
 * @param {string} username - Recipient's username
 */
async function sendResetEmail(to, token, username) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
        from: `"AI Agent" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Reset your AI Agent password',
        html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#0d1526;color:#f1f5f9;padding:32px;border-radius:16px;">
        <h2 style="background:linear-gradient(135deg,#4f8ef7,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 16px">AI Agent</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:linear-gradient(135deg,#4f8ef7,#a78bfa);color:white;border-radius:10px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request this, please ignore this email.</p>
        <p style="color:#475569;font-size:12px;margin-top:24px;">Or copy this link: <a href="${resetUrl}" style="color:#4f8ef7">${resetUrl}</a></p>
      </div>
    `,
    });
}

module.exports = { sendResetEmail };
