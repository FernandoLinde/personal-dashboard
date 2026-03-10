import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { PlayCircle, FileText, Sparkles, ChevronDown, Download, Bot, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, buildUrl } from "@shared/routes";
import type { VideoWithChannel } from "@shared/schema";

interface VideoCardProps {
  video: VideoWithChannel;
  index: number;
}

export function VideoCard({ video, index }: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const downloadUrl = buildUrl(api.videos.downloadTranscript.path, { id: video.id });

  const getSourceIcon = (source: string | null) => {
    if (source?.includes("Generated")) return <Bot className="w-3 h-3 mr-1" />;
    if (source?.includes("unavailable")) return <AlertCircle className="w-3 h-3 mr-1" />;
    return <FileText className="w-3 h-3 mr-1" />;
  };

  const hasTranscript = video.transcriptText && video.transcriptText.trim();
  const allBullets = video.summaryBullets?.slice(0, 5) || [];
  const previewBullets = allBullets.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5), ease: "easeOut" }}
      className="flex flex-col rounded-2xl bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden"
    >
      {/* Background subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 hover:from-primary/5 transition-colors duration-500 pointer-events-none" />

      {/* Thumbnail & Header */}
      <div className="flex flex-col md:flex-row gap-5 p-5 relative z-10">
        {/* Thumbnail */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 relative aspect-video rounded-xl overflow-hidden bg-secondary border border-white/10 hover:border-white/20 transition-colors">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title} 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <PlayCircle className="w-12 h-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 hover:bg-transparent transition-colors duration-300" />
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-xs font-mono font-medium text-white/90">
             {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${(video.durationSeconds % 60).toString().padStart(2, '0')}` : '--:--'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-xs font-medium border-0">
                  {video.category}
                </Badge>
                <span className="text-xs text-muted-foreground/80 font-medium">
                  {video.channel.name}
                </span>
                <span className="text-xs text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground/80">
                  {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground leading-snug hover:text-primary transition-colors">
                {video.title}
              </h3>
            </div>
          </div>

          {/* AI Summary Preview */}
          {previewBullets.length > 0 ? (
            <div className="mt-3 mb-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary/70 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Key Insights
              </div>
              <ul className="space-y-1.5">
                {previewBullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-muted-foreground line-clamp-1 flex items-start gap-2">
                    <span className="text-primary/40 mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 mb-4 flex-1">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {video.description || "No description available."}
              </p>
            </div>
          )}

          <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="default" 
                size="sm" 
                className="rounded-full h-8 text-xs font-medium bg-white text-black hover:bg-white/90 transition-colors shadow-none"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <ChevronDown className={`w-3.5 h-3.5 mr-1.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="rounded-full h-8 text-xs text-muted-foreground hover:text-foreground border-white/10 hover:bg-white/5"
              >
                <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                  Watch
                </a>
              </Button>
            </div>

            <div className="hidden sm:flex items-center">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                {video.status === 'processed' ? 'Ingested' : video.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-white/5 p-5 space-y-6"
        >
          {/* Full AI Summary */}
          {allBullets.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Summary
              </h4>
              <ul className="space-y-3">
                {allBullets.map((bullet, i) => (
                  <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                    <span className="text-primary/50 select-none mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" /> Full Transcript
              </h4>
              {hasTranscript && (
                <Button 
                  asChild
                  variant="outline" 
                  size="sm" 
                  className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-xs h-8"
                >
                  <a href={downloadUrl} download={`${video.youtubeVideoId}-transcript.txt`}>
                    <Download className="w-3 h-3 mr-2" />
                    Download
                  </a>
                </Button>
              )}
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 sm:p-6 text-sm text-muted-foreground/80 leading-relaxed font-sans whitespace-pre-wrap max-h-96 overflow-y-auto">
              {hasTranscript ? (
                video.transcriptText
              ) : (
                <span className="italic opacity-50">No transcript available for this video.</span>
              )}
            </div>
            {hasTranscript && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {getSourceIcon(video.transcriptSource)}
                {video.transcriptSource || "Unknown Source"}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
