/**
 * Metrics Library
 *
 * Field-appropriate scoring functions for clinical extraction evaluation.
 * - Exact match (vitals, follow_up.interval_days)
 * - Numeric tolerance (temp_f ±0.5)
 * - Fuzzy string similarity (chief_complaint, follow_up.reason)
 * - Set-F1 with fuzzy matching (medications, diagnoses, plan)
 */

// ─── String Normalization ────────────────────────────────────────────

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeDose(dose: string | null): string {
  if (!dose) return "";
  return dose
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/milligrams?/g, "mg")
    .replace(/micrograms?/g, "mcg")
    .replace(/milliliters?/g, "ml")
    .trim();
}

const FREQ_MAP: Record<string, string> = {
  "bid": "twice daily",
  "tid": "three times daily",
  "qid": "four times daily",
  "qd": "once daily",
  "daily": "once daily",
  "qhs": "at bedtime",
  "prn": "as needed",
  "q4h": "every 4 hours",
  "q6h": "every 6 hours",
  "q8h": "every 8 hours",
  "q12h": "every 12 hours",
  "q6h prn": "every 6 hours as needed",
  "q4h prn": "every 4 hours as needed",
};

export function normalizeFrequency(freq: string | null): string {
  if (!freq) return "";
  const lower = freq.toLowerCase().trim();
  return FREQ_MAP[lower] || lower;
}

// ─── Levenshtein Distance ────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Fuzzy similarity score between 0 and 1.
 * 1 = identical, 0 = completely different.
 */
export function fuzzySimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (na === nb) return 1.0;
  if (na.length === 0 && nb.length === 0) return 1.0;
  if (na.length === 0 || nb.length === 0) return 0.0;

  const dist = levenshteinDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/**
 * Check if two strings are a fuzzy match above a threshold.
 */
export function fuzzyMatch(
  a: string,
  b: string,
  threshold = 0.75
): boolean {
  return fuzzySimilarity(a, b) >= threshold;
}

// ─── Exact Match ─────────────────────────────────────────────────────

export function exactMatch(a: unknown, b: unknown): number {
  if (a === null && b === null) return 1.0;
  if (a === null || b === null) return 0.0;
  if (typeof a === "string" && typeof b === "string") {
    return normalizeString(a) === normalizeString(b) ? 1.0 : 0.0;
  }
  return a === b ? 1.0 : 0.0;
}

// ─── Numeric Tolerance ───────────────────────────────────────────────

export function numericTolerance(
  predicted: number | null,
  expected: number | null,
  tolerance = 0.5
): number {
  if (predicted === null && expected === null) return 1.0;
  if (predicted === null || expected === null) return 0.0;
  const diff = Math.abs(predicted - expected);
  if (diff <= tolerance) return 1.0;
  // Gradual falloff
  return Math.max(0, 1 - diff / (tolerance * 5));
}

// ─── Set F1 (with fuzzy matching) ────────────────────────────────────

interface SetMatchOptions {
  fuzzyThreshold: number;
  matchFn?: (a: string, b: string) => number;
}

const DEFAULT_SET_OPTS: SetMatchOptions = {
  fuzzyThreshold: 0.75,
};

/**
 * Compute precision, recall, F1 for two sets of strings with fuzzy matching.
 */
export function setF1(
  predicted: string[],
  expected: string[],
  opts: Partial<SetMatchOptions> = {}
): { precision: number; recall: number; f1: number } {
  const { fuzzyThreshold } = { ...DEFAULT_SET_OPTS, ...opts };

  if (predicted.length === 0 && expected.length === 0) {
    return { precision: 1.0, recall: 1.0, f1: 1.0 };
  }
  if (predicted.length === 0) {
    return { precision: 0.0, recall: 0.0, f1: 0.0 };
  }
  if (expected.length === 0) {
    return { precision: 0.0, recall: 0.0, f1: 0.0 };
  }

  const usedExpected = new Set<number>();
  let truePositives = 0;

  for (const p of predicted) {
    let bestMatch = -1;
    let bestScore = 0;
    for (let i = 0; i < expected.length; i++) {
      if (usedExpected.has(i)) continue;
      const score = fuzzySimilarity(p, expected[i]);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }
    if (bestScore >= fuzzyThreshold && bestMatch >= 0) {
      truePositives++;
      usedExpected.add(bestMatch);
    }
  }

  const precision = truePositives / predicted.length;
  const recall = truePositives / expected.length;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  return { precision, recall, f1 };
}

