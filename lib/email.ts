import nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  senderName?: string;
  hostelName?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_PORT || '465') === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, body, html, senderName, hostelName }: EmailPayload) {
  try {
    const rawFrom = process.env.SMTP_FROM || 'Kupera <noreply@kupera.in>';
    // Clean outer quotes if any were passed in .env
    const cleanedFrom = rawFrom.replace(/^["']|["']$/g, '');

    // Extract email address between < > or use fallback user
    const emailMatch = cleanedFrom.match(/<([^>]+)>/);
    const emailAddress = emailMatch ? emailMatch[1] : (process.env.SMTP_USER || cleanedFrom);

    // If a specific hostel name is provided, display: "Hostel Name (via Kupera) <address>"
    const customName = hostelName || senderName;
    const displayName = customName
      ? `${customName.trim()} (via Kupera)`
      : cleanedFrom.includes('<')
      ? cleanedFrom.replace(/<[^>]+>/, '').trim()
      : 'Kupera';

    const fromAddress = `"${displayName}" <${emailAddress}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: body || '',
      html: html || undefined,
    });
    
    console.log(`[SMTP] Email dispatched to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[SMTP] Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

