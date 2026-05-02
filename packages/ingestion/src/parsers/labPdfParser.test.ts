import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@openvitals/domain";
import { createLabPdfParser } from "./labPdfParser";
import type { ExtractObservationsFn, PdfExtractionResult } from "../pdf/extractObservations";

const PDF_HEADER = Buffer.from("%PDF-1.4\nfake-pdf-bytes\n");

function makeFile(overrides: Partial<{ fileName: string; mimeType: string; bytes: Buffer }> = {}) {
  const bytes = overrides.bytes ?? PDF_HEADER;
  return {
    fileName: overrides.fileName ?? "labs.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    bytes,
    sha256: sha256Hex(bytes)
  };
}

function fakeExtraction(observations: PdfExtractionResult["observations"], notes: string | null = null): PdfExtractionResult {
  return {
    observations,
    documentNotes: notes,
    modelUsed: "anthropic/claude-sonnet-4.6",
    promptVersion: "test"
  };
}

describe("labPdfParser", () => {
  it("classifies a small PDF as supported", async () => {
    const parser = createLabPdfParser({ extract: vi.fn() });
    const result = await parser.classify(makeFile());

    expect(result.supported).toBe(true);
    expect(result.classification).toBe("lab_pdf");
  });

  it("rejects oversize PDFs so the placeholder parser can handle them", async () => {
    const parser = createLabPdfParser({ extract: vi.fn() });
    const big = Buffer.alloc(11 * 1024 * 1024);
    PDF_HEADER.copy(big);
    const result = await parser.classify(makeFile({ bytes: big }));

    expect(result.supported).toBe(false);
    expect(result.classification).toBe("pdf_too_large");
  });

  it("rejects non-PDF files outright", async () => {
    const parser = createLabPdfParser({ extract: vi.fn() });
    const result = await parser.classify(
      makeFile({ fileName: "labs.csv", mimeType: "text/csv", bytes: Buffer.from("name,value\nHb,13.2\n") })
    );

    expect(result.supported).toBe(false);
  });

  it("normalizes a high-confidence observation without flagging it for review", async () => {
    const extract: ExtractObservationsFn = vi.fn(async () =>
      fakeExtraction([
        {
          displayName: "Hemoglobin",
          valueRaw: "13.2",
          valueNumeric: 13.2,
          unitOriginal: "g/dL",
          observedAt: "2024-04-01",
          referenceRangeLow: 12,
          referenceRangeHigh: 17,
          interpretation: null,
          category: "labs",
          sourcePage: 2,
          sourceText: "Hemoglobin 13.2 g/dL",
          confidence: 0.95
        }
      ])
    );

    const parser = createLabPdfParser({ extract });
    const file = makeFile();
    const parsed = await parser.parse(file);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.kind).toBe("observation");
    expect(parsed[0]?.sourceReference?.page).toBe(2);

    const [normalized] = await parser.normalize(parsed);
    if (normalized?.kind !== "observation") throw new Error("expected an observation");

    expect(normalized.displayName).toBe("Hemoglobin");
    expect(normalized.valueNumeric).toBe("13.2");
    expect(normalized.unitOriginal).toBe("g/dL");
    expect(normalized.observedAt?.toISOString().slice(0, 10)).toBe("2024-04-01");
    expect(normalized.observedAtUnknown).toBe(false);
    expect(normalized.reviewReasons).toEqual([]);
    expect(normalized.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("flags low-confidence observations for review", async () => {
    const extract: ExtractObservationsFn = vi.fn(async () =>
      fakeExtraction([
        {
          displayName: "Glucose",
          valueRaw: "92",
          valueNumeric: 92,
          unitOriginal: "mg/dL",
          observedAt: "2024-04-01",
          referenceRangeLow: 70,
          referenceRangeHigh: 99,
          interpretation: null,
          category: "labs",
          sourcePage: 1,
          sourceText: "Glucose 92 mg/dL",
          confidence: 0.42
        }
      ])
    );

    const parser = createLabPdfParser({ extract });
    const parsed = await parser.parse(makeFile());
    const [normalized] = await parser.normalize(parsed);
    if (normalized?.kind !== "observation") throw new Error("expected an observation");

    expect(normalized.reviewReasons).toContain("low_confidence");
  });

  it("falls back to a placeholder review record when the model returns no observations", async () => {
    const extract: ExtractObservationsFn = vi.fn(async () =>
      fakeExtraction([], "This document does not appear to be a lab report.")
    );

    const parser = createLabPdfParser({ extract });
    const parsed = await parser.parse(makeFile());

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.kind).toBe("note");

    const [normalized] = await parser.normalize(parsed);
    if (normalized?.kind !== "review_placeholder") throw new Error("expected a placeholder");

    expect(normalized.reason).toBe("pdf_extraction_failed");
    expect(normalized.recordType).toBe("note");
  });

  it("falls back to a placeholder when the extractor throws", async () => {
    const extract: ExtractObservationsFn = vi.fn(async () => {
      throw new Error("gateway 500");
    });

    const parser = createLabPdfParser({ extract });
    const parsed = await parser.parse(makeFile());

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.kind).toBe("note");

    const [normalized] = await parser.normalize(parsed);
    if (normalized?.kind !== "review_placeholder") throw new Error("expected a placeholder");

    expect(normalized.reason).toBe("pdf_extraction_failed");
    expect(normalized.warnings.some((warning) => warning.code === "pdf_extraction_failed")).toBe(true);
  });

  it("preserves null observation dates as observedAtUnknown with a review reason", async () => {
    const extract: ExtractObservationsFn = vi.fn(async () =>
      fakeExtraction([
        {
          displayName: "BUN",
          valueRaw: "14",
          valueNumeric: 14,
          unitOriginal: "mg/dL",
          observedAt: null,
          referenceRangeLow: null,
          referenceRangeHigh: null,
          interpretation: null,
          category: "labs",
          sourcePage: null,
          sourceText: "BUN 14 mg/dL",
          confidence: 0.92
        }
      ])
    );

    const parser = createLabPdfParser({ extract });
    const parsed = await parser.parse(makeFile());
    const [normalized] = await parser.normalize(parsed);
    if (normalized?.kind !== "observation") throw new Error("expected an observation");

    expect(normalized.observedAt).toBeNull();
    expect(normalized.observedAtUnknown).toBe(true);
    expect(normalized.reviewReasons).toContain("missing_date");
  });
});
