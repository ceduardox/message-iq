# Rollback 2026-03-17 - PWA push chat direct open refuerzo

## Archivos modificados
- `server/routes.ts`
- `client/public/OneSignalSDKWorker.js`
- `client/src/main.tsx`

## Objetivo
- Priorizar apertura directa de chat en PWA usando `conversationId` en `data`.
- Evitar navegacion forzada por `url` cuando existe `conversationId`.
- Agregar debug de click push para diagnostico en dispositivo.

## Rollback rapido
1. Buscar commit:
   - `git log --oneline -n 10`
2. Revertir:
   - `git revert <commit_sha>`
3. Subir:
   - `git push origin main`
