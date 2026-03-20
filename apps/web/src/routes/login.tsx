import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@daveyplate/better-auth-ui";
import { authClient } from "@/lib/auth-client";
import { any } from "zod";

export const Route: any = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary">SanoTalk</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered medical consultations
          </p>
        </div>
        <AuthCard
          view="signIn"
          redirectTo="/dashboard"
        />
      </div>
    </div>
  );
}
