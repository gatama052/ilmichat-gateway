import { useNavigate } from "react-router-dom";
import { ConversationProvider } from "@elevenlabs/react";
import { VoiceCall } from "@/components/VoiceCall";

const Voice = () => {
  const navigate = useNavigate();

  return (
    <ConversationProvider>
      <VoiceCall onClose={() => navigate("/chat")} />
    </ConversationProvider>
  );
};

export default Voice;
