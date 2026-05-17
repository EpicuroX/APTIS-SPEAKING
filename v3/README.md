# Aptis Speaking · Simulador (v3)

Simulador completo del Speaking Aptis ESOL B2/C1.
Las 4 partes, cada una con 4 modos: Estructura · Aplicado · Tarjetas · Examen.

## Funciones clave del Modo Examen

- 🎲 **Tema aleatorio** de la lista de temas reales de Aptis.
- ⏱ **Cronómetros de verdad**: preparación + respuesta según parte.
- 🎤 **Reconocimiento de voz** (Web Speech API · Android Chrome).
- ⌨ Modo escribir como alternativa.
- 📊 **Análisis automático**: palabras, tiempos verbales, conectores B2, idioms.
- 📋 **Botón "Copiar prompt para Claude"** con tu respuesta + análisis para evaluación detallada.
- 📚 **Historial** de hasta 50 intentos guardado en localStorage.

## Estructura

```
aptis-speaking-v3/
├── imsmanifest.xml
├── index.html
├── css/style.css
├── js/
│   ├── scorm.js                  ← persistencia SCORM + localStorage
│   ├── motor.js                  ← navegación y los 3 primeros modos
│   ├── examen.js                 ← modo examen completo
│   └── contenidos/
│       ├── parte-1.json          ← preguntas personales
│       ├── parte-2.json          ← describir foto
│       ├── parte-3.json          ← comparar fotos
│       └── parte-4.json          ← tema abstracto (10 temas)
└── README.md
```

## Editar contenidos

Toca solo los `.json` de `js/contenidos/`. El motor no se toca nunca.

Cada parte tiene:
- `meta` · tiempos y formato visibles en cabecera
- `examen` · `preparacion_segundos`, `respuesta_segundos`, `subtareas`
- `pasos` · plantilla con huecos y opciones
- `kits_universales` · listas mágicas para improvisar
- `temas` · cada uno con `preguntas`, `respuesta_modelo`, `kit_sugerido`

Añadir un tema = añadir un objeto al array `temas`. Sin tocar código.

## Probar en local

```bash
cd aptis-speaking-v3
python3 -m http.server 8000
# Abre http://localhost:8000
```

## Empaquetar para Moodle

```bash
zip -r ../aptis-speaking-v3.zip . -x "*.DS_Store"
```

El `imsmanifest.xml` debe quedar en la raíz del ZIP.

## Subir a GitHub Pages

Sube TODO el contenido (no la carpeta envuelta) a la raíz del repo. Activa Pages
desde Settings → Pages, branch `main`, `/ (root)`.

## Importante para reconocimiento de voz

- **Android Chrome:** funciona ✓
- **Portátil Chrome / Edge:** funciona ✓
- **iPhone Safari:** muy limitado o no funciona
- **Firefox:** no funciona

En cualquier caso, el **modo escribir** funciona en todos.

---

*v3.0 · Mayo 2026 · Aptis ESOL B2/C1*
