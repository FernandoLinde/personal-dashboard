import { YoutubeTranscript } from "youtube-transcript";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "but",
  "by",
  "can",
  "could",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "more",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "you",
  "your",
]);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function cleanText(text: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(text)
      .replace(/\[(music|applause|laughter)\]/gi, " ")
      .replace(/\u00a0/g, " "),
  );
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function sentenceOverlap(left: string, right: string): number {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) return 0;

  let matches = 0;
  for (const token of a) {
    if (b.has(token)) matches++;
  }

  return matches / Math.min(a.size, b.size);
}

function splitIntoSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 240);
}

function buildKeywordScores(text: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function scoreSentence(sentence: string, keywordScores: Map<string, number>): number {
  const tokens = tokenize(sentence);
  let score = 0;

  for (const token of tokens) {
    score += keywordScores.get(token) ?? 0;
  }

  if (/\d/.test(sentence)) score += 2;
  if (sentence.length >= 70 && sentence.length <= 180) score += 3;
  if (sentence.includes(":")) score += 1;

  return score;
}

function pickDescriptionBullets(description: string): string[] {
  const lineBullets = description
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line.replace(/^[-*0-9.)\s]+/, "")))
    .filter((line) => line.length >= 30);

  if (lineBullets.length > 0) {
    return lineBullets.slice(0, 4).map((line) => line.replace(/[.!?]$/, ""));
  }

  return splitIntoSentences(description)
    .slice(0, 4)
    .map((sentence) => sentence.replace(/[.!?]$/, ""));
}

export function buildSummaryBullets(input: {
  title: string;
  description?: string | null;
  transcriptText?: string | null;
}): string[] {
  const rawDescription = decodeHtmlEntities(input.description ?? "").trim();
  const transcriptText = cleanText(input.transcriptText ?? "");
  const description = cleanText(rawDescription);
  const sourceText = transcriptText || description;

  if (!sourceText) {
    return [input.title.trim()];
  }

  if (!transcriptText && rawDescription) {
    const fallbackBullets = pickDescriptionBullets(rawDescription);
    if (fallbackBullets.length > 0) {
      return fallbackBullets;
    }
  }

  const keywordScores = buildKeywordScores(sourceText);
  const candidates = splitIntoSentences(sourceText)
    .map((sentence) => ({
      sentence,
      score: scoreSentence(sentence, keywordScores),
    }))
    .sort((left, right) => right.score - left.score);

  const bullets: string[] = [];
  for (const candidate of candidates) {
    const compactSentence = candidate.sentence.replace(/[.!?]$/, "");
    if (
      compactSentence.length < 35 ||
      bullets.some((existing) => sentenceOverlap(existing, compactSentence) > 0.7)
    ) {
      continue;
    }

    bullets.push(compactSentence);
    if (bullets.length === 4) break;
  }

  if (bullets.length > 0) {
    return bullets;
  }

  const fallbackBullets = pickDescriptionBullets(rawDescription || sourceText).slice(0, 4);
  return fallbackBullets.length > 0 ? fallbackBullets : [input.title.trim()];
}

async function fetchTranscriptWithLibrary(videoId: string): Promise<string | null> {
  const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
  const transcript = transcriptItems.map((item) => item.text).join(" ");
  const cleaned = cleanText(transcript);
  return cleaned || null;
}

function extractJsonObject(source: string, marker: string): unknown | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const objectStart = source.indexOf("{", markerIndex + marker.length);
  if (objectStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = objectStart; index < source.length; index++) {
    const character = source[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "{") depth++;
    if (character === "}") depth--;

    if (depth === 0) {
      try {
        return JSON.parse(source.slice(objectStart, index + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

type WatchPageData = {
  description: string | null;
  captionTracks: any[];
};

async function fetchWatchPageData(videoId: string): Promise<WatchPageData> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`YouTube watch page returned ${response.status}`);
  }

  const html = await response.text();
  const playerResponse =
    extractJsonObject(html, "var ytInitialPlayerResponse = ") ??
    extractJsonObject(html, "ytInitialPlayerResponse = ");

  const description = cleanText(
    stripHtml((playerResponse as any)?.videoDetails?.shortDescription ?? ""),
  );
  const captionTracks =
    (playerResponse as any)?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return {
    description: description || null,
    captionTracks: Array.isArray(captionTracks) ? captionTracks : [],
  };
}

async function fetchTranscriptFromWatchPage(videoId: string): Promise<string | null> {
  const watchPageData = await fetchWatchPageData(videoId);
  const captionTracks = watchPageData.captionTracks;
  if (captionTracks.length === 0) {
    return null;
  }

  const preferredTrack =
    captionTracks.find((track: any) => track?.languageCode?.startsWith("en") && track?.kind !== "asr") ??
    captionTracks.find((track: any) => track?.languageCode?.startsWith("en")) ??
    captionTracks[0];

  if (!preferredTrack?.baseUrl) {
    return null;
  }

  const transcriptUrl = new URL(preferredTrack.baseUrl);
  transcriptUrl.searchParams.set("fmt", "json3");

  const transcriptResponse = await fetch(transcriptUrl.toString(), {
    headers: REQUEST_HEADERS,
  });

  if (!transcriptResponse.ok) {
    throw new Error(`Caption track returned ${transcriptResponse.status}`);
  }

  const transcriptJson = await transcriptResponse.json();
  const events = Array.isArray(transcriptJson?.events) ? transcriptJson.events : [];
  const transcript = events
    .flatMap((event: any) => (Array.isArray(event?.segs) ? event.segs : []))
    .map((segment: any) => segment?.utf8 ?? "")
    .join(" ");

  return cleanText(transcript) || null;
}

export async function fetchVideoSupportText(videoId: string): Promise<{
  descriptionText: string | null;
}> {
  try {
    const watchPageData = await fetchWatchPageData(videoId);
    return {
      descriptionText: watchPageData.description,
    };
  } catch {
    return {
      descriptionText: null,
    };
  }
}

export async function fetchBestTranscript(videoId: string): Promise<{
  transcriptText: string | null;
  transcriptSource: string;
}> {
  const strategies = [fetchTranscriptWithLibrary, fetchTranscriptFromWatchPage];

  for (const strategy of strategies) {
    try {
      const transcriptText = await strategy(videoId);
      if (transcriptText) {
        return {
          transcriptText,
          transcriptSource: "YouTube transcript",
        };
      }
    } catch {
      continue;
    }
  }

  return {
    transcriptText: null,
    transcriptSource: "Transcript unavailable",
  };
}
