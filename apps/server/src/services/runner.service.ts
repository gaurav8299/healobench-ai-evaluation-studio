/**
 * Runner Service
 *
 * Orchestrates evaluation runs with:
 * - Semaphore-based concurrency (max 5 in-flight)
 * - Mock or real LLM extraction
 * - Resumable runs (tracks completed cases)
 * - Idempotency (cached results per strategy+model+case)
 * - SSE progress streaming
 */

import type {
  ClinicalExtraction,
  PromptStrategy,
  RunSummary,
  EvalRun,
  CaseResult,
  TokenUsage,
  RunStatus,
} from "@test-evals/shared";

import { mockExtract } from "@test-evals/llm";
import { computePromptHash } from "@test-evals/llm";
import { evaluateCase, aggregateFieldScores } from "./evaluate.service";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// ─── In-memory store (replace with DB in production) ─────────────────

interface RunStore {
  runs: Map<string, EvalRun>;
  listeners: Map<string, Array<(event: SSEEventPayload) => void>>;
}

export interface SSEEventPayload {
  type: string;
  run_id: string;
  case_id?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const store: RunStore = {
  runs: new Map(),
  listeners: new Map(),
};

// ─── Data loader ─────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "..", "..", "data");

export function loadTranscript(caseId: string): string {
  const filePath = join(DATA_DIR, "transcripts", `${caseId}.txt`);
  return readFileSync(filePath, "utf-8");
}

export function loadGold(caseId: string): ClinicalExtraction {
  const filePath = join(DATA_DIR, "gold", `${caseId}.json`);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function listCaseIds(): string[] {
  const dir = join(DATA_DIR, "transcripts");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(".txt", ""))
      .sort();
  } catch {
    return [];
  }
}

// ─── Semaphore for concurrency control ───────────────────────────────

class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

// ─── Cost calculation ────────────────────────────────────────────────

function calculateCost(tokens: TokenUsage): number {
  // Haiku pricing (approximate): $0.25/M input, $1.25/M output
  const inputCost = (tokens.input_tokens / 1_000_000) * 0.25;
  const outputCost = (tokens.output_tokens / 1_000_000) * 1.25;
  const cacheReadCost = (tokens.cache_read_input_tokens / 1_000_000) * 0.03;
  return inputCost + outputCost + cacheReadCost;
}

// ─── SSE helpers ─────────────────────────────────────────────────────

