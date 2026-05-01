// ─── Clinical Extraction Schema Types ────────────────────────────────
// These types mirror data/schema.json exactly

export interface Vitals {
  bp: string | null;
  hr: number | null;
  temp_f: number | null;
  spo2: number | null;
}

export interface Medication {
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
}

export interface Diagnosis {
  description: string;
  icd10?: string;
}

export interface FollowUp {
  interval_days: number | null;
  reason: string | null;
}

export interface ClinicalExtraction {
  chief_complaint: string;
  vitals: Vitals;
  medications: Medication[];
  diagnoses: Diagnosis[];
  plan: string[];
  follow_up: FollowUp;
}

// ─── Prompt Strategy ─────────────────────────────────────────────────

export type PromptStrategy = "zero_shot" | "few_shot" | "cot";

export const PROMPT_STRATEGIES: PromptStrategy[] = [
  "zero_shot",
  "few_shot",
  "cot",
];

// ─── Run Status ──────────────────────────────────────────────────────

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused";

// ─── Token Usage ─────────────────────────────────────────────────────

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_write_input_tokens: number;
}

// ─── Field Score ─────────────────────────────────────────────────────

export interface FieldScore {
  field: string;
  score: number; // 0.0 to 1.0
  metric: string; // e.g. "exact", "fuzzy", "set_f1", "numeric_tolerance"
  details?: string;
}

// ─── Hallucination ───────────────────────────────────────────────────

export interface Hallucination {
  field: string;
  predicted_value: string;
  grounded: boolean;
  evidence?: string;
}

// ─── LLM Attempt (retry trace) ──────────────────────────────────────

export interface LLMAttempt {
  attempt_number: number;
  request_prompt_hash: string;
  response_raw?: string;
  parsed_output?: ClinicalExtraction;
  validation_errors?: string[];
  tokens: TokenUsage;
  latency_ms: number;
  cache_hit: boolean;
  timestamp: string;
}

// ─── Case Result ─────────────────────────────────────────────────────

export interface CaseResult {
  case_id: string;
  transcript_path: string;
  status: "completed" | "failed" | "pending" | "running";
  prediction: ClinicalExtraction | null;
  gold: ClinicalExtraction;
  scores: FieldScore[];
  overall_score: number;
  hallucinations: Hallucination[];
  hallucination_count: number;
  schema_valid: boolean;
  attempts: LLMAttempt[];
  wall_time_ms: number;
  tokens: TokenUsage;
  explanation?: CaseExplanation;
}

// ─── Case Explanation ────────────────────────────────────────────────

export interface CaseExplanation {
  summary: string;
  field_explanations: FieldExplanation[];
  matched_symptoms: string[];
  missing_items: string[];
  hallucinated_items: string[];
}

export interface FieldExplanation {
  field: string;
  verdict: "correct" | "partially_correct" | "incorrect" | "missing";
  score: number;
  reason: string;
  expected: string;
  predicted: string;
}

// ─── Run Summary ─────────────────────────────────────────────────────

export interface RunSummary {
  id: string;
  strategy: PromptStrategy;
  model: string;
  prompt_hash: string;
  status: RunStatus;
  started_at: string;
  completed_at: string | null;
  total_cases: number;
  completed_cases: number;
  failed_cases: number;
  overall_f1: number;
  field_scores: Record<string, number>;
  hallucination_count: number;
  schema_failure_count: number;
  total_tokens: TokenUsage;
  total_cost_usd: number;
  wall_time_ms: number;
}

// ─── Eval Run (full) ─────────────────────────────────────────────────

export interface EvalRun extends RunSummary {
  cases: CaseResult[];
}

// ─── Compare DTOs ────────────────────────────────────────────────────

export interface CompareFieldDelta {
  field: string;
  run_a_score: number;
  run_b_score: number;
  delta: number;
  winner: "a" | "b" | "tie";
}

export interface CompareResult {
  run_a: RunSummary;
  run_b: RunSummary;
  field_deltas: CompareFieldDelta[];
  overall_winner: "a" | "b" | "tie";
  case_deltas: Array<{
    case_id: string;
    run_a_score: number;
    run_b_score: number;
    delta: number;
  }>;
}

// ─── Leaderboard Entry ──────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  model: string;
  strategy: PromptStrategy;
  prompt_hash: string;
  overall_f1: number;
  field_scores: Record<string, number>;
  total_cost_usd: number;
  avg_latency_ms: number;
  run_count: number;
  best_run_id: string;
  last_run_at: string;
}

// ─── API Request/Response DTOs ───────────────────────────────────────

export interface StartRunRequest {
  strategy: PromptStrategy;
  model?: string;
  dataset_filter?: string[];
  force?: boolean;
}

export interface StartRunResponse {
  run_id: string;
  status: RunStatus;
  message: string;
}

export type ExportFormat = "json" | "csv" | "pdf";

// ─── SSE Event Types ─────────────────────────────────────────────────

export type SSEEventType =
  | "run_started"
  | "case_started"
  | "case_completed"
  | "case_failed"
  | "run_completed"
  | "run_failed"
  | "progress";

export interface SSEEvent {
  type: SSEEventType;
  run_id: string;
  case_id?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Test Case Template ──────────────────────────────────────────────

export interface TestCaseTemplate {
  id: string;
  transcript: string;
  gold: ClinicalExtraction;
  metadata?: {
    specialty?: string;
    complexity?: "simple" | "moderate" | "complex" | "edge_case";
    tags?: string[];
  };
}
