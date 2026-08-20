# Integracion CRM - Reporte IQX de Lectura

Documento tecnico para que el CRM reciba el codigo enviado por WhatsApp, consulte IQeXponencial por API JSON, genere el PDF con el mismo estilo visual del reporte IQX y lo envie al usuario.

## Objetivo del flujo

1. El usuario termina su test de lectura en IQeXponencial.
2. IQeXponencial guarda el resultado y genera un codigo unico para ese resultado.
3. El boton del resultado abre WhatsApp al numero del CRM con el texto:

```text
Hola, quiero recibir mi informe completo IQX de lectura.
Codigo: IQX-R-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

4. El CRM detecta el codigo `IQX-R-...`.
5. El CRM consulta la API de IQeXponencial con ese codigo.
6. IQeXponencial responde un JSON completo del resultado.
7. El CRM renderiza el PDF con su propia plantilla, usando los datos recibidos.
8. El CRM envia el PDF al usuario por WhatsApp.

Importante: un mismo usuario puede hacer varios tests por dia. El codigo identifica un resultado especifico, no solamente al usuario.

## URL y autenticacion

Endpoint de produccion:

```http
GET https://iqexponencial.app/api/crm/reading-report/:code
```

Header obligatorio:

```http
Authorization: Bearer TU_CRM_API_KEY
```

La variable en IQeXponencial debe estar configurada como una de estas:

```env
CRM_API_KEY=clave-secreta-compartida-con-el-crm
```

Tambien se acepta:

```env
IQX_CRM_API_KEY=clave-secreta-compartida-con-el-crm
```

El CRM debe guardar la misma clave en sus variables de entorno.

## Formato del codigo

Formato recibido por WhatsApp:

```text
IQX-R-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Reglas:

- Prefijo fijo: `IQX-R-`.
- Despues del prefijo vienen 32 caracteres alfanumericos en mayuscula.
- El codigo corresponde internamente al `resultId` UUID del resultado, sin guiones.
- El CRM debe extraer el codigo con una expresion tipo:

```regex
IQX-R-[A-Z0-9]{32}
```

## Ejemplo de llamada desde el CRM

```bash
curl "https://iqexponencial.app/api/crm/reading-report/IQX-R-1234567890ABCDEF1234567890ABCDEF" \
  -H "Authorization: Bearer TU_CRM_API_KEY"
```

## Respuestas HTTP

```json
{
  "code": "IQX-R-1234567890ABCDEF1234567890ABCDEF",
  "resultId": "12345678-90ab-cdef-1234-567890abcdef",
  "reportType": "reading_iqx",
  "reportVersion": 1,
  "createdAt": "2026-05-26T20:30:00.000Z",
  "student": {},
  "reading": {},
  "scores": {},
  "cognitiveProfile": {},
  "source": {}
}
```

Estados esperados:

- `200 OK`: resultado encontrado.
- `400 Bad Request`: codigo invalido.
- `401 Unauthorized`: falta API key o es incorrecta.
- `404 Not Found`: codigo valido, pero resultado no encontrado o no es test de lectura.
- `503 Service Unavailable`: IQeXponencial no tiene configurada `CRM_API_KEY` o `IQX_CRM_API_KEY`.

## JSON completo esperado

```ts
type IqxReadingReportResponse = {
  code: string;
  resultId: string;
  reportType: "reading_iqx";
  reportVersion: number;
  createdAt: string | null;
  student: {
    name: string;
    email: string | null;
    phone: string | null;
    age: string | null;
    country: string | null;
    countryCode: string | null;
    state: string | null;
    city: string | null;
    grade: string | null;
    institution: string | null;
    studentType: string | null;
    semester: string | null;
    isProfessional: boolean | null;
    profession: string | null;
    occupation: string | null;
    workplace: string | null;
    comment: string | null;
  };
  reading: {
    category: string | null;
    title: string | null;
    wordCount: number | null;
    themeNumber: number | null;
    language: string | null;
    content: string | null;
  };
  scores: {
    comprehension: number | null;
    speedWpm: number | null;
    maxSpeedWpm: number | null;
    correctAnswers: number | null;
    totalAnswers: number | null;
    readingTimeSeconds: number | null;
    questionsTimeSeconds: number | null;
    readerCategory: string | null;
  };
  cognitiveProfile: {
    answers: unknown;
    score: number | null;
    profile: string | null;
    mainNeed: string | null;
    interest: string | null;
  };
  source: {
    sessionId: string | null;
    isPwa: boolean | null;
  };
};
```

