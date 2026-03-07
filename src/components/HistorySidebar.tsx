import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, Plus, LogOut, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  mode: string;
};

interface HistorySidebarProps {
  mode: "assistant" | "tools";
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
}

export const HistorySidebar = ({
  mode,
  isOpen,
  onClose,
  onSelectConversation,
  onNewChat,
  onLogout,
}: HistorySidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const { theme, setTheme } = useTheme();

  // Map new mode names to DB mode values
  const dbMode = mode === "assistant" ? "chat" : "dakwah";

  useEffect(() => {
    if (isOpen) loadConversations();
  }, [isOpen, mode]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("mode", dbMode)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Gagal memuat riwayat");
      return;
    }
    setConversations(data || []);
  };

  const handleDeleteConversation = async (id: string, e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus percakapan");
      return;
    }
    toast.success("Percakapan berhasil dihapus");
    setConversations(conversations.filter((c) => c.id !== id));
    setLongPressId(null);
  };

  const handleLongPressStart = (id: string) => {
    longPressTimer.current = setTimeout(() => setLongPressId(id), 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      <div className="fixed lg:relative left-0 top-0 h-full w-80 bg-card border-r border-border z-50 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            Riwayat {mode === "assistant" ? "Assistant" : "Tools"}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <Button onClick={() => { onNewChat(); onClose(); }} className="w-full" variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Obrolan Baru
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Belum ada riwayat percakapan</p>
            ) : (
              conversations.map((conv) => (
                <Card
                  key={conv.id}
                  className="w-full px-3.5 py-2.5 cursor-pointer hover:bg-accent hover:shadow-md transition-all duration-200 rounded-xl shadow-sm"
                  onClick={() => { if (longPressId !== conv.id) onSelectConversation(conv.id); }}
                  onMouseDown={() => handleLongPressStart(conv.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() => handleLongPressStart(conv.id)}
                  onTouchEnd={handleLongPressEnd}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium text-sm truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(conv.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {longPressId === conv.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 animate-in fade-in zoom-in duration-200"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Button onClick={onLogout} className="w-full" variant="ghost">
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      </div>
    </>
  );
};
