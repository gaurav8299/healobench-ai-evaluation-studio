/**
 * Evaluate Service
 *
 * Computes per-field scores for a (prediction, gold) pair using
 * the metric appropriate to each field type.
 */

import type {
  ClinicalExtraction,
  FieldScore,
  CaseResult,
  TokenUsage,
  LLMAttempt,
  Hallucination,
} from "@test-evals/shared";

import {
  fuzzySimilarity,
  exactMatch,
  numericTolerance,
  setF1,
  medicationSetF1,
  diagnosisSetF1,
} from "../lib/metrics";

import { detectHallucinations } from "./hallucination.service";
import { generateExplanation } from "./explanation.service";

// ─── Per-field scoring ───────────────────────────────────────────────

export function scoreFields(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction
): FieldScore[] {
  const scores: FieldScore[] = [];

  // 1. chief_complaint — fuzzy string similarity
  const ccScore = fuzzySimilarity(
    prediction.chief_complaint,
    gold.chief_complaint
  );
  scores.push({
    field: "chief_complaint",
    score: ccScore,
    metric: "fuzzy_similarity",
    details: `Similarity: ${(ccScore * 100).toFixed(1)}%`,
  });

  // 2. vitals.bp — exact match (normalized)
  const bpScore = exactMatch(prediction.vitals.bp, gold.vitals.bp);
  scores.push({
    field: "vitals.bp",
    score: bpScore,
    metric: "exact",
    details: `Predicted: ${prediction.vitals.bp}, Gold: ${gold.vitals.bp}`,
  });

  // 3. vitals.hr — exact integer match
  const hrScore = exactMatch(prediction.vitals.hr, gold.vitals.hr);
  scores.push({
    field: "vitals.hr",
    score: hrScore,
    metric: "exact",
    details: `Predicted: ${prediction.vitals.hr}, Gold: ${gold.vitals.hr}`,
  });

  // 4. vitals.temp_f — numeric tolerance ±0.5
  const tempScore = numericTolerance(
    prediction.vitals.temp_f,
    gold.vitals.temp_f,
    0.5
  );
  scores.push({
    field: "vitals.temp_f",
    score: tempScore,
    metric: "numeric_tolerance",
    details: `Predicted: ${prediction.vitals.temp_f}, Gold: ${gold.vitals.temp_f} (±0.5)`,
  });

  // 5. vitals.spo2 — exact integer match
  const spo2Score = exactMatch(prediction.vitals.spo2, gold.vitals.spo2);
  scores.push({
    field: "vitals.spo2",
    score: spo2Score,
    metric: "exact",
    details: `Predicted: ${prediction.vitals.spo2}, Gold: ${gold.vitals.spo2}`,
  });

  // 6. medications — set-F1 with fuzzy name/dose/freq matching
  const medResult = medicationSetF1(prediction.medications, gold.medications);
  scores.push({
    field: "medications",
    score: medResult.f1,
    metric: "set_f1_fuzzy",
    details: `P: ${medResult.precision.toFixed(2)}, R: ${medResult.recall.toFixed(2)}, F1: ${medResult.f1.toFixed(2)}`,
  });

  // 7. diagnoses — set-F1 with fuzzy description + exact icd10
  const diagResult = diagnosisSetF1(prediction.diagnoses, gold.diagnoses);
  scores.push({
    field: "diagnoses",
    score: diagResult.f1,
    metric: "set_f1_fuzzy",
    details: `P: ${diagResult.precision.toFixed(2)}, R: ${diagResult.recall.toFixed(2)}, F1: ${diagResult.f1.toFixed(2)}`,
  });

  // 8. plan — set-F1 with fuzzy matching
  const planResult = setF1(prediction.plan, gold.plan, {
    fuzzyThreshold: 0.6,
  });
  scores.push({
    field: "plan",
    score: planResult.f1,
    metric: "set_f1_fuzzy",
    details: `P: ${planResult.precision.toFixed(2)}, R: ${planResult.recall.toFixed(2)}, F1: ${planResult.f1.toFixed(2)}`,
  });

  // 9. follow_up.interval_days — exact match
  const fuDaysScore = exactMatch(
    prediction.follow_up.interval_days,
    gold.follow_up.interval_days
  );
  scores.push({
    field: "follow_up.interval_days",
    score: fuDaysScore,
    metric: "exact",
    details: `Predicted: ${prediction.follow_up.interval_days}, Gold: ${gold.follow_up.interval_days}`,
  });

  // 10. follow_up.reason — fuzzy similarity
  const fuReasonScore = fuzzySimilarity(
    prediction.follow_up.reason || "",
    gold.follow_up.reason || ""
  );
  scores.push({
    field: "follow_up.reason",
    score: fuReasonScore,
    metric: "fuzzy_similarity",
    details: `Similarity: ${(fuReasonScore * 100).toFixed(1)}%`,
  });

  return scores;
}

// ─── Overall score (weighted average) ────────────────────────────────

const FIELD_WEIGHTS: Record<string, number> = {
  chief_complaint: 1.5,
  "vitals.bp": 1.0,
  "vitals.hr": 1.0,
  "vitals.temp_f": 1.0,
  "vitals.spo2": 1.0,
  medications: 2.0,
  diagnoses: 2.0,
  plan: 1.5,
  "follow_up.interval_days": 0.5,
  "follow_up.reason": 0.5,
};

export function computeOverallScore(scores: FieldScore[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of scores) {
    const weight = FIELD_WEIGHTS[s.field] || 1.0;
    weightedSum += s.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ─── Full case evaluation ────────────────────────────────────────────

export function evaluateCase(
  caseId: string,
  transcriptPath: string,
  transcript: string,
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
  attempts: LLMAttempt[],
  tokens: TokenUsage,
  wallTimeMs: number
): CaseResult {
  // Score fields
  const scores = scoreFields(prediction, gold);
  const overallScore = computeOverallScore(scores);

  // Detect hallucinations
  const hallucinations = detectHallucinations(prediction, gold, transcript);
  const hallucinationCount = hallucinations.filter((h) => !h.grounded).length;

  // Schema validity (mock mode always valid, but track it)
  const schemaValid = true;

  // Generate explanation
  const explanation = generateExplanation(
    prediction,
    gold,
    scores,
    hallucinations
  );

  return {
    case_id: caseId,
    transcript_path: transcriptPath,
    status: "completed",
    prediction,
    gold,
    scores,
    overall_score: overallScore,
    hallucinations,
    hallucination_count: hallucinationCount,
    schema_valid: schemaValid,
    attempts,
    wall_time_ms: wallTimeMs,
    tokens,
    explanation,
  };
}

// ─── Aggregate field scores across cases ─────────────────────────────

export function aggregateFieldScores(
  cases: CaseResult[]
): Record<string, number> {
  const fieldSums: Record<string, number> = {};
  const fieldCounts: Record<string, number> = {};

  for (const c of cases) {
    for (const s of c.scores) {
      fieldSums[s.field] = (fieldSums[s.field] || 0) + s.score;
      fieldCounts[s.field] = (fieldCounts[s.field] || 0) + 1;
    }
  }

  const result: Record<string, number> = {};
  for (const field of Object.keys(fieldSums)) {
    result[field] = fieldSums[field] / fieldCounts[field];
  }
  return result;
}
