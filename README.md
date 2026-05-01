# HealoBench — AI Evaluation Studio

HealoBench is a production-grade evaluation harness for clinical NLP. It allows AI engineering teams to test, compare, and ship better prompts with confidence. Designed to turn clinical transcripts into structured JSON (chief complaint, vitals, medications, diagnoses, and follow-up plan) with rigorous metric tracking.

## Overview

When building AI agents in healthcare, you cannot simply "vibe-check" prompts. You need a repeatable, deterministic evaluation harness that provides hard numbers on whether prompt v7 is better than prompt v6, on exactly which fields, and where it fails. 

HealoBench is that harness.

![HealoBench Demo Preview](/docs/demo.png)

## Features & Capabilities

- **Clinical Extraction:** Process synthetic doctor-patient transcripts through three prompt strategies (Zero-Shot, Few-Shot, Chain-of-Thought).
- **Per-Field Scoring:** We use field-appropriate metrics instead of generic exact matches. 
  - Fuzzy string match for chief complaints
  - Numeric tolerance for vitals
  - Set-based Precision/Recall/F1 for medications and diagnoses
- **Hallucination Detection:** Built-in grounding checks verify every predicted value against the source transcript.
- **Strategy Comparison:** Side-by-side visual comparison showing which prompt wins on which fields.
- **Visual Analytics:** Beautiful Recharts-powered dashboard showing accuracy trends, error distribution, and API costs.
- **Mock LLM Mode:** Run zero-cost, latency-simulated, and realistic mock evaluations offline for rapid development and demos.

## Architecture

HealoBench is a modern Turborepo monorepo:

- **`apps/web`**: Next.js App Router client with Tailwind CSS, Recharts, and SSE live-streaming.
- **`apps/server`**: Hono REST API running on Bun, handling concurrency control via semaphores, real-time SSE updates, and LLM orchestration.
- **`packages/llm`**: Extensible mock & real LLM providers featuring prompt hashing, seeded deterministic RNG testing, and latency simulation.
- **`packages/shared`**: Shared TypeScript types for full end-to-end type safety.

## Demo Instructions

HealoBench includes a robust "Demo Mode" for live presentations without incurring API costs or waiting for long inference times.

1. Install dependencies:
   ```bash
   bun install
   ```
2. Start the suite:
   ```bash
   bun run dev
   ```
3. Open `http://localhost:3001` in your browser.
4. Click **⚡ Run Demo (5 Cases)** on the landing page or Runs dashboard.
5. The system will automatically select the Chain-of-Thought preset, subset 5 test cases, and stream live results via SSE, completing in under 10 seconds.
6. Click **📸 Export PNG** on any completed run to download a report.

## Technical Innovations

- **Deterministic Mocking:** The `MockLLMProvider` hashes your exact system prompt to generate a seeded PRNG. This means the mock results are perfectly deterministic for the same prompt, but tweaking your prompt slightly will generate slightly different accuracy scores—simulating a real LLM environment perfectly.
- **Resumable Concurrency:** Evaluations run via a Semaphore-controlled async queue, preventing rate-limit blocks while maintaining high throughput.
- **Real-Time Hydration:** Web application hydrates run states over SSE streams, rendering beautiful gauge charts and field-level progress bars in real time as cases evaluate.
