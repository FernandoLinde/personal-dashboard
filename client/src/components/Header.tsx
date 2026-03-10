import { Search, RefreshCw, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRunIngestion } from "@/hooks/use-ingestion";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}

export function Header({ searchQuery, setSearchQuery }: HeaderProps) {
  const { mutate: runIngestion, isPending } = useRunIngestion();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo/Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-gradient hidden sm:block">
            Monitor
          </h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles, transcripts, or channels..." 
            className="w-full bg-black/20 border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 pl-9 rounded-full h-10 text-sm placeholder:text-muted-foreground/50 transition-all hover:bg-black/30"
          />
        </div>

        {/* Actions */}
        <div className="shrink-0">
          <Button 
            onClick={() => runIngestion()} 
            disabled={isPending}
            variant="outline"
            size="sm"
            className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all h-9 px-4"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin opacity-50' : ''}`} />
            {isPending ? 'Ingesting...' : 'Refresh Feed'}
          </Button>
        </div>
        
      </div>
    </header>
  );
}