## Campos principales para el PDF

Usar estos campos como base:

- Alumno: `student.name`
- Edad: `student.age`
- Fecha del test: `createdAt`
- ID evaluacion visual: generar en CRM como `IQX-YYMMDD-XXX`
- Perfil obtenido: `scores.readerCategory`
- Comprension lectora: `scores.comprehension`
- Respuestas correctas: `scores.correctAnswers` / `scores.totalAnswers`
- Velocidad lectora: `scores.speedWpm`
- Tiempo de lectura: `scores.readingTimeSeconds`
- Tiempo de respuesta: `scores.questionsTimeSeconds`
- Texto leido: `reading.title`
- Palabras: `reading.wordCount`
- Institucion: `student.institution`
- Perfil cognitivo: `cognitiveProfile.profile`
- Area clave: `cognitiveProfile.mainNeed`
- Interes: `cognitiveProfile.interest`
- Puntaje IQX: `cognitiveProfile.score`

## Estilo visual exacto del reporte actual

El reporte actual se renderiza como una pieza HTML ancha, pensada para capturarse como imagen/PDF.

Medidas base:

- Contenedor principal: `1240px` de ancho.
- Fondo externo: blanco.
- Padding general: `32px`.
- Tarjeta principal: borde `1px solid #e2e8f0`, radio `28px`, sombra `0 20px 60px rgba(15,23,42,0.16)`.
- Fuente base: sans-serif. Si el CRM puede cargar fuentes de marca, usar Gilroy/Myriad; si no, usar `Inter`, `Arial` o `system-ui`.

Paleta:

- Azul oscuro principal: `#071a3d`.
- Azul footer: `#081735`.
- Azul seccion recomendacion: `#0b2e63`.
- Azul parametro UNESCO: `#0b3a72`.
- Cian principal: `#06b6d4` / `#22d3ee`.
- Cian fuerte: `#0891b2`.
- Verde competente: `#22c55e`.
- Amarillo regular: `#eab308`.
- Naranja dificultad: `#f97316`.
- Rojo dificultad severa: `#ef4444`.
- Fondo gris suave: `#f8fafc`.
- Texto principal: `#0f172a`.
- Texto secundario: `#475569`.
- Bordes: `#e2e8f0`.

Logo:

- URL usada en IQeXponencial: `/logo.png`
- En PDF del CRM usar el logo oficial IQX en PNG transparente.
- Tamano del logo superior izquierdo: ancho aproximado `210px`.
- Tamano del logo inferior derecho: alto aproximado `96px`.

## Estructura del PDF

### 1. Encabezado

Grid de 2 columnas:

- Columna izquierda: `340px`.
- Columna derecha: resto.

Columna izquierda:

- Fondo blanco.
- Padding `40px` horizontal, `24px` vertical.
- Logo IQX.
- Texto: `INTELIGENCIA EXPONENCIAL`
- Separador cian: `220px x 3px`.
- Texto: `METODO X - NEUROACELERACION COGNITIVA`

Columna derecha:

- Banda superior azul oscuro `#071a3d`.
- Alto minimo `110px`.
- Texto grande: `REPORTE DE RESULTADOS IQX`
- Subtitulo: `EVALUACION DE COMPRENSION LECTORA`
- Decoracion lateral izquierda: dos franjas inclinadas, una cian/azul y una blanca.

Debajo de la banda:

Cuatro datos en grid:

1. Alumno.
2. Edad.
3. Fecha del Test.
4. ID Evaluacion.

Cada dato lleva icono dentro de cuadro redondeado con gradiente cian/teal.

### 2. Perfil y resultados generales

Grid de dos columnas:

- Izquierda: `360px`.
- Derecha: resto.
- Gap: `24px`.

Tarjeta perfil:

