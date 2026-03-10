let cachedApp: ((req: any, res: any) => void | Promise<void>) | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      const { createApp } = await import("../server/app");
      cachedApp = createApp();
    }

    return cachedApp(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error("Vercel function startup failed:", error);

    return res.status(500).json({
      message,
      hint: "This usually means the database is not connected yet.",
    });
  }
}
