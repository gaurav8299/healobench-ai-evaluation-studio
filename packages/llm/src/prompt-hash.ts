/**
 * Prompt Hash Utility
 * 
 * Generates a deterministic content hash for prompt content so that
 * "prompt v6" is unambiguous. Any character change produces a new hash.
 */

export async function computePromptHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Use Web Crypto API (available in Bun)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Return first 12 chars for readability
  return hashHex.slice(0, 12);
}

/**
 * Generate a prompt version label like "v-a3b2c1d4e5f6"
 */
export async function promptVersion(content: string): Promise<string> {
  const hash = await computePromptHash(content);
  return `v-${hash}`;
}
