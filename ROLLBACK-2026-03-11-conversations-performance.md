# Rollback Plan - 2026-03-11

## Solicitud
"Mejorar rapidez del Kanban/polling sin desconfigurar nada".

## Cambio aplicado
Optimización de carga de conversaciones para reducir payload y trabajo en frontend:

1. `GET /api/conversations` ahora soporta query params:
- `limit` (opcional): cantidad máxima de conversaciones.
- `before` (opcional): cursor por fecha (`updatedAt`) para paginación futura.

2. Filtro por agente movido a SQL (backend), evitando traer todo y filtrar en memoria.

3. Inbox usa `useConversations(limit)` y consulta solo la cantidad visible (50 inicial + 20 por "Ver más").

## Archivos modificados
- `server/storage.ts`
- `server/routes.ts`
- `client/src/hooks/use-inbox.ts`
- `client/src/pages/InboxPage.tsx`

## Validación rápida
1. Abrir inbox admin y agente.
2. Confirmar que carga inicial muestra 50 chats y `Ver más` agrega 20.
3. Ver en DevTools que `/api/conversations?limit=...` responde 200.
4. Confirmar que agente solo ve sus chats asignados.
5. Confirmar Analytics sigue cargando conversaciones (usa endpoint sin `limit`).

## Rollback seguro
### Opción A (recomendada si ya se subió a Git)
1. Identificar commit del cambio:
   - `git log --oneline -n 10`
2. Revertir sin perder historial:
   - `git revert <SHA_DEL_CAMBIO>`
3. Push:
   - `git push origin main`

### Opción B (rollback local por archivos específicos)
1. Recuperar versión previa de estos archivos:
   - `server/storage.ts`
   - `server/routes.ts`
   - `client/src/hooks/use-inbox.ts`
   - `client/src/pages/InboxPage.tsx`
2. Comando:
   - `git checkout <SHA_PREVIO> -- <archivo>` (repetir por archivo)
3. Verificar con `npm run check` y `npm run build`.

## Señales para rollback inmediato
- Inbox no muestra nuevos chats correctamente.
- Agentes ven chats no asignados o dejan de ver los suyos.
- Errores de 500 en `/api/conversations`.
- Se rompe botón "Ver más".
