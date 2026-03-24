import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import type { auth } from "@sanotalk/trpc/auth";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      // auth-ui already navigates to /two-factor via TanStack Router's navigate().
      // A hard window.location redirect here causes a redundant full-page reload
      // which doubles every OTP send. Leave this as a no-op.
      onTwoFactorRedirect() {},
    }),
  ],
});

export const { useSession, signIn, signOut, signUp } = authClient;
