# NOTAS - Ajustes IQx (CRM WhatsApp)

> Archivo vivo de decisiones y contexto. Actualizar conforme el usuario aporte más información.
> Fecha de inicio: 2026-08-26

---

## 1. Contexto del negocio

- CRM clonado desde otro negocio (RYZTOR - suplementos: berberina, citrato de magnesio).
- **Este CRM es para IQx · Inteligencia eXponencial**: centro de entrenamiento y mejoramiento cognitivo (Metodología X).
- NO vende productos físicos. No aplican conceptos de "pedido", "envío", "pago contra entrega", "catálogo de suplementos".
- Dominio de producción: **https://iqexcelencia.com** (rebrand de IQMAXIMO). Repo: github.com/ceduardox/message-iq.git. Deploy en Railway.

## 2. Problema identificado: la IA responde "berberina / citrato"

- La tabla `products` está VACÍA en producción (dump railway_dump.sql: solo CREATE TABLE, sin INSERT).
- El re-enganche automático Stage 2 enviaba hardcodeado:
  "Si gusta, le muestro opciones segun lo que busca. [BOTONES: Ver catalogo, Ver precios, Hablar con asesor]"
  (server/follow-up.ts:187-188)
- Al presionar "Ver catálogo" la IA detecta "catálogo", no encuentra productos y por la regla "SIEMPRE usa [BOTONES:] o [LISTA:]" (ai-service.ts:361) inventa opciones → berberina/citrato.
- El AI Guard (BLOCKED_LEGACY_BUTTON_SETS, routes.ts:33) solo bloquea botones de diabetes, no berberina.

## 3. Cambios YA aplicados en código (no subidos a git)

### 3.1 Marcador flexible de columna: [ESTADO: ...]
- server/ai-service.ts: nuevo parseo de `[ESTADO: pending|ready|delivered|ninguno]`.
- `[PEDIDO_LISTO]` sigue como retrocompatible → mapea a `ready`.
- routes.ts: aplica `orderStatus` si la IA emite `[ESTADO: ...]`; si no, usa `orderReady` (legacy).

### 3.2 Reglas de columna definidas por el usuario
| Marcador | Columna | Quién la mueve |
|----------|---------|----------------|
| `[ESTADO: pending]` | Cierre en proceso (ya pasó la llamada/cita) | **IA** |
| `[ESTADO: ready]` | Por cerrar (listo para enviar) | **Solo manual** (prohibido a la IA) |
| `[ESTADO: delivered]` | Cerrado | **Solo manual** (prohibido a la IA) |
| `[LLAMAR]` | Esperando confirmación / cliente quiere o acepta llamada | **IA** |
| `[NECESITO_HUMANO]` | Interacción humana (IA no sabe responder) | **IA** |

- La IA tiene PROHIBIDO emitir `[ESTADO: ready]`, `[ESTADO: delivered]` y `[PEDIDO_LISTO]` (prompt inyectado).
- La IA solo mueve a `pending` = "cierre en proceso" (llamada/cita ya realizada, falta cierre comercial).

### 3.3 Ojosito en login (mostrar/ocultar contraseña)
- client/src/pages/LoginPage.tsx: botón Eye/EyeOff en el campo de contraseña. Aplica al login.

