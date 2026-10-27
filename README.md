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
  Si hay sesiones en el diario, también muestra páginas por día/mes/año, días
  activos, media diaria, sesiones, rachas y libros con más actividad.
- **Ficha completa de libro**: portada, estado, puntuación con medias estrellas,
  formato, idioma, tags, sinopsis, notas y **diario lector** por sesiones.
- **Alta por ISBN** con autocompletado desde Google Books y Open Library.
- **Importación desde TheStoryGraph**: CSV oficial de la biblioteca y, si se
  quiere recuperar el avance por fechas, JSON/CSV del Reading Journal generado
  localmente con el extractor incluido. Se pueden subir juntos o aplicar el
  diario sobre libros que ya estén en Read Nook.
- **Libros sin portada**: se genera una portada tipográfica automática.
- **Biblioteca de ejemplo** con un clic si empiezas de cero.

## Importar el diario de StoryGraph

El CSV oficial de StoryGraph contiene datos por libro, pero no el historial de
avances del Reading Journal. Para recuperarlo sin introducir las sesiones a
mano:

1. Exporta la biblioteca desde StoryGraph (**Manage Account → Export**) si esos
   libros todavía no están en Read Nook.
2. Abre **Importar** en Read Nook y despliega «¿Aún no tienes el JSON? Prepara
   el extractor». Desde ahí puedes instalar o descargar
   `public/tools/storygraph-journal-exporter.user.js`.
3. Instala el userscript con Tampermonkey/Violentmonkey (o copia su contenido
   en la consola del navegador) y ábrelo en StoryGraph con tu sesión iniciada.
   El script trabaja solo en tu navegador: hace peticiones GET a StoryGraph,
   no pide contraseña ni cookies y no envía tus datos a Read Nook.
4. Ejecuta la exportación y descarga el **JSON** (recomendado) o el CSV gemelo.
5. Vuelve a Read Nook → **Importar**. Sube el CSV oficial, el diario, o ambos.
   Si la biblioteca ya está importada, sube solo el diario para no duplicar
   libros.

Read Nook vincula cada sesión por ID de StoryGraph, ISBN/UID o título y autor.
Convierte páginas acumuladas y porcentajes en páginas de cada sesión, conserva
las entradas manuales, separa las relecturas y usa el ID original de cada
avance para que reimportar el mismo archivo actualice sin duplicar. El extractor
también guarda la URL de la portada mostrada por StoryGraph; al importar, esa
portada sustituye a la que el libro tuviera en Read Nook, incluidos los libros
presentes en los metadatos del JSON aunque no tengan avances exportables. Si
StoryGraph no aporta ninguna, se conserva la actual. El informe final muestra entradas
nuevas/actualizadas, portadas sustituidas y libros sin coincidencia.

> El extractor solo puede recuperar avances que realmente se registraron en
> StoryGraph. Si un libro se marcó como leído retrospectivamente, puede que
> solo existan la fecha de inicio/fin o una única entrada; en ese caso no es
> posible reconstruir con exactitud cuántas páginas se leyeron cada día.

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
| `npm test` | Pruebas del parser y la fusión del diario de StoryGraph |

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
  storyGraphJournal.ts Parser JSON/CSV y fusión idempotente del diario
  demo.ts            Biblioteca de ejemplo
  components/
    ui.tsx           Primitivas: Modal, BookCover, badges, botones…
    ThemePicker.tsx  Selector de apariencia con vistas previas
    ReadingNow · Library · Bookshelf · ReadingChallenge · Statistics
    BookForm · JournalModal · ImportModal · TagManager · Charts · StarRating
public/tools/
  storygraph-journal-exporter.user.js  Extractor local del Reading Journal
tests/
  storyGraphJournal.test.mjs           Pruebas del importador del diario
server/
  index.js           API Express + servido del build en producción
```
