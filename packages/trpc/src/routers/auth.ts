import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@sanotalk/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Resend integration — handled in server/src/email.ts
      const { sendEmail } = await import("../../server/src/email.js" as string);
      await sendEmail({
        to: user.email,
        subject: "Verify your SanoTalk account",
        html: `<a href="${url}">Verify Email</a>`,
      });
    },
  },
  socialProviders: {},
  trustedOrigins: [process.env.VITE_API_URL ?? "http://localhost:5173"],
});