### 3.4 Fish Audio (TTS nuevo proveedor) - IMPLEMENTADO Y VERIFICADO
- Proveedor "fish" agregado en el CRM, igual que ElevenLabs (backend + BD + frontend + preview).
- API: https://api.fish.audio/v1/tts (POST) con header `model: s2.1-pro-free` (gratis hasta 31-ago).
- Listado de voces: GET https://api.fish.audio/model (self + es, sort task_count). El campo de ID es `_id`. `licensed=true` devuelve 0 → NO usar.
- Clave: FISH_API_KEY en .env (NO subir a git; .env está gitignored). VERIFICADA: listado y TTS funcionan.
- Columna BD: ai_settings.fish_voice_id VARCHAR(100) (schema.ts + bootstrap + storage ensure).
- server/routes.ts: getFishApiKey(), generateFishAudio(), integrado en generateTtsAudioBuffer (provider "fish"), endpoint /api/fish/voices, zod: ttsProvider incluye "fish", fishVoiceId.
- client/src/pages/AIAgentPage.tsx: botón proveedor "Fish Audio", grid de voces (search/select/preview), estado fishVoiceId, guardado en settings.
- FLUJO PRIMERA RESPUESTA EN AUDIO (PENDIENTE, sección 11.12): hoy solo responde audio si el cliente manda audio (routes.ts:767). Falta opción para primera respuesta siempre en audio.
- El preview en UI usa /api/tts/preview (genera audio real con la voz seleccionada). Para escuchar samples directos de la lista, el listado ya devuelve `preview_url` (samples[0].audio de Fish) pero la UI aún no lo reproduce en-grid (mismo comportamiento que ElevenLabs).

### 3.5 Clave Fish editable en FRONTEND (no en Coolify) + modos de audio (IMPLEMENTADO)
- El usuario NO quiere poner FISH_API_KEY en variables de entorno de Coolify/Railway. Quiere configurarla desde la UI.
- Nueva columna BD: ai_settings.fish_api_key TEXT (schema + bootstrap + storage ensure).
- server/routes.ts getFishApiKey() ahora es async: prioriza env FISH_API_KEY; si no existe, lee ai_settings.fishApiKey (guardada desde el frontend).
- TtsOptions.fishApiKey para pasar la clave guardada al TTS y al preview.
- Frontend (AIAgentPage): campo "Clave API de Fish Audio" con OJITO (Eye/EyeOff) para ocultar/mostrar la clave. Guardada vía /api/ai/settings (PATCH) con fishApiKey.
- Modos de audio configurables en /ai-agent (audioResponseEnabled activo):
  - "all": audio en TODAS las respuestas.
  - "first": audio SOLO en la primera respuesta de la conversación.
  - "until_second": audio en las 2 primeras respuestas.
  - Columna ai_settings.audio_mode VARCHAR(20) DEFAULT 'first'.
- Contador en memoria conversationAiResponseCount (Map<conversationId, n>) para saber cuántas respuestas IA ya se enviaron por conversación.
- REGLA FIJA DE PRECIOS: isPriceRelatedResponse() en routes.ts. Si la respuesta contiene palabras de precio/costo/oferta/pago (precio, cuánto cuesta, costo, valor, paga, Bs, $, oferta, promoción, etc.) NUNCA se envía audio, sin importar el modo elegido. Se registra en AUDIO_BLOCKED_PRICE.
- Previews y flujo de envío pasan fishApiKey desde settings.

### 3.6 PRIMERA RESPUESTA EN AUDIO PARA LEADS NUEVOS (IMPLEMENTADO)
- Un lead nuevo (conversación recién creada en el webhook) recibe su PRIMERA respuesta SIEMPRE en audio (bienvenida con voz "humana"), salvo la regla de precios.
- Implementación: flag `isNewConversation` en BufferedMessage (se marca al crear la conversación en el webhook) → se propaga por flushMessageBuffer → processAiResponse → shouldSendAudioForResponse retorna true si isNewConversation.
- El contador conversationAiResponseCount ahora se INICIALIZA desde el historial real (mensajes out tipo text) para que conversaciones existentes respeten el modo (first/until_second) aunque el servidor se reinicie.
- Los modos aplican igual: all=todas, first=primera, until_second=2 primeras. Para lead nuevo siempre suena la primera (es "first" implícito) + modo del usuario.
- IMPORTANTE: el audio de bienvenida requiere audioResponseEnabled activo en /ai-agent y el proveedor/voz configurados.

