export type Recency = "day" | "week" | "month" | "year";

export interface Hit {
  title?: string | null;
  url: string;
  date?: string | null;
  author?: string | null;
  /** Excerpt or page text, already chosen by the provider. */
  text?: string;
}

export interface SearchRequest {
  query: string;
  numResults: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  recency?: Recency;
  maxCharacters: number;
  mode: string;
  /** The raw tool input, for the provider's own `searchProps`. */
  input: Record<string, unknown>;
  signal: AbortSignal;
}

export interface FetchRequest {
  urls: string[];
  maxCharacters: number;
  signal: AbortSignal;
}

export interface SearchResult {
  hits: Hit[];
  cost?: number;
}

export interface FetchResult {
  hits: Hit[];
  /** One line per URL the provider could not fetch. */
  failed: string[];
}

export interface Http {
  post(path: string, body: unknown, signal: AbortSignal): Promise<unknown>;
}

/** Everything that differs between search providers. The rest of the plugin is shared. */
export interface Provider {
  /** Short lowercase id; becomes the tool-name suffix (`web_search_<id>`). */
  id: string;
  /** Display name for tool descriptions and errors. */
  label: string;
  /** Default secret name (`~/.valet/secrets/<name>`, env `<NAME>`). */
  secret: string;
  baseUrl: string;
  modes: readonly string[];
  defaultMode: string;
  /** Most results one search call may ask for. */
  maxResults: number;
  /** JSON-schema properties added to the search tool beyond the common ones. */
  searchProps: Record<string, unknown>;
  headers(key: string): Record<string, string>;
  search(req: SearchRequest, http: Http): Promise<SearchResult>;
  fetch(req: FetchRequest, http: Http): Promise<FetchResult>;
}
