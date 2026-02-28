const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: 'aritronentertainment@gmail.com',
    pass: 'vtpzidqgkxlqinmn',
  },
});

/**
 * Send a styled email
 * @param {string|string[]} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email HTML body
 * @returns {boolean} - True if sent successfully, false otherwise
 */
const sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: `"AriTron LTD" <aritronentertainment@gmail.com>`,
      to,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("❌ Email sending error:", error.message);
    return false;
  }
};

module.exports = sendEmail;
