/**
 * Compare API Routes
 */

import { Hono } from "hono";
import { compareRuns } from "../services/runner.service";

const compare = new Hono();

compare.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { run_a_id, run_b_id } = body as {
      run_a_id: string;
      run_b_id: string;
    };

    if (!run_a_id || !run_b_id) {
      return c.json({ error: "Both run_a_id and run_b_id are required" }, 400);
    }

    const result = compareRuns(run_a_id, run_b_id);
    if (!result) {
      return c.json({ error: "One or both runs not found" }, 404);
    }

    return c.json({ comparison: result });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default compare;
