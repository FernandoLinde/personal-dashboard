import { z } from 'zod';
import { insertChannelSchema, insertVideoSchema, channels, videos, type VideoWithChannel } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  videos: {
    list: {
      method: 'GET' as const,
      path: '/api/videos' as const,
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        channelId: z.coerce.number().optional(),
        limit: z.coerce.number().optional().default(50),
      }).optional(),
      responses: {
        200: z.array(z.custom<VideoWithChannel>()),
        500: errorSchemas.internal,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/videos/:id' as const,
      responses: {
        200: z.custom<VideoWithChannel>(),
        404: errorSchemas.notFound,
      },
    },
    downloadTranscript: {
      method: 'GET' as const,
      path: '/api/videos/:id/transcript/download' as const,
      responses: {
        // Returns a text file
        200: z.any(),
        404: errorSchemas.notFound,
      }
    }
  },
  channels: {
    list: {
      method: 'GET' as const,
      path: '/api/channels' as const,
      responses: {
        200: z.array(z.custom<typeof channels.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/channels' as const,
      input: insertChannelSchema,
      responses: {
        200: z.custom<typeof channels.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/channels/:id' as const,
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories' as const,
      responses: {
        200: z.array(z.string()),
      },
    },
  },
  ingestion: {
    run: {
      method: 'POST' as const,
      path: '/api/ingestion/run' as const,
      responses: {
        200: z.object({ message: z.string() }),
        500: errorSchemas.internal,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type VideoQueryParams = z.infer<typeof api.videos.list.input>;
