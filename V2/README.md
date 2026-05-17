# Aptis Speaking · Plantillas B2 (v2)

App de estudio basada en las **plantillas del Speaking Aptis**, pensada para
**memorizar la estructura y entender cómo se adapta a distintos temas**.

## Tres modos por cada Parte del examen

1. **📚 Aprender** · estructura desnuda. Cada hueco es clicable y muestra
   qué tipo de palabra va ahí + opciones de vocabulario B2.
2. **🔄 Ver aplicado** · la misma plantilla aplicada a 2 temas a la vez
   (vista comparada). Aquí ves de un vistazo qué cambia y qué se mantiene.
3. **🎯 Practicar** · pregunta tipo Aptis con un tema concreto. Tú piensas en
   voz alta. Luego pulsas "Ver respuesta modelo" y comparas.

## Temas incluidos (8)

Tecnología · Redes sociales · Trabajo remoto · Educación ·
Medio ambiente · Viajes · Salud · Familia

Cada parte tiene un ejemplo completo por cada tema. Total: 32 respuestas modelo.

## Secciones extra

- **📖 Vocabulario base** · conectores, adjetivos, phrasal verbs, idioms B2/C1.
- **🎯 Estrategia** · 6 consejos para el día del examen.
- **📊 Progreso** · seguimiento de uso por parte y modo.

## Estructura de archivos

```
aptis-speaking-v2/
├── imsmanifest.xml
├── index.html
├── README.md
├── css/style.css
└── js/
    ├── app.js
    ├── content.json   ← EDITA AQUÍ para cambiar contenido
    └── scorm.js
```

## Empaquetar para Moodle

```bash
cd aptis-speaking-v2
zip -r ../aptis-speaking-v2.zip . -x "*.DS_Store"
```

El `imsmanifest.xml` debe quedar en la raíz del ZIP.

## Probar en local

```bash
cd aptis-speaking-v2
python3 -m http.server 8000
# Abre http://localhost:8000
```

## Modificar el contenido

Toca `js/content.json`. La estructura es:

- `temas` · lista de temas. Añade un objeto y la app lo recoge automáticamente.
- `partes` · cada parte con sus pasos. Cada paso tiene `template`, `huecos`
  (con `opciones`), `trick`, `warning` opcional.
- `ejemplos_por_tema` · dentro de cada parte. **Cada tema debe tener entrada
  aquí** o la columna saldrá vacía.
- `vocabulario_base` · cualquier categoría con subcategorías y `items`.
- `estrategia` · lista plana de consejos.

Para añadir un tema nuevo:
1. Lo añades en `temas`.
2. Añades su ejemplo en `ejemplos_por_tema` dentro de cada parte (si no, sale vacío).

## Persistencia

- **Dentro de Moodle:** se sincroniza vía SCORM 1.2.
- **Fuera de Moodle:** se guarda en `localStorage` del navegador con la clave
  `aptis_speaking_v2`.

---

*v2.0 · Mayo 2026 · Proyecto personal de preparación Aptis ESOL*
