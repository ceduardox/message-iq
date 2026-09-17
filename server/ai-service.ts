import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import type { Message, Product } from "@shared/schema";

const DEFAULT_PUBLIC_BASE_URL = "https://iqexcelencia.com";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const CRM_TIME_ZONE = "America/La_Paz";
const CITA_MINUTES = 60;
const SEDE_LABEL: Record<string, string> = { centro: "Centro", norte: "Norte" };

type AiProvider = "openai" | "gemini" | "deepseek";

// Order status type
export type OrderStatus = 'pending' | 'ready' | 'delivered' | null;

// Normalize text: lowercase and remove accents
function normalize(text: string): string {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Search products by matching name or keywords against user message
function findMatchingProducts(userMessage: string, products: Product[]): Product[] {
  const normalizedMessage = normalize(userMessage);
  
  return products.filter(product => {
    // Check full product name (normalized)
    const normalizedName = normalize(product.name);
    if (normalizedMessage.includes(normalizedName)) {
      return true;
    }
    
    // Check individual words in product name (>2 chars)
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
    const nameMatch = nameWords.some(word => normalizedMessage.includes(word));
    
    // Check keywords (normalized)
    const keywordsMatch = product.keywords?.split(/[,\s]+/)
      .filter(k => k.length > 2)
      .some(keyword => normalizedMessage.includes(normalize(keyword)));
    
    return nameMatch || keywordsMatch;
  });
}

// Check if message is asking about products in general
function isProductQuery(userMessage: string): boolean {
  const generalKeywords = [
    "precio", "costo", "cuánto", "cuanto", "producto", "catálogo", "catalogo",
    "comprar", "pedir", "disponible", "tienen", "hay", "busco", "quiero",
    "necesito", "promoción", "promocion", "descuento", "oferta", "stock",
    "venden", "qué venden", "que venden", "lista", "opciones"
  ];
  const lowerMessage = userMessage.toLowerCase();
  return generalKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Only explicit catalog browsing should inject the full product list.
// Generic requests like "precio" should be handled by the system prompt,
// which may prefer a problem-based entry flow instead of direct product selection.
function isCatalogQuery(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase();
  const generalKeywords = [
    "producto",
    "productos",
    "catalogo",
    "catálogo",
    "tienen",
    "hay",
    "venden",
    "que venden",
    "qué venden",
    "lista",
    "opciones",
    "ver productos",
  ];

  return generalKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Search for product context in conversation history
function findProductInHistory(recentMessages: Message[], products: Product[]): Product | null {
  // Look through recent messages for product mentions
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.text) {
      const matches = findMatchingProducts(msg.text, products);
      if (matches.length === 1) {
        return matches[0]; // Found a specific product in history
      }
    }
  }
  return null;
}

function resolvePublicImageUrl(imageUrl?: string | null): string {
  const value = (imageUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;
  const baseUrl = (process.env.APP_BASE_URL || DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}${value}`;
}

function normalizeAiProvider(value?: string | null): AiProvider {
  if (value === "gemini") return "gemini";
  if (value === "deepseek") return "deepseek";
  return "openai";
}

// Build a short list of real free slots (up to 3 per sede) so the AI can offer and book them.
// Each slot gets a short code (C1, N2...) that the AI emits as [CITA: C1]; the server resolves it.
export async function getUpcomingAvailability(): Promise<{ context: string; slotsById: Record<string, { sede: string; startAt: string }> }> {
  const empty = { context: "", slotsById: {} as Record<string, { sede: string; startAt: string }> };
  try {
    const availRes: any = await db.execute(sql`
      SELECT weekday, start_time AS "startTime", end_time AS "endTime", sede
      FROM agent_availability WHERE is_active IS DISTINCT FROM false
    `);
    const avail = availRes.rows ?? availRes;
    if (!Array.isArray(avail) || avail.length === 0) return empty;

    const busyRes: any = await db.execute(sql`
      SELECT sede, start_at AS "startAt", end_at AS "endAt"
      FROM citas
      WHERE estado != 'cancelada'
        AND start_at >= NOW() - INTERVAL '1 hour'
        AND start_at <= NOW() + INTERVAL '8 days'
    `);
    const busy = busyRes.rows ?? busyRes;
    const busyBySede: Record<string, Array<{ s: number; e: number }>> = {};
    for (const b of busy) {
      (busyBySede[b.sede] ||= []).push({ s: new Date(b.startAt).getTime(), e: new Date(b.endAt).getTime() });
    }

    const toMin = (t: string) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
    const now = Date.now();
    const lines: string[] = [];
    const slotsById: Record<string, { sede: string; startAt: string }> = {};

    for (const sede of ["centro", "norte"]) {
      const blocks = avail.filter((a: any) => a.sede === sede);
      if (blocks.length === 0) continue;
      const slots: Date[] = [];
      for (let d = 1; d <= 7 && slots.length < 3; d++) {
        const day = new Date();
        day.setDate(day.getDate() + d);
        day.setHours(0, 0, 0, 0);
        const wd = day.getDay();
        for (const a of blocks.filter((x: any) => Number(x.weekday) === wd)) {
          const s = toMin(a.startTime);
          const e = toMin(a.endTime);
          for (let m = s; m + CITA_MINUTES <= e && slots.length < 3; m += CITA_MINUTES) {
            const st = new Date(day);
            st.setHours(Math.floor(m / 60), m % 60, 0, 0);
            if (st.getTime() < now + 60 * 60 * 1000) continue;
            const en = st.getTime() + CITA_MINUTES * 60000;
            const overlap = (busyBySede[sede] || []).some((b) => st.getTime() < b.e && en > b.s);
            if (!overlap) slots.push(st);
          }
          if (slots.length >= 3) break;
        }
      }
      if (slots.length === 0) continue;
      const prefix = sede === "norte" ? "N" : "C";
      const parts = slots.map((s, i) => {
        const code = `${prefix}${i + 1}`;
        slotsById[code] = { sede, startAt: s.toISOString() };
        const label = `${s.toLocaleDateString("es-BO", { weekday: "long", day: "2-digit", month: "short" })} ${s.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
        return `${code}=${label}`;
      });
      lines.push(`Sede ${SEDE_LABEL[sede]}: ${parts.join(" | ")}`);
    }
    return { context: lines.join("\n"), slotsById };
  } catch (err) {
    console.error("[AI] availability lookup failed:", err);
    return empty;
  }
}

