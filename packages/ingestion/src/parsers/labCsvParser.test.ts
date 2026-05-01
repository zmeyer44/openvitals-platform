import { describe, expect, it } from "vitest";
import { sha256Hex } from "@openvitals/domain";
import { labCsvParser } from "./labCsvParser";

describe("labCsvParser", () => {
  it("normalizes missing dates as unknown and review-needed", async () => {
    const bytes = Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n");
    const parsed = await labCsvParser.parse({
      fileName: "labs.csv",
      mimeType: "text/csv",
      bytes,
      sha256: sha256Hex(bytes)
    });

    const [record] = await labCsvParser.normalize(parsed);

    expect(record?.kind).toBe("observation");
    if (record?.kind !== "observation") {
      throw new Error("Expected a normalized observation");
    }

    expect(record?.observedAt).toBeNull();
    expect(record?.observedAtUnknown).toBe(true);
    expect(record?.reviewReasons).toContain("missing_date");
    expect(record?.valueNumeric).toBe("13.2");
  });

  it("does not convert blank numeric values to zero", async () => {
    const bytes = Buffer.from("test_name,value,unit,collected_at\nHemoglobin,,g/dL,2024-01-01\n");
    const parsed = await labCsvParser.parse({
      fileName: "labs.csv",
      mimeType: "text/csv",
      bytes,
      sha256: sha256Hex(bytes)
    });

    const [record] = await labCsvParser.normalize(parsed);

    expect(record?.kind).toBe("observation");
    if (record?.kind !== "observation") {
      throw new Error("Expected a normalized observation");
    }

    expect(record?.valueNumeric).toBeNull();
    expect(record?.originalValue).toBeNull();
  });
});
