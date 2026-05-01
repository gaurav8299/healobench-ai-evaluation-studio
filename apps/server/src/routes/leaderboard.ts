/**
 * Leaderboard API Routes
 */

import { Hono } from "hono";
import { getLeaderboard } from "../services/runner.service";

const leaderboard = new Hono();

leaderboard.get("/", (c) => {
  const entries = getLeaderboard();
  return c.json({ leaderboard: entries });
});

export default leaderboard;
