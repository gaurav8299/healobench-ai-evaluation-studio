/**
 * Mock LLM Provider
 * 
 * Simulates realistic AI predictions by reading gold JSON data and
 * introducing controlled errors. Designed so the full system can be
 * demoed without an API key or any external API calls.
 * 
 * Error modes:
 *  - CORRECT:    exact gold output (40% of cases)
 *  - PARTIAL:    gold with some fields slightly modified (35%)
 *  - INCORRECT:  gold with significant errors introduced (15%)
 *  - HALLUCINATE: extra fields or values not in transcript (10%)
 */

import type {
  ClinicalExtraction,
  Medication,
  Diagnosis,
  TokenUsage,
  LLMAttempt,
  PromptStrategy,
} from "@test-evals/shared";

// ─── Configuration ───────────────────────────────────────────────────

interface MockConfig {
  /** Probability of returning exact gold (0–1) */
  correctRate: number;
  /** Probability of partial errors */
  partialRate: number;
  /** Probability of significant errors */
  incorrectRate: number;
  /** Probability of hallucination */
  hallucinationRate: number;
  /** Simulated latency range [min, max] in ms */
  latencyRange: [number, number];
  /** Simulate retry (occasionally return invalid on first attempt) */
  retryRate: number;
}

const DEFAULT_CONFIG: MockConfig = {
  correctRate: 0.40,
  partialRate: 0.35,
  incorrectRate: 0.15,
  hallucinationRate: 0.10,
  latencyRange: [500, 1500],
  retryRate: 0.10,
};

// Strategy-specific configs — CoT is "best", zero_shot is "worst"
const STRATEGY_CONFIGS: Record<PromptStrategy, Partial<MockConfig>> = {
  zero_shot: {
    correctRate: 0.30,
    partialRate: 0.35,
    incorrectRate: 0.20,
    hallucinationRate: 0.15,
    retryRate: 0.15,
  },
  few_shot: {
    correctRate: 0.45,
    partialRate: 0.35,
    incorrectRate: 0.12,
    hallucinationRate: 0.08,
    retryRate: 0.08,
  },
  cot: {
    correctRate: 0.55,
    partialRate: 0.30,
    incorrectRate: 0.10,
    hallucinationRate: 0.05,
    retryRate: 0.05,
  },
};

// ─── Utility: Seeded RNG ─────────────────────────────────────────────

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

