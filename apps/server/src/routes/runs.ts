/**
 * Runs API Routes
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  startRun,
  resumeRun,
  getRun,
  getAllRuns,
  subscribeToRun,
  listCaseIds,
  loadTranscript,
  loadGold,
} from "../services/runner.service";
import type { PromptStrategy } from "@test-evals/shared";

const runs = new Hono();

// List all runs
runs.get("/", (c) => {
  const allRuns = getAllRuns();
  return c.json({ runs: allRuns });
});

// Start a new run
runs.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { strategy, model, dataset_filter, force, prompt_content } = body as {
      strategy: PromptStrategy;
      model?: string;
      dataset_filter?: string[];
      force?: boolean;
      prompt_content?: string;
    };

    if (!strategy || !["zero_shot", "few_shot", "cot"].includes(strategy)) {
      return c.json(
        { error: "Invalid strategy. Must be: zero_shot, few_shot, or cot" },
        400
      );
    }

    const run = await startRun(strategy, model, dataset_filter, force, prompt_content);
    return c.json({
      run_id: run.id,
      status: run.status,
      message: `Run started with strategy: ${strategy}`,
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Get run detail
runs.get("/:id", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json({ run });
});

// Resume a run
runs.post("/:id/resume", async (c) => {
  const id = c.req.param("id");
  const run = await resumeRun(id);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json({
    run_id: run.id,
    status: run.status,
    message: "Run resumed",
  });
});

// SSE stream for run progress
runs.get("/:id/stream", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribeToRun(id, (event) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    // Keep alive until run completes
    while (true) {
      const current = getRun(id);
      if (!current || current.status === "completed" || current.status === "failed") {
        break;
      }
      await stream.sleep(1000);
    }

    unsubscribe();
  });
});

// Get specific case from a run
runs.get("/:id/cases/:caseId", (c) => {
  const id = c.req.param("id");
  const caseId = c.req.param("caseId");
  const run = getRun(id);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const caseResult = run.cases.find((c) => c.case_id === caseId);
  if (!caseResult) {
    return c.json({ error: "Case not found" }, 404);
  }

  // Load transcript for the response
  let transcript = "";
  try {
    transcript = loadTranscript(caseId);
  } catch {
    // ok
  }

  return c.json({ case: caseResult, transcript });
});

export default runs;
