export const CONDITIONS: string[]
export const COMMON_FIELDS: string[]
export const LANGUAGES: string[]
export const MEDIA: Record<string, { icon: string; quickFilter: string; fields: string[]; hidden?: string[]; categories: string[]; genres: string[]; formats: string[] }>
export const PLATFORM_GROUPS: { brand: string; platforms: string[] }[]
export const PLATFORM_LABELS: Record<string, string>
export function matchPlatform(raw: any): string | null
export const MEDIA_TYPES: string[]
export const DEFAULT_TYPES: string[]
export const DEFAULT_START_TYPE: string
export function userPrefs(prefs: any): { types: string[]; startType: string }
export const SPECIFIC_FIELDS: string[]
export const ALL_FIELDS: string[]
export function fieldsFor(type: string): string[]
export function defaultFormat(type: string): string | null
export function allowedValue(type: string, field: 'category' | 'format' | 'language', value: any): boolean
export function isIsbn(code: string): boolean
export function normalizeIsbn(raw: any): string | null
export function matchGenre(type: string, raw: string): string | null
