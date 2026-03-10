import { formatDistanceToNow } from "date-fns";
import { PlayCircle, FileText, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VideoWithChannel } from "@shared/schema";

interface VideoCardProps {
  video: VideoWithChannel;
  onOpenDrawer: (video: VideoWithChannel) => void;
  index: number;
}

export function VideoCard({ video, onOpenDrawer, index }: VideoCardProps) {
  // Take max 3 bullets for the card preview
  const previewBullets = video.summaryBullets?.slice(0, 3) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5), ease: "easeOut" }}
      className="group flex flex-col md:flex-row gap-5 p-5 rounded-2xl bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden"
    >
      {/* Background subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 transition-colors duration-500 pointer-events-none" />

      {/* Thumbnail */}
      <div className="w-full md:w-64 lg:w-72 shrink-0 relative aspect-video rounded-xl overflow-hidden bg-secondary border border-white/10 group-hover:border-white/20 transition-colors">
        {video.thumbnailUrl ? (
          <img 
            src={video.thumbnailUrl} 
            alt={video.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <PlayCircle className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-xs font-mono font-medium text-white/90">
           {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${(video.durationSeconds % 60).toString().padStart(2, '0')}` : '--:--'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
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
            <h3 className="text-lg font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
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
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="rounded-full h-8 text-xs font-medium bg-white text-black hover:bg-white/90 transition-colors shadow-none"
              onClick={() => onOpenDrawer(video)}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              View Details
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
    </motion.div>
  );
}
