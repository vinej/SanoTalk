import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification, twoFactor as twoFactorTable } from "@sanotalk/db";
import { resend } from "./lib/resend";

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
          params = { ...params, data: { ...params.data, twoFactorEnabled: true } };
          console.log("[auth:create] user row — forcing twoFactorEnabled=true");
        }
        if (params.model === "account") {
          console.log("[auth:create] account row for userId:", params.data?.userId, "provider:", params.data?.providerId);
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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: withCustomAdapter(_baseAdapter),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "patient",
        input: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Disabled while Resend delivery to Hotmail/Outlook is unreliable with the
    // shared onboarding@resend.dev sender. Re-enable once a verified sending
    // domain is configured (EMAIL_FROM=noreply@yourdomain.com).
    requireEmailVerification: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    callbackURL: process.env.APP_URL ?? "http://localhost:5173",
    sendVerificationEmail: async ({ user, token }) => {
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      const verifyUrl = `${appUrl}/verify-email?token=${token}`;
      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      console.info(`[auth] Sending verification email to ${user.email} from ${from}`);
      const { error } = await resend.emails.send({
        from,
        to: user.email,
        subject: "Verify your SanoTalk account",
        html: `<p>Click the link below to verify your SanoTalk account:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>If you did not register, ignore this email.</p>`,
      });
      if (error) {
        console.error("[auth] Failed to send verification email:", error);
        // Do NOT throw — a failed verification email must not block sign-up.
        // The user can request a resend from the verify-email page.
      } else {
        console.info(`[auth] Verification email sent to ${user.email}`);
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
            console.error("[auth] Failed to send OTP:", error);
            throw new Error(`Failed to send OTP: ${error.message}`);
          }
        },
      },
    }),
  ],
  socialProviders: {},
  trustedOrigins: [process.env.BETTER_AUTH_URL!, process.env.APP_URL!],
});
