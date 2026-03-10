import { storage } from "./storage";
import type { InsertChannel, Video } from "@shared/schema";
import YouTubeSR from "youtube-sr";
import Parser from "rss-parser";
import { buildSummaryBullets, fetchBestTranscript } from "./video-processing";

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

function hasTranscript(video: Pick<Video, "transcriptText">): boolean {
  return !!video.transcriptText?.trim();
}

function hasSummary(video: Pick<Video, "summaryBullets">): boolean {
  return Array.isArray(video.summaryBullets) && video.summaryBullets.length > 0;
}

function normalizeDescription(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 5000);
}

export async function seedChannels() {
  const existingChannels = await storage.getChannels();
  if (existingChannels.length === 0) {
    console.log("Seeding channels...");
    for (const channel of SEED_CHANNELS) {
      await storage.createChannel(channel);
    }
    console.log("Channels seeded successfully.");
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
  let transcriptText = input.existingTranscriptText?.trim() || null;
  let transcriptSource = input.existingTranscriptSource || "Transcript unavailable";

  if (!transcriptText) {
    const transcriptResult = await fetchBestTranscript(input.videoId);
    transcriptText = transcriptResult.transcriptText;
    transcriptSource = transcriptResult.transcriptSource;
  }

  const summaryBullets =
    Array.isArray(input.existingSummaryBullets) && input.existingSummaryBullets.length > 0
      ? input.existingSummaryBullets
      : buildSummaryBullets({
          title: input.title,
          description: input.description,
          transcriptText,
        });

  return {
    transcriptText,
    transcriptSource,
    summaryBullets,
    status: "processed" as const,
  };
}

export async function runIngestion() {
  console.log("Starting ingestion run...");
  const run = await storage.createIngestionRun({ status: "running" });

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
    const allChannels = await storage.getChannels();
    const activeChannels = allChannels.filter((channel) => channel.isActive);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const channel of activeChannels) {
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

        const recentItems = items.filter((item) => {
          const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
          return !!publishedAt && !Number.isNaN(publishedAt.getTime()) && publishedAt >= sevenDaysAgo;
        });

        addLog(`Found ${recentItems.length} videos in the last 7 days for ${channel.name}`);

        for (const item of recentItems) {
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
            const needsTranscript = !hasTranscript(existing);
            const needsSummary = !hasSummary(existing);

            if (!needsTranscript && !needsSummary) {
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
              description,
              thumbnailUrl,
              youtubeUrl,
              publishedAt,
              category: channel.category,
              transcriptText: processed.transcriptText,
              transcriptSource: processed.transcriptSource,
              summaryBullets: processed.summaryBullets,
              status: processed.status,
            });

            videosUpdated++;
            addLog(`Updated missing transcript/summary for: ${title}`);
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
            description,
            thumbnailUrl,
            youtubeUrl,
            publishedAt,
            category: channel.category,
            transcriptText: processed.transcriptText,
            transcriptSource: processed.transcriptSource,
            summaryBullets: processed.summaryBullets,
            durationSeconds: 0,
            status: processed.status,
          });

          videosCreated++;
          addLog(`Added video: ${title}`);
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
  }
}
