/**
 * Explanation Generation Service
 *
 * Produces human-readable explanations for each evaluated case:
 * - Why AI response is correct or incorrect per field
 * - Which symptoms/values matched
 * - What was missing or hallucinated
 */

import type {
  ClinicalExtraction,
  FieldScore,
  Hallucination,
  CaseExplanation,
  FieldExplanation,
} from "@test-evals/shared";

function getVerdict(
  score: number
): "correct" | "partially_correct" | "incorrect" {
  if (score >= 0.95) return "correct";
  if (score >= 0.5) return "partially_correct";
  return "incorrect";
}

function explainChiefComplaint(
  predicted: string,
  expected: string,
  score: number
): FieldExplanation {
  const verdict = getVerdict(score);
  let reason: string;

  if (verdict === "correct") {
    reason =
      "The predicted chief complaint closely matches the expected output, capturing the key symptoms and duration.";
  } else if (verdict === "partially_correct") {
    reason = `The prediction captures some elements of the chief complaint but differs in wording or detail. Expected: "${expected}", Got: "${predicted}".`;
  } else {
    reason = `The predicted chief complaint significantly deviates from the expected. Key symptoms or context may be missing or incorrect.`;
  }

  return {
    field: "chief_complaint",
    verdict,
    score,
    reason,
    expected,
    predicted,
  };
}

function explainVitalField(
  field: string,
  predicted: unknown,
  expected: unknown,
  score: number
): FieldExplanation {
  const verdict = getVerdict(score);
  const predStr = predicted !== null ? String(predicted) : "null";
  const expStr = expected !== null ? String(expected) : "null";

  let reason: string;
  if (verdict === "correct") {
    reason = `${field} matches the expected value exactly.`;
  } else if (field === "vitals.temp_f" && score > 0) {
    reason = `Temperature is close but outside the ±0.5°F tolerance. Predicted ${predStr}°F vs expected ${expStr}°F.`;
  } else if (predicted === null && expected !== null) {
    reason = `${field} was not captured (null) but expected ${expStr}.`;
  } else {
    reason = `${field} mismatch: predicted ${predStr} vs expected ${expStr}.`;
  }

  return {
    field,
    verdict,
    score,
    reason,
    expected: expStr,
    predicted: predStr,
  };
}

function explainSetField(
  field: string,
  predictedItems: string[],
  expectedItems: string[],
  score: number
): FieldExplanation {
  const verdict = getVerdict(score);
  const predStr = predictedItems.join("; ");
  const expStr = expectedItems.join("; ");

  let reason: string;
  if (verdict === "correct") {
    reason = `All ${field} items were correctly identified with matching details.`;
  } else if (verdict === "partially_correct") {
    const missing = expectedItems.length - Math.round(score * expectedItems.length);
    reason = `${field}: ${Math.round(score * 100)}% match. Approximately ${missing} item(s) may be missing or incorrectly captured.`;
  } else {
    reason = `${field}: Poor match (${Math.round(score * 100)}%). Significant items are missing or incorrect.`;
  }

  return { field, verdict, score, reason, expected: expStr, predicted: predStr };
}

export function generateExplanation(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
  scores: FieldScore[],
  hallucinations: Hallucination[]
): CaseExplanation {
  const fieldExplanations: FieldExplanation[] = [];
  const matchedSymptoms: string[] = [];
  const missingItems: string[] = [];
  const hallucinatedItems: string[] = [];

  // Build field explanations
  for (const s of scores) {
    switch (s.field) {
      case "chief_complaint":
        fieldExplanations.push(
          explainChiefComplaint(
            prediction.chief_complaint,
            gold.chief_complaint,
            s.score
          )
        );
        if (s.score >= 0.5) matchedSymptoms.push("chief complaint");
        break;

      case "vitals.bp":
      case "vitals.hr":
      case "vitals.temp_f":
      case "vitals.spo2": {
        const vitalKey = s.field.split(".")[1] as keyof typeof prediction.vitals;
        fieldExplanations.push(
          explainVitalField(
            s.field,
            prediction.vitals[vitalKey],
            gold.vitals[vitalKey],
            s.score
          )
        );
        if (s.score >= 0.5) matchedSymptoms.push(s.field);
        else missingItems.push(s.field);
        break;
      }

      case "medications":
        fieldExplanations.push(
          explainSetField(
            "medications",
            prediction.medications.map((m) => `${m.name} ${m.dose || ""}`),
            gold.medications.map((m) => `${m.name} ${m.dose || ""}`),
            s.score
          )
        );
        if (s.score >= 0.5) matchedSymptoms.push("medications");
        else missingItems.push("medications");
        break;

      case "diagnoses":
        fieldExplanations.push(
          explainSetField(
            "diagnoses",
            prediction.diagnoses.map((d) => d.description),
            gold.diagnoses.map((d) => d.description),
            s.score
          )
        );
        if (s.score >= 0.5) matchedSymptoms.push("diagnoses");
        else missingItems.push("diagnoses");
        break;

      case "plan":
        fieldExplanations.push(
          explainSetField("plan", prediction.plan, gold.plan, s.score)
        );
        if (s.score >= 0.5) matchedSymptoms.push("plan items");
        else missingItems.push("plan items");
        break;

      case "follow_up.interval_days":
        fieldExplanations.push(
          explainVitalField(
            s.field,
            prediction.follow_up.interval_days,
            gold.follow_up.interval_days,
            s.score
          )
        );
        break;

      case "follow_up.reason":
        fieldExplanations.push(
          explainChiefComplaint(
            prediction.follow_up.reason || "",
            gold.follow_up.reason || "",
            s.score
          )
        );
        break;
    }
  }

  // Hallucinated items
  for (const h of hallucinations) {
    if (!h.grounded) {
      hallucinatedItems.push(`${h.field}: "${h.predicted_value}"`);
    }
  }

  // Overall summary
  const avgScore =
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const overallVerdict = getVerdict(avgScore);

  let summary: string;
  if (overallVerdict === "correct") {
    summary = `Overall excellent extraction. The AI correctly identified most clinical elements including ${matchedSymptoms.slice(0, 3).join(", ")}.`;
  } else if (overallVerdict === "partially_correct") {
    summary = `Partially correct extraction (${(avgScore * 100).toFixed(0)}%). Matched: ${matchedSymptoms.join(", ")}. Issues: ${missingItems.join(", ") || "minor discrepancies"}.`;
  } else {
    summary = `Poor extraction quality (${(avgScore * 100).toFixed(0)}%). Multiple fields have significant errors. Missing: ${missingItems.join(", ")}.`;
  }

  if (hallucinatedItems.length > 0) {
    summary += ` ⚠ ${hallucinatedItems.length} hallucinated value(s) detected.`;
  }

  return {
    summary,
    field_explanations: fieldExplanations,
    matched_symptoms: matchedSymptoms,
    missing_items: missingItems,
    hallucinated_items: hallucinatedItems,
  };
}
