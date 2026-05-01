import type {
  ClassificationResult,
  HealthDataParser,
  ImportFile
} from "./contracts";

export type ParserDecision = {
  parser: HealthDataParser;
  parserName: string;
  parserVersion: string;
  supported: boolean;
  decision: "supported" | "unsupported" | "empty" | "review_needed" | "error";
  classification: string;
  confidence: number;
  empty: boolean;
  reviewRequired: boolean;
  warnings: ClassificationResult["warnings"];
  reason?: string | undefined;
};

export type ParserRegistryResult = {
  decisions: ParserDecision[];
  selected: ParserDecision | null;
};

export type ParserRegistry = {
  parsers: readonly HealthDataParser[];
  classify(file: ImportFile): Promise<ParserRegistryResult>;
};

function decisionFor(result: ClassificationResult): ParserDecision["decision"] {
  if (!result.supported) {
    return "unsupported";
  }

  if (result.empty) {
    return "empty";
  }

  if (result.reviewRequired) {
    return "review_needed";
  }

  return "supported";
}

export function createParserRegistry(parsers: readonly HealthDataParser[]): ParserRegistry {
  return {
    parsers,
    async classify(file) {
      const decisions = await Promise.all(
        parsers.map(async (parser): Promise<ParserDecision> => {
          try {
            const result = await parser.classify(file);
            const firstWarning = result.warnings[0];

            return {
              parser,
              parserName: parser.name,
              parserVersion: parser.version,
              supported: result.supported,
              decision: decisionFor(result),
              classification: result.classification,
              confidence: result.confidence,
              empty: result.empty ?? false,
              reviewRequired: result.reviewRequired ?? false,
              warnings: result.warnings,
              reason: firstWarning?.code
            };
          } catch (error) {
            return {
              parser,
              parserName: parser.name,
              parserVersion: parser.version,
              supported: false,
              decision: "error",
              classification: "classification_error",
              confidence: 0,
              empty: false,
              reviewRequired: false,
              warnings: [
                {
                  code: "classification_error",
                  message: error instanceof Error ? error.message : String(error),
                  severity: "error"
                }
              ],
              reason: "classification_error"
            };
          }
        })
      );

      const selected =
        decisions
          .filter((decision) => decision.supported)
          .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

      return { decisions, selected };
    }
  };
}
