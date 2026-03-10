import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

interface UseVideosParams {
  search?: string;
  category?: string;
  channelId?: number;
  limit?: number;
}

export function useVideos(params?: UseVideosParams) {
  return useQuery({
    queryKey: [api.videos.list.path, params],
    queryFn: async () => {
      // Build query string
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append("search", params.search);
      if (params?.category && params.category !== "all") searchParams.append("category", params.category);
      if (params?.channelId) searchParams.append("channelId", params.channelId.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      
      const queryString = searchParams.toString();
      const url = `${api.videos.list.path}${queryString ? `?${queryString}` : ""}`;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch videos");
      
      const data = await res.json();
      return api.videos.list.responses[200].parse(data);
    },
  });
}

export function useVideo(id: number) {
  return useQuery({
    queryKey: [api.videos.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.videos.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch video");
      
      const data = await res.json();
      return api.videos.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}
