import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Define system prompts based on mode
    const systemPrompts = {
      chat: "Anda adalah asisten AI yang membantu dan ramah. Jawab pertanyaan dengan jelas dan informatif dalam Bahasa Indonesia.",
      dakwah: "Anda adalah asisten AI yang berfokus pada dakwah Islami. Berikan jawaban yang bijaksana, penuh hikmah, dan sesuai dengan ajaran Islam. Sertakan dalil dari Al-Quran atau Hadits jika relevan. Gunakan Bahasa Indonesia yang sopan dan santun."
    };

    const systemPrompt = systemPrompts[mode as keyof typeof systemPrompts] || systemPrompts.chat;

    console.log(`Processing ${mode} request:`, userMessage);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Batas penggunaan tercapai. Silakan coba lagi nanti." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Pembayaran diperlukan. Silakan tambahkan kredit ke workspace Anda." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || "Maaf, saya tidak dapat memproses permintaan Anda.";

    console.log("Response generated successfully");

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ilmichat function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
