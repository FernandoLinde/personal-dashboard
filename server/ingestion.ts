import { db } from "./db";
import { storage } from "./storage";
import { channels, videos, type InsertChannel } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "./replit_integrations/image/client"; // Reusing the OpenAI client initialized here
import { YoutubeTranscript } from "youtube-transcript"; // We will need to install this
import YouTubeSR from "youtube-sr";
import Parser from "rss-parser";

const parser = new Parser();

const SEED_CHANNELS: InsertChannel[] = [
  // Tech
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
  
  // Macro
  { name: "Bob Elliott", youtubeUrl: "https://www.youtube.com/@BobEUnlimited", youtubeIdentifier: "@BobEUnlimited", category: "Macro", isActive: true },
  { name: "MacroVoices", youtubeUrl: "https://www.youtube.com/@macrovoices7508", youtubeIdentifier: "@macrovoices7508", category: "Macro", isActive: true },
  
  // General
  { name: "StockPickers", youtubeUrl: "https://www.youtube.com/@StockPickers", youtubeIdentifier: "@StockPickers", category: "General", isActive: true },
  { name: "MarketMakers", youtubeUrl: "https://www.youtube.com/@mmakers", youtubeIdentifier: "@mmakers", category: "General", isActive: true },
  { name: "Bloomberg Originals", youtubeUrl: "https://www.youtube.com/@business", youtubeIdentifier: "@business", category: "General", isActive: true },
  { name: "WHG", youtubeUrl: "https://www.youtube.com/@wealthhighgovernance", youtubeIdentifier: "@wealthhighgovernance", category: "General", isActive: true },
  { name: "Masters of Scale", youtubeUrl: "https://www.youtube.com/@MastersofScale_", youtubeIdentifier: "@MastersofScale_", category: "General", isActive: true },
  { name: "All-In Podcast", youtubeUrl: "https://www.youtube.com/@allin", youtubeIdentifier: "@allin", category: "General", isActive: true },
];

export async function seedChannels() {
  const existingChannels = await storage.getChannels();
  if (existingChannels.length === 0) {
    console.log("Seeding channels...");
    for (const c of SEED_CHANNELS) {
      await storage.createChannel(c);
    }
    console.log("Channels seeded successfully.");
  }
}

export async function runIngestion() {
  console.log("Starting ingestion run...");
  const run = await storage.createIngestionRun({ status: "running" });
  
  let videosFound = 0;
  let videosCreated = 0;
  let errorsCount = 0;
  let logs: string[] = [];

  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const allChannels = await storage.getChannels();
    const activeChannels = allChannels.filter(c => c.isActive);
    
    // Only videos from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const channel of activeChannels) {
      addLog(`Checking channel: ${channel.name} (${channel.youtubeIdentifier})`);
      try {
        // Find channel ID first
        const channelRes = await YouTubeSR.YouTube.search(channel.youtubeIdentifier, { type: "channel", limit: 1 });
        if (!channelRes || channelRes.length === 0) {
          addLog(`Could not find channel ID for ${channel.youtubeIdentifier}`);
          errorsCount++;
          continue;
        }
        
        const channelId = channelRes[0].id;
        
        // Fetch recent videos via RSS feed
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const feed = await parser.parseURL(feedUrl);
        
        let recentVideos = feed.items || [];

        // We will just process up to 5 most recent to not overload in demo
        for (const v of recentVideos.slice(0, 5)) {
          const videoId = v.id.replace('yt:video:', '');
          
          const existing = await storage.getVideoByYoutubeId(videoId);
          if (existing) {
            continue;
          }

          videosFound++;
          
          let transcriptText = null;
          let transcriptSource = "Transcript unavailable";
          
          try {
            const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
            transcriptText = transcriptItems.map(t => t.text).join(' ');
            transcriptSource = "YouTube transcript";
          } catch (e) {
            addLog(`Could not fetch transcript for ${videoId}. Error: ${(e as Error).message}`);
          }

          let summaryBullets: string[] = [];
          
          // Use description from RSS or transcript
          const description = v.contentSnippet || v.content || "";
          const textToSummarize = transcriptText || description || "No text available.";
          
          if (textToSummarize.length > 50) {
            try {
              const summaryResponse = await openai.chat.completions.create({
                model: "gpt-5.1", // Standard text model via AI Integrations
                messages: [
                  { 
                    role: "system", 
                    content: "You are a helpful assistant that summarizes YouTube videos into 3-4 concise bullet points. Avoid fluff. Focus on main topics, arguments, or takeaways. Output a JSON array of strings." 
                  },
                  {
                    role: "user",
                    content: `Summarize the following video text:\n\n${textToSummarize.slice(0, 8000)}` // Slice to avoid context limit
                  }
                ],
                response_format: { type: "json_object" }
              });

              const content = summaryResponse.choices[0]?.message?.content;
              if (content) {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) summaryBullets = parsed;
                else if (parsed.bullets && Array.isArray(parsed.bullets)) summaryBullets = parsed.bullets;
                else if (parsed.summary && Array.isArray(parsed.summary)) summaryBullets = parsed.summary;
                else summaryBullets = Object.values(parsed).filter(val => typeof val === 'string') as string[];
              }
            } catch (e) {
              addLog(`Failed to generate summary for ${videoId}. Error: ${(e as Error).message}`);
              errorsCount++;
            }
          }

          const publishedAt = v.pubDate ? new Date(v.pubDate) : new Date();
          
          // Generate a thumbnail URL based on video ID
          const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          
          await storage.createVideo({
            youtubeVideoId: videoId,
            channelId: channel.id,
            title: v.title || "Unknown Title",
            description: description.slice(0, 500),
            thumbnailUrl,
            youtubeUrl: v.link || `https://www.youtube.com/watch?v=${videoId}`,
            publishedAt,
            category: channel.category,
            transcriptText,
            transcriptSource,
            summaryBullets,
            durationSeconds: 0, // Not available easily from RSS
            status: "processed"
          });
          
          videosCreated++;
          addLog(`Added video: ${v.title}`);
        }
      } catch (err) {
        addLog(`Error processing channel ${channel.name}: ${(err as Error).message}`);
        errorsCount++;
      }
    }

    await storage.updateIngestionRun(run.id, {
      status: "completed",
      finishedAt: new Date(),
      videosFound,
      videosCreated,
      errorsCount,
      logText: logs.join('\n')
    });
    console.log("Ingestion completed successfully.");

  } catch (globalErr) {
    addLog(`Global ingestion error: ${(globalErr as Error).message}`);
    await storage.updateIngestionRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      videosFound,
      videosCreated,
      errorsCount: errorsCount + 1,
      logText: logs.join('\n')
    });
  }
}