### 3.7 SISTEMA DE BANNERS PUBLICITARIOS (ad_id → texto) - IMPLEMENTADO
- Tabla BD: ad_banners (id, ad_id UNIQUE, problem_text, image_url, segment, is_active, created_at).
- Columna nueva en conversations: ad_id (se guarda el ad del referral que trajo al lead).
- Backend: CRUD /api/ad-banners (GET/POST/PATCH/DELETE, requireAdmin).
- Webhook: al recibir mensaje con ad_id, busca banner ACTIVO por ad_id; si existe, inyecta a messageForAi: [CONTEXTO DEL ANUNCIO: "texto del banner" (segmento)] para que la IA conecte con el problema.
- Frontend (/ai-agent): tarjeta "Publicidad / Banners" con:
  - Lista de banners (imagen thumbnail, ad_id, texto, segmento, toggle activo, editar, eliminar).
  - Botón "Nuevo anuncio" → modal RESPONSIVE: en móvil Sheet bottom (sube desde abajo), en PC Dialog centrado.
  - Campos: ad_id (obligatorio), texto del anuncio (obligatorio), imagen URL (opcional), segmento (opcional: hijos/adulto/universitario).
  - Toggle activar/desactivar (para cuando cambie la publicidad/imagen/video sin borrar).
- Cómo obtener ad_id: Meta Ads Manager → campaña → columna "ID del anuncio".
- NOTA: solo inyecta si el banner está Activo. Puede convivir con ad_lead_routing_rules (asignación de agente) que es independiente.
- Seguridad: endpoints requireAdmin; no borra datos al desactivar (toggle).

## 4. Flujo comercial definido por el usuario (IMPORTANTE)

### 4.1 Flujo de conversión (test como gancho)
```
DUDA ("solo quiero información")
→ Lexi ofrece el TEST DIAGNÓSTICO (valor/gancho)
→ El prospecto acepta
→ Se CONCRETA LA LLAMADA (con Asesor Educativo)
→ [El test se realiza después, en la oficina/cita]
```
ORDEN SIEMPRE: DUDA → TEST → ACUERDO → LLAMADA → VISITA/TEST EN OFICINA

- El test NO es online. Se realiza presencial en la sede.
- La llamada es el objetivo del chat. No agendar el test directamente por chat; el Asesor confirma en la llamada.
- El test es el "gancho" para concretar la llamada.

### 4.2 Propuesta de sección para el prompt (PENDIENTE de integrar)
```
## FLUJO DE DUDA → TEST → LLAMADA

Cuando el prospecto duda, pide "solo información" o no se decide a contactar:

1. Ofrece el DIAGNÓSTICO INICIAL como primer paso de valor:
   "Para orientarte bien, lo ideal es conocer su punto de partida en atención,
   memoria de trabajo, velocidad de procesamiento y comprensión. Hacemos un
   diagnóstico inicial en nuestra sede."

2. Cuando acepta hacer el test, concreta la LLAMADA para coordinar la visita:
   "Perfecto. Para coordinar tu visita, uno de nuestros Asesores Educativos se
   comunicará contigo y te explicará cómo funciona. ¿Qué día y horario te
   resulta más cómodo?"

3. La llamada es el objetivo: NO intentes agendar el test directamente por chat.
   El Asesor confirma agenda y datos en la llamada.

ORDEN SIEMPRE: DUDA → TEST → ACUERDO → LLAMADA → VISITA/TEST EN OFICINA
```

## 5. Títulos de columnas (PENDIENTE - decisión del usuario)

El usuario preguntó si los nombres actuales son correctos para este tipo de servicio.
Propuestas (NO aplicadas aún):
- Opción A (más alineada a servicio): "En seguimiento / Contacto coordinado / Atendido"
- Opción B (intermedia): "Pedido en proceso / Listo para coordinar / Atendido"
- Semántica real definida: pending=cierre en proceso (pasó la llamada), ready=por cerrar, delivered=cerrado.

Etiquetas actuales en código (4 archivos):
- ChatArea.tsx:1825-1841 (dropdown: Sin pedido / Pedido en proceso / Listo para entregar / Entregado)
- ConversationList.tsx:34-38 (Pedido en proceso / Listo para entregar / Entregado)
- KanbanView.tsx:473-475 (Pedido en Proceso / Listo para Enviar / Enviados y Entregados)
- AnalyticsPage.tsx (usa "Entregado")

