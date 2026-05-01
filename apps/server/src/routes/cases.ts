/**
 * Cases API Routes
 */

import { Hono } from "hono";
import {
  listCaseIds,
  loadTranscript,
  loadGold,
} from "../services/runner.service";

const cases = new Hono();

// List all available test cases
cases.get("/", (c) => {
  const caseIds = listCaseIds();
  const caseList = caseIds.map((id) => {
    try {
      const gold = loadGold(id);
      return {
        id,
        chief_complaint: gold.chief_complaint,
        medication_count: gold.medications.length,
        diagnosis_count: gold.diagnoses.length,
        has_vitals: !!(
          gold.vitals.bp ||
          gold.vitals.hr ||
          gold.vitals.temp_f ||
          gold.vitals.spo2
        ),
        plan_count: gold.plan.length,
      };
    } catch {
      return { id, error: "Failed to load" };
    }
  });

  return c.json({ cases: caseList, total: caseList.length });
});

// Get specific case details
cases.get("/:id", (c) => {
  const id = c.req.param("id");
  try {
    const transcript = loadTranscript(id);
    const gold = loadGold(id);
    return c.json({ id, transcript, gold });
  } catch {
    return c.json({ error: "Case not found" }, 404);
  }
});

export default cases;
