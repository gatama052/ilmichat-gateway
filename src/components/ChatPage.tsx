import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Menu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HistorySidebar } from "./HistorySidebar";
import { Session } from "@supabase/supabase-js";

type Message = {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
};

type Mode = "chat" | "dakwah";

interface ChatPageProps {
  mode: Mode;
}

export const ChatPage = ({ mode }: ChatPageProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const createNewConversation = async (firstUserMessage: string) => {
    if (!session?.user) return null;

    // Generate a meaningful title from the first message
    const title = firstUserMessage.length > 60 
      ? firstUserMessage.substring(0, 60).trim() + "..." 
      : firstUserMessage;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: session.user.id,
        mode,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast.error("Gagal membuat percakapan");
      return null;
    }

    return data.id;
  };

  const saveMessage = async (text: string, isBot: boolean, isFirstMessage: boolean = false) => {
    if (!session?.user) return;

    let conversationId = currentConversationId;
    
    if (!conversationId && isFirstMessage) {
      conversationId = await createNewConversation(text);
      if (conversationId) {
        setCurrentConversationId(conversationId);
      } else {
        return;
      }
    }

    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        text,
        is_bot: isBot,
      });

    if (error) {
      console.error("Error saving message:", error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userText = inputValue;
    setInputValue("");
    setIsLoading(true);

    // Save user message (mark as first if no conversation exists)
    const isFirstMessage = currentConversationId === null;
    await saveMessage(userText, false, isFirstMessage);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ilmichat`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            userMessage: userText,
            mode: mode,
          }),
        }
      );

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: "Gagal mendapat respon" }));
        throw new Error(errorData.error || "Gagal mendapat respon");
      }

      const data = await resp.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.text,
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      
      // Save bot message
      await saveMessage(data.text, true);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Gagal mengirim pesan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout berhasil");
    navigate("/auth");
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading conversation:", error);
      toast.error("Gagal memuat percakapan");
      return;
    }

    const loadedMessages: Message[] = data.map((msg) => ({
      id: msg.id,
      text: msg.text,
      isBot: msg.is_bot,
      timestamp: new Date(msg.created_at),
    }));

    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
    setShowHistory(false);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <HistorySidebar
        mode={mode}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  IlmiChat
                </h1>
              </div>
              <Button
                variant={mode === "chat" ? "ghost" : "default"}
                onClick={() => navigate(mode === "chat" ? "/dakwah" : "/chat")}
              >
                {mode === "chat" ? "Dakwah" : "Chat"}
              </Button>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="container mx-auto max-w-4xl space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <Card className="p-8 text-center max-w-md shadow-lg">
                  <h2 className="text-2xl font-semibold mb-2 text-foreground">
                    Assalamu'alaikum
                  </h2>
                  <p className="text-muted-foreground">
                    Mulai percakapan dalam mode {mode === "chat" ? "Chat" : "Dakwah"}
                  </p>
                </Card>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? "justify-start" : "justify-end"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
              >
                <Card
                  className={`max-w-[80%] p-4 ${
                    message.isBot
                      ? "bg-card border-primary/20 shadow-soft"
                      : "bg-primary text-primary-foreground shadow-soft"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <span className={`text-xs mt-2 block ${message.isBot ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Card>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <Card className="p-4 bg-card border-primary/20 shadow-soft">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Mengetik...</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 max-w-4xl">
            <div className="flex gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan Anda..."
                className="min-h-[60px] resize-none focus-visible:ring-primary"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px] rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
