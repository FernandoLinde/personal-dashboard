import { format } from "date-fns";
import { ExternalLink, Download, FileText, Bot, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, buildUrl } from "@shared/routes";
import type { VideoWithChannel } from "@shared/schema";

interface VideoDrawerProps {
  video: VideoWithChannel | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoDrawer({ video, isOpen, onClose }: VideoDrawerProps) {
  if (!video) return null;

  const downloadUrl = buildUrl(api.videos.downloadTranscript.path, { id: video.id });

  const getSourceIcon = (source: string | null) => {
    if (source?.includes("Generated")) return <Bot className="w-3 h-3 mr-1" />;
    if (source?.includes("unavailable")) return <AlertCircle className="w-3 h-3 mr-1" />;
    return <FileText className="w-3 h-3 mr-1" />;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl bg-card border-l border-white/5 p-0 flex flex-col">
        {/* Header Image Area */}
        <div className="relative w-full h-48 sm:h-64 bg-muted overflow-hidden shrink-0">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title} 
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <FileText className="w-12 h-12 text-muted-foreground opacity-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <Badge variant="secondary" className="bg-black/50 backdrop-blur-md border-white/10">
              {video.category}
            </Badge>
            <div className="text-xs font-mono text-muted-foreground bg-black/50 px-2 py-1 rounded backdrop-blur-md">
              {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${(video.durationSeconds % 60).toString().padStart(2, '0')}` : '--:--'}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 pb-2 shrink-0 flex flex-col gap-4 border-b border-white/5">
          <SheetHeader>
            <SheetTitle className="text-xl sm:text-2xl font-semibold leading-tight">
              {video.title}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 text-muted-foreground mt-2">
              <span className="font-medium text-foreground/80">{video.channel.name}</span>
              <span>•</span>
              <span>{format(new Date(video.publishedAt), "MMM d, yyyy")}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm" className="rounded-full">
              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer">
                Watch on YouTube
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            
            <Button asChild variant="outline" size="sm" className="rounded-full bg-white/5 border-white/10 hover:bg-white/10">
              <a href={downloadUrl} download={`${video.youtubeVideoId}-transcript.txt`}>
                <Download className="w-4 h-4 mr-2" />
                Download Transcript
              </a>
            </Button>

            <Badge variant="outline" className="rounded-full border-white/10 text-muted-foreground font-normal">
              {getSourceIcon(video.transcriptSource)}
              {video.transcriptSource || "Unknown Source"}
            </Badge>
          </div>
        </div>

        {/* Scrollable Transcript & Summary */}
        <ScrollArea className="flex-1 p-6 pt-4">
          <div className="space-y-8 pb-12">
            {video.summaryBullets && video.summaryBullets.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4" /> AI Summary
                </h3>
                <ul className="space-y-3">
                  {video.summaryBullets.map((bullet, i) => (
                    <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                      <span className="text-primary/50 select-none mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" /> Full Transcript
              </h3>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 sm:p-6 text-sm text-muted-foreground/80 leading-relaxed font-sans whitespace-pre-wrap">
                {video.transcriptText ? (
                  video.transcriptText
                ) : (
                  <span className="italic opacity-50">No transcript available for this video.</span>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
