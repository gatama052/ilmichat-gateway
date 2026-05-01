import { useState, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceCallProps {
  onClose: () => void;
}

export const VoiceCall = ({ onClose }: VoiceCallProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [muted, setMuted] = useState(false);

  const conversation = useConversation({
    onConnect: () => toast.success("Terhubung dengan AI"),
    onDisconnect: () => toast("Panggilan berakhir"),
    onError: (err: any) => {
      console.error("Voice error:", err);
      toast.error("Terjadi kesalahan pada voice chat");
    },
  });

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-token");
      if (error) throw error;
      if (!data?.token) throw new Error("Token tidak diterima");

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Start call failed:", err);
      toast.error(err?.message || "Gagal memulai panggilan. Pastikan mic diizinkan.");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
    onClose();
  }, [conversation, onClose]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    await conversation.setVolume({ volume: next ? 0 : 1 });
  }, [muted, conversation]);

  // Auto start when mounted
  useEffect(() => {
    startCall();
    return () => {
      conversation.endSession().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;
  const connected = status === "connected";

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-primary/10 to-background backdrop-blur-xl flex flex-col items-center justify-between p-6 animate-in fade-in duration-300">
      {/* Top bar */}
      <div className="w-full flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {isConnecting ? "Menghubungkan..." : connected ? "Tersambung" : "Terputus"}
        </div>
        <Button variant="ghost" size="icon" onClick={endCall} aria-label="Tutup">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Avatar / pulse */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute rounded-full bg-primary/30 transition-all duration-300 ${
              isSpeaking ? "h-64 w-64 animate-ping" : "h-48 w-48"
            }`}
          />
          <div
            className={`absolute rounded-full bg-primary/40 transition-all duration-500 ${
              isSpeaking ? "h-52 w-52" : "h-40 w-40"
            }`}
          />
          <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl">
            {isConnecting ? (
              <Loader2 className="h-12 w-12 text-primary-foreground animate-spin" />
            ) : (
              <Mic className="h-12 w-12 text-primary-foreground" />
            )}
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1">IlmiChat Voice</h2>
          <p className="text-sm text-muted-foreground">
            {isConnecting
              ? "Menyiapkan koneksi..."
              : isSpeaking
              ? "AI sedang berbicara..."
              : connected
              ? "Silakan bicara, AI mendengarkan"
              : "Tidak terhubung"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <Button
          variant={muted ? "destructive" : "outline"}
          size="icon"
          onClick={toggleMute}
          disabled={!connected}
          className="h-14 w-14 rounded-full"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={endCall}
          className="h-16 w-16 rounded-full shadow-lg"
          aria-label="Akhiri panggilan"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
};
