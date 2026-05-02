import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  CircleDashed,
  Eye,
  FileText,
  RefreshCw,
  Save,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { BrandLockup } from "../components/showcase/brand";
import { cn } from "../lib/cn";

export const Route = createFileRoute("/documents/intake")({
  component: DocumentIntake
});

type ImportStatus =
  | "uploaded"
  | "classified"
  | "parsed"
  | "normalized"
  | "needs_review"
  | "completed"
  | "failed";

type ImportJob = {
  id: string;
  status: ImportStatus;
  errorCode: string | null;
  errorMessage: string | null;
  metrics: Record<string, unknown>;
};

type SourceDocument = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  status: ImportStatus;
  classification: string | null;
  parserName: string | null;
  parserVersion: string | null;
  sha256: string | null;
};

type FileClassification = {
  id: string;
  parserName: string;
  parserVersion: string;
  decision: string;
  classification: string;
  confidence: string | null;
  selected: boolean;
  reason: string | null;
};

type StatusHistoryItem = {
  id: string;
  toStatus: ImportStatus;
  fromStatus: ImportStatus | null;
  actorType: string;
  reason: string | null;
  errorCode: string | null;
  createdAt: string;
};

type SourceRecord = {
  id: string;
  recordType: string;
  sourceText: string | null;
  extractionConfidence: string | null;
  originalPayload: Record<string, unknown>;
  warnings: Record<string, unknown>;
  reviewState: string;
};

type ReviewTask = {
  id: string;
  sourceRecordId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  confidence: string | null;
  suggestedValue: Record<string, unknown> | null;
};

type ObservationRecord = {
  id: string;
  sourceRecordId: string;
  displayName: string;
  category: "labs" | "vitals";
  observedAt: string | null;
  observedAtUnknown: boolean;
  originalValue: string | null;
  valueNumeric: string | null;
  valueText: string | null;
  normalizedValueNumeric: string | null;
  unitOriginal: string | null;
  unitNormalized: string | null;
  confidence: string | null;
  reviewState: string;
  trustLevel: string;
};

type CanonicalRecordItem =
  | { resourceType: "observation"; record: ObservationRecord }
  | { resourceType: "condition" | "medication" | "encounter"; record: Record<string, unknown> };

type QueueJob = {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
};

type ImportDetail = {
  importJob: ImportJob;
  sourceDocument: SourceDocument;
  classifications: FileClassification[];
  history: StatusHistoryItem[];
  sourceRecords: SourceRecord[];
  canonicalRecords: CanonicalRecordItem[];
  reviewTasks: ReviewTask[];
  queueJob: QueueJob | null;
};

type ObservationDraft = {
  displayName: string;
  observedAt: string;
  observedAtUnknown: boolean;
  value: string;
  unit: string;
  note: string;
};

type AuthMode = "sign-in" | "sign-up";

const finalImportStatuses = new Set<ImportStatus>(["completed", "needs_review", "failed"]);

function statusVariant(status: ImportStatus): React.ComponentProps<typeof Badge>["variant"] {
  if (status === "completed") return "success";
  if (status === "needs_review") return "warning";
  if (status === "failed") return "danger";
  return "info";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function confidenceLabel(confidence: string | null): string {
  if (!confidence) return "unknown";
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) return confidence;
  return `${Math.round(parsed * 100)}%`;
}