## 6. Nuevo prompt Lexi

- Archivo: `NUEVO PROMT LEXI.txt` (505 líneas) - prompt maestro v8 conceptual.
- Aún NO está cargado como activo en producción (el activo en BD es v7.0 viejo en ai_settings.system_prompt).
- Para activarlo: pegarlo en `/ai-agent` como Prompt principal.
- PENDIENTE: integrar sección "DUDA → TEST → LLAMADA" y ajustar sección 10 (diagnóstico como gancho).
- Recomendaciones extra para el prompt:
  - CTA del test como gancho (NO online).
  - Regla anti-invención de catálogo: "Nunca inventes productos, servicios, precios ni opciones de catálogo que no estén listados. Si no hay información, ofrece la llamada con un Asesor Educativo."
  - Usar {{AGENT_NAME}} en vez de hardcodear "Lexi" (ai-service.ts ya reemplaza el placeholder).
  - Reforzar cierre: cuando acepte llamada, escribir [LLAMAR] al final.

## 7. Re-enganche automático (follow-up)

- server/follow-up.ts: Stage 1 (tras followUpMinutes, hoy 60) genera mensaje con IA usando el prompt.
- Stage 2 (5h después de Stage 1) enviaba mensaje hardcodeado genérico de catálogo → PROBLEMA (ver sección 2).
- PENDIENTE: eliminar/reemplazar Stage 2 hardcodeado por mensaje alineado a IQx (o generado por IA con el prompt Lexi). Stage 1 ya usa IA → OK.

## 8. Productos (programas IQx) - OPCIONAL

- La tabla `products` está vacía. Sirve para servicios/programas (nombre, keywords, descripción, precio, imágenes).
- OPCIÓN: cargar los 7 programas IQx como productos para que la IA no invente:
  ACX (Activación X 6-7), CNX (Conexión X 7-8), FLX (Fluidez X 8-10), PTX (Potencia X 11-14), DMX (Dominio X 15+), VTX (Vértice X 12+, vía paralela), CRX (Circuito X 8+).

## 9. Enlaces útiles (contexto)

