import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, FilterX, Loader2, Plus, X } from "lucide-react";
import { Header } from "@/components/Header";
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/hooks/use-videos";
import { useChannels } from "@/hooks/use-channels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertChannel } from "@shared/schema";
import { api } from "@shared/routes";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedChannelId, setSelectedChannelId] = useState<number | undefined>();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelYoutubeId, setNewChannelYoutubeId] = useState("");
  const [newChannelCategory, setNewChannelCategory] = useState("Tech");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: videos, isLoading: videosLoading, isError: videosError } = useVideos({
    search: searchQuery || undefined,
    category: selectedCategory,
    channelId: selectedChannelId,
    limit: 100
  });

  const { data: channels, refetch: refetchChannels } = useChannels();
  const { data: categories = [] } = useQuery({
    queryKey: [api.categories.list.path],
    queryFn: async () => {
      const res = await fetch(api.categories.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: InsertChannel) => {
      const res = await apiRequest("/api/channels", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      refetchChannels();
      queryClient.invalidateQueries({ queryKey: [api.categories.list.path] });
      setShowAddChannel(false);
      setNewChannelName("");
      setNewChannelYoutubeId("");
      setNewChannelCategory("Tech");
    }
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: number) => {
      const res = await apiRequest(`/api/channels/${channelId}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      refetchChannels();
      queryClient.invalidateQueries({ queryKey: [api.categories.list.path] });
    }
  });

  const handleAddChannel = async () => {
    if (!newChannelName.trim() || !newChannelYoutubeId.trim()) return;
    
    const youtubeId = newChannelYoutubeId.startsWith("@") ? newChannelYoutubeId : `@${newChannelYoutubeId}`;
    
    createChannelMutation.mutate({
      name: newChannelName,
      youtubeUrl: `https://www.youtube.com/${youtubeId}`,
      youtubeIdentifier: youtubeId,
      category: newChannelCategory,
      isActive: true,
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedChannelId(undefined);
  };

  const allCategories = ["all", ...categories.filter(cat => cat !== "all")];
  const categoryOptions = categories.length > 0 ? categories : ["Tech", "Macro", "General"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar Filters */}
        <aside className="w-full lg:w-64 shrink-0 space-y-8">
          {/* Category Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </h3>
            <div className="flex flex-col gap-1">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-sm text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Channel Filter */}
          {channels && channels.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Channels
                </h3>
                <button
                  onClick={() => setShowAddChannel(!showAddChannel)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                  title="Add channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showAddChannel && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2 mb-3">
                  <Input
                    placeholder="Channel name"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="h-8 text-xs bg-white/5 border-white/10"
                  />
                  <Input
                    placeholder="YouTube ID (@channelname)"
                    value={newChannelYoutubeId}
                    onChange={(e) => setNewChannelYoutubeId(e.target.value)}
                    className="h-8 text-xs bg-white/5 border-white/10"
                  />
                  <select
                    value={newChannelCategory}
                    onChange={(e) => setNewChannelCategory(e.target.value)}
                    className="w-full h-8 text-xs bg-white/5 border border-white/10 rounded px-2 text-foreground"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat} className="bg-card">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs rounded-full bg-white text-black hover:bg-white/90"
                      onClick={handleAddChannel}
                      disabled={createChannelMutation.isPending}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-8 text-xs rounded-full border-white/10 hover:bg-white/5"
                      onClick={() => setShowAddChannel(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <button
                  onClick={() => setSelectedChannelId(undefined)}
                  className={`text-sm text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedChannelId === undefined 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
                >
                  All Channels
                </button>
                {channels.map(channel => (
                  <div key={channel.id} className="flex items-center group">
                    <button
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`flex-1 text-sm text-left px-3 py-2 rounded-lg transition-colors truncate ${
                        selectedChannelId === channel.id 
                          ? 'bg-primary/10 text-primary font-medium' 
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      }`}
                    >
                      {channel.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Feed Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-foreground flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-muted-foreground" />
              Latest Feed
            </h2>
            
            {(searchQuery || selectedCategory !== 'all' || selectedChannelId) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground rounded-full"
              >
                <FilterX className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          {videosLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary/50" />
              <p>Loading intelligence feed...</p>
            </div>
          ) : videosError ? (
            <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive text-center">
              Failed to load videos. Please try refreshing.
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="flex flex-col gap-4 pb-20">
              {videos.map((video, index) => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center border border-white/5 rounded-3xl bg-card border-dashed">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FilterX className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No videos found</h3>
              <p className="text-muted-foreground max-w-sm">
                Try adjusting your filters or search query to find what you're looking for, or run a manual ingestion.
              </p>
              <Button 
                variant="outline" 
                className="mt-6 rounded-full border-white/10"
                onClick={handleClearFilters}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
