## Rollback: Prompt Principal / Alternativo en `/ai-agent`

Fecha: 2026-03-14

### Objetivo del cambio
- Permitir guardar dos prompts en la UI de `/ai-agent`.
- Elegir cual prompt queda activo sin tocar migraciones ni desconfigurar el flujo actual.

### Archivos tocados
- `client/src/pages/AIAgentPage.tsx`
- `server/routes.ts`

### Como funciona
- El prompt principal y el alternativo se guardan en `ai_training_data` usando titulos reservados:
  - `__SYSTEM_PROMPT_PRIMARY__`
  - `__SYSTEM_PROMPT_SECONDARY__`
  - `__SYSTEM_PROMPT_ACTIVE__`
- El prompt activo tambien se copia a `ai_settings.systemPrompt` para no romper la logica actual.
- Esos registros reservados no aparecen en la lista normal de entrenamiento.

### Rollback seguro
1. Restaurar `client/src/pages/AIAgentPage.tsx` a la version anterior con un solo campo `systemPrompt`.
2. Restaurar `server/routes.ts` quitando:
   - `GET /api/ai/prompt-profiles`
   - `PATCH /api/ai/prompt-profiles`
   - helpers `getPromptProfiles`, `upsertPromptProfile`, `isHiddenPromptProfileTitle`
   - filtrado de titulos reservados en `/api/ai/training`
3. Mantener en `ai_settings.systemPrompt` el prompt que quiera seguir usando.

### Limpieza opcional de datos
- No hay migracion de base.
- Si quiere limpiar los registros ocultos despues del rollback, puede borrar de `ai_training_data` las filas con estos titulos:
  - `__SYSTEM_PROMPT_PRIMARY__`
  - `__SYSTEM_PROMPT_SECONDARY__`
  - `__SYSTEM_PROMPT_ACTIVE__`

### Riesgo
- Bajo.
- El rollback no requiere `db:push`.