- Radio `28px`.
- Fondo blanco.
- Borde `#e2e8f0`.
- Avatar circular `128px`.
- Titulo pequeno: `PERFIL OBTENIDO`.
- Perfil grande:
  - `COMPETENTE`: verde.
  - `REGULAR`: amarillo.
  - `CON DIFICULTAD`: naranja.
  - `CON DIFICULTAD SEVERA`: rojo.

Tarjeta resultados:

- Titulo en pill con gradiente cian/azul: `RESULTADOS GENERALES`.
- Cuatro columnas:
  - Comprension lectora.
  - Velocidad lectora.
  - Tiempo de lectura.
  - Tiempo de respuesta.
- Numeros principales en tamano grande, aprox `48px`.

### 3. Comparativo con parametros

Titulo centrado:

```text
COMPARATIVO CON PARAMETROS DE REFERENCIA
```

Dos tablas:

- Izquierda: `PARAMETRO NACIONAL - BOLIVIA`, header verde.
- Derecha: `PARAMETRO INTERNACIONAL (UNESCO)`, header azul.

Tabla Bolivia:

| Rango de edad | Velocidad lectora PPM | Nivel de comprension |
|---|---:|---|
| 7 anos | 60 - 90 | Capacidad de comprender textos simples y cortos |
| 8 anos | 70 - 110 | Comprende textos mas complejos con apoyo y contexto |
| 9 anos | 80 - 120 | Capacidad de extraer informacion detallada de los textos |
| 10 anos | 90 - 140 | Comprende textos narrativos y expositivos con fluidez |
| 11 anos | 100 - 150 | Habilidad para analizar y sintetizar informacion leida |
| 12 anos | 110 - 160 | Comprension profunda de textos variados y extensos |
| 13 a 14 anos | 150 - 170 | Habilidad para analizar y sintetizar informacion leida |
| 15 a 17 anos | 150 - 200 | Comprension profunda de textos variados y extensos |
| 18 anos en adelante | 200+ | Comprension profunda de textos variados y extensos |

Tabla UNESCO:

| Rango de edad | Velocidad lectora PPM | Nivel de comprension |
|---|---:|---|
| 7 anos | 90 - 110 | Capacidad de comprender textos simples y cortos |
| 8 y 9 anos | 110 - 150 | Comprende textos mas complejos con apoyo y contexto |
| 10 y 11 anos | 150 - 200 | Capacidad de extraer informacion detallada de los textos |
| 12 y 13 anos | 200 - 250 | Comprende textos narrativos y expositivos con fluidez |
| 13 y 14 anos | 250 - 300 | Habilidad para analizar y sintetizar informacion leida |
| 15 anos en adelante | 300+ | Comprension profunda de textos variados y extensos |

Regla importante:

Si `scores.comprehension < 80`, no interpretar la velocidad con las escalas. Mostrar:

```text
No se puede valorar la velocidad lectora con la escala porque la comprension presentada es menor al 80%. Primero debe priorizarse la comprension lectora.
```

### 4. Analisis IQX, nivel y proyeccion

Grid de tres columnas:

1. `ANALISIS IQX`
   - Fortalezas.
   - Areas de oportunidad.
2. `NIVEL IQX`
   - Circulo de progreso.
   - Nivel de 1 a 5.
3. `PROYECCION DE MEJORA`
   - Comprension profunda `+30%`.
   - Velocidad lectora `+40%`.
   - Retencion de informacion `+35%`.
   - Analisis y pensamiento critico `+35%`.

### 5. Franja azul de perfil cognitivo

Fondo `#0b2e63`.

Texto principal:

```text
Entrenar tu cerebro es aprender mas rapido, comprender mejor y alcanzar tu maximo potencial.
```

Texto secundario:

```text
En IQX te ayudamos a lograrlo.
```

Si existen datos cognitivos, mostrar caja interna con:

- Perfil.
- Area clave.
- Interes.
- Puntaje.

### 6. Recomendacion IQX y QR

Grid:

- Izquierda: recomendacion IQX.
- Derecha: bloque QR.

Texto recomendacion:

```text
Tu perfil muestra [un excelente potencial / oportunidades claras de crecimiento]. Con entrenamiento cognitivo personalizado podras mejorar tu comprension, velocidad lectora y rendimiento academico o profesional.
```

Cards pequenas:

- Texto leido.
- Palabras.
- Institucion.

QR:

