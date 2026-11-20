import { encrypt, decrypt } from './crypto.ts'

/** provider: openai | anthropic | google | mistral | compatible (see lib/ai.ts). */
export interface LlmConfig { provider?: string; baseUrl?: string; apiKey?: string; model?: string }
export interface Secrets { keys: Record<string, string>; llm: LlmConfig }

export function readSecrets(user: any): Secrets {
  const raw = user.secrets ? decrypt(user.secrets) : null
  const parsed = raw ? JSON.parse(raw) : {}
  return { keys: parsed.keys || {}, llm: parsed.llm || {} }
}

export async function writeSecrets(user: any, secrets: Secrets) {
  user.secrets = encrypt(JSON.stringify(secrets))
  await user.save()
}
