import type { Express, Request, Response } from "express";
import { z } from "zod";
import { api } from "../shared/routes.js";
import { initializeDatabase } from "./db.js";
import { runIngestion, seedChannels } from "./ingestion.js";
import { storage } from "./storage.js";

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

function isAuthorizedCronRequest(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return true;
  }

  return getBearerToken(req) === expectedSecret;
}

export function registerRoutes(app: Express) {
  initializeDatabase()
    .then(() => seedChannels())
    .catch(console.error);

  app.get(api.videos.list.path, async (req: Request, res: Response) => {
    try {
      const input = api.videos.list.input?.parse(req.query) || {};
      const videos = await storage.getVideos(input);
      res.json(videos);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      console.error("Error fetching videos:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.videos.get.path, async (req: Request, res: Response) => {
    try {
      const video = await storage.getVideo(Number(req.params.id));
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      res.json(video);
    } catch (err) {
      console.error("Error fetching video:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.videos.downloadTranscript.path, async (req: Request, res: Response) => {
    try {
      const video = await storage.getVideo(Number(req.params.id));
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (!video.transcriptText || !video.transcriptText.trim()) {
        return res.status(404).json({ message: "Transcript not available for this video" });
      }

      const filename = `transcript_${video.youtubeVideoId}.txt`;
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const content = `Title: ${video.title}\nChannel: ${video.channel.name}\nSource: ${video.transcriptSource}\n\nTranscript:\n${video.transcriptText}`;
      res.send(content);
    } catch (err) {
      console.error("Error downloading transcript:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.channels.list.path, async (_req: Request, res: Response) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (err) {
      console.error("Error fetching channels:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.channels.create.path, async (req: Request, res: Response) => {
    try {
      const input = api.channels.create.input?.parse(req.body);
      if (!input) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const channel = await storage.createChannel(input);
      res.json(channel);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      console.error("Error creating channel:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.channels.delete.path, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteChannel(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Channel not found" });
      }

      res.json({ message: "Channel deleted successfully" });
    } catch (err) {
      console.error("Error deleting channel:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.categories.list.path, async (_req: Request, res: Response) => {
    try {
      const allChannels = await storage.getChannels();
      const categories = [...new Set(allChannels.map((channel) => channel.category))];
      res.json(categories.sort());
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.ingestion.run.path, async (_req: Request, res: Response) => {
    try {
      if (process.env.VERCEL) {
        await runIngestion();
        return res.json({ message: "Ingestion completed" });
      }

      runIngestion().catch(console.error);
      res.json({ message: "Ingestion started in the background" });
    } catch (err) {
      console.error("Error starting ingestion:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/cron/ingestion", async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      await runIngestion();
      res.json({ message: "Scheduled ingestion completed" });
    } catch (err) {
      console.error("Error running scheduled ingestion:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