function getDefaultModelForProvider(provider: AiProvider): string {
  if (provider === "gemini") return DEFAULT_GEMINI_MODEL;
  if (provider === "deepseek") return process.env.DEEPSEEK_MODEL || "deepseek-flash";
  return DEFAULT_OPENAI_MODEL;
}

// DeepSeek is OpenAI-compatible (chat/completions).
async function requestDeepSeekCompletion(params: {
  model: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  maxTokens: number;
  temperature: number;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const messages = [
    { role: "system", content: params.systemPrompt },
    ...params.conversationHistory,
    { role: "user", content: params.userMessage },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages,
      max_tokens: Math.min(params.maxTokens, 8192),
      temperature: params.temperature,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `DeepSeek request failed with status ${response.status}`);
  }

  const responseText = String(payload?.choices?.[0]?.message?.content || "").trim();
  const tokensUsed = Number(payload?.usage?.total_tokens || 0);
  return { responseText, tokensUsed, providerUsed: "deepseek" as const };
}

// Deterministic safety net: if the AI offered concrete times in its previous message
// and the client replies with a short confirmation, book the matching slot.
function detectSlotConfirmation(
  userMessage: string,
  lastOutText: string,
  slotsById: Record<string, { sede: string; startAt: string }>,
): { sede: string; startAt: string } | null {
  const codes = Object.keys(slotsById);
  if (codes.length === 0 || !lastOutText) return null;
  if (!/\d{1,2}:\d{2}/.test(lastOutText)) return null;

  const msg = normalize(userMessage).replace(/[¡!.,]/g, "").trim();
  const confirmWords = ["si", "sí", "ok", "okay", "dale", "confirmo", "confirmado", "de acuerdo", "me sirve", "perfecto", "listo", "agendemos", "reservalo", "me acomoda", "esa", "ese"];
  const isOrdinal = /(la primera|el primero|la segunda|el segundo|opcion 1|opcion 2)/.test(msg);
  const isConfirm = isOrdinal || confirmWords.includes(msg) || msg.startsWith("si ");
  if (!isConfirm) return null;

  const sede = /norte/i.test(lastOutText) ? "norte" : /centro/i.test(lastOutText) ? "centro" : null;
  const filtered = codes
    .filter((c) => !sede || slotsById[c].sede === sede)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (filtered.length === 0) return null;
  const wantSecond = /(segunda|segundo|opcion 2)/.test(msg);
  const code = filtered[wantSecond && filtered.length > 1 ? 1 : 0];
  return slotsById[code];
}

