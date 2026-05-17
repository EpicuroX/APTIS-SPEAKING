# Aptis Speaking v1 · Paquete SCORM 1.2

Herramienta de memorización de las 28 frases-molde del Speaking Aptis (B2),
empaquetada como SCORM 1.2 para subir a Moodle.

## ¿Qué hace?

Tres vistas, nada más:

1. **Tarjetas** — anverso (función + truco), reverso (la frase con huecos `[X]`). Botones "La sé" / "No la sé" y lector "🔊 Escuchar" (Web Speech API, voz en-GB).
2. **Huecos** — la frase con 2-3 palabras-estructura ocultas. Escribes, comprueba, feedback inmediato.
3. **Progreso** — porcentaje de "La sé" por bloque y % de aciertos en huecos.

Filtros por bloque (A–F) en tarjetas y huecos. Filtro adicional por nivel (B2 / B2 alto) en tarjetas.

## Estructura

```
aptis-speaking-v1/
├── imsmanifest.xml         Manifiesto SCORM 1.2
├── index.html              Punto de entrada (3 vistas)
├── css/style.css           Estilos mobile-first
├── js/
│   ├── scorm.js            Wrapper SCORM 1.2 + fallback localStorage
│   ├── app.js              Lógica de la app
│   └── content.json        Las 28 frases (edítalo aquí)
└── README.md
```

## Empaquetar para Moodle

Desde la carpeta `aptis-speaking-v1`:

```bash
# Linux / macOS
cd aptis-speaking-v1
zip -r ../aptis-speaking-v1.zip . -x "*.DS_Store" "*.git*"
```

```powershell
# Windows (PowerShell)
Compress-Archive -Path .\aptis-speaking-v1\* -DestinationPath aptis-speaking-v1.zip
```

**Importante:** el `imsmanifest.xml` debe quedar en la **raíz** del ZIP, no dentro de una subcarpeta. Si tu ZIP queda como `aptis-speaking-v1/imsmanifest.xml`, Moodle no lo reconocerá.

## Subir a Moodle

1. En tu curso: **Añadir una actividad → Paquete SCORM**.
2. Nombre: "Aptis Speaking · Frases B2".
3. **Archivos**: arrastra `aptis-speaking-v1.zip`.
4. **Apariencia → Mostrar paquete**: "Nueva ventana" o "Frame actual", a tu gusto. En móvil va mejor en "Frame actual".
5. **Cualificación → Método de calificación**: "Calificación más alta". La nota = % de aciertos en huecos.
6. **Cualificación → Calificación máxima**: 100.
7. Guardar.

## Tracking SCORM

| Dato | Variable SCORM | Significado |
|---|---|---|
| Estado | `cmi.core.lesson_status` | `completed` si ≥ 70% de frases marcadas "La sé"; `incomplete` en otro caso |
| Nota | `cmi.core.score.raw` | % de aciertos en ejercicios de huecos (0–100) |
| Estado interno | `cmi.suspend_data` | JSON compacto con el estado de cada frase (máx. 4000 chars) |
| Intentos | `cmi.interactions.n` | Cada hueco contestado se registra como `fill-in` con `correct`/`wrong` |

Si la API SCORM no está disponible (uso fuera de Moodle, fallo de conexión), todo se guarda en `localStorage` con la clave `aptis_speaking_v1`.

## Probarlo en local (sin Moodle)

Necesitas un servidor estático porque `fetch('js/content.json')` no funciona con `file://`:

```bash
cd aptis-speaking-v1
python3 -m http.server 8000
# Abre http://localhost:8000
```

En este modo verás "Local (navegador)" en el dashboard. El progreso queda en `localStorage` del navegador.

## Editar las frases

Toca `js/content.json`. Cada frase tiene:

```json
{
  "id": "01",
  "block": "A",
  "level": "b2",              // "b2" o "b2-high"
  "function": "Abrir con...", // anverso: para qué sirve
  "trick": "OJO: no digas...", // anverso: truco mnemotécnico
  "template": "In my opinion, [X] is one of the most important...",
  "gaps": [
    { "answer": "most",      "hint": "superlativo" },
    { "answer": "important", "hint": "adjetivo clave" },
    { "answer": "nowadays",  "hint": "marcador temporal B2" }
  ]
}
```

**Reglas de edición:**

- `id`: cadena de 2 caracteres (`"01"` a `"28"`). Si añades más frases, sigue con `"29"`, `"30"`...
- `template`: usa apóstrofe recto (`'`), no tipográfico (`’`), para que la comparación funcione en móvil.
- Los `[huecos del alumno]` (`[X]`, `[verbo]`, `[ámbito]`) **se quedan visibles** en el ejercicio. No los pongas en `gaps`.
- En `gaps` solo van **palabras-estructura** que el alumno debe memorizar. La palabra debe existir en el `template` (la búsqueda es case-insensitive y por primera coincidencia no usada).
- Recomendado: 3 huecos por frase. 2 si la frase es muy corta.

## Compatibilidad

- Chrome / Edge / Firefox / Safari modernos.
- Móvil: probado mentalmente en iOS Safari y Chrome Android. Web Speech API es "best effort"; si no encuentra voz `en-GB`, usa la voz por defecto del sistema.
- Funciona offline una vez cargado.

## Limitaciones de esta v1

Por diseño NO incluye:

- Grabación de voz / comparación de pronunciación.
- Practica del Writing.
- Aplicación de las frases a temas concretos (eso es Fase 3-4 con Anki).
- Drag-and-drop, gamificación, badges.

Si esta v1 funciona en la práctica, esas funciones vienen en v2.

## Resolver problemas

- **"Error cargando content.json"** abriendo `index.html` con doble clic: navega con servidor (`python3 -m http.server`). `fetch` no funciona con `file://`.
- **Moodle no detecta el paquete:** comprueba que `imsmanifest.xml` está en la **raíz** del ZIP.
- **El botón "🔊 Escuchar" no suena en móvil:** algunos navegadores requieren un toque previo del usuario antes de permitir síntesis de voz. Toca cualquier botón antes y vuelve a probar.
- **El progreso no se guarda al cerrar:** asegúrate de salir a través de Moodle (no cerrar la pestaña sin más). En `beforeunload` se llama a `LMSCommit` + `LMSFinish`, pero algunos navegadores móviles cortan antes.

---

*v1.0 · Mayo 2026 · Proyecto personal de preparación Aptis ESOL*
