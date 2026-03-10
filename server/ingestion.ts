import Parser from "rss-parser";
import YouTubeSR from "youtube-sr";
import type { InsertChannel, Video } from "../shared/schema.js";
import { storage } from "./storage.js";
import {
  buildSummaryBullets,
  fetchBestTranscript,
  fetchVideoSupportText,
} from "./video-processing.js";

const parser = new Parser();

const SEED_CHANNELS: InsertChannel[] = [
  { name: "Jordi Visser", youtubeUrl: "https://www.youtube.com/@JordiVisserLabs", youtubeIdentifier: "@JordiVisserLabs", category: "Tech", isActive: true },
  { name: "Moonshots", youtubeUrl: "https://www.youtube.com/@peterdiamandis", youtubeIdentifier: "@peterdiamandis", category: "Tech", isActive: true },
  { name: "Acquired", youtubeUrl: "https://www.youtube.com/@AcquiredFM", youtubeIdentifier: "@AcquiredFM", category: "Tech", isActive: true },
  { name: "Y Combinator", youtubeUrl: "https://www.youtube.com/@ycombinator", youtubeIdentifier: "@ycombinator", category: "Tech", isActive: true },
  { name: "BitBiasedAI", youtubeUrl: "https://www.youtube.com/@BitBiasedAI", youtubeIdentifier: "@BitBiasedAI", category: "Tech", isActive: true },
  { name: "IBM Technology", youtubeUrl: "https://www.youtube.com/@IBMTechnology", youtubeIdentifier: "@IBMTechnology", category: "Tech", isActive: true },
  { name: "Invest Like the Best", youtubeUrl: "https://www.youtube.com/@ILTB_Podcast", youtubeIdentifier: "@ILTB_Podcast", category: "Tech", isActive: true },
  { name: "Stratechery", youtubeUrl: "https://www.youtube.com/@Stratechery", youtubeIdentifier: "@Stratechery", category: "Tech", isActive: true },
  { name: "Giant Ideas", youtubeUrl: "https://www.youtube.com/@GiantVentures", youtubeIdentifier: "@GiantVentures", category: "Tech", isActive: true },
  { name: "Pioneers of AI", youtubeUrl: "https://www.youtube.com/@PioneersofAI", youtubeIdentifier: "@PioneersofAI", category: "Tech", isActive: true },
  { name: "AI Upload", youtubeUrl: "https://www.youtube.com/@AIUpload", youtubeIdentifier: "@AIUpload", category: "Tech", isActive: true },
  { name: "No Priors: AI, Machine Learning, Tech, & Startups", youtubeUrl: "https://www.youtube.com/@NoPriorsPodcast", youtubeIdentifier: "@NoPriorsPodcast", category: "Tech", isActive: true },
  { name: "Marina Wyss - AI & Machine Learning", youtubeUrl: "https://www.youtube.com/@MarinaWyssAI", youtubeIdentifier: "@MarinaWyssAI", category: "Tech", isActive: true },
  { name: "Everyday AI", youtubeUrl: "https://www.youtube.com/@EverydayAI_", youtubeIdentifier: "@EverydayAI_", category: "Tech", isActive: true },
  { name: "Bob Elliott", youtubeUrl: "https://www.youtube.com/@BobEUnlimited", youtubeIdentifier: "@BobEUnlimited", category: "Macro", isActive: true },
  { name: "MacroVoices", youtubeUrl: "https://www.youtube.com/@macrovoices7508", youtubeIdentifier: "@macrovoices7508", category: "Macro", isActive: true },
  { name: "StockPickers", youtubeUrl: "https://www.youtube.com/@StockPickers", youtubeIdentifier: "@StockPickers", category: "General", isActive: true },
  { name: "MarketMakers", youtubeUrl: "https://www.youtube.com/@mmakers", youtubeIdentifier: "@mmakers", category: "General", isActive: true },
  { name: "Bloomberg Originals", youtubeUrl: "https://www.youtube.com/@business", youtubeIdentifier: "@business", category: "General", isActive: true },
  { name: "WHG", youtubeUrl: "https://www.youtube.com/@wealthhighgovernance", youtubeIdentifier: "@wealthhighgovernance", category: "General", isActive: true },
  { name: "Masters of Scale", youtubeUrl: "https://www.youtube.com/@MastersofScale_", youtubeIdentifier: "@MastersofScale_", category: "General", isActive: true },
  { name: "All-In Podcast", youtubeUrl: "https://www.youtube.com/@allin", youtubeIdentifier: "@allin", category: "General", isActive: true },
];

