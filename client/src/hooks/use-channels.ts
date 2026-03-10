import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useChannels() {
  return useQuery({
    queryKey: [api.channels.list.path],
    queryFn: async () => {
      const res = await fetch(api.channels.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch channels");
      
      const data = await res.json();
      return api.channels.list.responses[200].parse(data);
    },
  });
}
