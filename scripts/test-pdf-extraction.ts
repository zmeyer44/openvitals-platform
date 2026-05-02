import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractObservationsFromPdf } from "../packages/ingestion/src/pdf/extractObservations";

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not set in this shell");
  }

  const path = process.argv[2];
  if (!path) {
    throw new Error("Usage: tsx scripts/test-pdf-extraction.ts <pdf-path>");
  }

  const bytes = await readFile(path);
  const fileName = basename(path);
  const startedAt = Date.now();

  console.log(`> Extracting from ${path} (${bytes.byteLength} bytes)`);
  console.log(`> Model: ${process.env.OPENVITALS_PDF_LLM_MODEL ?? "anthropic/claude-sonnet-4.6 (default)"}`);

  const result = await extractObservationsFromPdf({
    bytes,
    fileName,
    signal: AbortSignal.timeout(120_000)
  });

  const durationMs = Date.now() - startedAt;
  console.log(`> Done in ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`> Model used: ${result.modelUsed}`);
  console.log(`> Prompt version: ${result.promptVersion}`);
  console.log(`> documentNotes: ${result.documentNotes ?? "(none)"}`);
  console.log(`> observations: ${result.observations.length}`);
  console.log("");

  for (const [index, observation] of result.observations.entries()) {
    console.log(`#${index + 1} ${observation.displayName}`);
    console.log(`   value: ${observation.valueRaw}${observation.unitOriginal ? ` ${observation.unitOriginal}` : ""}`);
    if (observation.referenceRangeLow !== null || observation.referenceRangeHigh !== null) {
      console.log(`   range: ${observation.referenceRangeLow ?? "?"} – ${observation.referenceRangeHigh ?? "?"}`);
    }
    if (observation.interpretation) console.log(`   flag:  ${observation.interpretation}`);
    console.log(`   when:  ${observation.observedAt ?? "(unknown)"}`);
    console.log(`   page:  ${observation.sourcePage ?? "?"}`);
    console.log(`   conf:  ${observation.confidence.toFixed(2)}`);
    console.log(`   src:   ${observation.sourceText}`);
    console.log("");
  }
}

main().catch((error) => {
  if (error && typeof error === "object") {
    const anyErr = error as Record<string, unknown>;
    console.error("name:", anyErr.name);
    console.error("message:", anyErr.message);
    console.error("statusCode:", anyErr.statusCode);
    console.error("responseBody:", anyErr.responseBody);
    if (anyErr.cause) console.error("cause:", anyErr.cause);
    if (anyErr.stack) console.error(anyErr.stack);
  } else {
    console.error(error);
  }
  process.exit(1);
});
