import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string | undefined;
}

export async function sendEmail(opts: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@sanotalk.app",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text? opts.text : 'undefined',
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
  return data;
}
