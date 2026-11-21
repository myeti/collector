import type { MediaType } from '../connectors/types.ts'

/** Why a row is left out of an import (translated client-side: import.reasons.*). */
export type ExcludeReason = 'toConsume' | 'wishlist' | 'notOwned' | 'untitled'

export interface ImportRow {
  fields: Record<string, any>
  excluded?: ExcludeReason
  /** Games whose platform could not be decided: the platforms the service lists, to pick from. */
  choices?: string[]
}

export interface Importer {
  id: string
  name: string
  type: MediaType
  /** Where the user exports the file. */
  url: string
  /** Is this a header row of this service's export? (some files start with a preamble) */
  header(columns: string[], filename: string): boolean
  rows(records: Record<string, string>[], filename: string): ImportRow[]
}

/** Trims and collapses inner whitespace; empty -> undefined. */
export const clean = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim() || undefined

/** First 4-digit year of a date or year field ("2024/03/09", "1974", "0" -> undefined). */
export const year = (s: any) => String(s ?? '').match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1]

export const has = (columns: string[], ...names: string[]) => names.every((n) => columns.includes(n))
