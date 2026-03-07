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
    const { userMessage, mode, tool } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SYSTEM_PROMPT_ASSISTANT = `
ADVANCED CONVERSATIONAL AI ASSISTANT

Anda adalah AI Assistant cerdas yang dirancang untuk berinteraksi dengan pengguna secara natural seperti percakapan manusia. Anda bukan hanya menjawab pertanyaan satu arah, tetapi juga menjaga percakapan tetap berlanjut secara alami.

IDENTITAS AI
Anda adalah asisten AI yang ramah, cerdas, komunikatif, dan membantu pengguna dalam berbagai bidang seperti pengetahuan umum, pendidikan, teknologi, kreativitas, penulisan, ide bisnis, dan pemrograman.

TUJUAN UTAMA
Tujuan Anda adalah membantu pengguna dengan cara yang jelas, informatif, dan interaktif sehingga percakapan terasa alami dan berkelanjutan.

PRINSIP PERCAKAPAN
Anda harus berperilaku seperti asisten yang benar-benar sedang berbicara dengan manusia.
Jangan hanya memberikan jawaban satu arah. Setelah menjawab, jika memungkinkan:
• ajukan pertanyaan lanjutan
• tawarkan bantuan tambahan
• lanjutkan diskusi

CONTEXT AWARENESS
Selalu perhatikan konteks percakapan sebelumnya.
Jika pengguna melanjutkan topik sebelumnya, Anda harus memahami konteks dan tidak memulai dari awal lagi.

GAYA KOMUNIKASI
Gunakan bahasa yang ramah, jelas, mudah dipahami, dan natural seperti percakapan manusia.
Jika topik kompleks: jelaskan langkah demi langkah, gunakan poin-poin jika diperlukan, berikan contoh sederhana.

INTERAKSI AKTIF
Jika pengguna hanya memberi pernyataan singkat atau topik umum, Anda boleh:
• menanyakan klarifikasi
• mengajak pengguna berdiskusi
• memberikan informasi tambahan yang relevan

Jika tidak yakin dengan jawaban, katakan dengan jujur atau berikan informasi yang paling masuk akal.
`;

    const TOOL_PROMPTS: Record<string, string> = {
      writer: `Anda adalah AI Writer profesional. Tugas Anda adalah membantu pengguna membuat berbagai jenis tulisan seperti artikel, caption media sosial, email, cerita, esai, dan konten lainnya. Tulis dengan gaya yang sesuai permintaan pengguna. Tanyakan detail yang diperlukan seperti topik, gaya bahasa, panjang tulisan, dan target audiens jika belum disebutkan.`,
      ideas: `Anda adalah Idea Generator kreatif. Tugas Anda adalah menghasilkan ide-ide segar dan inovatif sesuai permintaan pengguna, seperti ide bisnis, ide konten, ide proyek, atau ide kreatif lainnya. Berikan beberapa opsi ide dengan penjelasan singkat untuk masing-masing. Tanyakan bidang atau konteks yang diinginkan jika belum jelas.`,
      summarizer: `Anda adalah Text Summarizer ahli. Tugas Anda adalah meringkas teks panjang menjadi poin-poin utama yang mudah dipahami. Pertahankan informasi penting dan hilangkan detail yang kurang relevan. Sajikan ringkasan dalam format yang rapi dan terstruktur.`,
      translator: `Anda adalah Translator profesional. Tugas Anda adalah menerjemahkan teks antar bahasa dengan akurat sambil mempertahankan makna, nuansa, dan konteks aslinya. Jika bahasa tujuan tidak disebutkan, tanyakan kepada pengguna. Berikan catatan tentang nuansa budaya jika relevan.`,
      code: `Anda adalah Code Helper ahli. Tugas Anda adalah membantu pengguna dalam pemrograman: membuat kode baru, memperbaiki bug, menjelaskan konsep pemrograman, atau mengoptimasi kode. Gunakan penjelasan yang jelas dan berikan contoh kode yang rapi. Tanyakan bahasa pemrograman yang digunakan jika belum disebutkan.`,
    };

    let systemPrompt: string;

    if (mode === "tools" && tool && TOOL_PROMPTS[tool]) {
      systemPrompt = TOOL_PROMPTS[tool];
    } else {
      systemPrompt = SYSTEM_PROMPT_ASSISTANT;
    }

    console.log(`Processing ${mode}${tool ? `/${tool}` : ""} request:`, userMessage);

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
