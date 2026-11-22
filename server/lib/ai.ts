// AI assistant (vision): one code path for every provider, through the Vercel AI SDK.
// The user picks a provider in the settings; the SDK's provider packages handle each vendor's API,
// image format and structured-output mode. Our only job: the prompts and the schemas.
import { generateText, Output } from 'ai'
import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { publicFetch } from './safe-fetch.ts'
import { MEDIA, fieldsFor } from '../../shared/media.js'
import { candidate } from '../connectors/types.ts'
import type { Candidate, MediaType } from '../connectors/types.ts'
import type { LlmConfig } from './secrets.ts'

/** Providers offered in the settings. `compatible` covers OpenRouter, Ollama, LM Studio, Groq… (base URL required). */
export const PROVIDERS = {
  openai: { name: 'OpenAI', baseUrl: false, keyRequired: true, example: 'gpt-4o-mini' },
  anthropic: { name: 'Anthropic (Claude)', baseUrl: false, keyRequired: true, example: 'claude-opus-5-5' },
  google: { name: 'Google (Gemini)', baseUrl: false, keyRequired: true, example: '' },
  mistral: { name: 'Mistral', baseUrl: false, keyRequired: true, example: '' },
  compatible: { name: 'OpenAI-compatible', baseUrl: true, keyRequired: false, example: '' },
} as const
export type ProviderId = keyof typeof PROVIDERS

export function providerOf(llm: LlmConfig): ProviderId {
  return llm.provider && llm.provider in PROVIDERS ? (llm.provider as ProviderId) : 'openai'
}

export function llmEnabled(llm: LlmConfig) {
  const provider = PROVIDERS[providerOf(llm)]
  if (!llm.model) return false
  if (provider.keyRequired && !llm.apiKey) return false
  if (provider.baseUrl && !llm.baseUrl) return false
  return true
}

function model(llm: LlmConfig): LanguageModel {
  const apiKey = llm.apiKey || undefined
  const baseURL = llm.baseUrl || undefined
  const id = llm.model!
  // The base URL is user-provided: cloud providers may only reach public addresses (no probing of the
  // server's network). "OpenAI-compatible" is meant for self-hosted models (Ollama, LM Studio on the LAN)
  // and keeps local access; accounts are created by the administrator, so that trust is deliberate.
  const fetch = publicFetch
  switch (providerOf(llm)) {
    case 'anthropic': return createAnthropic({ apiKey, baseURL, fetch })(id)
    case 'google': return createGoogleGenerativeAI({ apiKey, baseURL, fetch })(id)
    case 'mistral': return createMistral({ apiKey, baseURL, fetch })(id)
    case 'compatible': return createOpenAICompatible({ name: 'custom', baseURL: baseURL!, apiKey })(id)
    default: return createOpenAI({ apiKey, baseURL, fetch })(id)
  }
}

/** Short connection check for the settings screen. */
export async function testConnection(llm: LlmConfig): Promise<string> {
  const { text } = await generateText({
    model: model(llm),
    prompt: 'Reply with the single word: pong',
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30_000),
  })
  return text
}

// ---------------------------------------------------------------- Schemas

// Never asked from the AI: the user's own note, the synopsis (not on a front cover), the item's state.
const HIDDEN = new Set(['cover', 'consumed', 'digitalized', 'comment', 'description', 'condition'])

/**
 * Item fields for a media type, lenient on purpose: models in plain JSON mode often omit empty fields
 * (→ default null) or return an off-list value (→ null instead of failing the whole answer).
 * Choice lists are still sent to the model as enums. Nulls are dropped later by candidate().
 */
function itemSchema(type: MediaType, exclude: string[] = []) {
  const m = MEDIA[type]
  const choice = (values: string[]) => z.enum(values as [string, ...string[]]).nullable().default(null).catch(null)
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of fieldsFor(type)) {
    if (HIDDEN.has(f) || exclude.includes(f)) continue
    if (f === 'title') shape.title = z.string().describe('Title as printed')
    else if (f === 'category' && m.categories.length) shape.category = choice(m.categories)
    else if (f === 'format' && m.formats.length) shape.format = choice(m.formats)
    else shape[f] = z.string().nullable().default(null).catch(null)
  }
  return z.object(shape)
}

// OpenAI's strict mode requires every field; our lenient schema needs the regular JSON-schema mode.
const providerOptions = { openai: { strictJsonSchema: false } }

function rules(type: MediaType, locale: string) {
  const m = MEDIA[type]
  return [
    'Only fill what you can read on the image or are highly confident about; use null otherwise. Never invent barcodes or ISBNs.',
    `"author" is the ${{ book: 'writer', music: 'artist or band', movie: 'director', videogame: 'developer studio', custom: 'maker' }[type]}; "editor" the ${{ book: 'publisher', music: 'record label', movie: 'production studio', videogame: 'publisher', custom: 'brand' }[type]}. "release_date" is YYYY or YYYY-MM-DD.`,
    m.genres.length ? `"genre" should be one of: ${m.genres.join(', ')} (or a short free label).` : '',
    '"saga" is the series name and "volume" its number, when the item belongs to a series.',
    type === 'videogame' ? '"format" is the platform; the case design often tells it.' : '',
    `Keep titles in the language printed on the item. Interface language: ${locale}.`,
  ].filter(Boolean).map((r) => `- ${r}`).join('\n')
}

const imagePart = (jpeg: Buffer) => ({ type: 'image' as const, image: jpeg, mediaType: 'image/jpeg' })

// ---------------------------------------------------------------- Tasks

const BULK_HINTS: Record<string, string> = {
  book: 'Books seen by their spines or covers. Spine text is often vertical. For comics and mangas, set "saga" and "volume" when a series name and number are visible.',
  music: 'CDs, vinyls or tapes seen by their spines or covers. "author" is the artist or band, "title" the album.',
  movie: 'DVD / Blu-ray cases seen by their spines or covers. "author" (the director) only if printed.',
  videogame: 'Video game cases seen by their spines or covers.',
  custom: 'Collectible objects.',
}

/** Lists every item visible on a photo (one cover, a shelf, a pile), in reading order. */
export async function detectMany(llm: LlmConfig, jpeg: Buffer, type: MediaType, locale: string): Promise<Candidate[]> {
  // An unreadable entry (no title) becomes null and is dropped, instead of failing the whole shelf.
  const schema = z.object({ items: z.array(itemSchema(type, ['barcode', 'isbn', 'genre']).nullable().catch(null)) })
  const { output } = await generateText({
    model: model(llm),
    system: [
      `You are cataloguing a physical collection from ONE photo showing one or several ${type} items (a single cover, a shelf, a pile, a box).`,
      BULK_HINTS[type] || '',
      'List every distinct item you can identify, in reading order (left to right, top to bottom); at most 60.',
      'One entry per physical item; repeat an entry if the same title appears twice. Skip items whose title you cannot read.',
      `Rules:\n${rules(type, locale)}`,
    ].filter(Boolean).join('\n'),
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Here is the photo.' }, imagePart(jpeg)] }],
    output: Output.object({ schema, name: 'shelf' }),
    providerOptions,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(150_000),
  })
  return (output?.items || [])
    .filter((i: any) => i?.title)
    .slice(0, 60)
    .map((i: any) => candidate({ id: 'llm', name: `AI · ${llm.model}` }, type, i))
}
