import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification, twoFactor as twoFactorTable } from "@sanotalk/db";
import { resend } from "./lib/resend";

// Structured log helper — avoids raw console.* which bypasses PII scrubbing.
// Redacts emails inline since this package has no access to the server's pino instance.
const authLog = {
  info: (msg: string) => console.info(`[auth] ${msg}`),
  error: (msg: string) => console.error(`[auth] ${msg}`),
  redactEmail: (email: string) => email.slice(0, 3) + "***",
};

// Wrap the drizzle adapter to:
//  1. Force twoFactorEnabled=true on user creation (plugin always writes false explicitly,
//     ignoring the DB column default)
//  2. Manually resolve account joins on findOne (the drizzle adapter's experimental.joins
//     path is unreliable for credential sign-in)
const _baseAdapter = drizzleAdapter(db, {
  provider: "pg",
  schema: { user, session, account, verification, twoFactor: twoFactorTable },
});

function withCustomAdapter(adapterFactory: typeof _baseAdapter): typeof _baseAdapter {
  return (betterAuthOptions: any) => {
    const adapter = adapterFactory(betterAuthOptions);
    const origCreate  = adapter.create.bind(adapter);
    const origFindOne = adapter.findOne.bind(adapter);
    const origFindMany = adapter.findMany.bind(adapter);

    return {
      ...adapter,

      // Force twoFactorEnabled=true for every new user so MFA is active from
      // the first sign-in — no manual setup step required.
      create: async (params: any) => {
        if (params.model === "user") {
          // Always force patient role and 2FA on sign-up — role escalation
          // must go through a separate admin-only mutation, never sign-up.
          params = { ...params, data: { ...params.data, twoFactorEnabled: true, role: "patient" } };
          authLog.info("user row — forcing role=patient, twoFactorEnabled=true");
        }
        if (params.model === "account") {
          authLog.info(`account row for provider: ${params.data?.providerId}`);
        }
        return origCreate(params);
      },

      // Manually resolve joins so Better Auth can find related records.
      // Two relationship directions exist:
      //   many-to-one: parent holds the FK  e.g. session.userId → user.id
      //                → query joined model WHERE id = parent[joinModelId]
      //   one-to-many: child holds the FK   e.g. account.userId → user.id
      //                → query joined model WHERE userId = parent.id
      findOne: async (params: any) => {
        const result = await origFindOne(params);
        if (!result || !params.join || Object.keys(params.join).length === 0) return result;
        const r = result as Record<string, unknown>;
        for (const joinModel of Object.keys(params.join)) {
          const fkOnParent = `${joinModel}Id`; // e.g. "userId" when joinModel="user"
          if (fkOnParent in r) {
            // many-to-one: session → user
            const related = await origFindOne({
              model: joinModel,
              where: [{ field: "id", value: r[fkOnParent] as string }],
            });
            r[joinModel] = related ?? null;
          } else {
            // one-to-many: user → accounts
            const related = await origFindMany({
              model: joinModel,
              where: [{ field: "userId", value: r.id as string }],
            });
            r[joinModel] = related ?? [];
          }
        }
        return result;
      },
    } as any;
  };
}

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: withCustomAdapter(_baseAdapter),
  session: {
    expiresIn: 60 * 60 * 8,      // 8-hour absolute session lifetime
    updateAge: 60 * 15,           // refresh session every 15 min of activity
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: "sanotalk",
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "patient",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Disabled while Resend delivery to Hotmail/Outlook is unreliable with the
    // shared onboarding@resend.dev sender. Re-enable once a verified sending
    // domain is configured (EMAIL_FROM=noreply@yourdomain.com).
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    callbackURL: process.env.APP_URL ?? "http://localhost:5173",
    sendVerificationEmail: async ({ user, token }) => {
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      const verifyUrl = `${appUrl}/verify-email?token=${token}`;
      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      authLog.info(`Sending verification email to ${authLog.redactEmail(user.email)} from ${from}`);
      const { error } = await resend.emails.send({
        from,
        to: user.email,
        subject: "Verify your SanoTalk account",
        html: `<p>Click the link below to verify your SanoTalk account:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>If you did not register, ignore this email.</p>`,
      });
      if (error) {
        authLog.error(`Failed to send verification email: ${(error as any)?.message ?? error}`);
        // Do NOT throw — a failed verification email must not block sign-up.
        // The user can request a resend from the verify-email page.
      } else {
        authLog.info(`Verification email sent to ${authLog.redactEmail(user.email)}`);
      }
    },
  },
  plugins: [
    twoFactor({
      skipVerificationOnEnable: false,
      otpOptions: {
        async sendOTP({ user, otp }) {
          const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
          const { error } = await resend.emails.send({
            from,
            to: user.email,
            subject: "Your SanoTalk security code",
            html: `<p>Your one-time verification code is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in 3 minutes. Do not share it with anyone.</p>`,
          });
          if (error) {
            authLog.error(`Failed to send OTP: ${(error as any)?.message ?? error}`);
            throw new Error(`Failed to send OTP: ${error.message}`);
          }
        },
      },
    }),
  ],
  socialProviders: {},
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.APP_URL!,
    ...(!isProduction && process.env.NGROK_URL ? [process.env.NGROK_URL] : []),
    ...(!isProduction ? ["http://localhost:5173", "http://localhost:3001"] : []),
  ],
});
