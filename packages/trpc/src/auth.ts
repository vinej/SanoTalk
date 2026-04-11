import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification, twoFactor as twoFactorTable } from "@sanotalk/db";
import { resend } from "./lib/resend";
import { escapeHtml } from "./lib/escape-html";
import { encrypt, decrypt } from "./lib/crypto";

// Structured JSON log helper — writes to stdout/stderr in a format compatible
// with pino so log aggregators (Loki, etc.) parse it consistently.
// Redacts emails inline since this package has no access to the server's pino instance.
const authLog = {
  info: (msg: string) => process.stdout.write(JSON.stringify({ level: 30, time: Date.now(), msg: `[auth] ${msg}` }) + "\n"),
  error: (msg: string) => process.stderr.write(JSON.stringify({ level: 50, time: Date.now(), msg: `[auth] ${msg}` }) + "\n"),
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

// Fields that must be encrypted at rest in the Better Auth adapter layer
const ENCRYPTED_ADAPTER_FIELDS: Record<string, string[]> = {
  twoFactor: ["secret", "backupCodes"],
  account: ["accessToken", "refreshToken", "idToken"],
};

function encryptAdapterFields(model: string, data: Record<string, any>): Record<string, any> {
  const fields = ENCRYPTED_ADAPTER_FIELDS[model];
  if (!fields) return data;
  const copy = { ...data };
  for (const field of fields) {
    if (copy[field] && typeof copy[field] === "string" && !copy[field].startsWith("enc:v1:")) {
      copy[field] = encrypt(copy[field]);
    }
  }
  return copy;
}

function decryptAdapterFields(model: string, row: any): any {
  if (!row) return row;
  const fields = ENCRYPTED_ADAPTER_FIELDS[model];
  if (!fields) return row;
  const copy = { ...row };
  for (const field of fields) {
    if (copy[field] && typeof copy[field] === "string" && copy[field].startsWith("enc:v1:")) {
      try {
        copy[field] = decrypt(copy[field]);
      } catch {
        // If decryption fails, return as-is (could be pre-migration plaintext)
      }
    }
  }
  return copy;
}

function withCustomAdapter(adapterFactory: typeof _baseAdapter): typeof _baseAdapter {
  return (betterAuthOptions: any) => {
    const adapter = adapterFactory(betterAuthOptions);
    const origCreate  = adapter.create.bind(adapter);
    const origFindOne = adapter.findOne.bind(adapter);
    const origFindMany = adapter.findMany.bind(adapter);
    const origUpdate = (adapter as any).update?.bind(adapter);

    return {
      ...adapter,

      // Force twoFactorEnabled=true for every new user so MFA is active from
      // the first sign-in — no manual setup step required.
      // Encrypt sensitive fields in twoFactor and account models at rest.
      create: async (params: any) => {
        if (params.model === "user") {
          // Always force patient role and 2FA on sign-up — role escalation
          // must go through a separate admin-only mutation, never sign-up.
          params = { ...params, data: { ...params.data, twoFactorEnabled: true, role: "patient", approved: false } };
          authLog.info("user row — forcing role=patient, twoFactorEnabled=true");
        }
        if (params.model === "account") {
          authLog.info(`account row for provider: ${params.data?.providerId}`);
        }
        // Encrypt sensitive fields before writing to DB
        if (ENCRYPTED_ADAPTER_FIELDS[params.model]) {
          params = { ...params, data: encryptAdapterFields(params.model, params.data) };
        }
        const result = await origCreate(params);
        return decryptAdapterFields(params.model, result);
      },

      // Encrypt on update for twoFactor and account models
      update: origUpdate ? async (params: any) => {
        if (ENCRYPTED_ADAPTER_FIELDS[params.model] && params.update) {
          params = { ...params, update: encryptAdapterFields(params.model, params.update) };
        }
        const result = await origUpdate(params);
        return decryptAdapterFields(params.model, result);
      } : undefined,

      // Manually resolve joins so Better Auth can find related records.
      // Decrypt sensitive fields after reading from DB.
      findOne: async (params: any) => {
        let result = await origFindOne(params);
        result = decryptAdapterFields(params.model, result);
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
            r[joinModel] = (related ?? []).map((item: any) => decryptAdapterFields(joinModel, item));
          }
        }
        return result;
      },

      findMany: async (params: any) => {
        const results = await origFindMany(params);
        if (!Array.isArray(results) || !ENCRYPTED_ADAPTER_FIELDS[params.model]) return results;
        return results.map((row: any) => decryptAdapterFields(params.model, row));
      },
    } as any;
  };
}

