import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { createApp } from "./server/app.js";

const app = createApp();
const publicIndexPath = path.resolve(process.cwd(), "public", "index.html");

app.get("/{*path}", (req: Request, res: Response) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "Not found" });
  }

  if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  }

  return res.status(404).send("Client build not found");
});

export default app;
