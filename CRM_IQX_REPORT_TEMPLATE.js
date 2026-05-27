/**
 * Plantilla standalone para el CRM.
 *
 * Uso:
 *   const { renderIqxReadingReportHtml } = require("./CRM_IQX_REPORT_TEMPLATE");
 *   const html = renderIqxReadingReportHtml(reportJson, {
 *     logoSrc: "file:///app/assets/logo.png",
 *     qrSrc: "file:///app/assets/qr.png",
 *     website: "www.iqexponencial.com",
 *   });
 *
 * Luego convertir `html` a PDF/imagen con Playwright o Puppeteer.
 */

const BOLIVIA_REFERENCE = [
  { label: "7 anos", min: 60, max: 90, description: "Capacidad de comprender textos simples y cortos" },
  { label: "8 anos", min: 70, max: 110, description: "Comprende textos mas complejos con apoyo y contexto" },
  { label: "9 anos", min: 80, max: 120, description: "Capacidad de extraer informacion detallada de los textos" },
  { label: "10 anos", min: 90, max: 140, description: "Comprende textos narrativos y expositivos con fluidez" },
  { label: "11 anos", min: 100, max: 150, description: "Habilidad para analizar y sintetizar informacion leida" },
  { label: "12 anos", min: 110, max: 160, description: "Comprension profunda de textos variados y extensos" },
  { label: "13 a 14 anos", min: 150, max: 170, description: "Habilidad para analizar y sintetizar informacion leida" },
  { label: "15 a 17 anos", min: 150, max: 200, description: "Comprension profunda de textos variados y extensos" },
  { label: "18 anos en adelante", min: 200, max: null, description: "Comprension profunda de textos variados y extensos" },
];