function dateInputValue(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function buildObservationDraft(record: ObservationRecord): ObservationDraft {
  return {
    displayName: record.displayName,
    observedAt: dateInputValue(record.observedAt),
    observedAtUnknown: record.observedAtUnknown,
    value: record.valueNumeric ?? record.valueText ?? record.originalValue ?? "",
    unit: record.unitNormalized ?? record.unitOriginal ?? "",
    note: ""
  };
}

function sameObservationDraft(a: ObservationDraft, b: ObservationDraft): boolean {
  return (
    a.displayName === b.displayName &&
    a.observedAt === b.observedAt &&
    a.observedAtUnknown === b.observedAtUnknown &&
    a.value === b.value &&
    a.unit === b.unit &&
    a.note === b.note
  );
}

function findReviewTask(detail: ImportDetail, item: CanonicalRecordItem): ReviewTask | null {
  const record = item.record as { id?: unknown; sourceRecordId?: unknown };
  const resourceId = typeof record.id === "string" ? record.id : null;
  const sourceRecordId = typeof record.sourceRecordId === "string" ? record.sourceRecordId : null;

  return (
    detail.reviewTasks.find(
      (task) =>
        task.status === "open" &&
        ((task.resourceType === item.resourceType && task.resourceId === resourceId) ||
          (sourceRecordId && task.sourceRecordId === sourceRecordId))
    ) ?? null
  );
}

function sourceRecordForItem(detail: ImportDetail, item: CanonicalRecordItem): SourceRecord | null {
  const record = item.record as { sourceRecordId?: unknown };
  const sourceRecordId = typeof record.sourceRecordId === "string" ? record.sourceRecordId : null;
  if (!sourceRecordId) return null;
  return detail.sourceRecords.find((sourceRecord) => sourceRecord.id === sourceRecordId) ?? null;
}

function useImportPolling(importJobId: string | null) {
  const [detail, setDetail] = React.useState<ImportDetail | null>(null);
  const [rawText, setRawText] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [authRequired, setAuthRequired] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!importJobId) return null;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/imports/${importJobId}`, { credentials: "include" });
      if (response.status === 401) {
        setAuthRequired(true);
        return null;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not load import detail.");
      }

      const nextDetail = (await response.json()) as ImportDetail;
      setDetail(nextDetail);

      const documentResponse = await fetch(`/api/imports/${importJobId}/document`, {
        credentials: "include"
      });
      const mimeType = nextDetail.sourceDocument.mimeType ?? "";
      if (documentResponse.ok && (mimeType.startsWith("text/") || mimeType.includes("csv") || mimeType.includes("json"))) {
        setRawText(await documentResponse.text());
      } else if (!documentResponse.ok) {
        setRawText("");
      }

      return nextDetail;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setLoading(false);
    }
  }, [importJobId]);

  const detailRef = React.useRef<ImportDetail | null>(null);
  React.useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  React.useEffect(() => {
    if (!importJobId) {
      setDetail(null);
      setRawText("");
      detailRef.current = null;
      return undefined;
    }

    void refresh();

    const interval = window.setInterval(() => {
      const current = detailRef.current;
      if (current && finalImportStatuses.has(current.importJob.status)) return;
      void refresh();
    }, 1600);

    return () => {
      window.clearInterval(interval);
    };
  }, [importJobId, refresh]);

  return { detail, rawText, loading, error, authRequired, setAuthRequired, refresh };
}

function DocumentIntake() {
  const [importJobId, setImportJobId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>("sign-up");
  const [authName, setAuthName] = React.useState("Alex Rivera");
  const [authEmail, setAuthEmail] = React.useState("alex.intake@example.test");
  const [authPassword, setAuthPassword] = React.useState("openvitals-dev-pass");
  const [authError, setAuthError] = React.useState<string | null>(null);
  const { detail, rawText, loading, error, authRequired, setAuthRequired, refresh } =
    useImportPolling(importJobId);

  React.useEffect(() => {
    void checkSession();
  }, []);

  async function checkSession() {
    const response = await fetch("/api/auth/get-session", { credentials: "include" });
    const payload = await response.json().catch(() => null);
    const hasSession = Boolean(payload?.user || payload?.session);
    setAuthenticated(hasSession);
    setAuthRequired(!hasSession);
    setAuthChecked(true);
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);

    const endpoint = authMode === "sign-up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
    const body =
      authMode === "sign-up"
        ? { email: authEmail, password: authPassword, name: authName }
        : { email: authEmail, password: authPassword };

    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      setAuthError(payload?.message ?? payload?.error ?? "Authentication failed.");
      return;
    }

    await checkSession();
    if (importJobId) {
      await refresh();
    }
  }

  async function uploadDocument() {
    if (!selectedFile) {
      setUploadError("Select a document first.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/imports", {
      method: "POST",
      credentials: "include",
      body: formData
    });

    if (response.status === 401) {
      setAuthRequired(true);
      setAuthenticated(false);
      setUploading(false);
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setUploadError(payload?.error ?? "Upload failed.");
      setUploading(false);
      return;
    }

    const payload = (await response.json()) as { importJobId: string };
    setImportJobId(payload.importJobId);
    setUploading(false);
  }

  const observationItems = detail?.canonicalRecords.filter(
    (item): item is Extract<CanonicalRecordItem, { resourceType: "observation" }> => item.resourceType === "observation"
  ) ?? [];
  const openReviewTasks = detail?.reviewTasks.filter((task) => task.status === "open") ?? [];

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon-sm" aria-label="Back to home">
              <ChevronLeft />
            </Button>
          </Link>
          <BrandLockup />
          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="hidden text-[13px] font-medium text-muted sm:block">Document intake</span>
        </div>
        <div className="flex items-center gap-2">
          {detail && (
            <Badge variant={statusVariant(detail.importJob.status)} dot>
              {statusLabel(detail.importJob.status)}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<RefreshCw />}
            disabled={!importJobId || loading}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-56px)] lg:grid-cols-[45vw_1fr]">
        <section className="border-b border-line bg-[#eaf1fb] px-4 py-5 lg:border-b-0 lg:border-r lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-[620px] flex-col gap-5">
            <UploadPanel
              authChecked={authChecked}
              authenticated={authenticated}
              selectedFile={selectedFile}
              uploading={uploading}
              error={uploadError}
              onFileChange={setSelectedFile}
              onUpload={() => void uploadDocument()}
            />
            <SourcePreview detail={detail} importJobId={importJobId} rawText={rawText} />
          </div>
        </section>

        <section className="bg-surface px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[880px]">
            {authRequired && (
              <AuthPanel
                mode={authMode}
                name={authName}
                email={authEmail}
                password={authPassword}
                error={authError}
                onModeChange={setAuthMode}
                onNameChange={setAuthName}
                onEmailChange={setAuthEmail}
                onPasswordChange={setAuthPassword}
                onSubmit={(event) => void submitAuth(event)}
              />
            )}

            {!authRequired && (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[12px] font-medium text-accent">
                      <ShieldCheck className="size-4" />
                      <span>Provenance review</span>
                    </div>
                    <h1 className="mt-2 text-[34px] font-semibold leading-tight text-ink">
                      {detail?.sourceDocument.fileName ?? "Document confirmation"}
                    </h1>
                    <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">
                      Compare the uploaded source against extracted records, then confirm or correct each item.
                    </p>
                  </div>

                  {detail && (
                    <div className="grid min-w-[260px] grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-line bg-line">
                      <StatusMetric label="Records" value={String(detail.canonicalRecords.length)} />
                      <StatusMetric label="Open review" value={String(openReviewTasks.length)} />
                    </div>
                  )}
                </div>

                {error && (
                  <InlineAlert tone="danger" icon={<AlertCircle />}>
                    {error}
                  </InlineAlert>
                )}

                {!detail && (
                  <EmptyParsedState />
                )}

                {detail && (
                  <div className="space-y-5">
                    <ImportTimeline history={detail.history} classifications={detail.classifications} />

                    {detail.importJob.status === "failed" && (
                      <InlineAlert tone="danger" icon={<AlertCircle />}>
                        {detail.importJob.errorMessage ?? detail.importJob.errorCode ?? "Import failed."}
                      </InlineAlert>
                    )}

                    {observationItems.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-[18px] font-semibold text-ink">Parsed observations</h2>
                          <Badge variant="accent">{observationItems.length} items</Badge>
                        </div>
                        {observationItems.map((item, index) => (
                          <ObservationReviewItem
                            key={item.record.id}
                            index={index + 1}
                            item={item}
                            sourceRecord={sourceRecordForItem(detail, item)}
                            reviewTask={findReviewTask(detail, item)}
                            onResolved={refresh}
                          />
                        ))}
                      </div>
                    ) : (
                      <DocumentReviewTasks detail={detail} onResolved={refresh} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function UploadPanel({
  authChecked,
  authenticated,
  selectedFile,
  uploading,
  error,
  onFileChange,
  onUpload
}: {
  authChecked: boolean;
  authenticated: boolean;
  selectedFile: File | null;
  uploading: boolean;
  error: string | null;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-[7px] border border-dashed border-[#abc4e7] bg-white px-3 py-2 text-[13px] text-muted">
          <UploadCloud className="size-5 text-accent" />
          <span className="min-w-0 flex-1 truncate">
            {selectedFile ? selectedFile.name : "Upload CSV, PDF, image, or structured export"}
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".csv,text/csv,application/pdf,image/*,.json,application/json"
            onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <Button
          variant="primary"
          size="lg"
          leadingIcon={<UploadCloud />}
          loading={uploading}
          disabled={!authChecked || !authenticated || !selectedFile}
          onClick={onUpload}
        >
          Scan
        </Button>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      {!authenticated && authChecked && (
        <p className="mt-2 text-[12.5px] text-muted">Sign in to attach uploads to your health record.</p>
      )}
    </div>
  );
}

function SourcePreview({
  detail,
  importJobId,
  rawText
}: {
  detail: ImportDetail | null;
  importJobId: string | null;
  rawText: string;
}) {
  const mimeType = detail?.sourceDocument.mimeType ?? "";
  const documentUrl = importJobId ? `/api/imports/${importJobId}/document` : "";

  return (
    <div className="overflow-hidden rounded-[8px] border border-white/70 bg-white shadow-md">
      <div className="flex items-center justify-center gap-2 border-b border-line bg-[#f7fbff] px-4 py-3 text-[13px] font-medium text-[#4e78b8]">
        <Check className="size-4" />
        <span>{detail ? "Scan complete." : "Ready to scan."}</span>
      </div>
      <div className="min-h-[520px] bg-[#f8fafc] p-4">
        {!detail && (
          <div className="grid min-h-[488px] place-items-center rounded-[7px] border border-dashed border-[#bdd0ec] bg-white/70 text-center">
            <div>
              <FileText className="mx-auto mb-3 size-8 text-[#7a9dd2]" />
              <div className="text-[14px] font-medium text-ink">Source preview</div>
              <div className="mt-1 text-[12.5px] text-muted">The uploaded document appears here.</div>
            </div>
          </div>
        )}

        {detail && mimeType.startsWith("image/") && (
          <img
            src={documentUrl}
            alt={detail.sourceDocument.fileName ?? "Uploaded source document"}
            className="mx-auto max-h-[720px] w-auto max-w-full rounded-[7px] border border-line bg-white object-contain shadow-sm"
          />
        )}

        {detail && mimeType === "application/pdf" && (
          <iframe
            title={detail.sourceDocument.fileName ?? "Uploaded source document"}
            src={documentUrl}
            className="h-[720px] w-full rounded-[7px] border border-line bg-white shadow-sm"
          />
        )}

        {detail && !mimeType.startsWith("image/") && mimeType !== "application/pdf" && (
          <RawTextDocument rawText={rawText} fileName={detail.sourceDocument.fileName ?? "Uploaded document"} />
        )}
      </div>
    </div>
  );
}

function RawTextDocument({ rawText, fileName }: { rawText: string; fileName: string }) {
  const lines = rawText.trim() ? rawText.trim().split(/\r?\n/) : [];

  return (
    <div className="mx-auto min-h-[640px] max-w-[480px] rounded-[7px] border border-line bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="text-[18px] font-semibold text-ink">OpenVitals import</div>
          <div className="mt-1 max-w-[260px] truncate text-[12px] text-muted">{fileName}</div>
        </div>
        <Badge variant="accent">Raw</Badge>
      </div>
      {lines.length > 0 ? (
        <pre className="overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-ink">
          {rawText}
        </pre>
      ) : (
        <div className="grid min-h-[420px] place-items-center text-[13px] text-muted">
          Waiting for document bytes.
        </div>
      )}
    </div>
  );
}

function AuthPanel({
  mode,
  name,
  email,
  password,
  error,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mb-6 rounded-[8px] border border-line bg-surface-muted p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">Sign in to review documents</h1>
          <p className="mt-1 text-[13px] text-muted">Uploads and corrections are stored under your owner record.</p>
        </div>
        <div className="inline-flex rounded-[7px] border border-line bg-surface p-0.5">
          <button
            type="button"
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium",
              mode === "sign-in" ? "bg-ink text-canvas" : "text-muted"
            )}
            onClick={() => onModeChange("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium",
              mode === "sign-up" ? "bg-ink text-canvas" : "text-muted"
            )}
            onClick={() => onModeChange("sign-up")}
          >
            Create
          </button>
        </div>
      </div>

      <form className="grid gap-3 sm:grid-cols-3" onSubmit={onSubmit}>
        {mode === "sign-up" && (
          <label className="grid gap-1.5 text-[12px] font-medium text-muted">
            Name
            <Input value={name} onChange={(event) => onNameChange(event.currentTarget.value)} />
          </label>
        )}
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Email
          <Input type="email" value={email} onChange={(event) => onEmailChange(event.currentTarget.value)} />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Password
          <Input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.currentTarget.value)}
          />
        </label>
        <div className="flex items-end">
          <Button className="w-full" type="submit" variant="primary" size="lg">
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-muted px-3 py-2.5">
      <div className="text-[10.5px] font-medium uppercase text-muted">{label}</div>
      <div className="mt-1 font-mono text-[18px] text-ink">{value}</div>
    </div>
  );
}

function InlineAlert({
  tone,
  icon,
  children
}: {
  tone: "warning" | "danger" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px]",
        tone === "danger" && "border-danger/20 bg-danger-soft text-danger-foreground",
        tone === "warning" && "border-warning/20 bg-warning-soft text-warning-foreground",
        tone === "info" && "border-info/20 bg-info-soft text-info-foreground"
      )}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function EmptyParsedState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-[8px] border border-dashed border-line bg-surface-muted">
      <div className="text-center">
        <Eye className="mx-auto mb-3 size-8 text-subtle" />
        <div className="text-[15px] font-medium text-ink">Parsed output</div>
        <div className="mt-1 text-[13px] text-muted">Upload a document to begin review.</div>
      </div>
    </div>
  );
}

function ImportTimeline({
  history,
  classifications
}: {
  history: StatusHistoryItem[];
  classifications: FileClassification[];
}) {
  const selected = classifications.find((classification) => classification.selected);

  return (
    <div className="rounded-[8px] border border-line bg-surface-muted p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <CircleDashed className="size-4 text-accent" />
          <span>Import pipeline</span>
        </div>
        {selected && (
          <Badge variant="muted">
            {selected.classification} · {confidenceLabel(selected.confidence)}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((item) => (
          <Badge key={item.id} variant={statusVariant(item.toStatus)}>
            {statusLabel(item.toStatus)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ObservationReviewItem({
  index,
  item,
  sourceRecord,
  reviewTask,
  onResolved
}: {
  index: number;
  item: Extract<CanonicalRecordItem, { resourceType: "observation" }>;
  sourceRecord: SourceRecord | null;
  reviewTask: ReviewTask | null;
  onResolved: () => Promise<ImportDetail | null>;
}) {
  const observation = item.record;
  const initialDraft = React.useMemo(() => buildObservationDraft(observation), [observation]);
  const [draft, setDraft] = React.useState<ObservationDraft>(initialDraft);
  const [busy, setBusy] = React.useState<"confirm" | "correct" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const changed = !sameObservationDraft(draft, initialDraft);

  async function submit(action: "confirm" | "correct") {
    setBusy(action);
    setError(null);

    const endpoint = reviewTask
      ? `/api/review-tasks/${reviewTask.id}/resolve`
      : `/api/records/${item.resourceType}/${observation.id}/action`;
    const corrections = {
      displayName: draft.displayName,
      observedAt: draft.observedAtUnknown || draft.observedAt === "" ? null : draft.observedAt,
      observedAtUnknown: draft.observedAtUnknown,
      originalValue: draft.value === "" ? null : draft.value,
      valueNumeric: draft.value === "" ? null : draft.value,
      normalizedValueNumeric: draft.value === "" ? null : draft.value,
      unitOriginal: draft.unit === "" ? null : draft.unit,
      unitNormalized: draft.unit === "" ? null : draft.unit
    };

    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        note: draft.note || undefined,
        corrections: action === "correct" ? corrections : undefined
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Review action failed.");
      setBusy(null);
      return;
    }

    await onResolved();
    setBusy(null);
  }

  return (
    <div className="rounded-[8px] border border-line bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 font-mono text-[12px] text-muted">{String(index).padStart(2, "0")}</span>
          <div>
            <div className="text-[15px] font-semibold text-ink">{observation.displayName}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant={reviewTask ? "warning" : "muted"}>
                {reviewTask ? statusLabel(reviewTask.reason) : statusLabel(observation.reviewState)}
              </Badge>
              <Badge variant="outline">{confidenceLabel(observation.confidence)}</Badge>
              <Badge variant="outline">{statusLabel(observation.trustLevel)}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Check />}
            loading={busy === "confirm"}
            disabled={busy !== null || observation.reviewState === "confirmed"}
            onClick={() => void submit("confirm")}
          >
            Confirm
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Save />}
            loading={busy === "correct"}
            disabled={busy !== null || !changed}
            onClick={() => void submit("correct")}
          >
            Save correction
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr]">
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Test
          <Input
            value={draft.displayName}
            onChange={(event) => setDraft((current) => ({ ...current, displayName: event.currentTarget.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Result
          <Input
            value={draft.value}
            onChange={(event) => setDraft((current) => ({ ...current, value: event.currentTarget.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Unit
          <Input
            value={draft.unit}
            onChange={(event) => setDraft((current) => ({ ...current, unit: event.currentTarget.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-muted">
          Date
          <Input
            type="date"
            value={draft.observedAt}
            disabled={draft.observedAtUnknown}
            onChange={(event) => setDraft((current) => ({ ...current, observedAt: event.currentTarget.value }))}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={draft.observedAtUnknown}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                observedAtUnknown: event.currentTarget.checked,
                observedAt: event.currentTarget.checked ? "" : current.observedAt
              }))
            }
          />
          Date unknown
        </label>
        <Input
          className="max-w-[360px]"
          placeholder="Reviewer note"
          value={draft.note}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.currentTarget.value }))}
        />
      </div>

      {sourceRecord?.sourceText && (
        <div className="mt-3 rounded-[7px] border border-line bg-surface-muted px-3 py-2 font-mono text-[12px] leading-5 text-muted">
          {sourceRecord.sourceText}
        </div>
      )}

      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

function DocumentReviewTasks({
  detail,
  onResolved
}: {
  detail: ImportDetail;
  onResolved: () => Promise<ImportDetail | null>;
}) {
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const openTasks = detail.reviewTasks.filter((task) => task.status === "open");

  async function resolveTask(task: ReviewTask, action: "confirm" | "ignore") {
    setBusyTaskId(task.id);
    setError(null);

    const response = await fetch(`/api/review-tasks/${task.id}/resolve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: action === "confirm" ? "Reviewed in document intake." : undefined })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Could not resolve review task.");
      setBusyTaskId(null);
      return;
    }

    await onResolved();
    setBusyTaskId(null);
  }

  if (openTasks.length === 0) {
    return (
      <div className="rounded-[8px] border border-line bg-surface-muted p-6 text-center">
        <Check className="mx-auto mb-3 size-8 text-success" />
        <div className="text-[15px] font-medium text-ink">No parsed canonical records yet</div>
        <div className="mt-1 text-[13px] text-muted">
          Supported CSV lab files will populate editable observations here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-ink">Document review tasks</h2>
        <Badge variant="warning">{openTasks.length} open</Badge>
      </div>
      {openTasks.map((task) => (
        <div key={task.id} className="rounded-[8px] border border-line bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold text-ink">{statusLabel(task.reason)}</div>
              <div className="mt-1 text-[13px] text-muted">
                {typeof task.suggestedValue?.message === "string"
                  ? task.suggestedValue.message
                  : "This document needs review before it can become trusted health data."}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={busyTaskId === task.id}
                onClick={() => void resolveTask(task, "ignore")}
              >
                Ignore
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={busyTaskId === task.id}
                onClick={() => void resolveTask(task, "confirm")}
              >
                Mark reviewed
              </Button>
            </div>
          </div>
        </div>
      ))}
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