// ─── Medication Set F1 ───────────────────────────────────────────────

import type { Medication } from "@test-evals/shared";

/**
 * Compare medication lists using name-fuzzy + dose-normalized + freq-normalized matching.
 */
export function medicationSetF1(
  predicted: Medication[],
  expected: Medication[]
): {
  precision: number;
  recall: number;
  f1: number;
  details: Array<{
    predicted?: Medication;
    expected?: Medication;
    name_score: number;
    dose_score: number;
    freq_score: number;
    route_score: number;
    overall: number;
    matched: boolean;
  }>;
} {
  if (predicted.length === 0 && expected.length === 0) {
    return { precision: 1.0, recall: 1.0, f1: 1.0, details: [] };
  }

  const details: ReturnType<typeof medicationSetF1>["details"] = [];
  const usedExpected = new Set<number>();
  let truePositives = 0;

  for (const pred of predicted) {
    let bestIdx = -1;
    let bestScore = 0;
    let bestDetail: (typeof details)[0] | null = null;

    for (let i = 0; i < expected.length; i++) {
      if (usedExpected.has(i)) continue;
      const exp = expected[i];

      const nameScore = fuzzySimilarity(pred.name, exp.name);
      const doseScore =
        pred.dose && exp.dose
          ? normalizeDose(pred.dose) === normalizeDose(exp.dose)
            ? 1.0
            : fuzzySimilarity(pred.dose, exp.dose)
          : pred.dose === exp.dose
            ? 1.0
            : 0.0;
      const freqScore =
        normalizeFrequency(pred.frequency) ===
        normalizeFrequency(exp.frequency)
          ? 1.0
          : fuzzySimilarity(pred.frequency || "", exp.frequency || "");
      const routeScore =
        pred.route && exp.route
          ? normalizeString(pred.route) === normalizeString(exp.route)
            ? 1.0
            : 0.0
          : pred.route === exp.route
            ? 1.0
            : 0.0;

      // Weighted overall: name 40%, dose 25%, freq 25%, route 10%
      const overall =
        nameScore * 0.4 + doseScore * 0.25 + freqScore * 0.25 + routeScore * 0.1;

      if (nameScore >= 0.7 && overall > bestScore) {
        bestScore = overall;
        bestIdx = i;
        bestDetail = {
          predicted: pred,
          expected: exp,
          name_score: nameScore,
          dose_score: doseScore,
          freq_score: freqScore,
          route_score: routeScore,
          overall,
          matched: true,
        };
      }
    }

    if (bestIdx >= 0 && bestDetail) {
      truePositives++;
      usedExpected.add(bestIdx);
      details.push(bestDetail);
    } else {
      details.push({
        predicted: pred,
        name_score: 0,
        dose_score: 0,
        freq_score: 0,
        route_score: 0,
        overall: 0,
        matched: false,
      });
    }
  }

  // Add unmatched expected
  for (let i = 0; i < expected.length; i++) {
    if (!usedExpected.has(i)) {
      details.push({
        expected: expected[i],
        name_score: 0,
        dose_score: 0,
        freq_score: 0,
        route_score: 0,
        overall: 0,
        matched: false,
      });
    }
  }

  const precision = predicted.length > 0 ? truePositives / predicted.length : 0;
  const recall = expected.length > 0 ? truePositives / expected.length : 0;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  return { precision, recall, f1, details };
}

// ─── Diagnosis Set F1 ────────────────────────────────────────────────

import type { Diagnosis } from "@test-evals/shared";

export function diagnosisSetF1(
  predicted: Diagnosis[],
  expected: Diagnosis[]
): { precision: number; recall: number; f1: number } {
  const predStrings = predicted.map(
    (d) => `${d.description}${d.icd10 ? ` (${d.icd10})` : ""}`
  );
  const expStrings = expected.map(
    (d) => `${d.description}${d.icd10 ? ` (${d.icd10})` : ""}`
  );

  return setF1(predStrings, expStrings, { fuzzyThreshold: 0.65 });
}
