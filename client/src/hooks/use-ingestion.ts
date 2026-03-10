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
      
      if (!res.ok) {
        throw new Error("Failed to run ingestion");
      }
      
      const data = await res.json();
      return api.ingestion.run.responses[200].parse(data);
    },
    onSuccess: (data) => {
      toast({
        title: "Ingestion Started",
        description: data.message || "Background task is running to fetch new videos.",
      });
      // Invalidate videos to show any new ones
      queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
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