function randomBetween(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Error Introducers ───────────────────────────────────────────────

const CHIEF_COMPLAINT_MUTATIONS = [
  (s: string) => s.replace(/for (\w+ \w+)/, "for several days"),
  (s: string) => s.split(" ").slice(0, -2).join(" "),
  (s: string) => `${s} with mild headache`,
  (s: string) => s.replace(/and/, "with associated"),
];

const FREQUENCY_SYNONYMS: Record<string, string> = {
  "every 6 hours as needed": "q6h PRN",
  "every 6 hours": "q6h",
  "every 8 hours": "q8h",
  "twice daily": "BID",
  "once daily": "daily",
  "three times daily": "TID",
  "every 12 hours": "q12h",
  "at bedtime": "QHS",
  "every 4 hours": "q4h",
  "BID": "twice daily",
  "TID": "three times daily",
  "QHS": "at bedtime",
};

const ROUTE_SYNONYMS: Record<string, string> = {
  PO: "oral",
  oral: "PO",
  IV: "intravenous",
  intravenous: "IV",
  topical: "topically",
  topically: "topical",
  inhaled: "inhalation",
  inhalation: "inhaled",
};

const HALLUCINATED_MEDICATIONS: Medication[] = [
  { name: "acetaminophen", dose: "500 mg", frequency: "every 6 hours", route: "PO" },
  { name: "amoxicillin", dose: "500 mg", frequency: "three times daily", route: "PO" },
  { name: "omeprazole", dose: "20 mg", frequency: "once daily", route: "PO" },
  { name: "diphenhydramine", dose: "25 mg", frequency: "at bedtime", route: "PO" },
  { name: "loratadine", dose: "10 mg", frequency: "once daily", route: "PO" },
];

const HALLUCINATED_DIAGNOSES: Diagnosis[] = [
  { description: "seasonal allergic rhinitis", icd10: "J30.2" },
  { description: "tension headache", icd10: "G44.2" },
  { description: "mild dehydration", icd10: "E86.0" },
  { description: "insomnia", icd10: "G47.00" },
];

const HALLUCINATED_PLAN_ITEMS = [
  "Consider allergy testing if symptoms persist",
  "Recommend stress management techniques",
  "Schedule follow-up blood work in 2 weeks",
  "Refer to specialist if no improvement",
  "Start vitamin D supplementation",
];

// ─── Mutation Functions ──────────────────────────────────────────────

function mutateChiefComplaint(
  gold: string,
  severity: "partial" | "incorrect",
  rng: () => number
): string {
  if (severity === "partial") {
    // Slight rephrasing
    const mutation = pickRandom(CHIEF_COMPLAINT_MUTATIONS, rng);
    return mutation(gold);
  }
  // Incorrect — truncate significantly or replace
  return gold.split(" ").slice(0, 3).join(" ") + " and general malaise";
}

function mutateVitals(
  gold: ClinicalExtraction["vitals"],
  severity: "partial" | "incorrect",
  rng: () => number
): ClinicalExtraction["vitals"] {
  const vitals = { ...gold };

  if (severity === "partial") {
    // Slightly off on one value
    if (vitals.hr !== null) {
      vitals.hr = vitals.hr + (rng() > 0.5 ? 2 : -2);
    }
    if (vitals.temp_f !== null && rng() > 0.5) {
      vitals.temp_f = Math.round((vitals.temp_f + 0.3) * 10) / 10;
    }
  } else {
    // Incorrect — wrong values or null
    if (vitals.bp !== null && rng() > 0.3) {
      const parts = vitals.bp.split("/");
      vitals.bp = `${parseInt(parts[0]) + 20}/${parseInt(parts[1]) + 10}`;
    }
    if (vitals.hr !== null) {
      vitals.hr = vitals.hr + randomBetween(-15, 15, rng);
    }
    if (vitals.spo2 !== null && rng() > 0.5) {
      vitals.spo2 = null as unknown as number;
    }
  }

  return vitals;
}

function mutateMedications(
  gold: Medication[],
  severity: "partial" | "incorrect",
  rng: () => number
): Medication[] {
  const meds = gold.map((m) => ({ ...m }));

  if (severity === "partial" && meds.length > 0) {
    // Synonym swap on frequency/route
    const idx = Math.floor(rng() * meds.length);
    if (meds[idx].frequency && FREQUENCY_SYNONYMS[meds[idx].frequency!]) {
      meds[idx].frequency = FREQUENCY_SYNONYMS[meds[idx].frequency!];
    }
    if (meds[idx].route && ROUTE_SYNONYMS[meds[idx].route!]) {
      meds[idx].route = ROUTE_SYNONYMS[meds[idx].route!];
    }
    // Dose format variation (e.g., "400 mg" → "400mg")
    if (meds[idx].dose) {
      meds[idx].dose = meds[idx].dose!.replace(" mg", "mg").replace(" mcg", "mcg");
    }
  } else if (severity === "incorrect") {
    // Drop a medication or change the name
    if (meds.length > 1 && rng() > 0.5) {
      meds.splice(Math.floor(rng() * meds.length), 1);
    } else if (meds.length > 0) {
      meds[0].dose = `${randomBetween(100, 1000, rng)} mg`;
    }
  }

  return meds;
}

function mutateDiagnoses(
  gold: Diagnosis[],
  severity: "partial" | "incorrect",
  rng: () => number
): Diagnosis[] {
  const diags = gold.map((d) => ({ ...d }));

  if (severity === "partial" && diags.length > 0) {
    // Slight description change
    diags[0].description = diags[0].description.replace(
      /infection/,
      "syndrome"
    );
  } else if (severity === "incorrect") {
    // Wrong ICD code or missing description
    if (diags.length > 0 && diags[0].icd10) {
      diags[0].icd10 = "Z99.9";
    }
    if (diags.length > 1) {
      diags.pop();
    }
  }

  return diags;
}

function mutatePlan(
  gold: string[],
  severity: "partial" | "incorrect",
  rng: () => number
): string[] {
  const plan = [...gold];

  if (severity === "partial") {
    // Rephrase one item
    if (plan.length > 0) {
      const idx = Math.floor(rng() * plan.length);
      plan[idx] = plan[idx].replace(/\b(and|or|with)\b/, ",");
    }
  } else {
    // Drop items
    if (plan.length > 1) {
      plan.splice(Math.floor(rng() * plan.length), 1);
    }
  }

  return plan;
}

function mutateFollowUp(
  gold: ClinicalExtraction["follow_up"],
  severity: "partial" | "incorrect",
  rng: () => number
): ClinicalExtraction["follow_up"] {
  const fu = { ...gold };

  if (severity === "partial") {
    if (fu.interval_days !== null) {
      fu.interval_days = fu.interval_days + (rng() > 0.5 ? 7 : -3);
      if (fu.interval_days < 0) fu.interval_days = 1;
    }
  } else {
    fu.interval_days = fu.interval_days !== null ? fu.interval_days * 2 : 30;
    fu.reason = "general follow-up";
  }

  return fu;
}

function addHallucinations(
  extraction: ClinicalExtraction,
  rng: () => number
): ClinicalExtraction {
  const result = { ...extraction };

  // Add a hallucinated medication
  if (rng() > 0.4) {
    result.medications = [
      ...result.medications,
      pickRandom(HALLUCINATED_MEDICATIONS, rng),
    ];
  }

  // Add a hallucinated diagnosis
  if (rng() > 0.5) {
    result.diagnoses = [
      ...result.diagnoses,
      pickRandom(HALLUCINATED_DIAGNOSES, rng),
    ];
  }

  // Add a hallucinated plan item
  if (rng() > 0.6) {
    result.plan = [
      ...result.plan,
      pickRandom(HALLUCINATED_PLAN_ITEMS, rng),
    ];
  }

  return result;
}

// ─── Main Mock Provider ──────────────────────────────────────────────

export interface MockLLMResult {
  prediction: ClinicalExtraction;
  attempts: LLMAttempt[];
  tokens: TokenUsage;
  latency_ms: number;
  error_mode: "correct" | "partial" | "incorrect" | "hallucinated";
}

export async function mockExtract(
  caseId: string,
  transcript: string,
  gold: ClinicalExtraction,
  strategy: PromptStrategy,
  promptHash: string,
  config?: Partial<MockConfig>
): Promise<MockLLMResult> {
  const cfg = {
    ...DEFAULT_CONFIG,
    ...STRATEGY_CONFIGS[strategy],
    ...config,
  };

  const rng = seededRandom(`${caseId}-${strategy}-${promptHash}`);

  // Determine error mode
  const roll = rng();
  let errorMode: MockLLMResult["error_mode"];
  if (roll < cfg.correctRate) {
    errorMode = "correct";
  } else if (roll < cfg.correctRate + cfg.partialRate) {
    errorMode = "partial";
  } else if (roll < cfg.correctRate + cfg.partialRate + cfg.incorrectRate) {
    errorMode = "incorrect";
  } else {
    errorMode = "hallucinated";
  }

  // Apply mutations
  let prediction: ClinicalExtraction;
  if (errorMode === "correct") {
    prediction = JSON.parse(JSON.stringify(gold));
  } else if (errorMode === "partial" || errorMode === "incorrect") {
    const severity = errorMode === "partial" ? "partial" : "incorrect";
    prediction = {
      chief_complaint: mutateChiefComplaint(gold.chief_complaint, severity, rng),
      vitals: mutateVitals(gold.vitals, severity, rng),
      medications: mutateMedications(gold.medications, severity, rng),
      diagnoses: mutateDiagnoses(gold.diagnoses, severity, rng),
      plan: mutatePlan(gold.plan, severity, rng),
      follow_up: mutateFollowUp(gold.follow_up, severity, rng),
    };
  } else {
    // Hallucinated — start with partial then add fake items
    prediction = {
      chief_complaint: gold.chief_complaint,
      vitals: { ...gold.vitals },
      medications: [...gold.medications.map((m) => ({ ...m }))],
      diagnoses: [...gold.diagnoses.map((d) => ({ ...d }))],
      plan: [...gold.plan],
      follow_up: { ...gold.follow_up },
    };
    prediction = addHallucinations(prediction, rng);
  }

  // Simulate latency
  const latency = randomBetween(cfg.latencyRange[0], cfg.latencyRange[1], rng);
  await new Promise((resolve) => setTimeout(resolve, latency));

  // Simulate token usage
  const inputTokens = randomBetween(800, 2000, rng);
  const outputTokens = randomBetween(200, 600, rng);
  const cacheRead = strategy !== "zero_shot" ? randomBetween(400, 1200, rng) : 0;
  const cacheWrite = strategy !== "zero_shot" && rng() > 0.7 ? randomBetween(100, 500, rng) : 0;

  const tokens: TokenUsage = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: cacheRead,
    cache_write_input_tokens: cacheWrite,
  };

  // Build attempt trace
  const attempts: LLMAttempt[] = [];
  const needsRetry = rng() < cfg.retryRate;

  if (needsRetry) {
    // First attempt "fails" validation
    attempts.push({
      attempt_number: 1,
      request_prompt_hash: `mock-${strategy}-${caseId}`,
      response_raw: JSON.stringify({ ...prediction, extra_field: "invalid" }),
      validation_errors: ["additionalProperties: must NOT have additional properties 'extra_field'"],
      tokens: {
        input_tokens: Math.floor(inputTokens * 0.5),
        output_tokens: Math.floor(outputTokens * 0.5),
        cache_read_input_tokens: 0,
        cache_write_input_tokens: cacheWrite,
      },
      latency_ms: Math.floor(latency * 0.4),
      cache_hit: false,
      timestamp: new Date(Date.now() - latency).toISOString(),
    });
  }

  // Successful attempt
  attempts.push({
    attempt_number: needsRetry ? 2 : 1,
    request_prompt_hash: `mock-${strategy}-${caseId}`,
    response_raw: JSON.stringify(prediction),
    parsed_output: prediction,
    validation_errors: [],
    tokens,
    latency_ms: needsRetry ? Math.floor(latency * 0.6) : latency,
    cache_hit: cacheRead > 0,
    timestamp: new Date().toISOString(),
  });

  return {
    prediction,
    attempts,
    tokens,
    latency_ms: latency,
    error_mode: errorMode,
  };
}

// ─── Batch helper ────────────────────────────────────────────────────

export async function mockExtractBatch(
  cases: Array<{
    caseId: string;
    transcript: string;
    gold: ClinicalExtraction;
  }>,
  strategy: PromptStrategy,
  promptHash: string,
  config?: Partial<MockConfig>
): Promise<MockLLMResult[]> {
  const results: MockLLMResult[] = [];
  for (const c of cases) {
    const result = await mockExtract(
      c.caseId,
      c.transcript,
      c.gold,
      strategy,
      promptHash,
      config
    );
    results.push(result);
  }
  return results;
}
