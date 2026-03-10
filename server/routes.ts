import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { runIngestion, seedChannels } from "./ingestion";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed channels if not exists
  seedChannels().catch(console.error);

  // Get videos
  app.get(api.videos.list.path, async (req: Request, res: Response) => {
    try {
      const input = api.videos.list.input?.parse(req.query) || {};
      const videos = await storage.getVideos(input);
      res.json(videos);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error fetching videos:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get video by ID
  app.get(api.videos.get.path, async (req: Request, res: Response) => {
    try {
      const video = await storage.getVideo(Number(req.params.id));
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      res.json(video);
    } catch (err) {
      console.error("Error fetching video:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download transcript
  app.get(api.videos.downloadTranscript.path, async (req: Request, res: Response) => {
    try {
      const video = await storage.getVideo(Number(req.params.id));
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      if (!video.transcriptText) {
        return res.status(404).json({ message: 'Transcript not available for this video' });
      }
      
      const filename = `transcript_${video.youtubeVideoId}.txt`;
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Formatting the text a bit nicely
      const content = `Title: ${video.title}\nChannel: ${video.channel.name}\nSource: ${video.transcriptSource}\n\nTranscript:\n${video.transcriptText}`;
      
      res.send(content);
    } catch (err) {
      console.error("Error downloading transcript:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get channels
  app.get(api.channels.list.path, async (req: Request, res: Response) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (err) {
      console.error("Error fetching channels:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trigger ingestion
  app.post(api.ingestion.run.path, async (req: Request, res: Response) => {
    try {
      // Kick off background job so we don't block the request for too long
      // Actually we could just await it or not wait. To provide immediate feedback, let's trigger and return.
      runIngestion().catch(console.error);
      res.json({ message: "Ingestion started in the background" });
    } catch (err) {
      console.error("Error starting ingestion:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