type IngestionOptions = {
  mode?: "full" | "repair";
  deadlineMs?: number;
  repairLimit?: number;
  channelLimit?: number;
  maxRecentVideosPerChannel?: number;
};

function hasTranscript(video: Pick<Video, "transcriptText">): boolean {
  return !!video.transcriptText?.trim();
}

function hasUsefulSummary(video: Pick<Video, "summaryBullets" | "title">): boolean {
  if (!Array.isArray(video.summaryBullets) || video.summaryBullets.length === 0) {
    return false;
  }

  if (video.summaryBullets.length === 1) {
    const onlyBullet = video.summaryBullets[0]?.trim().toLowerCase();
    const title = video.title.trim().toLowerCase();
    if (!onlyBullet || onlyBullet === title) {
      return false;
    }
  }

  return true;
}

function needsRepair(video: Pick<Video, "title" | "transcriptText" | "summaryBullets">): boolean {
  return !hasTranscript(video) || !hasUsefulSummary(video);
}

function normalizeDescription(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 5000);
}

function isShortFormVideo(input: {
  title: string;
  description: string;
  durationSeconds?: number | null;
}): boolean {
  const combinedText = `${input.title} ${input.description}`.toLowerCase();
  if (/#shorts?\b/.test(combinedText)) {
    return true;
  }

  return (
    typeof input.durationSeconds === "number" &&
    input.durationSeconds > 0 &&
    input.durationSeconds <= 180
  );
}

export async function seedChannels() {
  const existingChannels = await storage.getChannels();
  const existingIdentifiers = new Set(
    existingChannels.map((channel) => channel.youtubeIdentifier),
  );
  const missingChannels = SEED_CHANNELS.filter(
    (channel) => !existingIdentifiers.has(channel.youtubeIdentifier),
  );

  if (missingChannels.length > 0) {
    console.log(`Seeding ${missingChannels.length} missing channels...`);
    for (const channel of missingChannels) {
      await storage.createChannel(channel);
    }
    console.log("Missing channels seeded successfully.");
  }
}

async function processVideoContent(input: {
  videoId: string;
  title: string;
  description: string;
  existingTranscriptText?: string | null;
  existingTranscriptSource?: string | null;
  existingSummaryBullets?: string[] | null;
}) {
  const supportText = await fetchVideoSupportText(input.videoId);
  const bestDescription =
    (supportText.descriptionText && supportText.descriptionText.length > input.description.length
      ? supportText.descriptionText
      : input.description) || input.title;
  const durationSeconds = supportText.durationSeconds;

  if (
    isShortFormVideo({
      title: input.title,
      description: bestDescription,
      durationSeconds,
    })
  ) {
    return {
      description: bestDescription,
      transcriptText: null,
      transcriptSource: "Filtered short video",
      summaryBullets: [],
      durationSeconds,
      status: "filtered" as const,
    };
  }

  let transcriptText = input.existingTranscriptText?.trim() || null;
  let transcriptSource = input.existingTranscriptSource || "Transcript unavailable";

  if (!transcriptText) {
    const transcriptResult = await fetchBestTranscript(input.videoId);
    transcriptText = transcriptResult.transcriptText;
    transcriptSource = transcriptResult.transcriptSource;

    if (!transcriptText && bestDescription.trim().length > 80) {
      transcriptText = bestDescription;
      transcriptSource = "Video description";
    }
  }

  const summaryBullets =
    hasUsefulSummary({
      title: input.title,
      summaryBullets: input.existingSummaryBullets ?? null,
    })
      ? [...(input.existingSummaryBullets ?? [])]
      : buildSummaryBullets({
          title: input.title,
          description: bestDescription,
          transcriptText,
        });

  return {
    description: bestDescription,
    transcriptText,
    transcriptSource,
    summaryBullets,
    durationSeconds,
    status: "processed" as const,
  };
}

