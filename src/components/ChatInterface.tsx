import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Message = {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
};

type Mode = "chat" | "dakwah";

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const resp = await fetch("https://ilmichat.netlify.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: inputValue,
          mode: mode,
        }),
      });

      if (!resp.ok) {
        throw new Error("Failed to get response");
      }

      const data = await resp.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.text,
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              IlmiChat
            </h1>
            <div className="flex gap-2">
              <Button
                variant={mode === "chat" ? "default" : "outline"}
                onClick={() => setMode("chat")}
                className="transition-all duration-300"
              >
                Chat
              </Button>
              <Button
                variant={mode === "dakwah" ? "default" : "outline"}
                onClick={() => setMode("dakwah")}
                className="transition-all duration-300"
              >
                Dakwah
              </Button>
            </div>
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
                  Start a conversation in {mode === "chat" ? "Chat" : "Dakwah"} mode
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
                  <span className="text-muted-foreground">Typing...</span>
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
              placeholder="Type your message..."
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
  );
};
