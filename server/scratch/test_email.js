require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_PORT == 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_USER, // Send to self for testing
      subject: 'Hello World Test',
      text: 'This is a test email to verify SMTP credentials.'
    });
    console.log('✅ Email sent successfully:', info.messageId);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testEmail();
