import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "../lib/auth-client";

export const Route: any = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={(href) => navigate({ to: href as any })}
      basePath=""
      viewPaths={{ signIn: "login", signUp: "sign-up" }}
    >
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="w-full max-w-md px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary">SanoTalk</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered medical consultations
            </p>
          </div>
          <AuthCard
            pathname="/sign-up"
            redirectTo="/dashboard"
          />
        </div>
      </div>
    </AuthUIProvider>
  );
}