function buildDeadline(options?: IngestionOptions): number {
  return Date.now() + (options?.deadlineMs ?? 55_000);
}

function hasTimeRemaining(deadlineAt: number): boolean {
  return Date.now() < deadlineAt;
}

async function repairExistingVideos(addLog: (message: string) => void, deadlineAt: number, limit: number) {
  let repaired = 0;
  const candidates = await storage.getVideosForRepair(limit);

  for (const video of candidates) {
    if (!hasTimeRemaining(deadlineAt)) {
      addLog("Stopped repair pass early to stay within time limit.");
      break;
    }

    if (!needsRepair(video)) {
      continue;
    }

    try {
      const processed = await processVideoContent({
        videoId: video.youtubeVideoId,
        title: video.title,
        description: normalizeDescription(video.description ?? ""),
        existingTranscriptText: video.transcriptText,
        existingTranscriptSource: video.transcriptSource,
        existingSummaryBullets: video.summaryBullets ?? null,
      });

      await storage.updateVideo(video.id, {
        description: processed.description,
        transcriptText: processed.transcriptText,
        transcriptSource: processed.transcriptSource,
        summaryBullets: processed.summaryBullets,
        durationSeconds: processed.durationSeconds ?? null,
        status: processed.status,
      });

      repaired++;
      addLog(
        processed.status === "filtered"
          ? `Filtered short video: ${video.title}`
          : `Repaired transcript/summary for: ${video.title}`,
      );
    } catch (error) {
      addLog(`Repair failed for ${video.title}: ${(error as Error).message}`);
    }
  }

  return repaired;
}

