import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Mail, Lock } from "lucide-react";
import { z } from "zod";
import { signIn } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label, FieldHint } from "../components/ui/label";
import { toast } from "../components/ui/toast";

const loginSearchSchema = z.object({
  redirect: z.string().optional()
});

export const Route = createFileRoute("/_auth/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/login" });
  const redirectTo =
    search.redirect && search.redirect.startsWith("/") && !search.redirect.startsWith("//")
      ? search.redirect
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        toast.error(result.error.message ?? "Invalid credentials");
        return;
      }
      await navigate({ to: redirectTo });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px] animate-[slide-up_0.32s_cubic-bezier(0.32,0.72,0.4,1)]">
      <div className="mb-7">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
          Operator · Sign in
        </span>
        <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.025em] text-ink leading-[1.1]">
          Welcome <span className="italic font-normal text-accent">back</span>.
        </h1>
        <p className="mt-1.5 text-[14px] text-muted leading-relaxed">
          Resume control of your records and sharing policies.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-[12px] border border-line bg-surface p-6 shadow-md"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            size="lg"
            placeholder="you@clinic.org"
            autoComplete="email"
            leadingIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
          </div>
          <Input
            id="password"
            type="password"
            size="lg"
            autoComplete="current-password"
            leadingIcon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FieldHint>Use the password set when your account was provisioned.</FieldHint>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          trailingIcon={<ArrowRight />}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        Don&apos;t have an account?{" "}
        <Link
          to="/signup"
          className="text-accent font-medium hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
