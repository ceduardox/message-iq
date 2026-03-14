# Rollback 2026-03-14 - Toggle Flujo Comercial Fijo

## Objetivo
Restaurar el comportamiento anterior al agregado del toggle `Usar Flujo Comercial Fijo`, sin desconfigurar el flujo principal de productos.

## Cambios incluidos en esta edicion
- UI en `/ai-agent` para activar o desactivar el flujo comercial fijo
- Backend que respeta ese toggle antes de ejecutar menus y respuestas forzadas de productos
- El toggle reutiliza internamente el campo existente `learning_mode` para evitar migraciones riesgosas

## Restauracion operativa inmediata
Si solo quiere volver al comportamiento de hoy sin tocar codigo:

1. Entre a `/ai-agent`
2. Deje activado `Usar Flujo Comercial Fijo`
3. Guarde configuracion

Con eso, el CRM vuelve a trabajar exactamente con el flujo fijo de productos.

## Restauracion de codigo
Si desea revertir completamente este cambio en codigo:

1. Restaurar estos archivos al estado anterior:
   - `shared/schema.ts`
   - `server/routes.ts`
   - `client/src/pages/AIAgentPage.tsx`
2. Revertir el commit que introdujo este toggle.

## Base de datos
Este cambio NO agrega columnas nuevas.

Importante:
- Se reutiliza el campo existente `learning_mode`
- No hace falta migracion para usar o revertir este toggle

## Verificacion despues del rollback
- En `/ai-agent` ya no debe aparecer el switch `Usar Flujo Comercial Fijo`
- El flujo fijo de productos debe volver a quedar siempre activo
- La conversacion debe seguir respondiendo como antes de este toggle

## Riesgo de rollback
- Bajo
- La columna nueva en la base puede quedarse sin impacto negativo
