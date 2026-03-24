import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@sanotalk/db";
import { Resend } from "resend";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
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
      const resend = new Resend(process.env.RESEND_API_KEY);
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
  trustedOrigins: [process.env.BETTER_AUTH_URL!, process.env.APP_URL!],
});
