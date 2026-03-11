import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Menu, Copy, Check, PenLine, Lightbulb, FileText, Languages, Code2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HistorySidebar } from "./HistorySidebar";
import { Session } from "@supabase/supabase-js";
import ilmichatLogo from "@/assets/ilmichat-logo.png";

type Message = {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
};

type Mode = "assistant" | "tools";
type ToolType = "writer" | "ideas" | "summarizer" | "translator" | "code";

const TOOLS: { id: ToolType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "writer", label: "AI Writer", icon: <PenLine className="h-5 w-5" />, desc: "Buat artikel, caption, email, cerita" },
  { id: "ideas", label: "Idea Generator", icon: <Lightbulb className="h-5 w-5" />, desc: "Hasilkan ide bisnis, konten, proyek" },
  { id: "summarizer", label: "Summarizer", icon: <FileText className="h-5 w-5" />, desc: "Ringkas teks panjang jadi poin utama" },
  { id: "translator", label: "Translator", icon: <Languages className="h-5 w-5" />, desc: "Terjemahkan teks antar bahasa" },
  { id: "code", label: "Code Helper", icon: <Code2 className="h-5 w-5" />, desc: "Buat, perbaiki, jelaskan kode" },
];

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedTool(null);
  }, [mode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
      else setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const createNewConversation = async (firstUserMessage: string) => {
    if (!session?.user) return null;
    const title = firstUserMessage.trim().slice(0, 35);
    const dbMode = mode === "assistant" ? "chat" : "dakwah";

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: session.user.id, mode: dbMode, title })
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
      if (conversationId) setCurrentConversationId(conversationId);
      else return;
    }

    await supabase.from("messages").insert({ conversation_id: conversationId, text, is_bot: isBot });
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
            mode,
            tool: mode === "tools" ? selectedTool : undefined,
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
    setSelectedTool(null);
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Gagal memuat percakapan");
      return;
    }

    setMessages(data.map((msg) => ({
      id: msg.id,
      text: msg.text,
      isBot: msg.is_bot,
      timestamp: new Date(msg.created_at),
    })));
    setCurrentConversationId(conversationId);
    setShowHistory(false);
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      toast.success("Teks berhasil disalin");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Gagal menyalin teks");
    }
  };

  const getPlaceholder = () => {
    if (mode === "tools" && selectedTool) {
      const t = TOOLS.find(t => t.id === selectedTool);
      return t ? `Gunakan ${t.label}...` : "Ketik pesan Anda...";
    }
    return "Ketik pesan Anda...";
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-accent/20 to-background overflow-hidden">
      <HistorySidebar
        mode={mode}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="w-full px-3 sm:px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(!showHistory)} className="flex-shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent truncate">
                  IlmiChat 052
                </h1>
              </div>
              <Button
                variant="default"
                onClick={() => navigate(mode === "assistant" ? "/tools" : "/chat")}
                className="flex-shrink-0 text-sm sm:text-base bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-300"
              >
                {mode === "assistant" ? "🛠 AI Tools" : "💬 AI Assistant"}
              </Button>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="w-full max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full min-h-[60vh] px-4">
                <div className="text-center space-y-4 w-full max-w-md">
                  <img src={ilmichatLogo} alt="IlmiChat Logo" className="w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-4 animate-friendly-blink" />
                  <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                    {mode === "assistant" ? "Halo! 👋" : "AI Tools"}
                  </h2>
                  <p className="text-muted-foreground text-base sm:text-lg px-4">
                    {mode === "assistant"
                      ? "Saya AI Assistant Anda. Tanya apa saja — sains, teknologi, bisnis, coding, atau sekadar ngobrol!"
                      : "Pilih tool AI di bawah untuk memulai tugas spesifik."}
                  </p>

                  {mode === "tools" && !selectedTool && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
                      {TOOLS.map((tool) => (
                        <button
                          key={tool.id}
                          className="group p-5 bg-gradient-to-br from-primary/10 via-accent/30 to-secondary/10 rounded-xl border-2 border-primary/20 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 flex items-center gap-4 text-left"
                          onClick={() => setSelectedTool(tool.id)}
                        >
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                            {tool.icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{tool.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
                          </div>
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary flex items-center justify-center transition-all duration-300">
                            <span className="text-xs">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {mode === "tools" && selectedTool && (
                    <div className="mt-4">
                      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium">
                        {TOOLS.find(t => t.id === selectedTool)?.icon}
                        {TOOLS.find(t => t.id === selectedTool)?.label}
                        <button onClick={() => setSelectedTool(null)} className="ml-1 hover:text-destructive transition-colors">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isBot ? "justify-start" : "justify-end"} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <Card className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 ${message.isBot ? "bg-card border-primary/20 shadow-soft" : "bg-primary text-primary-foreground shadow-soft"}`}>
                  <p className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.text}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className={`text-xs ${message.isBot ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {message.isBot && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity" onClick={() => copyToClipboard(message.text, message.id)}>
                        {copiedId === message.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <Card className="p-4 bg-card border-primary/20 shadow-soft">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Berpikir...</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Tool selector bar when in tools mode with messages */}
        {mode === "tools" && messages.length > 0 && selectedTool && (
          <div className="border-t border-border bg-card/60 px-3 py-2">
            <div className="max-w-4xl mx-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tool aktif:</span>
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                {TOOLS.find(t => t.id === selectedTool)?.icon}
                {TOOLS.find(t => t.id === selectedTool)?.label}
                <button onClick={() => setSelectedTool(null)} className="ml-1 hover:text-destructive">✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="w-full px-3 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto">
            {mode === "tools" && !selectedTool && messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-2">Pilih tool di atas untuk memulai</p>
            ) : (
              <div className="flex gap-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={getPlaceholder()}
                  className="min-h-[60px] resize-none focus-visible:ring-primary flex-1"
                  disabled={isLoading || (mode === "tools" && !selectedTool)}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading || (mode === "tools" && !selectedTool)}
                  size="icon"
                  className="h-[60px] w-[60px] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex-shrink-0"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