- Actualmente es referencial en el reporte visual.
- El CRM puede reemplazarlo por un QR real hacia una landing, plan, checkout o perfil del usuario.

### 7. Footer final

Fondo `#081735`.

Mensaje central:

```text
TU MENTE TIENE UN POTENCIAL ILIMITADO.
ENTRENALA. ACELERALA. TRANSFORMA TU FUTURO.
```

Badges:

- Neurociencia aplicada.
- Entrenamiento cognitivo.
- Resultados medibles.
- Metodo X comprobado.

Linea final blanca:

```text
www.iqexponencial.com
SIGUENOS EN REDES SOCIALES @iqexponencial
```

## Reglas de calculo para el CRM

### ID visual de evaluacion

```ts
function getEvaluationId(resultId: string, createdAt: string | null) {
  const date = createdAt ? new Date(createdAt) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const numeric = resultId.replace(/\D/g, "");
  const suffix = numeric ? numeric.slice(-3).padStart(3, "0") : "001";
  return `IQX-${yy}${mm}${dd}-${suffix}`;
}
```

### Tiempo

```ts
function formatTime(seconds: number | null) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
```

### Nivel IQX

```ts
function getIqxLevel(data: IqxReadingReportResponse) {
  const comp = data.scores.comprehension ?? 0;
  const speed = data.scores.speedWpm ?? 0;
  const category = data.scores.readerCategory;
  const unesco = getUnescoReferenceByAge(parseAge(data.student.age));

  if (category === "LECTOR CON DIFICULTAD SEVERA") return 1;
  if (category === "LECTOR CON DIFICULTAD") return 2;
  if (category === "LECTOR REGULAR") return comp >= 70 ? 3 : 2;
  if (category === "LECTOR COMPETENTE" && unesco && speed >= unesco.min) return 5;
  if (category === "LECTOR COMPETENTE") return 4;
  return 3;
}
```

### Descripcion de perfil

```ts
function getProfileDescription(category: string | null) {
  if (!category) return "Resultado en proceso de interpretacion.";
  if (category === "LECTOR COMPETENTE") return "Buen nivel de comprension y velocidad lectora.";
  if (category === "LECTOR REGULAR") return "Comprension funcional con margen claro para elevar la velocidad y consistencia.";
  if (category === "LECTOR CON DIFICULTAD") return "Necesita reforzar comprension y tecnica lectora para ganar precision.";
  return "Requiere apoyo prioritario en comprension y base lectora.";
}
```

## Recomendacion de implementacion en el CRM

Backend recomendado:

1. Escuchar mensajes entrantes de WhatsApp.
2. Extraer codigo con regex `IQX-R-[A-Z0-9]{32}`.
3. Consultar API de IQeXponencial.
4. Guardar en base de datos:
   - `code`
   - `resultId`
   - `phone`
   - `studentName`
   - JSON crudo recibido
   - URL/path del PDF generado
   - estado de envio
5. Renderizar HTML con la plantilla visual.
6. Convertir HTML a PDF.
7. Enviar PDF por WhatsApp.

Librerias recomendadas para PDF:

- Node.js: `puppeteer` o `playwright`.
- Python: `weasyprint` o `playwright`.

Configuracion sugerida de PDF:

- Tamano: `A4` horizontal o pagina personalizada basada en `1240px`.
- Si se quiere conservar exactamente la proporcion visual del reporte actual, renderizar HTML a `1240px` de ancho y exportar con escala ajustada.
- Fondo activado: `printBackground: true`.
- Margenes: `0` o muy bajos.

## Seguridad

- No exponer `CRM_API_KEY` en frontend.
- Solo el backend del CRM debe llamar este endpoint.
- Registrar cada consulta para auditoria.
- Si el codigo no existe, no inventar datos ni enviar PDF.
- Evitar reenviar PDF duplicado si el mismo codigo ya fue procesado, salvo que el usuario lo pida nuevamente.

## Nota sobre el admin de IQeXponencial

El boton actual del admin `Descargar reporte IQX` se mantiene independiente.

Ese boton sigue generando su reporte visual desde el admin. El nuevo flujo del CRM no reemplaza el admin; solamente permite que el usuario pida el informe por WhatsApp usando un codigo unico del resultado.

