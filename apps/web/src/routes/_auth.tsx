import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BrandLockup } from "../components/showcase/brand";
import { Toaster } from "../components/ui/toast";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout
});

function AuthLayout() {
  return (
    <main className="relative flex min-h-screen flex-col bg-canvas overflow-hidden">
      {/* Faint dotted canvas, fades to nothing at the edges */}
      <div
        className="absolute inset-0 dotted-canvas opacity-50"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)"
        }}
        aria-hidden
      />
      {/* Accent wash high in the canvas, behind the form */}
      <div
        className="absolute inset-x-0 top-0 h-[480px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 0%, color-mix(in oklch, var(--accent) 14%, transparent) 0%, transparent 65%)"
        }}
        aria-hidden
      />
      {/* Hairline horizon, sits just under the header */}
      <div
        className="absolute inset-x-0 top-[72px] h-px bg-line/60 pointer-events-none"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex">
          <BrandLockup />
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
          Provenance · Records · Sharing
        </span>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <Outlet />
      </div>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle text-center">
          Health records with provenance first
        </p>
      </footer>

      <Toaster />
    </main>
  );
}