export function buildCurrentDateContext(now = new Date()): string {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = dateParts.find((part) => part.type === "year")?.value || "";
  const month = dateParts.find((part) => part.type === "month")?.value || "";
  const day = dateParts.find((part) => part.type === "day")?.value || "";
  const isoDate = year && month && day ? `${year}-${month}-${day}` : "";

  const readableDate = new Intl.DateTimeFormat("es-BO", {
    timeZone: CRM_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const readableTime = new Intl.DateTimeFormat("es-BO", {
    timeZone: CRM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return [
    "CONTEXTO DE FECHA ACTUAL DEL CRM:",
    `- Zona horaria oficial: ${CRM_TIME_ZONE} (Bolivia).`,
    `- Hoy es ${readableDate}${isoDate ? ` (${isoDate})` : ""}.`,
    `- Hora actual aproximada: ${readableTime}.`,
    '- Si el cliente pregunta por "hoy", "mañana", agenda, vencimientos o fechas relativas, responde usando esta fecha del CRM. No inventes meses ni uses fechas de entrenamiento.',
    "- Esta fecha prevalece sobre cualquier fecha antigua escrita en el prompt, reglas aprendidas o historial.",
  ].join("\n");
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey });
}

async function requestOpenAiCompletion(params: {
  model: string;
  messages: any[];
  maxTokens: number;
  temperature: number;
}) {
  const completion = await getOpenAiClient().chat.completions.create({
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  });

  return {
    responseText: completion.choices[0]?.message?.content || "",
    tokensUsed: completion.usage?.total_tokens || 0,
    providerUsed: "openai" as const,
  };
}

async function requestGeminiCompletion(params: {
  model: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  maxTokens: number;
  temperature: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const contents = [
    ...params.conversationHistory.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    {
      role: "user",
      parts: [{ text: params.userMessage }],
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: params.systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: Math.min(params.maxTokens, 8192),
          // Disable "thinking" so the token budget goes to the actual WhatsApp reply.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      `Gemini request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const parts = payload?.candidates?.[0]?.content?.parts;
  const responseText = Array.isArray(parts)
    ? parts.map((part: any) => String(part?.text || "")).join("").trim()
    : "";
  const tokensUsed = Number(payload?.usageMetadata?.totalTokenCount || 0);

  return {
    responseText,
    tokensUsed,
    providerUsed: "gemini" as const,
  };
}

function getProductImageContext(product: Product) {
  const imageLines: string[] = [];
  const mainImage = resolvePublicImageUrl(product.imageUrl);
  const bottleImage = resolvePublicImageUrl(product.imageBottleUrl);
  const doseImage = resolvePublicImageUrl(product.imageDoseUrl);
  const ingredientsImage = resolvePublicImageUrl(product.imageIngredientsUrl);
  if (mainImage) imageLines.push(`Imagen principal: ${mainImage}`);
  if (bottleImage) imageLines.push(`Imagen frasco: ${bottleImage}`);
  if (doseImage) imageLines.push(`Imagen dosis: ${doseImage}`);
  if (ingredientsImage) imageLines.push(`Imagen ingredientes: ${ingredientsImage}`);
  return imageLines.join("\n");
}

export async function generateAiResponse(
  conversationId: number,
  userMessage: string,
  recentMessages: Message[],
  imageBase64?: string, // Optional: base64 encoded image for vision analysis
  advisorName?: string,
): Promise<{ response: string; imageUrl?: string; tokensUsed: number; orderReady?: boolean; needsHuman?: boolean; shouldCall?: boolean; orderStatus?: OrderStatus; cita?: { sede: string; startAt: string } } | null> {
  try {
    const [settings, allProducts, learnedRules] = await Promise.all([
      storage.getAiSettings(),
      storage.getProducts(),
      storage.getActiveLearnedRules(),
    ]);
    
    if (!settings?.enabled) {
      return null;
    }
    
    // Find products matching user's current message
    const matchingProducts = findMatchingProducts(userMessage, allProducts);
    
    // Get catalog from settings (fallback for products not in database)
    const catalog = settings.catalog || "";
    
    // SMART PRODUCT SEARCH LOGIC:
    // 1. First, AI uses instructions/system prompt
    // 2. If user mentions a product name, load that product info
    // 3. If asking specific question (like dosage) and no product in current message,
    //    look in conversation history for which product they're asking about
    
    let productContext = "";
    let productInContext: Product | null = null;
    
    if (matchingProducts.length > 0) {
      // User mentioned specific product(s) - include only those
      productContext = matchingProducts.map(p => 
        `${p.name} - ${p.price || "Consultar precio"}\n${p.description || ""}\n${getProductImageContext(p)}`
      ).join("\n\n");
      productInContext = matchingProducts[0];
    } else {
      // Check if it's a follow-up question about a product mentioned earlier
      const historyProduct = findProductInHistory(recentMessages, allProducts);
      if (historyProduct) {
        productContext = `${historyProduct.name} - ${historyProduct.price || "Consultar precio"}\n${historyProduct.description || ""}\n${getProductImageContext(historyProduct)}`;
        productInContext = historyProduct;
      } else if (isCatalogQuery(userMessage)) {
        // General product query without specific product - show list
        if (allProducts.length > 0) {
          productContext = "PRODUCTOS DISPONIBLES:\n" + allProducts.map(p => 
            `• ${p.name} - ${p.price || "Consultar"}`
          ).join("\n");
        } else if (catalog) {
          productContext = catalog.substring(0, 1500);
        }
      }
    }

    // Get previous messages for context (configurable, default 3)
    const historyCount = settings.conversationHistory || 3;
    const conversationHistory = recentMessages
      .slice(-(historyCount + 1), -1)
      .map((m) => ({
        role: m.direction === "in" ? "user" : "assistant",
        content: m.text || `[${m.type}]`,
      })) as Array<{ role: "user" | "assistant"; content: string }>;

    const resolvedAdvisorName = (advisorName || "").trim() || "Lexi";
    const promptTemplate = settings.systemPrompt || "Eres un asistente de ventas amigable.";
    let instructions = promptTemplate
      .replace(/\{\{\s*AGENT_NAME\s*\}\}/gi, resolvedAdvisorName)
      .replace(/\{\{\s*NOMBRE_AGENTE\s*\}\}/gi, resolvedAdvisorName);
    // Backward-compatible safety: if old prompt hardcodes "Isabella", map it to the active advisor.
    if (resolvedAdvisorName.toLowerCase() !== "isabella") {
      instructions = instructions
        .replace(/\bsoy\s+isabella\b/gi, `soy ${resolvedAdvisorName}`)
        .replace(/\bme\s+llamo\s+isabella\b/gi, `me llamo ${resolvedAdvisorName}`)
        .replace(/\bisabella\b/gi, resolvedAdvisorName);
    }
    
    const learnedRulesContext = learnedRules.length > 0 
      ? "\n=== REGLAS APRENDIDAS ===\n" + learnedRules.map(r => `- ${r.rule}`).join("\n")
      : "";
    const currentDateContext = buildCurrentDateContext();
    const availability = await getUpcomingAvailability();
    const availabilityContext = availability.context;
    
    // Build system prompt
    const systemPrompt = `NOMBRE DE ASESORA PARA ESTA CONVERSACION: ${resolvedAdvisorName}
REGLA INMUTABLE: Si te presentas o mencionas nombre de asesora, usa SIEMPRE "${resolvedAdvisorName}".
No uses otros nombres distintos al asignado.
${currentDateContext}
REGLA EDUCATIVA INMUTABLE (IQx es centro educativo presencial, NO vende productos):
- Nunca hables de envios, stock, pedidos ni pago contra entrega.
- Si preguntan por otra ciudad: explica con honestidad que el entrenamiento es presencial en Santa Cruz y deja la puerta abierta a visitar una sede.
- Tolera typos y respuestas de 1 palabra (ej: domigno=domingo, "la primera"=primera sede mencionada). Resuelve sin repreguntar.
- Mensajes de 2 a 3 lineas, 1 pregunta por turno, usa el nombre del cliente cuando lo sepas.

${instructions}

=== FECHA ACTUAL AUTORITATIVA ===
${currentDateContext}

=== REGLAS ===
- Responde en 2-3 líneas máximo (mensajes cortos tipo WhatsApp, nunca párrafos)
- UNA sola pregunta por mensaje. NUNCA preguntes dos cosas a la vez.
- Orden de recoleccion: problema/dolor -> nombre -> edad -> ciudad -> sede -> horario -> confirmar.
- Primer mensaje (saludo): presentate y pregunta el desafio + si es para el/ella o para su hijo/a (UNICA excepcion de doble pregunta). Luego, UNA sola pregunta por turno.
- Espejo emocional primero (valida lo que siente) y luego informa.
- PROHIBIDO jerga interna: no digas "Metodologia X", "pilares", "Ciclo X" ni siglas de programas (ACX, FLX, PTX, DMX, VTX, CRX) salvo que el cliente lo pregunte.
- NO uses [BOTONES:] ni [LISTA:] (son marca de bot). Todo el flujo es SOLO TEXTO; usa ▫️ para enumerar opciones si hace falta.
- Cuando des una direccion de sede, incluye SIEMPRE su link de mapa: Norte https://maps.app.goo.gl/dYeZVSYdkNckfgzb8 ; Centro https://maps.app.goo.gl/KJtHM4YEkt8iABBKA
- IDENTIDAD: si preguntan si eres bot/IA/robot/sistema/humana, NUNCA confirmes ni niegues. PROHIBIDO decir "soy un bot", "soy una IA", "soy un sistema", "soy un asistente digital". Evade con calidez y redirige. Nunca digas que pasaras la conversacion a un humano.
- ANTIRREPETICION: no repitas la misma pregunta igual dos veces. Si el cliente responde corto o ambiguo ("ok", "?", "info"), reformula distinto y ofrece 2 alternativas en texto. Si sigue ambiguo, ofrece "¿te muestro como funciona o prefieres que te contacte un Asesor?".
- CADA MENSAJE DEBE TERMINAR con UNA pregunta o un siguiente paso claro. NUNCA dejes un mensaje solo informativo. Si diste una explicacion, cierra con una pregunta corta o un CTA a cita/llamada.
- Si el cliente responde ambiguo sobre el segmento ("mi", "yo", "para mi", "es mio"), NO asumas; confirma: "¿Es para ti o para tu hijo/a?".
- PRECIO: nunca inventes montos; no saltes al CTA, primero pregunta si es para el/ella o para su hijo/a.
- OBJECION DE VALOR ("esta caro"): no repitas el precio; reencuadra el valor (diagnostico inicial, medicion del avance, acompanamiento) y avanza.
- "SOLO PRECIOS / NO QUIERO CITA": tranquiliza ("sin compromiso") y continua sin presion.
- INFO POR CORREO: aclara que no usamos correo y ofrece resumir por aqui o que un Asesor llame.
- CIERRE (prioridad): tu objetivo es conseguir una CITA de diagnostico o una LLAMADA con Asesor. Cuando el cliente muestre interes real, propon cita/llamada; si acepta llamada, escribe [LLAMAR] al final.
- Si el cliente pide EXPLICITAMENTE cita/agendar ("quiero una cita", "cuando puedo ir", "quiero agendar"): NO descubras el problema; pide solo lo minimo (nombre, edad, sede) y ofrece HORARIOS de inmediato. Si ya sabes la sede, ofrece horarios al toque.
- El NOMBRE es opcional para agendar: no lo pidas mas de una vez. Si el cliente da otro dato, continua con sede/horario.
- Nunca bloquees el avance esperando un dato; ofrece igual el siguiente paso.
- Si dice "no quiero llamadas": no insistas con llamada; ofrece cita presencial.
- DESCONFIANZA ("es estafa"): responde con calma y datos concretos en TEXTO (web iqexponencial.com, TikTok, Facebook), sin listas ni botones.
- TEMA CLINICO (TDAH, autismo, dislexia): se honesta (no tratamos ni curamos; es entrenamiento cognitivo que acompaña) y deriva a profesional; nunca diagnostiques.
- En el turno del espejo emocional NO expliques lo que hacemos; solo valida lo que siente y pide el nombre.
- Usa el nombre del cliente en cada mensaje desde que lo sepas.
- Ciudades que SI cuentan como Santa Cruz (agendar normal): Santa Cruz de la Sierra, Cotoca, Warnes, Montero, La Guardia, El Torno, Porongo, Cuatro Canadas, Okinawa Uno, Mineros, Fernandez Alonso, San Julian, Pailon. Solo si es una ciudad claramente lejana usa el guion de honestidad.
- Tono humano y cálido
- Para enviar imagen usa: [IMAGEN: url]
- Para enviar botones interactivos (máximo 3 opciones, 20 caracteres cada una) usa: [BOTONES: opción1, opción2, opción3]. Ejemplo: Te paso opciones [BOTONES: Producto A, Producto B, Hablar con asesor]
- Para enviar una lista interactiva (hasta 10 opciones) usa: [LISTA: título del botón | opción1, opción2, opción3]. Ejemplo: Mira el catálogo [LISTA: Ver productos | Producto A, Producto B, Producto C]
- IMPORTANTE: Cuando las instrucciones mencionen "botones" o el cliente deba elegir entre opciones, SIEMPRE usa el formato [BOTONES:] o [LISTA:]. NUNCA escribas las opciones como texto plano con asteriscos o viñetas.
- IMPORTANTE: Puedes mover la conversacion a la columna de CIERRE EN PROCESO con el formato [ESTADO: pending] (al final de la respuesta, se quita del mensaje enviado). Usalo cuando la llamada o cita con el Asesor Educativo YA se realizo y el proceso de cierre esta en curso:
  - [ESTADO: pending]: cierre en proceso (la llamada/cita ya paso).
- IMPORTANTE: NUNCA uses [ESTADO: ready] ni [ESTADO: delivered]. Esas dos columnas (por cerrar y cerrado) las mueve manualmente el equipo humano del CRM, no la IA.
- IMPORTANTE: No inventes movimientos de columna si no hay suficiente avance; deja que el flujo natural de la conversacion lo determine.
- IMPORTANTE: NUNCA uses [PEDIDO_LISTO]. Ese marcador es de un negocio anterior y no aplica a IQx. Para cerrar el proceso de una llamada/cita usa [ESTADO: pending].
- Un cierre esta "en proceso" cuando la llamada o cita con el Asesor Educativo ya se realizo y solo falta el cierre comercial.
- Si NO puedes responder la pregunta con la información disponible, escribe exactamente [NECESITO_HUMANO] y no respondas nada más.
- Si el cliente pide que lo llamen (cualquier forma: "llámenme", "me pueden llamar", "prefiero llamada", "que me llame", "quiero hablar por teléfono"), o menciona llamada telefónica, o detectas que una llamada cerraría la venta, escribe [LLAMAR] al final SIEMPRE. Recuerda: ya tienes su número de WhatsApp, NO le pidas número.
${availabilityContext ? `\n=== HORARIOS DISPONIBLES (usa SOLO estos, nunca inventes) ===\n${availabilityContext}\n- Ofrece 2 opciones concretas (ej: "el jueves 17 a las 15:00 o 16:00").\n- Cuando el cliente confirme CUALQUIERA de las opciones (ej: "si", "la primera", "15:00", "me sirve"), DEBES escribir al final EXACTAMENTE el codigo del horario elegido: [CITA: C1] o [CITA: N2]. Usa el codigo (C1, C2, N1...) que aparece antes del "=".\n- Al confirmar, el texto debe AFIRMAR la reserva, NO volver a preguntar ni repetir la lista. Ejemplo: "¡Listo, Pepito! 🎉 Tu diagnóstico gratuito quedó reservado para el jueves 17 a las 15:00 en la Sede Norte (Av. Los Cusis #139). ¿Podrán venir ambos padres? 😊" seguido de [CITA: N1].\n- Si el cliente aun no eligio, ofrece 2 opciones y NO uses [CITA:] todavia.\n- Si no hay horario disponible, no uses [CITA:].` : ""}
${learnedRulesContext}
${productContext ? `\n=== PRODUCTOS ===\n${productContext}` : ""}`;

    // Build user message content - with or without image
    let userContent: any = userMessage;
    if (imageBase64) {
      // Vision format: array with text and image
      userContent = [
        { type: "text", text: userMessage || "El cliente envió esta imagen. Analízala y responde." },
        { 
          type: "image_url", 
          image_url: { 
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: "low" // Use low detail to save tokens
          } 
        }
      ];
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userContent },
    ];

    const configuredProvider = normalizeAiProvider(settings.aiProvider);
    const modelToUse = settings.model || getDefaultModelForProvider(configuredProvider);
    const maxTokensToUse = settings.maxTokens || 120;
    const temperatureToUse = (settings.temperature || 70) / 100; // Convert 0-100 to 0-1

    let responseText = "";
    let tokensUsed = 0;
    let providerUsed: AiProvider = "openai";

    const runProvider = async (p: AiProvider) => {
      if (p === "deepseek") {
        return requestDeepSeekCompletion({
          model: configuredProvider === "deepseek" ? modelToUse : getDefaultModelForProvider("deepseek"),
          systemPrompt,
          conversationHistory,
          userMessage,
          maxTokens: maxTokensToUse,
          temperature: temperatureToUse,
        });
      }
      if (p === "gemini") {
        return requestGeminiCompletion({
          model: configuredProvider === "gemini" ? modelToUse : getDefaultModelForProvider("gemini"),
          systemPrompt,
          conversationHistory,
          userMessage,
          maxTokens: maxTokensToUse,
          temperature: temperatureToUse,
        });
      }
      return requestOpenAiCompletion({
        model: configuredProvider === "openai" ? modelToUse : getDefaultModelForProvider("openai"),
        messages,
        maxTokens: maxTokensToUse,
        temperature: temperatureToUse,
      });
    };

    // Vision (image) only works through OpenAI here.
    const chain: AiProvider[] = [];
    if (imageBase64) {
      chain.push("openai");
    } else if (configuredProvider === "deepseek") {
      chain.push("deepseek", "gemini", "openai");
    } else if (configuredProvider === "gemini") {
      chain.push("gemini", "deepseek", "openai");
    } else {
      chain.push("openai", "deepseek", "gemini");
    }

    let lastError: unknown = null;
    for (const provider of chain) {
      try {
        const result = await runProvider(provider);
        if (result.responseText) {
          responseText = result.responseText;
          tokensUsed = result.tokensUsed;
          providerUsed = result.providerUsed;
          lastError = null;
          break;
        }
        lastError = new Error(`${provider} returned empty response`);
        console.warn(`[AI] ${provider} returned empty response, trying next provider`);
      } catch (err) {
        lastError = err;
        console.error(`[AI] ${provider} failed, trying next provider:`, err);
      }
    }
    if (!responseText) {
      throw lastError || new Error("All AI providers failed");
    }

    // Extract image URL if present
    const imageMatch = responseText.match(/\[IMAGEN:\s*([^\]]+)\]/i);
    let imageUrl: string | undefined;
    let cleanResponse = responseText;
    
    if (imageMatch) {
      imageUrl = resolvePublicImageUrl(imageMatch[1]);
      cleanResponse = cleanResponse.replace(imageMatch[0], "").trim();
    }

    // Check for explicit column/status marker: [ESTADO: pending|ready|delivered|ninguno]
    // Allows the AI to move the conversation between CRM columns based on the conversation.
    const statusMatch = cleanResponse.match(/\[ESTADO:\s*(pending|ready|delivered|ninguno)\]/i);
    let orderStatus: OrderStatus = null;
    let orderReady = false;
    if (statusMatch) {
      const rawStatus = statusMatch[1].toLowerCase();
      orderStatus = rawStatus === "ninguno" ? null : (rawStatus as OrderStatus);
      cleanResponse = cleanResponse.replace(statusMatch[0], "").trim();
      console.log("=== STATUS MARKER DETECTED ===", { conversationId, orderStatus });
    }

    // Backward-compatible: [PEDIDO_LISTO] maps to "ready"
    if (cleanResponse.includes("[PEDIDO_LISTO]")) {
      orderReady = true;
      cleanResponse = cleanResponse.replace(/\[PEDIDO_LISTO\]/gi, "").trim();
      console.log("=== ORDER READY DETECTED ===", { conversationId });
    }

    // Check if AI needs human help
    const needsHuman = cleanResponse.includes("[NECESITO_HUMANO]");
    if (needsHuman) {
      cleanResponse = cleanResponse.replace(/\[NECESITO_HUMANO\]/gi, "").trim();
      console.log("=== NEEDS HUMAN ATTENTION ===", { conversationId });
    }

    // Check if should call (NEUROVENTA or explicit request)
    let shouldCall = cleanResponse.includes("[LLAMAR]");
    if (shouldCall) {
      cleanResponse = cleanResponse.replace(/\[LLAMAR\]/gi, "").trim();
      console.log("=== SHOULD CALL DETECTED ===", { conversationId });
    }

    // Deterministic fallback: explicit call request from the client always flags [LLAMAR].
    if (!shouldCall) {
      const callRequestRe = /(ll[aá]m(en|ame|enme|enos|enlo|enla)|me pueden llamar|pueden llamarme|que me llame|prefiero (una )?llamada|quiero (una )?llamada|hablar por (tel[eé]fono|celular)|llamada telef[oó]nica|contacten(me|lo)|me llaman|ll[aá]menme)/i;
      if (callRequestRe.test(normalize(userMessage))) {
        shouldCall = true;
        console.log("=== SHOULD CALL (fallback por texto del cliente) ===", { conversationId });
      }
    }

    // Check for appointment marker: [CITA: C1] (slot code) or legacy [CITA: sede | ISO]
    const citaMatch = cleanResponse.match(/\[CITA:\s*([^\]]+)\]/i);
    let cita: { sede: string; startAt: string } | undefined;
    if (citaMatch) {
      const raw = citaMatch[1].trim();
      const token = raw.split("|")[0].trim().toUpperCase();
      const byCode = availability.slotsById[token];
      if (byCode) {
        cita = byCode;
        console.log("=== CITA MARKER (code) DETECTED ===", { conversationId, token, ...cita });
      } else {
        const legacy = raw.match(/^(centro|norte)\s*\|\s*(.+)$/i);
        if (legacy) {
          const parsed = new Date(legacy[2].trim());
          if (!Number.isNaN(parsed.getTime())) {
            cita = { sede: legacy[1].toLowerCase(), startAt: parsed.toISOString() };
            console.log("=== CITA MARKER (legacy) DETECTED ===", { conversationId, ...cita });
          }
        }
      }
      cleanResponse = cleanResponse.replace(citaMatch[0], "").trim();
    }

    // Fallback: short confirmation ("si", "la primera") after the AI offered times.
    if (!cita && !needsHuman) {
      const lastOut = [...recentMessages].reverse().find((m) => m.direction === "out");
      const fallback = detectSlotConfirmation(userMessage, lastOut?.text || "", availability.slotsById);
      if (fallback) {
        cita = fallback;
        console.log("=== CITA FALLBACK (confirmacion detectada) ===", { conversationId, ...cita });
      }
    }

    // Fallback anti "mensaje muerto": si la respuesta no trae pregunta ni CTA, agrega uno.
    const isClosing = /(adios|adi[oó]s|gracias|bye|chau|hasta luego|no me interesa)/i.test(normalize(userMessage));
    if (!needsHuman && !cita && !shouldCall && cleanResponse && !cleanResponse.includes("?") && !isClosing) {
      cleanResponse = `${cleanResponse.replace(/\s+$/, "")} ¿Te gustaría que coordinemos una cita o una llamada con un Asesor? 😊`;
      console.log("=== FALLBACK CTA (respuesta sin pregunta) ===", { conversationId });
    }

    storage.createAiLog({
      conversationId,
      userMessage,
      aiResponse: `[${providerUsed}] ${responseText}`,
      tokensUsed,
      success: true,
    }).catch(err => console.error("AI log error:", err));

    return { response: needsHuman ? "" : cleanResponse, imageUrl: needsHuman ? undefined : imageUrl, tokensUsed, orderReady, needsHuman, shouldCall, orderStatus, cita: needsHuman ? undefined : cita };
  } catch (error: any) {
    console.error("AI Error:", error);
    
    await storage.createAiLog({
      conversationId,
      userMessage,
      aiResponse: null,
      tokensUsed: 0,
      success: false,
      error: error.message,
    });

    return null;
  }
}
