import { useNavigate } from "react-router-dom";
import { VoiceCall } from "@/components/VoiceCall";

const Voice = () => {
  const navigate = useNavigate();
  return <VoiceCall onClose={() => navigate("/chat")} />;
};

export default Voice;
