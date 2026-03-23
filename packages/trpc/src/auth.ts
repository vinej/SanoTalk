import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@sanotalk/db";
import { Resend } from "resend";

const resend = new Resend("re_fdJ3v5fJ_BXV7ii7TQyRbDMsstZJcvbSQ");

export const auth = betterAuth({
  baseURL: "http://localhost:3001",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "noreply@sanotalk.app",
        to: user.email,
        subject: "Verify your SanoTalk account",
        html: `<a href="${url}">Verify Email</a>`,
      });
      if (error) {
        console.error("[auth] Failed to send verification email:", error);
        throw new Error(`Failed to send verification email: ${error.message}`);
      }
    },
  },
  socialProviders: {},
  trustedOrigins: ['http://localhost:3001', 'http://localhost:5173'],
});
