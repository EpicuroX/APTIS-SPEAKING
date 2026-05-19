# Aptis Speaking · Simulador v4.2

Simulador HIPER-REALISTA del Aptis ESOL General Speaking. Objetivo: practicar muchísimo en condiciones reales de examen.

## 🆕 Novedades v4.2 (frente a v4)

1. **Cronómetros separados** — Las 3 preguntas de Partes 1, 2 y 3 se hacen una por una, cada una con su propio cronómetro. Como en el examen real.
2. **🔥 Simulacro Completo** — Modo nuevo: las 4 partes seguidas, 12 minutos sin pausas. Para hacer una vez por semana.
3. **📄 PDF descargable** — Al terminar un intento (o un simulacro completo), descarga un PDF con todas tus preguntas, respuestas y análisis. Lo subes al chat evaluador externo.
4. **Parte 1 rediseñada** — 10 temas oficiales del Aptis (hometown, hobbies, family, work, food, daily routine, travel, friends, weather, sport) con 3 plantillas escaladas (presente / pasado / futuro). 150 preguntas en banco solo en Parte 1.
5. **Fix del popover** — Los bocadillos ya cierran bien al tocar la ✕, fuera, o Escape.

## Cómo usarlo · flujo recomendado

```
Lunes/Miércoles  →  📚 Estructura (15 min) repasar plantillas
Martes/Jueves    →  🎯 Práctica suelta (20 min) una parte
Sábado           →  🔥 Simulacro completo (25 min) + PDF + evaluador externo
Domingo          →  Revisar feedback y apuntar mejoras
```

## Estructura

```
aptis-speaking-v4.2/
├── index.html
├── imsmanifest.xml
├── css/style.css
└── js/
    ├── scorm.js
    ├── motor.js
    ├── examen.js         (cronómetros separados + simulacro + PDF)
    └── contenidos/
        ├── kits-globales.json
        ├── parte-1.json    (10 temas, 3 plantillas escaladas, 150 preguntas)
        ├── parte-2.json
        ├── parte-3.json
        └── parte-4.json
```

## 6 modos

- **📚 Estructura** — Plantillas con texto fijo en negrita, huecos clicables (💬).
- **🔗 Conectores** — Catálogo por función con cuándo, dónde y ejemplo.
- **🔄 Aplicado** — Respuesta modelo completa para cada tema.
- **🃏 Tarjetas** — Flashcards de pasos y respuesta modelo.
- **🎯 Práctica** — Una parte aislada con cronómetros separados por pregunta.
- **🔥 Simulacro** — Las 4 partes seguidas, 12 min reales, PDF al final.

## Flujo del Simulacro Completo

1. Pulsas 🔥 Simulacro desde cualquier parte.
2. La app encadena Parte 1 → Parte 2 → Parte 3 → Parte 4 sin pausas.
3. Tema aleatorio en cada parte. Preguntas combinadas aleatoriamente.
4. Al terminar:
   - Análisis global automático (palabras, conectores, idioms, tiempos).
   - Resumen de tus respuestas por parte.
   - **📄 Descargar PDF completo** → archivo `aptis-simulacro-2026-05-18.pdf`.
   - **📋 Copiar prompt para Claude** → texto plano listo para pegar.
5. Subes el PDF al chat evaluador y recibes corrección global.

## Despliegue en GitHub Pages

1. Sube TODO el contenido a `/v4.2/` de tu repo.
2. Abre `https://TU-USUARIO.github.io/APTIS-SPEAKING/v4.2/`
3. (Recomendado) Crea acceso directo en pantalla de inicio del móvil.

## Niveles soportados

Chips de color por nivel CEFR:
- 🔵 A1-A2 (gris)
- 🟢 B1 (cyan)
- ✅ B2 (verde)
- 🟡 B2 alto (amarillo)
- 🔴 C1 (rojo)

## Banco de preguntas totales

| Parte | Temas | Preguntas |
|---|---|---|
| Parte 1 | 10 | 150 |
| Parte 2 | 8 | 72 |
| Parte 3 | 8 | 72 |
| Parte 4 | 10 | 94 |
| **Total** | **36** | **388** |

## Dependencias en runtime

- **Web Speech API** (nativa del navegador) — para reconocimiento de voz
- **jsPDF** — para generar el PDF; se carga bajo demanda desde CDN solo cuando pulsas el botón

## Datos persistentes (localStorage)

- Clave: `aptis_examen_v4_2`
- Guarda los últimos 50 intentos
- Borrable desde la pestaña 📊 Dashboard