const UNESCO_REFERENCE = [
  { label: "7 anos", min: 90, max: 110, description: "Capacidad de comprender textos simples y cortos" },
  { label: "8 y 9 anos", min: 110, max: 150, description: "Comprende textos mas complejos con apoyo y contexto" },
  { label: "10 y 11 anos", min: 150, max: 200, description: "Capacidad de extraer informacion detallada de los textos" },
  { label: "12 y 13 anos", min: 200, max: 250, description: "Comprende textos narrativos y expositivos con fluidez" },
  { label: "13 y 14 anos", min: 250, max: 300, description: "Habilidad para analizar y sintetizar informacion leida" },
  { label: "15 anos en adelante", min: 300, max: null, description: "Comprension profunda de textos variados y extensos" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseAge(value) {
  const age = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(age) ? age : null;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES");
}

function formatTime(seconds) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getBoliviaReferenceByAge(age) {
  if (age === null) return null;
  if (age <= 7) return BOLIVIA_REFERENCE[0];
  if (age === 8) return BOLIVIA_REFERENCE[1];
  if (age === 9) return BOLIVIA_REFERENCE[2];
  if (age === 10) return BOLIVIA_REFERENCE[3];
  if (age === 11) return BOLIVIA_REFERENCE[4];
  if (age === 12) return BOLIVIA_REFERENCE[5];
  if (age <= 14) return BOLIVIA_REFERENCE[6];
  if (age <= 17) return BOLIVIA_REFERENCE[7];
  return BOLIVIA_REFERENCE[8];
}

function getUnescoReferenceByAge(age) {
  if (age === null) return null;
  if (age <= 7) return UNESCO_REFERENCE[0];
  if (age <= 9) return UNESCO_REFERENCE[1];
  if (age <= 11) return UNESCO_REFERENCE[2];
  if (age <= 13) return UNESCO_REFERENCE[3];
  if (age <= 14) return UNESCO_REFERENCE[4];
  return UNESCO_REFERENCE[5];
}

function getEvaluationId(data) {
  const date = data.createdAt ? new Date(data.createdAt) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const raw = String(data.resultId || "").replace(/\D/g, "");
  const suffix = raw ? raw.slice(-3).padStart(3, "0") : "001";
  return `IQX-${yy}${mm}${dd}-${suffix}`;
}

function canInterpretReadingSpeed(data) {
  return (data.scores?.comprehension ?? 0) > 79;
}

function getNationalComparison(data) {
  const age = parseAge(data.student?.age);
  const ref = getBoliviaReferenceByAge(age);
  const speed = data.scores?.speedWpm ?? 0;
  if (!canInterpretReadingSpeed(data)) {
    return "No se puede valorar la velocidad lectora con la escala nacional porque la comprension presentada es menor al 80%. Primero debe priorizarse la comprension lectora.";
  }
  if (!ref || !speed) return "Sin datos suficientes para comparar con el parametro nacional.";
  if (speed < ref.min) return `Su velocidad lectora (${speed} PPM) esta por debajo del rango esperado para ${ref.label} (${ref.min}${ref.max ? ` - ${ref.max}` : "+"} PPM).`;
  if (ref.max !== null && speed > ref.max) return `Su velocidad lectora (${speed} PPM) esta por encima del rango esperado para ${ref.label} (${ref.min} - ${ref.max} PPM).`;
  return `Su velocidad lectora (${speed} PPM) se encuentra dentro del rango esperado para ${ref.label} (${ref.min}${ref.max ? ` - ${ref.max}` : "+"} PPM).`;
}

function getInternationalComparison(data) {
  const age = parseAge(data.student?.age);
  const ref = getUnescoReferenceByAge(age);
  const speed = data.scores?.speedWpm ?? 0;
  if (!canInterpretReadingSpeed(data)) {
    return "No se puede valorar la velocidad lectora con la escala internacional porque la comprension presentada es menor al 80%. Primero debe priorizarse la comprension lectora.";
  }
  if (!ref || !speed) return "Sin datos suficientes para comparar con el parametro internacional.";
  if (speed < ref.min) return `Su velocidad lectora (${speed} PPM) se encuentra por debajo del estandar internacional para ${ref.label} (${ref.min}${ref.max ? ` - ${ref.max}` : "+"} PPM). Existen oportunidades para mejorar.`;
  if (ref.max !== null && speed > ref.max) return `Su velocidad lectora (${speed} PPM) supera el estandar internacional de referencia para ${ref.label} (${ref.min} - ${ref.max} PPM).`;
  return `Su velocidad lectora (${speed} PPM) se encuentra dentro del estandar internacional para ${ref.label} (${ref.min}${ref.max ? ` - ${ref.max}` : "+"} PPM).`;
}

function getIqxLevel(data) {
  const comp = data.scores?.comprehension ?? 0;
  const speed = data.scores?.speedWpm ?? 0;
  const category = data.scores?.readerCategory;
  const unesco = getUnescoReferenceByAge(parseAge(data.student?.age));
  if (category === "LECTOR CON DIFICULTAD SEVERA") return 1;
  if (category === "LECTOR CON DIFICULTAD") return 2;
  if (category === "LECTOR REGULAR") return comp >= 70 ? 3 : 2;
  if (category === "LECTOR COMPETENTE" && unesco && speed >= unesco.min) return 5;
  if (category === "LECTOR COMPETENTE") return 4;
  return 3;
}

function getProfileDescription(category) {
  if (!category) return "Resultado en proceso de interpretacion.";
  if (category === "LECTOR COMPETENTE") return "Buen nivel de comprension y velocidad lectora.";
  if (category === "LECTOR REGULAR") return "Comprension funcional con margen claro para elevar la velocidad y consistencia.";
  if (category === "LECTOR CON DIFICULTAD") return "Necesita reforzar comprension y tecnica lectora para ganar precision.";
  return "Requiere apoyo prioritario en comprension y base lectora.";
}

function getProfileColor(category) {
  if (!category) return "#f97316";
  if (category.includes("COMPETENTE")) return "#16a34a";
  if (category.includes("REGULAR")) return "#eab308";
  if (category.includes("SEVERA")) return "#ef4444";
  return "#f97316";
}

function getStrengths(data) {
  const items = [];
  const comp = data.scores?.comprehension ?? 0;
  const speed = data.scores?.speedWpm ?? 0;
  const correct = data.scores?.correctAnswers ?? 0;
  const total = data.scores?.totalAnswers ?? 0;
  if (comp >= 80) items.push("Buena comprension general del texto.");
  if (speed >= 150) items.push("Velocidad lectora adecuada para su nivel.");
  if (correct >= Math.max(1, Math.ceil(total * 0.8))) items.push("Respuestas precisas y consistentes.");
  if ((data.scores?.questionsTimeSeconds ?? 0) <= 45) items.push("Tiempo de respuesta agil.");
  if (data.cognitiveProfile?.profile) items.push(`Perfil cognitivo identificado: ${data.cognitiveProfile.profile}.`);
  if (items.length === 0) items.push("Resultado util para definir un plan de entrenamiento inicial.");
  return items.slice(0, 5);
}

function getOpportunities(data) {
  const items = [];
  const comp = data.scores?.comprehension ?? 0;
  const speed = data.scores?.speedWpm ?? 0;
  const national = getBoliviaReferenceByAge(parseAge(data.student?.age));
  if (comp < 80) items.push("Profundizar la comprension antes de aumentar velocidad.");
  if (comp >= 80 && national && speed < national.min) items.push("Elevar la velocidad lectora hasta el rango esperado para su edad.");
  if ((data.scores?.questionsTimeSeconds ?? 0) > 60) items.push("Mejorar la rapidez de analisis al responder.");
  if (data.cognitiveProfile?.mainNeed) items.push(`Trabajar el area clave detectada: ${data.cognitiveProfile.mainNeed}.`);
  items.push("Desarrollar habitos de lectura con mayor constancia.");
  return [...new Set(items)].slice(0, 5);
}

function getProjection(data) {
  const focus = String(data.cognitiveProfile?.mainNeed || "").toLowerCase();
  const base = [
    { label: "Comprension profunda", value: "+30%" },
    { label: "Velocidad lectora", value: "+40%" },
    { label: "Retencion de informacion", value: "+35%" },
    { label: "Analisis y pensamiento critico", value: "+35%" },
  ];
  if (focus.includes("concentr")) base[2] = { label: "Concentracion sostenida", value: "+35%" };
  if (focus.includes("record")) base[2] = { label: "Retencion de informacion", value: "+40%" };
  return base;
}

function rangeText(row) {
  return `${row.min}${row.max ? ` - ${row.max}` : " en adelante"}`;
}

function renderReferenceRows(rows, selected, highlightClass) {
  return rows.map((row) => `
    <tr class="${selected && selected.label === row.label ? highlightClass : ""}">
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(rangeText(row))}</td>
      <td>${escapeHtml(row.description)}</td>
    </tr>
  `).join("");
}

function renderList(items, type) {
  return items.map((item) => `
    <li>
      <span class="${type === "strength" ? "dot-check" : "dot-warning"}">${type === "strength" ? iconSvg("check") : ""}</span>
      <span>${escapeHtml(item)}</span>
    </li>
  `).join("");
}

function iconSvg(name) {
  const attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths = {
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    spark: '<path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
  };
  return `<svg ${attrs}>${paths[name] || paths.spark}</svg>`;
}

export function renderIqxReadingReportHtml(data, options = {}) {
  const logoSrc = options.logoSrc || "https://iqexponencial.app/logo.png";
  const qrSrc = options.qrSrc || "";
  const website = options.website || "www.iqexponencial.com";
  const social = options.social || "SIGUENOS EN REDES SOCIALES @iqexponencial";
  const age = parseAge(data.student?.age);
  const bolivia = getBoliviaReferenceByAge(age);
  const unesco = getUnescoReferenceByAge(age);
  const iqxLevel = getIqxLevel(data);
  const category = data.scores?.readerCategory || "SIN PERFIL";
  const profileTitle = category.replace(/^LECTOR\s+/, "").trim() || "SIN PERFIL";
  const profileColor = getProfileColor(category);
  const strengths = getStrengths(data);
  const opportunities = getOpportunities(data);
  const projection = getProjection(data);
  const potentialText = iqxLevel >= 4 ? "POTENCIAL ALTO" : iqxLevel === 3 ? "POTENCIAL MEDIO" : "EN DESARROLLO";
  const recommendationTone = category === "LECTOR COMPETENTE" ? "un excelente potencial" : "oportunidades claras de crecimiento";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte IQX</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #0f172a;
      font-family: Inter, Arial, Helvetica, sans-serif;
    }
    .report {
      width: 1240px;
      background: #fff;
      padding: 28px;
    }
    .shell {
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 28px;
      background: #fff;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.16);
    }
    .top-grid {
      display: grid;
      grid-template-columns: 315px 1fr;
      background: #fff;
    }
    .brand {
      min-height: 164px;
      padding: 15px 34px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .brand img { width: 156px; height: auto; object-fit: contain; margin-bottom: 10px; }
    .brand .name { font-size: 13px; letter-spacing: .2em; color: #334155; font-weight: 700; }
    .brand .line { width: 190px; height: 3px; background: #06b6d4; margin: 10px 0 8px; }
    .brand .method { font-size: 10px; letter-spacing: .16em; color: #64748b; font-weight: 700; }
    .hero {
      position: relative;
      min-height: 88px;
      overflow: hidden;
      background: #071a3d;
      color: #fff;
      padding: 20px 44px;
    }
    .hero:before {
      content: "";
      position: absolute;
      left: -34px;
      top: -18px;
      width: 48px;
      height: 160px;
      transform: skewX(-12deg);
      background: linear-gradient(180deg, #22d3ee, #3b82f6);
    }
    .hero:after {
      content: "";
      position: absolute;
      left: -12px;
      top: -18px;
      width: 18px;
      height: 160px;
      transform: skewX(-12deg);
      background: rgba(255, 255, 255, .95);
    }
    .hero-content { padding-left: 38px; position: relative; z-index: 1; }
    .hero h1 { margin: 0; font-size: 39px; line-height: 1; font-weight: 900; letter-spacing: .04em; }
    .hero p { margin: 7px 0 0; font-size: 18px; font-weight: 700; letter-spacing: .03em; }
    .identity {
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 34px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .id-item { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .id-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #22d3ee, #14b8a6);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      flex: 0 0 auto;
    }
    .id-icon svg { width: 21px; height: 21px; }
    .id-item b { display: block; font-size: 13px; color: #334155; }
    .id-item span { display: block; font-size: 16px; color: #0f172a; font-weight: 700; line-height: 1.15; }
    .content { background: #f8fafc; padding: 18px 28px; }
    .profile-row { display: grid; grid-template-columns: 330px 1fr; gap: 22px; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 28px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .06);
    }
    .profile-card { padding: 18px; display: flex; gap: 16px; align-items: center; }
    .avatar {
      width: 104px;
      height: 104px;
      border-radius: 999px;
      border: 6px solid #67e8f9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0;
      color: #334155;
      flex: 0 0 auto;
      box-shadow: inset 0 2px 8px rgba(15, 23, 42, .08);
    }
    .avatar svg { width: 49px; height: 49px; }
    .eyebrow { color: #64748b; font-size: 13px; letter-spacing: .05em; font-weight: 900; margin: 0; }
    .profile-title { margin: 7px 0 0; font-size: 27px; line-height: .98; font-weight: 900; color: var(--profile-color); }
    .profile-desc { margin: 10px 0 0; color: #334155; font-size: 14px; line-height: 1.35; }
    .results-card { padding: 18px; }
    .pill {
      display: inline-flex;
      height: 42px;
      align-items: center;
      border-radius: 999px;
      padding: 0 24px;
      background: linear-gradient(90deg, #06b6d4, #3b82f6);
      color: #fff;
      font-size: 15px;
      font-weight: 900;
      margin-bottom: 18px;
    }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); }
    .metric { text-align: center; padding: 6px 18px; border-left: 1px solid #e2e8f0; }
    .metric:first-child { border-left: 0; }
    .metric .icon { height: 38px; line-height: 1; margin-bottom: 10px; display:flex; align-items:center; justify-content:center; }
    .metric .icon svg { width: 38px; height: 38px; }
    .metric h3 { min-height: 42px; margin: 0; display: flex; align-items: end; justify-content: center; font-size: 14px; line-height: 1.12; font-weight: 900; }
    .metric strong { display: block; margin-top: 13px; font-size: 43px; line-height: 1; font-weight: 900; }
    .metric span { display: block; margin-top: 6px; color: #64748b; font-size: 14px; font-weight: 600; }
    .section-title { display: flex; align-items: center; gap: 16px; margin: 18px 0; }
    .section-title:before, .section-title:after { content: ""; height: 1px; background: #cbd5e1; flex: 1; }
    .section-title h2 { margin: 0; color: #334155; font-size: 22px; font-weight: 900; letter-spacing: .03em; }
    .tables { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
    .table-card { overflow: hidden; border-radius: 22px; background: #fff; border: 1px solid #bfdbfe; }
    .table-card.green { border-color: #bbf7d0; }
    .table-head { padding: 10px 18px; color: #fff; font-size: 17px; font-weight: 900; }
    .table-head.green { background: linear-gradient(90deg, #16a34a, #10b981); }
    .table-head.blue { background: #0b3a72; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #eff6ff; text-align: left; padding: 9px 14px; color: #334155; }
    .green th { background: #f0fdf4; }
    td { border-top: 1px solid #e2e8f0; padding: 8px 14px; vertical-align: top; color: #475569; }
    td:first-child { color: #0f172a; font-weight: 700; }
    tr.hl-green td { background: rgba(240, 253, 244, .9); }
    tr.hl-blue td { background: rgba(239, 246, 255, .9); }
    .comparison {
      margin: 14px;
      padding: 13px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.35;
      font-weight: 600;
    }
    .comparison.green { border: 1px solid #bbf7d0; background: #f0fdf4; color: #14532d; }
    .comparison.blue { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e3a8a; }
    .analysis-grid { display: grid; grid-template-columns: 1.1fr .8fr 1fr; gap: 20px; margin-top: 20px; }
    .analysis-card { padding: 20px; border-radius: 22px; }
    .analysis-card h2 { margin: 0 0 12px; font-size: 22px; font-weight: 900; }
    .analysis-card h3 { margin: 11px 0 7px; font-size: 16px; font-weight: 900; }
    .analysis-card ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 14px; color: #334155; line-height: 1.32; }
    .analysis-card li { display: flex; gap: 8px; align-items: flex-start; }
    .dot-check { width: 18px; height: 18px; border-radius: 999px; background: #22c55e; color: #fff; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; margin-top: 1px; }
    .dot-check svg { width: 12px; height: 12px; }
    .dot-warning { width: 8px; height: 8px; border-radius: 999px; background: #f59e0b; flex: 0 0 auto; margin-top: 8px; }
    .level-card { padding: 20px; text-align: center; border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .level-title { font-size: 20px; font-weight: 900; margin-bottom: 14px; }
    .ring {
      width: 150px;
      height: 150px;
      border-radius: 999px;
      border: 12px solid #cffafe;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 0 10px #fff, 0 0 0 1px #e2e8f0;
    }
    .ring strong { font-size: 62px; line-height: .9; color: #0891b2; font-weight: 900; }
    .ring span { font-size: 16px; color: #475569; font-weight: 900; }
    .potential { margin: 14px 0 0; color: #059669; font-size: 22px; font-weight: 900; }
    .projection { display: grid; gap: 10px; margin-top: 14px; }
    .projection-item { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 10px 14px; }
    .projection-item b { font-size: 15px; }
    .projection-item strong { color: #10b981; font-size: 27px; font-weight: 900; }
    .blue-band {
      margin-top: 22px;
      border-radius: 24px;
      background: #0b2e63;
      color: #fff;
      padding: 17px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .blue-band h2 { margin: 0; font-size: 22px; font-weight: 900; line-height: 1.2; }
    .blue-band p { margin: 5px 0 0; color: #cffafe; font-size: 16px; }
    .cognitive-box { min-width: 390px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.1); border-radius: 16px; padding: 12px 14px; }
    .cognitive-box h3 { margin: 0 0 10px; font-size: 18px; }
    .cognitive-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 14px; font-size: 14px; }
    .cognitive-grid span { color: rgba(255,255,255,.65); }
    .recommendation-grid { display: grid; grid-template-columns: 1fr 260px; gap: 22px; margin-top: 22px; }
    .recommendation { padding: 20px; border-radius: 22px; }
    .recommendation h2 { margin: 0 0 10px; font-size: 22px; font-weight: 900; }
    .recommendation p { margin: 0; font-size: 16px; line-height: 1.4; color: #334155; }
    .mini-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .mini { border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; padding: 10px; font-size: 13px; }
    .mini span { color: #64748b; display: block; }
    .mini b { display: block; margin-top: 4px; font-size: 15px; color: #0f172a; }
    .qr-card { padding: 20px; text-align: center; border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .qr {
      width: 140px;
      height: 140px;
      border: 8px solid #e2e8f0;
      border-radius: 18px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .qr img { width: 100%; height: 100%; object-fit: cover; }
    .qr-placeholder {
      width: 100%;
      height: 100%;
      background:
        linear-gradient(45deg, #0f172a 25%, transparent 25%, transparent 75%, #0f172a 75%, #0f172a),
        linear-gradient(45deg, #0f172a 25%, transparent 25%, transparent 75%, #0f172a 75%, #0f172a);
      background-size: 24px 24px;
      background-position: 0 0, 12px 12px;
    }
    .qr-card h3 { margin: 12px 0 0; font-size: 16px; line-height: 1.25; }
    .footer { margin-top: 22px; border-radius: 22px; overflow: hidden; background: #081735; color: #fff; }
    .footer-grid { display: grid; grid-template-columns: 220px 1fr 220px; align-items: center; }
    .footer-icon { min-height: 160px; background: radial-gradient(circle at center, rgba(34,197,94,.35), transparent 60%); display: flex; align-items: center; justify-content: center; color: #67e8f9; }
    .footer-icon svg { width: 54px; height: 54px; }
    .footer-center { text-align: center; padding: 17px; }
    .footer-center h2 { margin: 0; font-size: 27px; font-weight: 900; letter-spacing: .03em; }
    .footer-center h3 { margin: 5px 0 0; font-size: 27px; color: #67e8f9; font-weight: 900; }
    .badges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
    .badges div { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); border-radius: 14px; padding: 10px 7px; font-size: 12px; font-weight: 700; }
    .footer-logo { display: flex; align-items: center; justify-content: center; padding: 24px; }
    .footer-logo img { height: 96px; width: auto; object-fit: contain; }
    .footer-bottom { background: #fff; color: #334155; display: flex; justify-content: space-between; padding: 12px 32px; font-size: 16px; font-weight: 700; }
  </style>
</head>
<body>
  <main class="report">
    <section class="shell">
      <div class="top-grid">
        <div class="brand">
          <img src="${escapeHtml(logoSrc)}" alt="IQX" />
          <div class="name">INTELIGENCIA EXPONENCIAL</div>
          <div class="line"></div>
          <div class="method">METODO X - NEUROACELERACION COGNITIVA</div>
        </div>
        <div>
          <div class="hero">
            <div class="hero-content">
              <h1>REPORTE DE RESULTADOS IQX</h1>
              <p>EVALUACION DE COMPRENSION LECTORA</p>
            </div>
          </div>
          <div class="identity">
            <div class="id-item"><div class="id-icon">${iconSvg("user")}</div><div><b>Alumno:</b><span>${escapeHtml(data.student?.name || "-")}</span></div></div>
            <div class="id-item"><div class="id-icon">${iconSvg("user")}</div><div><b>Edad:</b><span>${escapeHtml(data.student?.age ? `${data.student.age} anos` : "-")}</span></div></div>
            <div class="id-item"><div class="id-icon">${iconSvg("calendar")}</div><div><b>Fecha del Test:</b><span>${escapeHtml(formatDate(data.createdAt))}</span></div></div>
            <div class="id-item"><div class="id-icon">${iconSvg("shield")}</div><div><b>ID Evaluacion:</b><span>${escapeHtml(getEvaluationId(data))}</span></div></div>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="profile-row">
          <div class="card profile-card" style="--profile-color:${profileColor}">
            <div class="avatar">${iconSvg("user")}</div>
            <div>
              <p class="eyebrow">PERFIL OBTENIDO</p>
              <h2 class="profile-title">${escapeHtml(profileTitle)}</h2>
              <p class="profile-desc">${escapeHtml(getProfileDescription(category))} ${category === "LECTOR COMPETENTE" ? "Potencial para alcanzar niveles superiores." : "Hay espacio claro de mejora estructurada."}</p>
            </div>
          </div>

          <div class="card results-card">
            <div class="pill">RESULTADOS GENERALES</div>
            <div class="metrics">
              <div class="metric"><div class="icon" style="color:#06b6d4">${iconSvg("book")}</div><h3>COMPRENSION LECTORA</h3><strong>${escapeHtml(data.scores?.comprehension ?? 0)}%</strong><span>${escapeHtml(data.scores?.correctAnswers ?? 0)} de ${escapeHtml(data.scores?.totalAnswers ?? 0)}</span></div>
              <div class="metric"><div class="icon" style="color:#3b82f6">${iconSvg("gauge")}</div><h3>VELOCIDAD LECTORA</h3><strong>${escapeHtml(data.scores?.speedWpm ?? 0)}</strong><span>PPM</span></div>
              <div class="metric"><div class="icon" style="color:#8b5cf6">${iconSvg("clock")}</div><h3>TIEMPO DE LECTURA</h3><strong>${escapeHtml(formatTime(data.scores?.readingTimeSeconds))}</strong><span>min</span></div>
              <div class="metric"><div class="icon" style="color:#f97316">${iconSvg("target")}</div><h3>TIEMPO DE RESPUESTA</h3><strong>${escapeHtml(formatTime(data.scores?.questionsTimeSeconds))}</strong><span>seg</span></div>
            </div>
          </div>
        </div>

        <div class="section-title"><h2>COMPARATIVO CON PARAMETROS DE REFERENCIA</h2></div>

        <div class="tables">
          <div class="table-card green">
            <div class="table-head green">PARAMETRO NACIONAL - BOLIVIA</div>
            <table>
              <thead><tr><th>Rango de edad</th><th>Velocidad lectora (PPM)</th><th>Nivel de comprension</th></tr></thead>
              <tbody>${renderReferenceRows(BOLIVIA_REFERENCE, bolivia, "hl-green")}</tbody>
            </table>
            <div class="comparison green">${escapeHtml(getNationalComparison(data))}</div>
          </div>
          <div class="table-card">
            <div class="table-head blue">PARAMETRO INTERNACIONAL (UNESCO)</div>
            <table>
              <thead><tr><th>Rango de edad</th><th>Velocidad lectora (PPM)</th><th>Nivel de comprension</th></tr></thead>
              <tbody>${renderReferenceRows(UNESCO_REFERENCE, unesco, "hl-blue")}</tbody>
            </table>
            <div class="comparison blue">${escapeHtml(getInternationalComparison(data))}</div>
          </div>
        </div>

        <div class="analysis-grid">
          <div class="card analysis-card">
            <h2>ANALISIS IQX</h2>
            <h3 style="color:#16a34a">FORTALEZAS</h3>
            <ul>${renderList(strengths, "strength")}</ul>
            <h3 style="color:#f59e0b">AREAS DE OPORTUNIDAD</h3>
            <ul>${renderList(opportunities, "opportunity")}</ul>
          </div>
          <div class="card level-card">
            <div class="level-title">NIVEL IQX</div>
            <div class="ring"><strong>${escapeHtml(iqxLevel)}</strong><span>DE 5</span></div>
            <div class="potential">${escapeHtml(potentialText)}</div>
            <p class="profile-desc">${iqxLevel >= 4 ? "Buen desempeno con capacidad para alcanzar niveles superiores." : "Desempeno con oportunidad clara de mejora estructurada."}</p>
          </div>
          <div class="card analysis-card">
            <h2>PROYECCION DE MEJORA</h2>
            <p class="profile-desc">Con un entrenamiento cognitivo estructurado y constante, en las areas clave de IQX, podras mejorar:</p>
            <div class="projection">
              ${projection.map((item) => `<div class="projection-item"><b>${escapeHtml(item.label)}</b><strong>${escapeHtml(item.value)}</strong></div>`).join("")}
            </div>
          </div>
        </div>

        <div class="blue-band">
          <div>
            <h2>Entrenar tu cerebro es aprender mas rapido, comprender mejor y alcanzar tu maximo potencial.</h2>
            <p>En IQX te ayudamos a lograrlo.</p>
          </div>
          <div class="cognitive-box">
            <h3>Perfil Cognitivo IQX</h3>
            <div class="cognitive-grid">
              <div><span>Perfil:</span> <b>${escapeHtml(data.cognitiveProfile?.profile || "-")}</b></div>
              <div><span>Area clave:</span> <b>${escapeHtml(data.cognitiveProfile?.mainNeed || "-")}</b></div>
              <div><span>Interes:</span> <b>${escapeHtml(data.cognitiveProfile?.interest || "-")}</b></div>
              <div><span>Puntaje:</span> <b>${escapeHtml(data.cognitiveProfile?.score ?? "-")}</b></div>
            </div>
          </div>
        </div>

        <div class="recommendation-grid">
          <div class="card recommendation">
            <h2>RECOMENDACION IQX</h2>
            <p>Tu perfil muestra ${escapeHtml(recommendationTone)}. Con entrenamiento cognitivo personalizado podras mejorar tu comprension, velocidad lectora y rendimiento academico o profesional.</p>
            <div class="mini-grid">
              <div class="mini"><span>Texto leido</span><b>${escapeHtml(data.reading?.title || "-")}</b></div>
              <div class="mini"><span>Palabras</span><b>${escapeHtml(data.reading?.wordCount ?? "-")}</b></div>
              <div class="mini"><span>Institucion</span><b>${escapeHtml(data.student?.institution || "-")}</b></div>
            </div>
          </div>
          <div class="card qr-card">
            <div class="qr">${qrSrc ? `<img src="${escapeHtml(qrSrc)}" alt="QR" />` : `<div class="qr-placeholder"></div>`}</div>
            <h3>ESCANEA PARA CONOCER NUESTROS PROGRAMAS DE ENTRENAMIENTO</h3>
          </div>
        </div>

        <div class="footer">
          <div class="footer-grid">
            <div class="footer-icon">${iconSvg("spark")}</div>
            <div class="footer-center">
              <h2>TU MENTE TIENE UN POTENCIAL ILIMITADO.</h2>
              <h3>ENTRENALA. ACELERALA. TRANSFORMA TU FUTURO.</h3>
              <div class="badges">
                <div>Neurociencia aplicada</div>
                <div>Entrenamiento cognitivo</div>
                <div>Resultados medibles</div>
                <div>Metodo X comprobado</div>
              </div>
            </div>
            <div class="footer-logo"><img src="${escapeHtml(logoSrc)}" alt="IQX" /></div>
          </div>
          <div class="footer-bottom"><span>${escapeHtml(website)}</span><span>${escapeHtml(social)}</span></div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

