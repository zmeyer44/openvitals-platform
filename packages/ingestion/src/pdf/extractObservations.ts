import { generateObject } from "ai";
import { z } from "zod";

export const PDF_EXTRACTOR_PROMPT_VERSION = "v1.2026-05";

const SYSTEM_PROMPT = `You extract laboratory and vital-sign observations from a single PDF health document.

Return one entry per distinct observation. Do not invent results that are not present.

Rules:
- displayName: the analyte/test/vital exactly as the document labels it (e.g. "Hemoglobin", "Systolic Blood Pressure"). Trim whitespace. Title case is fine.
- valueRaw: the value as written in the document (preserve units and qualifiers like "<5", "Negative", "Trace").
- valueNumeric: the numeric component if the value is purely numeric or has a single leading numeric token, otherwise null.
- unitOriginal: the unit as written in the document, or null if absent.
- observedAt: an ISO 8601 date or datetime when the specimen was collected/observed. If only a date is shown, use YYYY-MM-DD. If unknown, null.
- referenceRangeLow / referenceRangeHigh: numeric bounds when a normal/reference range is shown (e.g. "13.5 – 17.5"). Null otherwise.
- interpretation: short flag if shown, e.g. "low", "high", "abnormal", "critical". Null if absent.
- sourcePage: 1-indexed page number where the observation appears. Null if you cannot determine it.
- sourceText: the exact line, row, or short snippet from the PDF that you extracted this observation from.
- confidence: your confidence the extraction is correct, in [0, 1]. Lower this when the layout is ambiguous, OCR is messy, or units/dates are unclear.
- category: "labs" for laboratory analytes, "vitals" for vital signs (BP, HR, temperature, weight, height, BMI, SpO2). When in doubt, "labs".

If the PDF is not a lab/vitals report, return an empty observations array and put a brief explanation in documentNotes.
If the PDF appears to be a lab/vitals report but you cannot extract any rows confidently, return an empty observations array and explain why in documentNotes.`;

export const observationItemSchema = z.object({
  displayName: z.string().min(1),
  valueRaw: z.string(),
  valueNumeric: z.number().nullable(),
  unitOriginal: z.string().nullable(),
  observedAt: z.string().nullable(),
  referenceRangeLow: z.number().nullable(),
  referenceRangeHigh: z.number().nullable(),
  interpretation: z.string().nullable(),
  category: z.enum(["labs", "vitals"]).default("labs"),
  sourcePage: z.number().int().min(1).nullable(),
  sourceText: z.string(),
  confidence: z.number().min(0).max(1)
});

export const pdfExtractionSchema = z.object({
  observations: z.array(observationItemSchema),
  documentNotes: z.string().nullable()
});

export type ExtractedObservation = z.infer<typeof observationItemSchema>;
export type PdfExtractionResult = z.infer<typeof pdfExtractionSchema> & {
  modelUsed: string;
  promptVersion: string;
};

export type ExtractObservationsFn = (input: ExtractObservationsInput) => Promise<PdfExtractionResult>;

export type ExtractObservationsInput = {
  bytes: Buffer;
  fileName: string;
  model?: string;
  signal?: AbortSignal;
};

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

export async function extractObservationsFromPdf(input: ExtractObservationsInput): Promise<PdfExtractionResult> {
  const modelId = input.model ?? process.env.OPENVITALS_PDF_LLM_MODEL ?? DEFAULT_MODEL;

  const { object } = await generateObject({
    model: modelId,
    schema: pdfExtractionSchema,
    schemaName: "PdfHealthExtraction",
    schemaDescription: "Structured laboratory and vitals observations extracted from a health PDF.",
    system: SYSTEM_PROMPT,
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" }
      }
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract every laboratory result and vital sign from the attached PDF using the provided schema."
          },
          {
            type: "file",
            mediaType: "application/pdf",
            data: input.bytes,
            filename: input.fileName
          }
        ]
      }
    ],
    ...(input.signal ? { abortSignal: input.signal } : {})
  });

  return {
    ...object,
    modelUsed: modelId,
    promptVersion: PDF_EXTRACTOR_PROMPT_VERSION
  };
}
