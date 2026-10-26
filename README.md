# 📚 Read Nook — Tu rincón de lectura

Aplicación web de seguimiento de lecturas: registra tus libros, sigue tu progreso
página a página, ponte un reto anual, mira crecer tu estantería y explora tus
estadísticas de lectura.

## Funcionalidades

- **Inicio**: libros en curso con anillo de progreso, slider y avances rápidos
  (+10/+25 páginas), pendientes y resumen del reto anual.
- **Biblioteca**: búsqueda (título, autor y géneros), filtros por estado,
  ordenación y vista en rejilla o lista.
- **Estantería**: tu colección en baldas, como una librería de verdad.
- **Reto anual**: objetivo editable, anillo de progreso, hitos (25/50/75/100 %),
  indicador de ritmo y vitrina de libros completados.
- **Estadísticas**: páginas, nota media, libros por mes/día, géneros, formatos,
  idiomas, autores y distribución de puntuaciones (global, por año o por mes).
- **Ficha completa de libro**: portada, estado, puntuación con medias estrellas,
  formato, idioma, tags, sinopsis, notas y **diario lector** por sesiones.
- **Alta por ISBN** con autocompletado desde Google Books y Open Library.
- **Importación CSV** desde TheStoryGraph (arrastrar y soltar, con búsqueda de
  portadas por ISBN).
- **Libros sin portada**: se genera una portada tipográfica automática.
- **Biblioteca de ejemplo** con un clic si empiezas de cero.

## 🎨 Los 4 temas

Toda la interfaz usa *tokens* de diseño (variables CSS), así que cambiar de tema
recolorea la app entera —incluidos gráficos, estantería y portadas generadas—.
Se elige desde **Apariencia** (icono de paleta) o desde las muestras de la barra
lateral, y queda guardado en el servidor:

| Tema | Descripción |
|---|---|
| **Rincón cálido** | Papel crema, terracota y verde salvia, serif editorial (Fraunces). |
| **Minimal** | Neutros limpios, acento índigo, radios pequeños. Tipo Notion/Linear. |
| **Nocturno** | Tinta y dorado, siempre oscuro. Para leer de noche. |
| **Vibrante** | Violeta y rosa, formas muy redondeadas, tipografía Nunito. |

Todos (excepto Nocturno, oscuro por definición) tienen modo claro y oscuro.
El diseño es responsive: **barra lateral en PC** y **navegación inferior flotante
en móvil**, con modales que se convierten en hojas inferiores en pantallas pequeñas.

## Desarrollo

Necesitas dos procesos: la API (puerto 3001) y Vite (puerto 5173, con proxy a `/api`).

```bash
# 1) API
cd server && npm install && node index.js

# 2) Web (en otra terminal)
npm install && npm run dev
```

Abre http://localhost:5173 — si la biblioteca está vacía, usa
«Explorar con libros de ejemplo».

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |

## Producción (Docker)

```bash
docker compose up --build
```

Sirve la app en http://localhost:8080. Los datos persisten en un volumen
(`book-tracker-data`) con un único `db.json` (libros, tags, objetivo y tema).

## Estructura

```
src/
  App.tsx            Shell: sidebar (PC) + cabecera y barra inferior (móvil)
  index.css          Tokens de los 4 temas (claro/oscuro) y estilos base
  types.ts           Tipos y metadatos de estado/tema
  hooks.ts           Libros, ajustes (objetivo, tema, modo) y tags
  api.ts             Cliente de la API REST
  lib.ts             ISBN (Google Books/Open Library) y parser CSV StoryGraph
  demo.ts            Biblioteca de ejemplo
  components/
    ui.tsx           Primitivas: Modal, BookCover, badges, botones…
    ThemePicker.tsx  Selector de apariencia con vistas previas
    ReadingNow · Library · Bookshelf · ReadingChallenge · Statistics
    BookForm · JournalModal · ImportModal · TagManager · Charts · StarRating
server/
  index.js           API Express + servido del build en producción
```
