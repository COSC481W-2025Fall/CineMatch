// mern/server/utils/email.js
import nodemailer from "nodemailer";

// Read the SMTP port from the environment, default to 587 if not set
const PORT = Number(process.env.SMTP_PORT || 587);

// Create a reusable Nodemailer transporter using SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: PORT,
    secure: PORT === 465,          // true for 465, false for 587
    // Login credentials for the SMTP server
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    // Enable logging options during debugging:
    logger: true,
    debug: true,
});

// Helper function to send an email
export async function sendMail({ to, subject, text, html, from }) {
    const mailFrom = from || `"CineMatch" <${process.env.SMTP_USER}>`;
    // Optional - verify connection at startup or once
    // await transporter.verify();

    const info = await transporter.sendMail({ from: mailFrom, to, subject, text, html });
    return info; 
}