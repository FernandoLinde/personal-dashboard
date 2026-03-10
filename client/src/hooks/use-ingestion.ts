import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useRunIngestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.ingestion.run.path, {
        method: api.ingestion.run.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || "Failed to run ingestion");
      }

      return api.ingestion.run.responses[200].parse(data);
    },
    onSuccess: (data) => {
      const completed = /completed/i.test(data.message || "");
      toast({
        title: completed ? "Feed Updated" : "Ingestion Started",
        description: data.message || "Background task is running to fetch new videos.",
      });

      queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
      if (!completed) {
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
        }, 4000);
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
        }, 10000);
      }
    },
    onError: (error) => {
      toast({
        title: "Ingestion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
