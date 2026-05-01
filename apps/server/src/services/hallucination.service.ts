/**
 * Hallucination Detection Service
 *
 * Grounding check: for each predicted value, verify it appears
 * (or fuzzy-matches) as a substring in the transcript.
 * Flag and count ungrounded values.
 */

import type { ClinicalExtraction, Hallucination } from "@test-evals/shared";
import { normalizeString, fuzzySimilarity } from "../lib/metrics";

/**
 * Check if a value is grounded in the transcript text.
 * Uses both exact substring matching and fuzzy matching.
 */
function isGrounded(
  value: string,
  transcript: string,
  threshold = 0.70
): { grounded: boolean; evidence?: string } {
  if (!value || value.length < 2) return { grounded: true };

  const normValue = normalizeString(value);
  const normTranscript = normalizeString(transcript);

  // Direct substring check
  if (normTranscript.includes(normValue)) {
    // Find the surrounding context
    const idx = normTranscript.indexOf(normValue);
    const start = Math.max(0, idx - 30);
    const end = Math.min(normTranscript.length, idx + normValue.length + 30);
    return {
      grounded: true,
      evidence: `"...${normTranscript.slice(start, end)}..."`,
    };
  }

  // Token-level fuzzy check — split value into words and check each
  const valueWords = normValue.split(" ").filter((w) => w.length > 2);
  const transcriptLower = normTranscript;
  let matchedWords = 0;

  for (const word of valueWords) {
    if (transcriptLower.includes(word)) {
      matchedWords++;
    }
  }

  if (valueWords.length > 0) {
    const wordMatchRatio = matchedWords / valueWords.length;
    if (wordMatchRatio >= threshold) {
      return {
        grounded: true,
        evidence: `${matchedWords}/${valueWords.length} words found in transcript`,
      };
    }
  }

  // Sliding window fuzzy match for short values
  if (normValue.length <= 30) {
    const windowSize = normValue.length + 10;
    for (let i = 0; i <= normTranscript.length - normValue.length; i += 5) {
      const window = normTranscript.slice(i, i + windowSize);
      const sim = fuzzySimilarity(normValue, window);
      if (sim >= threshold) {
        return {
          grounded: true,
          evidence: `Fuzzy match (${(sim * 100).toFixed(0)}%) at: "...${window}..."`,
        };
      }
    }
  }

  return { grounded: false };
}

/**
 * Detect hallucinations by checking all predicted values against the transcript.
 */
export function detectHallucinations(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
  transcript: string
): Hallucination[] {
  const hallucinations: Hallucination[] = [];

  // Check chief complaint
  const ccCheck = isGrounded(prediction.chief_complaint, transcript);
  hallucinations.push({
    field: "chief_complaint",
    predicted_value: prediction.chief_complaint,
    grounded: ccCheck.grounded,
    evidence: ccCheck.evidence,
  });

  // Check vitals
  if (prediction.vitals.bp) {
    const bpCheck = isGrounded(prediction.vitals.bp, transcript);
    hallucinations.push({
      field: "vitals.bp",
      predicted_value: prediction.vitals.bp,
      grounded: bpCheck.grounded,
      evidence: bpCheck.evidence,
    });
  }

  if (prediction.vitals.hr !== null) {
    const hrCheck = isGrounded(String(prediction.vitals.hr), transcript);
    hallucinations.push({
      field: "vitals.hr",
      predicted_value: String(prediction.vitals.hr),
      grounded: hrCheck.grounded,
      evidence: hrCheck.evidence,
    });
  }

  if (prediction.vitals.temp_f !== null) {
    const tempCheck = isGrounded(String(prediction.vitals.temp_f), transcript);
    hallucinations.push({
      field: "vitals.temp_f",
      predicted_value: String(prediction.vitals.temp_f),
      grounded: tempCheck.grounded,
      evidence: tempCheck.evidence,
    });
  }

  // Check medications
  for (const med of prediction.medications) {
    const nameCheck = isGrounded(med.name, transcript);
    hallucinations.push({
      field: "medications.name",
      predicted_value: med.name,
      grounded: nameCheck.grounded,
      evidence: nameCheck.evidence,
    });

    if (med.dose) {
      const doseCheck = isGrounded(med.dose, transcript);
      hallucinations.push({
        field: "medications.dose",
        predicted_value: med.dose,
        grounded: doseCheck.grounded,
        evidence: doseCheck.evidence,
      });
    }
  }

  // Check diagnoses
  for (const diag of prediction.diagnoses) {
    const descCheck = isGrounded(diag.description, transcript);
    hallucinations.push({
      field: "diagnoses.description",
      predicted_value: diag.description,
      grounded: descCheck.grounded,
      evidence: descCheck.evidence,
    });
  }

  // Check plan items
  for (const item of prediction.plan) {
    const planCheck = isGrounded(item, transcript);
    hallucinations.push({
      field: "plan",
      predicted_value: item,
      grounded: planCheck.grounded,
      evidence: planCheck.evidence,
    });
  }

  // Check follow_up reason
  if (prediction.follow_up.reason) {
    const fuCheck = isGrounded(prediction.follow_up.reason, transcript);
    hallucinations.push({
      field: "follow_up.reason",
      predicted_value: prediction.follow_up.reason,
      grounded: fuCheck.grounded,
      evidence: fuCheck.evidence,
    });
  }

  return hallucinations;
}