- Test cerebral: https://www.iqexponencial.com/test-cerebral
- Web: https://www.iqexponencial.com/
- Sedes Santa Cruz: Norte (Av. Los Cusis #193, esq. Banzer), Centro (C. Cochabamba #694 esq. Saavedra, diagonal Torres CAINCO).

## 10. REGLAS DE SEGURIDAD EN PRODUCCIÓN

- El usuario tiene MIEDO de borrar cosas en producción (ya borró cosas antes por accidente).
- NINGÚN cambio debe borrar filas de BD. Los cambios son: UI, prompt (config), código (reversible).
- Antes de tocar producción, respaldar. Preferir cambios reversibles.

## 11. PUBLICIDAD: BANNERS DE PROBLEMA → ENGANCHE (NUEVO - CLAVE)

### 11.1 Banners de publicidad que usará (problemas que resuelve IQx)
- "Lee pero no comprende"
- "Estudia pero no retiene"
- "Se distrae con todo"
- "Estudia horas y aun así le va mal"
- "Estudia pero olvida todo en el examen"
- "Tarda horas en terminar sus tareas"
- "Lee páginas y no retiene"
- "Sabes el tema pero te bloqueas al exponer"
- "Tienes mil ideas y no logras enfocarte"
- "Tu mente se agita antes de terminar el día"

### 11.2 Modelo de enganche (tomado del ejemplo RYZTOR, validado por el usuario)
Flujo que SI FUNCIONA (RYZTOR):
1. Publicidad con PROBLEMA específico ("reduce azúcar en la sangre").
2. Cliente escribe "más info".
3. IA responde: saludo + **pregunta de opciones** para identificar el problema exacto.
4. Según la respuesta, IA explica **cómo el producto ayuda con ESE problema** (problema → mecanismo → beneficio).
5. Cierra con oferta/acción.

Ejemplo RYZTOR:
- Ad: "reduce azúcar en la sangre" → cliente: "más info"
- IA: "¡Hola! ¿Busca la Berberina para controlar azúcar, regular antojos y peso, o apoyar el hígado graso?"
- Cliente: "hígado graso" → IA: "La Berberina ayuda al metabolismo de las grasas... activa la enzima AMPK..."
- "¿Le gustaría que le comparta las ofertas de esta semana?"

### 11.3 Problema actual de la IA de IQx (según el usuario)
Su ejemplo de respuesta actual (Lexi) tiene estos defectos:
- Pide nombre/edad/para quién ANTES de dar valor (aburrido).
- "Dice mucho y al final como que no dice nada" → respuestas largas y genéricas.
- Ofrece "llamada con asesor" demasiado pronto y de forma genérica.
- No conecta con el problema específico del banner publicitario.

### 11.4 Diseño propuesto (MEJOR que el ejemplo del usuario)
- **Pasar el ad_id/banner a la IA como contexto** ("El prospecto vino por el banner: 'estudia y no retiene'") para que la respuesta inicial conecte con ese problema. HOY NO SE HACE (solo se usa para routing de agentes).
- **Primera respuesta = espejo del problema + pregunta de opciones** (NO pedir nombre/edad primero).
- **Mapa problema → capacidad → metodología**: tabla de problemas listados mapeados a pilares/programas de Metodología X.
- **CTA de cierre en 2 pasos**: primero ofrecer TEST GRATUITO (gancho), luego LLAMADA para coordinar.
- **Regla de brevedad**: respuestas cortas, no "decir mucho y no decir nada".

### 11.5 Mapa problema → solución IQx (para inyectar en prompt)
- "No retiene / olvida todo en el examen" → memoria de trabajo, codificación dual, repaso espaciado → POTENCIA X / FLUIDEZ X.
- "Se distrae con todo / no se enfoca" → atención selectiva y sostenida → CONEXIÓN X / ACTIVACIÓN X.
- "Lee y no comprende / no retiene lo leído" → comprensión lectora, decodificación ágil → FLUIDEZ X / DOMINIO X.
- "Se bloquea al exponer / sabes pero no comunicas" → proyección de impacto, oratoria → DOMINIO X / VÉRTICE X.
- "Tarda horas en tareas / no organiza" → funciones ejecutivas, organización, sistemas de estudio → POTENCIA X / VÉRTICE X.
- "Mente agitada antes de terminar el día" → regulación del nivel de alerta, autorregulación → Neuro-Activación / POTENCIA X.

### 11.6 Estructura de la primera respuesta ideal (enganche)
1. Reconocer el problema del banner (espejo).
2. Pregunta de opciones [BOTONES:] o [LISTA:] para afinar el problema.
3. (Tras respuesta) explicar 1-3 líneas cómo Metodología X trabaja ESA capacidad.
4. CTA: "¿Quieres esto? → agendamos una llamada con un Asesor para hacerte un test totalmente gratuito."

### 11.7 Origen de los leads (DECIDIDO por el usuario)
- **La mayoría llega por Meta Ads** → se detecta el banner vía `ad_id` (ya existe `extractAdIdFromIncomingMessage` en routes.ts:425, hoy solo usado para routing de agente). Se debe guardar mapeo `ad_id → descripción del banner` e inyectarlo a la IA como contexto.
- **Los que NO llegan por ads** → la IA debe preguntar con **3 opciones de los problemas MÁS VIRALES** (sin saber el banner). No pedir nombre/edad primero.

### 11.8 Las 3 opciones "más virales" para preguntar a los que NO vienen por ads
Selección preliminar de los problemas con más potencial viral (afinar con el usuario):
1. **Estudia pero no retiene / olvida todo en el examen** → memoria de trabajo, retención → Potencia X / Fluidez X
2. **Se distrae con todo / no logra enfocarse** → atención selectiva y sostenida → Conexión X / Activación X
3. **Lee pero no comprende / se bloquea al exponer** → comprensión + proyección → Fluidez X / Dominio X / Vértice X

PENDIENTE: confirmar con el usuario cuáles son exactamente las 3 más virales y en qué orden.

### 11.9 AUDIENCIA MIXTA (IMPORTANTE - decidido por el usuario)
- NO todos los leads son por los hijos. Hay tres segmentos:
  1. **Padres** preguntando por hijos (niños/adolescentes) → programas por edad ACX/CNX/FLX/PTX/DMX.
  2. **Adultos jóvenes / universitarios** preguntando por sí mismos → Potencia X / Dominio X / Vértice X.
  3. **Profesionales / mayores** → Dominio X / Vértice X (alto rendimiento, oratoria, estudio, trabajo).
- La pregunta de diagnóstico NO debe asumir "es para tu hijo/a". Debe permitir identificar SEGMENTO + PROBLEMA.
- El prompt y la primera respuesta deben adaptar el lenguaje según segmento (padre vs adulto que pregunta por sí mismo).

### 11.10 Botones vs Lista (análisis para no parecer bot)
- `[BOTONES:]` = respuesta rápida de WhatsApp. Máx 3 botones, 20 caracteres c/u. Aparecen como botones grandes bajo el mensaje.
- `[LISTA:]` = menú desplegable. Hasta 10 opciones, título de botón máx 20 chars, cada opción máx 24 chars.
- Percepción: los BOTONES grandes (quick reply) son el mecanismo nativo de chatbots de WhatsApp → el público los asocia con "bot". La LISTA es un menú desplegable más sutil, se percibe más como "catálogo/guía" y menos como bot.
- Recomendación de expertos: para leads fríos al inicio, evitar parecer bot → texto conversacional + LISTA (o pregunta abierta). Los botones convienen en respuestas avanzadas (ya hay contexto) o para micro-decisiones (sí/no/llamar).
- DECISIÓN PRELIMINAR: usar [LISTA:] en la pregunta de diagnóstico inicial (ambos casos A y B) porque (1) permite +3 opciones (segmento + problema + "otro"), (2) se ve menos como bot. Botones para CTA de cierre (llamada/sí).
- PENDIENTE: confirmar esta decisión con el usuario.

### 11.11 PRINCIPIO REORDENADO: NADA DE "BOT" (decisión fuerte del usuario)
- El usuario NO quiere que se vea como chatbot ni bot. A la gente le asusta.
- Quiere que el prospecto SIENTA que habla con un humano (idealmente un "alumno" / persona real de IQx).
- IMPLICACIÓN: la primera respuesta NO debe empezar con botones/listas (eso es marca de bot). Debe ser texto natural y conversacional.

### 11.12 PRIMERA RESPUESTA EN AUDIO (decisión del usuario)
- La primera respuesta (de bienvenida/saludo al nuevo lead) será en **AUDIO** (voz generada por IA), para dar sensación humana.
- HOY el audio solo se envía si el CLIENTE envía un audio (`wasAudioMessage && audioResponseEnabled`, routes.ts:767). NO se envía audio en la primera respuesta de un lead nuevo.
- PENDIENTE DE IMPLEMENTAR: opción para que la PRIMERA respuesta sea en audio siempre (o según config), además del texto.
- El sistema ya tiene TTS funcional: `sendAudioResponse` (routes.ts:1374), proveedores OpenAI/ElevenLabs, voz configurable en /ai-agent.
- Combinación ideal: **AUDIO (voz humana) + texto corto natural**, SIN botones en la primera interacción.

### 11.13 Modelo de primera respuesta "humana" (revisado)
1. **Audio** con saludo cálido y humano (no "Soy un bot", sino como persona).
2. **Texto breve** natural que acompaña el audio.
3. **NO botones** en el primer turno.
4. La pregunta de diagnóstico se hace en el SEGUNDO turno y de forma conversacional (o con lista sutil), no como robot con 3 botones.
5. El audio es el diferenciador: transmite calidez y humanidad que el texto no logra.
