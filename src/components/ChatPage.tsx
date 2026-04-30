import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Menu, Copy, Check, PenLine, Lightbulb, FileText, Languages, Code2, Paperclip, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HistorySidebar } from "./HistorySidebar";
import { Session } from "@supabase/supabase-js";
import ilmichatLogo from "@/assets/ilmichat-logo.png";

type Attachment = {
  id: string;
  name: string;
  type: "image" | "file";
  url: string; // data URL
  mime: string;
};

type Message = {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  imageUrl?: string;
  attachments?: Attachment[];
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

// Detect image-generation intent in user message
const detectImageIntent = (text: string): boolean => {
  const t = text.toLowerCase();
  const patterns = [
    /\b(buat|buatkan|bikin|bikinkan|generate|gambar(kan)?|lukis(kan)?|design|desain|render|create)\b.*\b(gambar|foto|ilustrasi|image|logo|poster|wallpaper|art|lukisan)\b/,
    /\b(gambar|foto|ilustrasi|image|logo)\b.*\b(tentang|dari|seperti|berupa|of|about)\b/,
    /^(gambar|foto|ilustrasi|lukis|generate image|create image)/,
  ];
  return patterns.some((p) => p.test(t));
};

export const ChatPage = ({ mode }: ChatPageProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGeneratingImage]);

  useEffect(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedTool(null);
    setAttachments([]);
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
    const title = firstUserMessage.trim().slice(0, 35) || "Percakapan baru";
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} terlalu besar (maks 10MB)`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newAttachments.push({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: isImage ? "image" : "file",
        url: dataUrl,
        mime: file.type,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const sendMessage = async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    const userText = inputValue.trim();
    const wantsImage = detectImageIntent(userText) && attachments.length === 0;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userText || (attachments.length > 0 ? "(file terlampir)" : ""),
      isBot: false,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentAttachments = [...attachments];
    setInputValue("");
    setAttachments([]);
    setIsLoading(true);
    if (wantsImage) setIsGeneratingImage(true);

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
            generateImage: wantsImage,
            attachments: currentAttachments.map((a) => ({
              type: a.type,
              url: a.url,
              name: a.name,
            })),
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
        text: data.text || "",
        isBot: true,
        timestamp: new Date(),
        imageUrl: data.imageUrl,
      };

      setMessages((prev) => [...prev, botMessage]);
      await saveMessage(data.text || "(gambar)", true);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengirim pesan.");
    } finally {
      setIsLoading(false);
      setIsGeneratingImage(false);
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
    setAttachments([]);
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
    return "Ketik pesan atau minta gambar...";
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
                size="sm"
                onClick={() => navigate(mode === "assistant" ? "/tools" : "/chat")}
                className="flex-shrink-0 text-xs sm:text-sm bg-foreground text-background hover:bg-foreground/85 shadow-md hover:shadow-lg transition-all duration-300 font-semibold px-3 py-1.5 h-auto"
              >
                {mode === "assistant" ? "AI Tools" : "AI Assistant"}
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
                      ? "Saya AI Assistant Anda. Tanya apa saja, kirim gambar/file, atau minta saya membuatkan gambar!"
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
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.attachments.map((a) =>
                        a.type === "image" ? (
                          <img key={a.id} src={a.url} alt={a.name} className="max-h-40 rounded-md border border-border" />
                        ) : (
                          <div key={a.id} className="flex items-center gap-1 text-xs bg-background/20 rounded px-2 py-1">
                            <FileText className="h-3 w-3" /> {a.name}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {message.text && (
                    <p className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">{message.text}</p>
                  )}
                  {message.imageUrl && (
                    <img
                      src={message.imageUrl}
                      alt="Hasil generate AI"
                      className="mt-2 rounded-lg border border-border max-w-full h-auto"
                    />
                  )}
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className={`text-xs ${message.isBot ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {message.isBot && message.text && (
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
                    {isGeneratingImage ? (
                      <>
                        <ImageIcon className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-foreground font-medium">Sabar yah AI....lagi proses gambarmu</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-muted-foreground">Berpikir...</span>
                      </>
                    )}
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
              <>
                {/* Attachment previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((a) => (
                      <div key={a.id} className="relative group">
                        {a.type === "image" ? (
                          <img src={a.url} alt={a.name} className="h-16 w-16 object-cover rounded-md border border-border" />
                        ) : (
                          <div className="h-16 px-3 flex items-center gap-2 rounded-md border border-border bg-muted text-xs">
                            <FileText className="h-4 w-4" />
                            <span className="max-w-[120px] truncate">{a.name}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeAttachment(a.id)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow"
                          aria-label="Hapus lampiran"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex gap-2 items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="h-[60px] w-[48px] flex-shrink-0"
                    aria-label="Lampirkan file atau gambar"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
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
                    disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || (mode === "tools" && !selectedTool)}
                    size="icon"
                    className="h-[60px] w-[60px] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex-shrink-0"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
