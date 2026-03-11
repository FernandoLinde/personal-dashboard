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

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

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

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTitleLikeBullet(bullet: string, title: string): boolean {
  const normalizedBullet = normalizeForComparison(bullet);
  const normalizedTitle = normalizeForComparison(title);
  return !!normalizedBullet && normalizedBullet === normalizedTitle;
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
    const fallbackBullets = pickDescriptionBullets(rawDescription).filter(
      (bullet) => !isTitleLikeBullet(bullet, input.title),
    );
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
      isTitleLikeBullet(compactSentence, input.title) ||
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

  const fallbackBullets = pickDescriptionBullets(rawDescription || sourceText)
    .filter((bullet) => !isTitleLikeBullet(bullet, input.title))
    .slice(0, 4);
  return fallbackBullets.length > 0 ? fallbackBullets : [input.title.trim()];
}

async function fetchTranscriptWithLibrary(videoId: string): Promise<string | null> {
  const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
  const transcript = transcriptItems.map((item) => item.text).join(" ");
  const cleaned = cleanText(transcript);
  return cleaned || null;
}

function extractStructuredSection(
  source: string,
  marker: string,
  openCharacter: string,
  closeCharacter: string,
): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const sectionStart = source.indexOf(openCharacter, markerIndex + marker.length);
  if (sectionStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = sectionStart; index < source.length; index++) {
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

    if (character === openCharacter) depth++;
    if (character === closeCharacter) depth--;

    if (depth === 0) {
      return source.slice(sectionStart, index + 1);
    }
  }

  return null;
}

type WatchPageData = {
  description: string | null;
  durationSeconds: number | null;
  innertubeApiKey: string | null;
};

function parseDurationSeconds(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function decodeEscapedJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

async function fetchWatchPageData(videoId: string): Promise<WatchPageData> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`YouTube watch page returned ${response.status}`);
  }

  const html = await response.text();
  const playerResponse =
    extractStructuredSection(html, "var ytInitialPlayerResponse = ", "{", "}") ??
    extractStructuredSection(html, "ytInitialPlayerResponse = ", "{", "}") ??
    html;

  const descriptionMatch = playerResponse.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  const durationMatch = playerResponse.match(/"lengthSeconds":"(\d+)"/);
  const apiKeyMatch =
    html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ??
    html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);

  const description = cleanText(
    stripHtml(decodeEscapedJsonString(descriptionMatch?.[1] ?? "")),
  );
  const durationSeconds = parseDurationSeconds(durationMatch?.[1] ?? null);

  return {
    description: description || null,
    durationSeconds,
    innertubeApiKey: apiKeyMatch?.[1] ?? null,
  };
}

async function fetchTranscriptFromInnertube(
  videoId: string,
  watchPageData?: WatchPageData,
): Promise<string | null> {
  const resolvedWatchPageData = watchPageData ?? (await fetchWatchPageData(videoId));
  const apiKey = resolvedWatchPageData.innertubeApiKey;
  if (!apiKey) {
    return null;
  }

  const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: {
      ...REQUEST_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
        },
      },
      videoId,
    }),
  });

  if (!playerResponse.ok) {
    throw new Error(`Innertube player returned ${playerResponse.status}`);
  }

  const playerJson = await playerResponse.json();
  const captionTracks =
    playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
    playerJson?.playerCaptionsTracklistRenderer?.captionTracks ??
    [];

  if (captionTracks.length === 0) {
    return null;
  }

  const preferredTrack =
    captionTracks.find((track: any) => track?.languageCode === "en" && track?.kind !== "asr") ??
    captionTracks.find((track: any) => track?.languageCode === "en") ??
    captionTracks[0];

  if (!preferredTrack?.baseUrl) {
    return null;
  }

  const transcriptUrl = new URL(preferredTrack.baseUrl);
  transcriptUrl.searchParams.delete("fmt");

  const transcriptResponse = await fetch(transcriptUrl.toString(), {
    headers: REQUEST_HEADERS,
  });

  if (!transcriptResponse.ok) {
    throw new Error(`Caption track returned ${transcriptResponse.status}`);
  }

  const transcriptBody = await transcriptResponse.text();
  const transcript = Array.from(
    transcriptBody.matchAll(RE_XML_TRANSCRIPT),
    (match) => decodeHtmlEntities(match[3]),
  ).join(" ");

  return cleanText(transcript) || null;
}

export async function fetchVideoSupportText(videoId: string): Promise<{
  descriptionText: string | null;
  durationSeconds: number | null;
  watchPageData: WatchPageData | null;
}> {
  try {
    const watchPageData = await fetchWatchPageData(videoId);
    return {
      descriptionText: watchPageData.description,
      durationSeconds: watchPageData.durationSeconds,
      watchPageData,
    };
  } catch {
    return {
      descriptionText: null,
      durationSeconds: null,
      watchPageData: null,
    };
  }
}

export async function fetchBestTranscript(videoId: string): Promise<{
  transcriptText: string | null;
  transcriptSource: string;
}> {
  return fetchBestTranscriptWithSupport(videoId);
}

export async function fetchBestTranscriptWithSupport(
  videoId: string,
  watchPageData?: WatchPageData | null,
): Promise<{
  transcriptText: string | null;
  transcriptSource: string;
}> {
  const resolvedWatchPageData =
    watchPageData === undefined ? await fetchWatchPageData(videoId).catch(() => null) : watchPageData;
  const strategies = [
    () => fetchTranscriptFromInnertube(videoId, resolvedWatchPageData ?? undefined),
    () => fetchTranscriptWithLibrary(videoId),
  ];

  for (const strategy of strategies) {
    try {
      const transcriptText = await strategy();
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
