import { initializeDatabase } from "../../server/db.js";
import { runIngestion, seedChannels } from "../../server/ingestion.js";

export default async function handler(_req: any, res: any) {
  try {
    await initializeDatabase();
    await seedChannels();
    await runIngestion();

    return res.status(200).json({ message: "Ingestion completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    console.error("Dedicated ingestion route failed:", error);

    return res.status(500).json({ message });
  }
}
