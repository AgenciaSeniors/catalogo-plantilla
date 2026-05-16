// =====================================================================
// EDGE FUNCTION: generar-descripcion  (Señores AI)
//
// Genera descripciones de productos para el catálogo digital usando
// la API de Gemini. La API key vive segura aquí (como secret de
// Supabase), nunca se expone al cliente.
//
// Se despliega UNA SOLA VEZ y la usan TODOS los catálogos.
//
// Requiere el secret:  GEMINI_KEY
// =====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nombre, categoria, negocio } = await req.json();

    if (!nombre || !String(nombre).trim()) {
      return json({ error: "Falta el nombre del producto" }, 400);
    }

    const GEMINI_KEY = Deno.env.get("GEMINI_KEY");
    if (!GEMINI_KEY) {
      return json({ error: "GEMINI_KEY no está configurada en Supabase" }, 500);
    }

    const contexto = [
      negocio ? `El negocio se llama "${negocio}".` : "",
      categoria ? `El producto pertenece a la categoría "${categoria}".` : "",
    ].filter(Boolean).join(" ");

    const prompt = `Eres un redactor experto en marketing para catálogos digitales de pequeños negocios.
Escribe UNA sola descripción breve, atractiva y vendedora para este producto.

Producto: "${nombre}".
${contexto}

Reglas estrictas:
- Escribe en español.
- Máximo 200 caracteres.
- Tono cálido, cercano y profesional.
- Despierta el deseo de compra y destaca un beneficio o cualidad.
- Sin emojis. Sin comillas. No empieces repitiendo el nombre del producto.
- Devuelve SOLO el texto de la descripción, sin ningún texto adicional.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 150 },
        }),
      },
    );

    const geminiData = await geminiResp.json();

    if (!geminiResp.ok) {
      return json({ error: "Error al llamar a Gemini", detalle: geminiData }, 502);
    }

    let descripcion =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Limpieza: quitar comillas envolventes que a veces agrega la IA
    descripcion = descripcion.replace(/^["'«»\s]+|["'«»\s]+$/g, "").trim();

    if (!descripcion) {
      return json({ error: "La IA no devolvió texto" }, 502);
    }

    return json({ descripcion });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
