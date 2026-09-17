# Reporte: Lexi (IQx) vs Milagros/Intelimax + Selector de horario

Fecha: 2026-09-16. Solo reporte, sin cambios de código.

## 1. Fuente evaluada
- `G:\IQEXPONENCIAL\CONVERSACION\WhatsApp Unknown 2026-09-16 at 02.19.51\` (5 capturas + `promt/promt.txt`)
- Prompt actual: `NUEVO PROMT LEXI.txt` (529 líneas) + `PROMT ULTIMO.txt` (Lucia)
- Código: `server/ai-service.ts`, `server/routes.ts` (webhook), `client/src/pages/RemindersPage.tsx`

## 2. Competencia: flujo observado
1. "Quiero agendar cita" → se presenta Milagros + beneficio + 1 pregunta dolor.
2. "Lento" (1 palabra) → espejo emocional + pide nombre.
3. "Pepito" → usa nombre siempre + pide edad hijo.
4. "135" → no valida, sigue ("¡Excelente!") + pide ciudad con lista texto ■.
5. "Mexico" → filtro honesto (<12 presencial es método) + puerta abierta.
6. "Y si estuviera en Cochabamba" → vende diagnóstico 45min gratuito + CTA única.
7. "Si" → ofrece 2 slots (mañana 10 / pasado 2) → entiende "Domigno" → confirma + 2 sedes con maps.
8. "La primera" → resuelve a Sede Centro sin repreguntar → ficha Día/Hora/Sede + "¿vienen ambos padres?".

Claves: 2-4 líneas por mensaje, 1 pregunta/turno, 1 emoji al final, tolera typos, memoria de nombre 6+ turnos, texto ■ (no botones bot), cierre con ficha.

## 3. Fallas de Lexi (prompt)
- Prompt documento (pilares, Ciclo X, 7 programas) → "dice mucho, no dice nada".
- Orden frío ciudad+edad juntas; competencia: dolor → nombre → edad → ciudad.
- Sin slots nombre/edad/ciudad/día/hora/sede → olvida (history 3 agrava).
- Abuso `[BOTONES]/[LISTA]` turno 1 = marca bot (viola NOTAS 11.11).
- Sin tolerancia typos ("Domigno", "La primera"), sin validación ligera ("135").
- Sin guion fuera de cobertura, sin ficha Día/Hora/Sede, sin remate ambos padres.
- Doble identidad Lucia/usted vs Lexi/tú; basura legacy envíos en `ai-service.ts:344-347`; `maxTokens 120` corta fichas.
- Sedes con datos mal: Norte dice #193/2°-3° anillo, real #139/Banzer-Beni. Centro dice "diagonal CAINCO", real solo Cochabamba/Saavedra. Sin alias primera/segunda.
- Negrita `*texto* ,` con espacio rompe WA (WA exige `*texto*,` pegado).

## 4. Sedes correctas
- Centro: Av. Cochabamba No. 694, esq. Calle Saavedra.
- Norte: Av. Los Cusis #139, entre Banzer y Beni.

## 5. Calendario/selector horario
Tienes: `RemindersPage` Lista/Calendario/Agenda semanal, `reminderAt/Note/Color/Done`, 45min, push staff, `PATCH /reminder`.
Es multiuso (follow-ups), no solo citas → conviene tabla nueva `citas`, no mezclar.
Falta KISS:
1. `agent_availability (agentId, weekday, inicio, fin, sede, active)` — carga 1 vez.
2. Slots 45min por sede; libre = plantilla menos `reminderAt/citas` ±45min misma sede.
3. Reserva = crear cita + ficha auto WhatsApp Día/Hora/Sede.
4. Anti-doble + estados reservado/confirmado/asistió/canceló (hoy solo done).
5. Fase 2: tag IA `[CITA:]` como `[BOTONES]`.

## 6. Recomendación KISS
Prompt: corregir 2 direcciones + 3 reglas (alias, ficha, remate). Calendario: tabla citas separada reusando Agenda. Nada existente se rompe.
