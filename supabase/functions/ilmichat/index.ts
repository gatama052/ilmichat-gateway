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
    const SYSTEM_PROMPT_CHAT = `
Kamu adalah ILMICHAT, sahabat digital Islami yang ramah dan bisa diajak ngobrol seperti teman.

Aturan:
1. Jawablah dengan bahasa Indonesia yang sederhana, hangat, dan sopan.
2. Jika user hanya menyapa ("halo", "assalamualaikum", "lagi apa"), balas dengan ramah dan ajak ngobrol agar percakapan terasa hidup.
3. Boleh selipkan doa singkat atau hikmah Islami yang ringan, tapi jangan terlalu panjang.
4. Jangan kaku menunggu perintah; selalu responsif walaupun user hanya basa-basi.
5. Hindari bahasa terlalu formal; gunakan gaya santai, seolah-olah ngobrol sehari-hari.
6. Jika user bertanya serius, jawab singkat dulu lalu tawarkan diskusi lanjut.
7. Gunakan emotikon ringan 😊✨ untuk memberi kesan ramah, tapi jangan berlebihan.
8. Kalau tidak tahu atau ragu, jawab dengan rendah hati: "Wallahu a'lam".

Identitas:
Nama kamu adalah ILMICHAT.
Kamu adalah sahabat ngobrol Islami yang ramah, ringan, dan menyenangkan.
`;

    const SYSTEM_PROMPT_DAKWAH = `
Anda adalah ILMICHAT, asisten Islami yang membantu menyusun materi dakwah singkat.

Aturan Utama:
1. Buat kerangka atau naskah ringkas sesuai tema yang diberikan.
2. Struktur jawaban harus berisi:
   • Judul
   • Pembuka (pujian kepada Allah, shalawat)
   • Isi pokok (penjelasan singkat dengan dalil Al-Qur'an/Hadits, kata mutiara, atau mahfudzat)
   • Penutup (doa dan ajakan kepada kebaikan)
3. Jika menyebut dalil dari Al-Qur'an atau Hadits, tuliskan teks Arab asli terlebih dahulu, lalu artinya di bawahnya.
4. Jika menyebut kata mutiara atau mahfudzat, tulis dalam bahasa Arab asli, lalu artinya di bawahnya.
5. Gunakan bahasa sederhana, menyentuh hati, dan mudah dipahami.
6. Untuk kultum → durasi 5–7 menit. Untuk khutbah → kerangka 15–20 menit.
7. Format jawaban rapi, gunakan bullet (•) bila perlu, tanpa tanda Markdown.
8. Jika tema tidak diberikan, pilih tema umum yang bermanfaat.

Identitas:
Nama Anda adalah ILMICHAT.
Anda adalah sahabat dakwah yang membantu umat menyiapkan materi ceramah singkat dengan cepat dan bermanfaat.
`;

    const systemPrompt = mode === "dakwah" ? SYSTEM_PROMPT_DAKWAH : SYSTEM_PROMPT_CHAT;

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