// Treat as production if NODE_ENV says so, OR if APP_URL is not localhost (deployed but NODE_ENV forgotten)
const appUrl = process.env.APP_URL ?? "";
const isProduction = process.env.NODE_ENV === "production"
  || (!appUrl.includes("localhost") && !appUrl.includes("127.0.0.1") && appUrl.length > 0);

// ── Per-account login lockout ──────────────────────────────────────────────
// Tracks failed sign-in attempts per email. Locks the account for 15 minutes
// after 5 consecutive failures — complements the per-IP rate limiter in index.ts.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of loginAttempts) {
    if (now > entry.lockedUntil + LOGIN_LOCKOUT_MS) loginAttempts.delete(email);
  }
}, 10 * 60 * 1000);

export function checkAccountLockout(email: string): void {
  const entry = loginAttempts.get(email);
  if (!entry) return;
  if (entry.lockedUntil > Date.now()) {
    throw new Error("Account temporarily locked due to too many failed login attempts. Please try again later.");
  }
  // Lockout expired — reset
  if (entry.count >= LOGIN_MAX_ATTEMPTS) loginAttempts.delete(email);
}

export function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginAttempts.set(email, entry);
}

export function clearFailedLogins(email: string): void {
  loginAttempts.delete(email);
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: withCustomAdapter(_baseAdapter),
  session: {
    expiresIn: 60 * 60 * 8,      // 8-hour absolute session lifetime
    updateAge: 60 * 15,           // refresh session every 15 min of activity
    cookieCache: { enabled: true, maxAge: 60 },  // 1 min — short window for PHI app
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
      approved: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      async hash(password: string) {
        // Validate complexity before hashing — reject weak passwords server-side
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
          throw new Error("Password must contain uppercase, lowercase, number, and special character");
        }
        // Use Better Auth's default bcrypt hashing
        const { hashPassword } = await import("better-auth/crypto");
        return hashPassword(password);
      },
      async verify({ password, hash: storedHash }) {
        const { verifyPassword } = await import("better-auth/crypto");
        return verifyPassword({ password, hash: storedHash });
      },
    },
    // Disabled while Resend delivery to Hotmail/Outlook is unreliable with the
    // shared onboarding@resend.dev sender. Re-enable once a verified sending
    // domain is configured (EMAIL_FROM=noreply@yourdomain.com).
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600, // 1 hour — limits window for token leakage via email/browser history
    // callbackURL handled by the verification link in sendVerificationEmail
    sendVerificationEmail: async ({ user, token }) => {
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      const verifyUrl = `${appUrl}/verify-email?token=${token}`;
      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      authLog.info(`Sending verification email to ${authLog.redactEmail(user.email)} from ${from}`);
      const { error } = await resend.emails.send({
        from,
        to: user.email,
        subject: "Verify your SanoTalk account",
        html: `<p>Click the link below to verify your SanoTalk account:</p><p><a href="${escapeHtml(verifyUrl)}">Verify Email</a></p><p>If you did not register, ignore this email.</p>`,
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
            throw new Error("Failed to send verification code. Please try again.");
          }
        },
      },
    }),
  ],
  socialProviders: {},
  trustedOrigins: [
    process.env.APP_URL!,
    // Trust both www and non-www variants of the app URL
    ...(process.env.APP_URL ? [process.env.APP_URL.replace("://", "://www.")] : []),
    ...(!isProduction && process.env.NGROK_URL && /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.app$/.test(process.env.NGROK_URL) ? [process.env.NGROK_URL] : []),
    ...(!isProduction ? ["http://localhost:5173", "http://localhost:3001"] : []),
  ],
});
