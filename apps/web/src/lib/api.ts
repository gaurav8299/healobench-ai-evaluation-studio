/**
 * API Client
 * All communication with the Hono server goes through here.
 * The web app NEVER talks to Anthropic directly.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as any).error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Health ──────────────────────────────────────────────────────────

export async function getHealth() {
  return apiFetch<{
    service: string;
    status: string;
    version: string;
    mode: string;
  }>("/");
}

// ─── Runs ────────────────────────────────────────────────────────────

export async function getRuns() {
  return apiFetch<{ runs: any[] }>("/api/v1/runs");
}

export async function startRun(params: {
  strategy: string;
  model?: string;
  dataset_filter?: string[];
  force?: boolean;
  prompt_content?: string;
}) {
  return apiFetch<{ run_id: string; status: string; message: string }>(
    "/api/v1/runs",
    { method: "POST", body: JSON.stringify(params) }
  );
}

export async function getRunDetail(id: string) {
  return apiFetch<{ run: any }>(`/api/v1/runs/${id}`);
}

export async function resumeRun(id: string) {
  return apiFetch<{ run_id: string; status: string; message: string }>(
    `/api/v1/runs/${id}/resume`,
    { method: "POST" }
  );
}

export async function getCaseDetail(runId: string, caseId: string) {
  return apiFetch<{ case: any; transcript: string }>(
    `/api/v1/runs/${runId}/cases/${caseId}`
  );
}

// ─── SSE Stream ──────────────────────────────────────────────────────

export function subscribeToRunStream(
  runId: string,
  onEvent: (event: any) => void,
  onError?: (error: Event) => void
): () => void {
  const url = `${API_BASE}/api/v1/runs/${runId}/stream`;
  const source = new EventSource(url);

  const events = [
    "run_started",
    "case_started",
    "case_completed",
    "case_failed",
    "run_completed",
    "run_failed",
  ];

  for (const eventType of events) {
    source.addEventListener(eventType, (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        onEvent({ type: eventType, ...data });
      } catch {
        // ignore parse errors
      }
    });
  }

  if (onError) {
    source.onerror = onError;
  }

  return () => source.close();
}

// ─── Compare ─────────────────────────────────────────────────────────

export async function compareRuns(runAId: string, runBId: string) {
  return apiFetch<{ comparison: any }>("/api/v1/compare", {
    method: "POST",
    body: JSON.stringify({ run_a_id: runAId, run_b_id: runBId }),
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────────

export async function getLeaderboard() {
  return apiFetch<{ leaderboard: any[] }>("/api/v1/leaderboard");
}

// ─── Cases ───────────────────────────────────────────────────────────

export async function getCases() {
  return apiFetch<{ cases: any[]; total: number }>("/api/v1/cases");
}

export async function getCaseData(id: string) {
  return apiFetch<{ id: string; transcript: string; gold: any }>(
    `/api/v1/cases/${id}`
  );
}

// ─── Export ──────────────────────────────────────────────────────────

export function getExportUrl(runId: string, format: "json" | "csv" | "pdf") {
  return `${API_BASE}/api/v1/export/${runId}/${format}`;
}
