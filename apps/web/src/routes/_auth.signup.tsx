import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail, Lock, User } from "lucide-react";
import { signUp } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label, FieldHint } from "../components/ui/label";
import { toast } from "../components/ui/toast";

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        toast.error(result.error.message ?? "Sign up failed");
        return;
      }
      toast.success("Account created. Welcome to OpenVitals.");
      await navigate({ to: "/" });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] animate-[slide-up_0.32s_cubic-bezier(0.32,0.72,0.4,1)]">
      <div className="mb-7">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
          Operator · New account
        </span>
        <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.025em] text-ink leading-[1.1]">
          Take <span className="italic font-normal text-accent">command</span> of
          your records.
        </h1>
        <p className="mt-1.5 text-[14px] text-muted leading-relaxed">
          Create the operator account that will own this OpenVitals workspace.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-[12px] border border-line bg-surface p-6 shadow-md"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name" required>
            Your name
          </Label>
          <Input
            id="name"
            size="lg"
            autoComplete="name"
            leadingIcon={<User />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Work email
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
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            size="lg"
            minLength={8}
            autoComplete="new-password"
            leadingIcon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FieldHint>Minimum 8 characters.</FieldHint>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          trailingIcon={<ArrowRight />}
        >
          Create account
        </Button>

        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle text-center pt-1">
          Provenance is recorded from your first record onward
        </p>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-accent font-medium hover:underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
