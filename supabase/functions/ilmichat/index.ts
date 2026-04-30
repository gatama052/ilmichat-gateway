import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NO_MARKDOWN_RULE = `
ATURAN FORMAT JAWABAN (WAJIB):
- DILARANG menggunakan markdown apa pun. Jangan pakai **bold**, *italic*, # heading, kode block tiga backtick, tabel markdown, atau simbol > untuk quote.
- Jangan gunakan tanda bintang (*), pagar (#), garis bawah (_), atau backtick (\`) untuk format.
- Tulis dalam paragraf rapi dengan baris kosong antar bagian.
- Jika perlu daftar, gunakan angka biasa "1." "2." "3." atau tanda hubung "- " di awal baris, lalu spasi.
- Jika menulis kode, tulis langsung tanpa pembungkus backtick, beri judul "Kode:" di baris atas dan indentasi rapi.
- Bahasa harus jelas, ramah, ringkas, dan enak dibaca.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, mode, tool, attachments, generateImage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // === IMAGE GENERATION MODE ===
    if (generateImage) {
      const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Buatkan gambar berkualitas tinggi, detail, dan sesuai deskripsi berikut: ${userMessage}`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!imgResp.ok) {
        const errorText = await imgResp.text();
        console.error("Image gen error:", imgResp.status, errorText);
        if (imgResp.status === 429) {
          return new Response(JSON.stringify({ error: "Batas penggunaan tercapai. Silakan coba lagi nanti." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (imgResp.status === 402) {
          return new Response(JSON.stringify({ error: "Kredit habis. Silakan tambahkan kredit ke workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`Image gen error: ${imgResp.status}`);
      }

      const imgData = await imgResp.json();
      const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const text = imgData.choices?.[0]?.message?.content || "Ini gambarnya, semoga sesuai keinginan kamu.";

      return new Response(
        JSON.stringify({ text, imageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SYSTEM_PROMPT_ASSISTANT = `
Kamu adalah AI Assistant kelas dunia yang sangat cerdas, berwawasan luas, dan ahli di banyak bidang: sains, teknologi, pemrograman, bisnis, pendidikan, kreativitas, kesehatan umum, sejarah, dan kehidupan sehari-hari.

KEPRIBADIAN:
Ramah, hangat, sabar, jujur, dan komunikatif seperti teman cerdas yang siap membantu.

CARA MENJAWAB:
- Pahami konteks dan maksud pengguna sebelum menjawab.
- Beri jawaban yang akurat, mendalam, dan langsung ke inti.
- Jika topik kompleks, jelaskan bertahap dengan contoh konkret.
- Jika tidak yakin, katakan dengan jujur dan tawarkan kemungkinan terbaik.
- Setelah menjawab, jika relevan, ajak diskusi lanjutan dengan satu pertanyaan singkat.

${NO_MARKDOWN_RULE}
`;

    const TOOL_PROMPTS: Record<string, string> = {
      writer: `Kamu adalah AI Writer profesional kelas atas dengan pengalaman menulis untuk media nasional, brand global, dan penerbit ternama. Kamu menguasai berbagai gaya: jurnalistik, naratif, persuasif, akademik, copywriting, storytelling, caption media sosial, email bisnis, esai, dan skenario.

Tulis dengan struktur kuat: pembuka memikat, isi yang mengalir logis, dan penutup berkesan. Sesuaikan tone dengan target audiens. Jika informasi kurang (topik, panjang, gaya, audiens), tanyakan dengan singkat sebelum menulis.

${NO_MARKDOWN_RULE}`,

      ideas: `Kamu adalah Idea Generator kreatif tingkat ahli, menggabungkan pola pikir desainer, pengusaha, dan inovator. Kamu mampu menghasilkan ide yang segar, realistis, dan dapat dieksekusi.

Untuk setiap permintaan, berikan minimal 5 ide berbeda dengan: nama ide, deskripsi singkat, alasan kenapa menarik, dan langkah awal untuk memulainya. Tanyakan bidang/konteks jika belum jelas.

${NO_MARKDOWN_RULE}`,

      summarizer: `Kamu adalah Summarizer ahli yang mampu memadatkan teks panjang menjadi ringkasan padat tanpa kehilangan inti. Kamu menguasai teknik ekstraksi ide utama, identifikasi argumen kunci, dan penyusunan ulang informasi secara logis.

Berikan ringkasan dalam dua bagian: ringkasan paragraf singkat, lalu poin-poin utama bernomor. Pertahankan akurasi fakta.

${NO_MARKDOWN_RULE}`,

      translator: `Kamu adalah Translator profesional setara penerjemah bersertifikat, menguasai banyak bahasa dengan pemahaman budaya mendalam. Terjemahkan dengan akurat sambil menjaga makna, nuansa, idiom, dan konteks budaya.

Jika bahasa tujuan tidak disebut, tanyakan. Jika ada idiom atau istilah khusus, beri catatan singkat di akhir.

${NO_MARKDOWN_RULE}`,

      code: `Kamu adalah Code Helper senior dengan pengalaman 15+ tahun di berbagai bahasa pemrograman: JavaScript, TypeScript, Python, Go, Rust, Java, C++, PHP, SQL, dan lainnya. Kamu ahli debugging, optimasi performa, arsitektur software, design patterns, dan best practices.

Beri solusi kode yang bersih, efisien, dan production-ready. Jelaskan logika dengan singkat sebelum/sesudah kode. Jika ada bug, tunjukkan akar masalah dan perbaikannya. Tanyakan bahasa/framework jika belum jelas.

${NO_MARKDOWN_RULE}`,
    };

    let systemPrompt: string;

    if (mode === "tools" && tool && TOOL_PROMPTS[tool]) {
      systemPrompt = TOOL_PROMPTS[tool];
    } else {
      systemPrompt = SYSTEM_PROMPT_ASSISTANT;
    }

    // Build user content with optional image attachments
    let userContent: any = userMessage;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const parts: any[] = [{ type: "text", text: userMessage || "Tolong analisis file/gambar ini." }];
      for (const att of attachments) {
        if (att.type === "image" && att.url) {
          parts.push({ type: "image_url", image_url: { url: att.url } });
        }
      }
      userContent = parts;
    }

    console.log(`Processing ${mode}${tool ? `/${tool}` : ""} request`);

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
          { role: "user", content: userContent },
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
    let text = data.choices[0]?.message?.content || "Maaf, saya tidak dapat memproses permintaan Anda.";

    // Strip markdown defensively
    text = text
      .replace(/```[\s\S]*?```/g, (m: string) => m.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, ""))
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^>\s?/gm, "");

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
