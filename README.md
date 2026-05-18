# Aptis Speaking · Simulador v4

Simulador para preparar el **Aptis ESOL General Speaking** (techo C1) en móvil.

## 🆕 Novedades v4 (frente a v3)

1. **Pedagogía de conectores** — Modo nuevo "🔗 Conectores": cada conector con función (adición / contraste / causa / consecuencia / concesión / listado), CUÁNDO usarlo, DÓNDE va y ejemplo aplicado. Con chip de nivel CEFR.
2. **UX renovada** — Texto base en **negrita**, huecos como bocadillos amarillos con 💬. Toca un bocadillo y se abre un popover con opciones, ayuda, tipo de palabra y nivel CEFR de cada opción.
3. **Banco de preguntas combinadas** — 328 preguntas en banco repartidas en bloques A/B/C por tema. En modo examen se combinan aleatoriamente. Botón 🎲 para tirar otra combinación.
4. **Subida de nivel B2-alto / C1** — Modelos rehechos con idioms (a double-edged sword, in a nutshell, broaden my horizons…), phrasal verbs (unwind, switch off, lean towards…) e inversiones C1 opcionales (Were I to…, Not only can I…).
5. **Parte 1 con 6 pasos** — Plantilla "padre nuestro" del PDF original: introducción → opinión → razón 1 → razón 2 → ejemplo pasado simple → ejemplo pasado continuo + cierre con idiom.

## Estructura

```
aptis-speaking-v4/
├── index.html
├── imsmanifest.xml          (para SCORM/Moodle)
├── css/style.css
└── js/
    ├── scorm.js
    ├── motor.js             (UX + 5 modos)
    ├── examen.js            (con bancos combinados)
    └── contenidos/
        ├── kits-globales.json
        ├── parte-1.json     (6 pasos)
        ├── parte-2.json
        ├── parte-3.json
        └── parte-4.json
```

## Cómo subir a GitHub Pages

1. En tu repo `APTIS-SPEAKING`, crea una carpeta `/v4/`.
2. Sube TODOS los archivos de esta carpeta a `/v4/`.
3. Espera 1-2 min y abre: `https://TU-USUARIO.github.io/APTIS-SPEAKING/v4/`

(la barra final es importante).

## 5 modos

- **📚 Estructura** — Plantilla con texto fijo en negrita, huecos clicables (💬).
- **🔗 Conectores** — Catálogo por función con cuándo, dónde y ejemplo.
- **🔄 Aplicado** — Respuesta modelo completa para cada tema.
- **🃏 Tarjetas** — Flashcards de pasos y respuesta modelo.
- **🎯 Examen** — Simulacro con preguntas combinadas, voz, análisis automático.

## Funciones del modo examen

- Banco de preguntas en bloques A (qué) + B (cómo) + C (reflexión).
- Combinación aleatoria → cada intento es distinto aunque el tema sea igual.
- Reconocimiento de voz (Web Speech API) o textarea.
- Análisis automático: nº palabras, conectores B2, idioms B2/C1, tiempos verbales (8 detectables incluida la inversión C1).
- Puntuación 0-100% estimada.
- Botón "Copiar prompt para Claude" → genera evaluación detallada en chat externo.
- Historial 50 últimos intentos en localStorage.

## Niveles soportados

Las opciones de los bocadillos van etiquetadas con chips:
- 🔵 A1-A2 (gris) — básico
- 🟢 B1 (cyan)
- ✅ B2 (verde) — objetivo principal
- 🟡 B2 alto (amarillo) — para rascar C1
- 🔴 C1 (rojo) — inversiones, idioms, pasivas impersonales

## Banco de preguntas (totales)

| Parte | Temas | Preguntas |
|---|---|---|
| Parte 1 | 8 | 90 |
| Parte 2 | 8 | 72 |
| Parte 3 | 8 | 72 |
| Parte 4 | 10 | 94 |
| **Total** | **34** | **328** |
