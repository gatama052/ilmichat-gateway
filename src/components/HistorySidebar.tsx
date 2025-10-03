import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  mode: string;
};

interface HistorySidebarProps {
  mode: "chat" | "dakwah";
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export const HistorySidebar = ({
  mode,
  isOpen,
  onClose,
  onSelectConversation,
  onNewChat,
}: HistorySidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, mode]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("mode", mode)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error);
      toast.error("Gagal memuat riwayat");
      return;
    }

    setConversations(data || []);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Gagal menghapus percakapan");
      return;
    }

    toast.success("Percakapan berhasil dihapus");
    setConversations(conversations.filter((c) => c.id !== id));
    setLongPressId(null);
  };

  const handlePressStart = (id: string) => {
    const timer = setTimeout(() => {
      setLongPressId(id);
    }, 500); // 500ms untuk long press
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed lg:relative left-0 top-0 h-full w-80 bg-card border-r border-border z-50 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Riwayat {mode === "chat" ? "Chat" : "Dakwah"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-border">
          <Button 
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full"
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Obrolan Baru
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Belum ada riwayat percakapan
              </p>
            ) : (
              conversations.map((conv) => (
                <Card
                  key={conv.id}
                  className={`p-3 cursor-pointer hover:bg-accent transition-colors relative ${
                    longPressId === conv.id ? "bg-destructive/10" : ""
                  }`}
                  onClick={() => onSelectConversation(conv.id)}
                  onMouseDown={() => handlePressStart(conv.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handlePressStart(conv.id)}
                  onTouchEnd={handlePressEnd}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {longPressId === conv.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
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
      </div>
    </>
  );
};
