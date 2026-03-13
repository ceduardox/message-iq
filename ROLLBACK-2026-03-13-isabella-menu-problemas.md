# Rollback Isabella 2026-03-13

## Objetivo
Restaurar exactamente el prompt maestro anterior al cambio de flujo comercial por problema, sin tocar reglas operativas, rutas, backend ni configuraciones ajenas.

## Snapshot exacto del estado anterior
Archivo de respaldo creado antes de editar:

`PROMPT_MAESTRO_ISABELLA_CORREGIDO.rollback-20260313-ventas-problema.txt`

Ese archivo contiene una copia integra del prompt maestro tal como estaba antes de este ajuste.

## Archivo modificado
Archivo activo editado:

`PROMPT_MAESTRO_ISABELLA_CORREGIDO.txt`

## Restauracion segura del archivo en el repo
Si desea volver al estado anterior del archivo:

1. Sustituya el contenido de `PROMPT_MAESTRO_ISABELLA_CORREGIDO.txt`
   por el contenido de `PROMPT_MAESTRO_ISABELLA_CORREGIDO.rollback-20260313-ventas-problema.txt`
2. Verifique que el nombre del archivo activo siga siendo exactamente:
   `PROMPT_MAESTRO_ISABELLA_CORREGIDO.txt`
3. No cambie nombres de tokens, URLs, reglas de ciudades, reglas de pago ni reglas de escalamiento.

## Restauracion si el prompt ya fue pegado en /ai-agent
El sistema usa el valor guardado en `settings.systemPrompt`.
Por eso, restaurar solo el archivo local NO cambia por si mismo lo que ya este cargado en el panel.

Si ya copio este prompt al panel `/ai-agent`, para volver al estado anterior haga esto:

1. Abra el archivo:
   `PROMPT_MAESTRO_ISABELLA_CORREGIDO.rollback-20260313-ventas-problema.txt`
2. Copie su contenido completo.
3. Abra `/ai-agent`.
4. Pegue ese contenido en el campo `System Prompt`.
5. Guarde los cambios.

## Alcance del cambio que revierte este rollback
Este rollback revierte solo el cambio comercial de:

- entrada inicial por problema
- submenu comercial por producto
- cambio de secuencia para pedir ciudad mas tarde

No requiere revertir:

- base de datos
- rutas del servidor
- componentes React
- integraciones WhatsApp
- reglas de ciudades habilitadas
- reglas de pago, envio, escalamiento o tokens backend

## Verificacion despues de restaurar
Revise que en el prompt activo vuelva a aparecer la estructura anterior de:

- primer contacto por producto con pregunta de ciudad inmediata
- ausencia del menu inicial:
  `Para la diabetes`
  `Para diabetes y bajar de peso`
  `Para estrenimiento y calambres`

## Nota operativa
El backup historico antiguo:

`PROMPT_MAESTRO_ISABELLA_CORREGIDO.backup-20260311-ordenado.txt`

no reemplaza este rollback, porque no necesariamente coincide con el estado exacto inmediatamente anterior a esta edicion.
