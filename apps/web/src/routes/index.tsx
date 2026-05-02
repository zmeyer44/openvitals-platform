import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowRight, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { BrandLockup, BrandMark } from "../components/showcase/brand";

export const Route = createFileRoute("/")({
  component: Home
});

function Home() {
  return (
    <main className="min-h-screen bg-canvas grid place-items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <BrandLockup className="mb-10" />
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
            Platform · Backend wired
          </span>
          <span className="h-px flex-1 bg-line" />
          <Badge variant="success" size="sm" dot>
            Live
          </Badge>
        </div>
        <h1 className="text-[44px] font-semibold tracking-[-0.025em] text-ink leading-[1.05]">
          Health records with{" "}
          <span className="text-accent">provenance</span>{" "}
          first.
        </h1>
        <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-xl">
          Backend foundation is wired for canonical records, durable import jobs, review tasks,
          outbox events, audit trails, integrations, and SQL-enforced sharing.
        </p>

        <div className="mt-8 flex items-center gap-2">
          <Link to="/documents/intake">
            <Button variant="primary" size="lg" trailingIcon={<Plus />}>
              Start document intake
            </Button>
          </Link>
          <Link to="/components">
            <Button variant="secondary" size="lg" trailingIcon={<ArrowRight />}>
              Open components
            </Button>
          </Link>
          <Button variant="secondary" size="lg" trailingIcon={<ArrowUpRight />}>
            View source
          </Button>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-px rounded-[10px] border border-line bg-line overflow-hidden">
          {[
            { label: "Import API", value: "POST /api/imports" },
            { label: "Worker job", value: "import.health_data" },
            { label: "Database", value: "Postgres + Drizzle" }
          ].map((s) => (
            <div key={s.label} className="bg-surface px-4 py-3.5">
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-muted">
                {s.label}
              </div>
              <div className="mt-1 font-mono text-[13px] text-ink truncate">{s.value}</div>
            </div>
          ))}
        </div>

        <footer className="mt-16 flex items-center gap-3 text-[12px] text-muted">
          <BrandMark size={18} />
          <span>OpenVitals platform — {new Date().getFullYear()}</span>
        </footer>
      </div>
    </main>
  );
}
