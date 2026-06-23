import { useState } from "react";
import { Copy, Download, FileText, Instagram, Loader2, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

interface TripData {
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  ai_summary: string | null;
  shareable_story: string | null;
  ai_overview?: string | null;
  ai_itinerary?: any[] | null;
  ai_must_try?: any[] | null;
}

interface TripExportDialogProps {
  trip: TripData;
  trigger?: React.ReactNode;
}

export function TripExportDialog({ trip, trigger }: TripExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (!trip.start_date) return "";
    const start = format(new Date(trip.start_date), "MMMM d");
    const end = trip.end_date ? format(new Date(trip.end_date), "MMMM d, yyyy") : "";
    return end ? `${start} - ${end}` : start;
  };

  const generateBlogPost = () => {
    const dateRange = formatDateRange();
    const destination = trip.destination || "an incredible destination";
    
    let content = `# ${trip.name}\n\n`;
    content += `*${dateRange}*\n\n`;
    content += `---\n\n`;
    
    if (trip.ai_overview || trip.ai_summary) {
      content += `## About This Journey\n\n`;
      content += `${trip.ai_overview || trip.ai_summary}\n\n`;
    }
    
    if (trip.shareable_story) {
      content += `## My Story\n\n`;
      content += `${trip.shareable_story}\n\n`;
    }
    
    if (trip.ai_itinerary && Array.isArray(trip.ai_itinerary) && trip.ai_itinerary.length > 0) {
      content += `## Daily Highlights\n\n`;
      trip.ai_itinerary.forEach((day: any, index: number) => {
        content += `### Day ${index + 1}${day.title ? `: ${day.title}` : ""}\n\n`;
        if (day.activities) {
          day.activities.forEach((activity: string) => {
            content += `- ${activity}\n`;
          });
        }
        content += `\n`;
      });
    }
    
    if (trip.ai_must_try && Array.isArray(trip.ai_must_try) && trip.ai_must_try.length > 0) {
      content += `## Must-Try Experiences\n\n`;
      trip.ai_must_try.forEach((item: any) => {
        if (typeof item === 'string') {
          content += `- ${item}\n`;
        } else if (item.name) {
          content += `- **${item.name}**${item.description ? `: ${item.description}` : ""}\n`;
        }
      });
      content += `\n`;
    }
    
    content += `---\n\n`;
    content += `*Created with TravelLens - Your AI Travel Companion*\n`;
    
    return content;
  };

  const generateInstagramCaption = () => {
    const destination = trip.destination || "somewhere amazing";
    const emojis = ["✈️", "🌍", "🗺️", "📸", "🌅", "🏝️", "🌆", "🎒"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    let caption = `${randomEmoji} ${trip.name}\n\n`;
    
    if (trip.shareable_story) {
      // Truncate story for Instagram (2200 char limit)
      const story = trip.shareable_story.length > 1500 
        ? trip.shareable_story.substring(0, 1500) + "..." 
        : trip.shareable_story;
      caption += `${story}\n\n`;
    } else if (trip.ai_summary) {
      caption += `${trip.ai_summary}\n\n`;
    } else {
      caption += `Exploring ${destination} and making unforgettable memories! 🌟\n\n`;
    }
    
    // Add hashtags
    const hashtags = [
      "#travel",
      "#wanderlust",
      "#explore",
      "#adventure",
      "#travelgram",
      "#travelphotography",
      `#${destination.toLowerCase().replace(/[^a-z]/g, "")}`,
      "#vacation",
      "#holiday",
      "#travelblogger",
    ].slice(0, 8).join(" ");
    
    caption += hashtags;
    
    return caption;
  };

  const generateTwitterThread = () => {
    const destination = trip.destination || "an amazing place";
    const tweets: string[] = [];
    
    // Tweet 1: Hook
    tweets.push(`🧵 Just got back from ${trip.name} and WOW. Here's everything you need to know about ${destination}:`);
    
    // Tweet 2: Overview
    if (trip.ai_summary || trip.ai_overview) {
      const summary = (trip.ai_summary || trip.ai_overview || "").substring(0, 250);
      tweets.push(`📍 ${summary}...`);
    }
    
    // Tweet 3-5: Must try items
    if (trip.ai_must_try && Array.isArray(trip.ai_must_try)) {
      const items = trip.ai_must_try.slice(0, 3);
      items.forEach((item: any, i: number) => {
        const name = typeof item === 'string' ? item : item.name;
        const desc = typeof item === 'string' ? '' : item.description;
        tweets.push(`${i + 1}. ${name}${desc ? `: ${desc.substring(0, 200)}` : ""}`);
      });
    }
    
    // Final tweet
    tweets.push(`Would I go back? Absolutely! 💯\n\nDrop a ❤️ if you want more travel content!`);
    
    return tweets.map((t, i) => `${i + 1}/${tweets.length}\n${t}`).join("\n\n---\n\n");
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard!`);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("File downloaded!");
  };

  const blogContent = generateBlogPost();
  const instagramContent = generateInstagramCaption();
  const twitterContent = generateTwitterThread();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export Trip
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="blog" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="blog" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Blog
            </TabsTrigger>
            <TabsTrigger value="instagram" className="text-xs">
              <Instagram className="h-3 w-3 mr-1" />
              Instagram
            </TabsTrigger>
            <TabsTrigger value="twitter" className="text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Twitter/X
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blog" className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 max-h-60 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">{blogContent}</pre>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => copyToClipboard(blogContent, "Blog post")}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => downloadAsFile(blogContent, `${trip.name.replace(/\s+/g, "-")}-blog.md`)}
              >
                <Download className="h-4 w-4 mr-1" />
                Download .md
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="instagram" className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 max-h-60 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">{instagramContent}</pre>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(instagramContent, "Instagram caption")}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Caption
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Perfect for your Instagram feed or Reels caption!
            </p>
          </TabsContent>

          <TabsContent value="twitter" className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 max-h-60 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">{twitterContent}</pre>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(twitterContent, "Twitter thread")}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Thread
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Ready-to-post Twitter/X thread format!
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