export async function runIngestion(options?: IngestionOptions) {
  console.log("Starting ingestion run...");
  const run = await storage.createIngestionRun({ status: "running" });
  const deadlineAt = buildDeadline(options);
  const mode = options?.mode ?? "full";

  let videosFound = 0;
  let videosCreated = 0;
  let videosUpdated = 0;
  let errorsCount = 0;
  const logs: string[] = [];

  const addLog = (message: string) => {
    console.log(message);
    logs.push(`[${new Date().toISOString()}] ${message}`);
  };

  try {
    if (mode === "repair") {
      videosUpdated += await repairExistingVideos(
        addLog,
        deadlineAt,
        options?.repairLimit ?? 12,
      );
    }

    if (!hasTimeRemaining(deadlineAt)) {
      await storage.updateIngestionRun(run.id, {
        status: "completed",
        finishedAt: new Date(),
        videosFound,
        videosCreated,
        videosUpdated,
        errorsCount,
        logText: logs.join("\n"),
      });

      return {
        message: `Refresh completed with ${videosUpdated} videos repaired.`,
        videosFound,
        videosCreated,
        videosUpdated,
      };
    }

    const allChannels = await storage.getChannels();
    const activeChannels = allChannels.filter((channel) => channel.isActive);
    const selectedChannels =
      mode === "repair"
        ? activeChannels.slice(0, options?.channelLimit ?? 6)
        : activeChannels;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const channel of selectedChannels) {
      if (!hasTimeRemaining(deadlineAt)) {
        addLog("Stopped channel scan early to stay within time limit.");
        break;
      }

      addLog(`Checking channel: ${channel.name} (${channel.youtubeIdentifier})`);

      try {
        const channelResults = await YouTubeSR.YouTube.search(channel.youtubeIdentifier, {
          type: "channel",
          limit: 1,
        });

        if (!channelResults || channelResults.length === 0) {
          addLog(`Could not find channel ID for ${channel.youtubeIdentifier}`);
          errorsCount++;
          continue;
        }

        const youtubeChannelId = channelResults[0].id;
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`;
        const feed = await parser.parseURL(feedUrl);
        const items = Array.isArray(feed.items) ? feed.items : [];

        const recentItems = items
          .filter((item) => {
            const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
            return !!publishedAt && !Number.isNaN(publishedAt.getTime()) && publishedAt >= sevenDaysAgo;
          })
          .slice(0, options?.maxRecentVideosPerChannel ?? (mode === "repair" ? 2 : 5));

        addLog(`Found ${recentItems.length} recent videos for ${channel.name}`);

        for (const item of recentItems) {
          if (!hasTimeRemaining(deadlineAt)) {
            addLog("Stopped video processing early to stay within time limit.");
            break;
          }

          const videoId = item.id?.replace(/^yt:video:/, "") ?? "";
          if (!videoId) {
            addLog(`Skipping an item with no video id for ${channel.name}`);
            errorsCount++;
            continue;
          }

          videosFound++;

          const title = item.title || "Untitled video";
          const description = normalizeDescription(item.contentSnippet || item.content || "");
          const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
          const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const youtubeUrl = item.link || `https://www.youtube.com/watch?v=${videoId}`;
          const existing = await storage.getVideoByYoutubeId(videoId);

          if (existing) {
            if (!needsRepair(existing)) {
              continue;
            }

            const processed = await processVideoContent({
              videoId,
              title,
              description,
              existingTranscriptText: existing.transcriptText,
              existingTranscriptSource: existing.transcriptSource,
              existingSummaryBullets: existing.summaryBullets ?? null,
            });

            await storage.updateVideo(existing.id, {
              title,
              description: processed.description,
              thumbnailUrl,
              youtubeUrl,
              publishedAt,
              category: channel.category,
              transcriptText: processed.transcriptText,
              transcriptSource: processed.transcriptSource,
              summaryBullets: processed.summaryBullets,
              durationSeconds: processed.durationSeconds ?? null,
              status: processed.status,
            });

            videosUpdated++;
            addLog(
              processed.status === "filtered"
                ? `Filtered short video: ${title}`
                : `Updated missing transcript/summary for: ${title}`,
            );
            continue;
          }

          const processed = await processVideoContent({
            videoId,
            title,
            description,
          });

          await storage.createVideo({
            youtubeVideoId: videoId,
            channelId: channel.id,
            title,
            description: processed.description,
            thumbnailUrl,
            youtubeUrl,
            publishedAt,
            category: channel.category,
            transcriptText: processed.transcriptText,
            transcriptSource: processed.transcriptSource,
            summaryBullets: processed.summaryBullets,
            durationSeconds: processed.durationSeconds ?? null,
            status: processed.status,
          });

          videosCreated++;
          addLog(
            processed.status === "filtered"
              ? `Skipped short video from feed: ${title}`
              : `Added video: ${title}`,
          );
        }
      } catch (error) {
        addLog(`Error processing channel ${channel.name}: ${(error as Error).message}`);
        errorsCount++;
      }
    }

    await storage.updateIngestionRun(run.id, {
      status: "completed",
      finishedAt: new Date(),
      videosFound,
      videosCreated,
      videosUpdated,
      errorsCount,
      logText: logs.join("\n"),
    });

    console.log("Ingestion completed successfully.");
    return {
      message:
        mode === "repair"
          ? `Refresh completed with ${videosUpdated} videos repaired and ${videosCreated} new videos added.`
          : "Ingestion completed",
      videosFound,
      videosCreated,
      videosUpdated,
    };
  } catch (error) {
    addLog(`Global ingestion error: ${(error as Error).message}`);

    await storage.updateIngestionRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      videosFound,
      videosCreated,
      videosUpdated,
      errorsCount: errorsCount + 1,
      logText: logs.join("\n"),
    });

    throw error;
  }
}