function emitEvent(runId: string, event: SSEEventPayload): void {
  const listeners = store.listeners.get(runId) || [];
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToRun(
  runId: string,
  callback: (event: SSEEventPayload) => void
): () => void {
  if (!store.listeners.has(runId)) {
    store.listeners.set(runId, []);
  }
  store.listeners.get(runId)!.push(callback);

  return () => {
    const listeners = store.listeners.get(runId) || [];
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// ─── Generate run ID ─────────────────────────────────────────────────

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${ts}_${rand}`;
}

// ─── Start a new run ─────────────────────────────────────────────────

export async function startRun(
  strategy: PromptStrategy,
  model: string = "claude-haiku-4-5-20251001",
  datasetFilter?: string[],
  force?: boolean,
  promptContent?: string
): Promise<EvalRun> {
  const runId = generateRunId();
  const promptHash = await computePromptHash(promptContent || `${strategy}-${model}-mock-v1`);

  // Check idempotency (if not forced, return existing run with same params)
  if (!force) {
    for (const [, existing] of store.runs) {
      if (
        existing.strategy === strategy &&
        existing.model === model &&
        existing.status === "completed"
      ) {
        return existing;
      }
    }
  }

  const allCaseIds = listCaseIds();
  const caseIds = datasetFilter
    ? allCaseIds.filter((id) => datasetFilter.includes(id))
    : allCaseIds;

  const run: EvalRun = {
    id: runId,
    strategy,
    model,
    prompt_hash: promptHash,
    status: "pending",
    started_at: new Date().toISOString(),
    completed_at: null,
    total_cases: caseIds.length,
    completed_cases: 0,
    failed_cases: 0,
    overall_f1: 0,
    field_scores: {},
    hallucination_count: 0,
    schema_failure_count: 0,
    total_tokens: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_write_input_tokens: 0,
    },
    total_cost_usd: 0,
    wall_time_ms: 0,
    cases: [],
  };

  store.runs.set(runId, run);

  // Start async processing
  processRun(run, caseIds);

  return run;
}

// ─── Process run (async) ─────────────────────────────────────────────

async function processRun(run: EvalRun, caseIds: string[]): Promise<void> {
  const semaphore = new Semaphore(5);
  run.status = "running";
  const startTime = Date.now();

  emitEvent(run.id, {
    type: "run_started",
    run_id: run.id,
    data: {
      strategy: run.strategy,
      total_cases: caseIds.length,
    },
    timestamp: new Date().toISOString(),
  });

  const promises = caseIds.map(async (caseId) => {
    await semaphore.acquire();
    try {
      // Check if already completed (resumability)
      const existing = run.cases.find(
        (c) => c.case_id === caseId && c.status === "completed"
      );
      if (existing) {
        semaphore.release();
        return;
      }

      emitEvent(run.id, {
        type: "case_started",
        run_id: run.id,
        case_id: caseId,
        data: {},
        timestamp: new Date().toISOString(),
      });

      const transcript = loadTranscript(caseId);
      const gold = loadGold(caseId);

      // Use mock LLM
      const llmResult = await mockExtract(
        caseId,
        transcript,
        gold,
        run.strategy,
        run.prompt_hash
      );

      // Evaluate
      const caseResult = evaluateCase(
        caseId,
        `data/transcripts/${caseId}.txt`,
        transcript,
        llmResult.prediction,
        gold,
        llmResult.attempts,
        llmResult.tokens,
        llmResult.latency_ms
      );

      run.cases.push(caseResult);
      run.completed_cases++;

      // Update totals
      run.total_tokens.input_tokens += caseResult.tokens.input_tokens;
      run.total_tokens.output_tokens += caseResult.tokens.output_tokens;
      run.total_tokens.cache_read_input_tokens +=
        caseResult.tokens.cache_read_input_tokens;
      run.total_tokens.cache_write_input_tokens +=
        caseResult.tokens.cache_write_input_tokens;
      run.hallucination_count += caseResult.hallucination_count;
      if (!caseResult.schema_valid) run.schema_failure_count++;

      emitEvent(run.id, {
        type: "case_completed",
        run_id: run.id,
        case_id: caseId,
        data: {
          score: caseResult.overall_score,
          completed: run.completed_cases,
          total: run.total_cases,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      run.failed_cases++;
      run.cases.push({
        case_id: caseId,
        transcript_path: `data/transcripts/${caseId}.txt`,
        status: "failed",
        prediction: null,
        gold: loadGold(caseId),
        scores: [],
        overall_score: 0,
        hallucinations: [],
        hallucination_count: 0,
        schema_valid: false,
        attempts: [],
        wall_time_ms: 0,
        tokens: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_write_input_tokens: 0,
        },
      });

      emitEvent(run.id, {
        type: "case_failed",
        run_id: run.id,
        case_id: caseId,
        data: { error: String(error) },
        timestamp: new Date().toISOString(),
      });
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(promises);

  // Finalize
  run.wall_time_ms = Date.now() - startTime;
  run.total_cost_usd = calculateCost(run.total_tokens);
  run.field_scores = aggregateFieldScores(
    run.cases.filter((c) => c.status === "completed")
  );

  const completedCases = run.cases.filter((c) => c.status === "completed");
  run.overall_f1 =
    completedCases.length > 0
      ? completedCases.reduce((sum, c) => sum + c.overall_score, 0) /
        completedCases.length
      : 0;

  run.status = run.failed_cases === run.total_cases ? "failed" : "completed";
  run.completed_at = new Date().toISOString();

  emitEvent(run.id, {
    type: "run_completed",
    run_id: run.id,
    data: {
      overall_f1: run.overall_f1,
      completed: run.completed_cases,
      failed: run.failed_cases,
      cost: run.total_cost_usd,
      wall_time_ms: run.wall_time_ms,
    },
    timestamp: new Date().toISOString(),
  });
}

// ─── Resume a run ────────────────────────────────────────────────────

export async function resumeRun(runId: string): Promise<EvalRun | null> {
  const run = store.runs.get(runId);
  if (!run) return null;
  if (run.status === "completed") return run;

  const allCaseIds = listCaseIds();
  const completedIds = new Set(
    run.cases.filter((c) => c.status === "completed").map((c) => c.case_id)
  );
  const remainingIds = allCaseIds.filter((id) => !completedIds.has(id));

  if (remainingIds.length === 0) {
    run.status = "completed";
    return run;
  }

  run.status = "running";
  processRun(run, remainingIds);
  return run;
}

// ─── Get run(s) ──────────────────────────────────────────────────────

export function getRun(runId: string): EvalRun | undefined {
  return store.runs.get(runId);
}

export function getAllRuns(): RunSummary[] {
  const runs: RunSummary[] = [];
  for (const [, run] of store.runs) {
    const { cases, ...summary } = run;
    runs.push(summary);
  }
  return runs.sort(
    (a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

// ─── Compare two runs ────────────────────────────────────────────────

import type { CompareResult, CompareFieldDelta } from "@test-evals/shared";

export function compareRuns(
  runIdA: string,
  runIdB: string
): CompareResult | null {
  const runA = store.runs.get(runIdA);
  const runB = store.runs.get(runIdB);
  if (!runA || !runB) return null;

  const { cases: casesA, ...summaryA } = runA;
  const { cases: casesB, ...summaryB } = runB;

  // Per-field deltas
  const allFields = new Set([
    ...Object.keys(runA.field_scores),
    ...Object.keys(runB.field_scores),
  ]);

  const fieldDeltas: CompareFieldDelta[] = [];
  for (const field of allFields) {
    const scoreA = runA.field_scores[field] || 0;
    const scoreB = runB.field_scores[field] || 0;
    const delta = scoreA - scoreB;
    fieldDeltas.push({
      field,
      run_a_score: scoreA,
      run_b_score: scoreB,
      delta,
      winner: delta > 0.01 ? "a" : delta < -0.01 ? "b" : "tie",
    });
  }

  // Case deltas
  const caseDeltas: CompareResult["case_deltas"] = [];
  const caseMapA = new Map(casesA.map((c) => [c.case_id, c]));
  const caseMapB = new Map(casesB.map((c) => [c.case_id, c]));
  const allCaseIds = new Set([...caseMapA.keys(), ...caseMapB.keys()]);

  for (const caseId of allCaseIds) {
    const a = caseMapA.get(caseId);
    const b = caseMapB.get(caseId);
    caseDeltas.push({
      case_id: caseId,
      run_a_score: a?.overall_score || 0,
      run_b_score: b?.overall_score || 0,
      delta: (a?.overall_score || 0) - (b?.overall_score || 0),
    });
  }

  // Overall winner
  const overallDelta = runA.overall_f1 - runB.overall_f1;
  const overallWinner: "a" | "b" | "tie" =
    overallDelta > 0.01 ? "a" : overallDelta < -0.01 ? "b" : "tie";

  return {
    run_a: summaryA,
    run_b: summaryB,
    field_deltas: fieldDeltas,
    overall_winner: overallWinner,
    case_deltas: caseDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}

// ─── Leaderboard ─────────────────────────────────────────────────────

import type { LeaderboardEntry } from "@test-evals/shared";

export function getLeaderboard(): LeaderboardEntry[] {
  const entries: Map<string, LeaderboardEntry> = new Map();

  for (const [, run] of store.runs) {
    if (run.status !== "completed") continue;

    const key = `${run.model}-${run.strategy}`;
    const existing = entries.get(key);

    if (!existing || run.overall_f1 > existing.overall_f1) {
      entries.set(key, {
        rank: 0,
        model: run.model,
        strategy: run.strategy,
        prompt_hash: run.prompt_hash,
        overall_f1: run.overall_f1,
        field_scores: run.field_scores,
        total_cost_usd: run.total_cost_usd,
        avg_latency_ms: run.wall_time_ms / run.total_cases,
        run_count: (existing?.run_count || 0) + 1,
        best_run_id: run.id,
        last_run_at: run.completed_at || run.started_at,
      });
    }
  }

  const sorted = Array.from(entries.values()).sort(
    (a, b) => b.overall_f1 - a.overall_f1
  );
  sorted.forEach((e, i) => (e.rank = i + 1));
  return sorted;
}
