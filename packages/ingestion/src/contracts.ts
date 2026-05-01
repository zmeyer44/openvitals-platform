import type { OpenVitalsDatabase } from "@openvitals/database";
import type { ReviewReason, SourceReference, Warning } from "@openvitals/domain";

export type ImportFile = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  sha256: string;
};

export type ClassificationResult = {
  supported: boolean;
  classification: string;
  confidence: number;
  empty?: boolean;
  warnings: Warning[];
};

export type ParsedRecord = {
  temporaryId: string;
  kind: "observation" | "condition" | "medication" | "encounter" | "note" | "empty";
  sourceText?: string;
  sourceReference?: SourceReference;
  original: Record<string, unknown>;
  confidence: number;
  warnings: Warning[];
};

export type NormalizedObservation = {
  temporaryId: string;
  kind: "observation";
  displayName: string;
  category: "labs" | "vitals";
  observedAt: Date | null;
  observedAtUnknown: boolean;
  originalValue: string | null;
  valueNumeric: string | null;
  valueText: string | null;
  unitOriginal: string | null;
  unitNormalized: string | null;
  confidence: number;
  sourceText?: string;
  sourceReference?: SourceReference;
  original: Record<string, unknown>;
  warnings: Warning[];
  reviewReasons: ReviewReason[];
};

export type NormalizedRecord = NormalizedObservation;

export type MaterializeContext = {
  ownerUserId: string;
  sourceDocumentId: string;
  importJobId: string;
  actorId: string;
};

export type MaterializeResult = {
  sourceRecordCount: number;
  canonicalRecordCount: number;
  reviewTaskCount: number;
};

export type HealthDataParser = {
  name: string;
  version: string;
  classify(file: ImportFile): Promise<ClassificationResult>;
  parse(file: ImportFile): Promise<ParsedRecord[]>;
  normalize(records: ParsedRecord[]): Promise<NormalizedRecord[]>;
  materialize(
    db: OpenVitalsDatabase,
    records: NormalizedRecord[],
    context: MaterializeContext
  ): Promise<MaterializeResult>;
};
