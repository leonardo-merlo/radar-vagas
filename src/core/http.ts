import { SourceBlockedError, type SourceName } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const RETRY_WAITS_MS = [10_000, 30_000];

export async function fetchText(source: SourceName, url: string, timeoutMs = 20_000): Promise<string> {
  for (const wait of RETRY_WAITS_MS) {
    const response = await request(url, timeoutMs);
    if (response.status !== 429) return readBody(source, url, response);
    await sleep(wait);
  }
  return readBody(source, url, await request(url, timeoutMs));
}

function request(url: string, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
}

async function readBody(source: SourceName, url: string, response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new SourceBlockedError(source, `HTTP ${response.status} em ${new URL(url).host} (bloqueio ou login exigido)`);
  }
  if (!response.ok) {
    throw new Error(`${source}: HTTP ${response.status} em ${url}`);
  }
  return response.text();
}

export async function fetchJson<T>(source: SourceName, url: string): Promise<T> {
  const text = await fetchText(source, url);
  return JSON.parse(text) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs tasks with a concurrency cap; failures become undefined so one bad page doesn't sink the batch. */
export async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await task(items[index] as T);
      } catch {
        results[index] = undefined;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
