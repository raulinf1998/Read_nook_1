# 📚 Bilibook — Tu rincón de lectura

Aplicación web de seguimiento de lecturas: registra tus libros, sigue tu progreso
página a página, ponte un reto anual, mira crecer tu estantería y explora tus
estadísticas de lectura.

## Cuentas familiares

Bilibook ofrece dos cuentas sin contraseña: **Raúl** y **Pequeñaja**. Al abrirlo
por primera vez en cada navegador se elige una cuenta; una cookie recuerda esa
selección durante un año. En Ajustes se puede cambiar de cuenta. No es un sistema
de autenticación: cualquier persona con acceso a la aplicación puede cambiar de
cuenta. Si se borran las cookies, hay que volver a elegir.

Los libros, diarios, estadísticas, etiquetas, objetivo, apariencia y preferencias
pertenecen a cada cuenta. Los datos anteriores a esta versión pasan a Raúl; el
servidor guarda `db.before-accounts.json` antes de la primera escritura migrada.
Haz igualmente una copia de seguridad del volumen completo antes de actualizar.
El nuevo formato de datos no es compatible con servidores anteriores sin restaurar
la copia de seguridad. En Estantería puedes elegir tu colección o las dos juntas;
al abrir una portada de la otra cuenta, Bilibook pide confirmación para cambiar a
esa cuenta y abrir su ficha.

## Funcionalidades

- **Inicio**: libros en curso con anillo de progreso, slider y botón
  **Registrar avance**. El popup solo pide la fecha y la página o porcentaje
  alcanzado; Bilibook calcula las páginas de esa sesión. En el móvil se abre
  sobre la zona visible en la que estás (también con el teclado abierto), no
  al final de la página. También muestra pendientes y resumen del reto anual.
- **Biblioteca**: búsqueda (título, autor, saga y géneros), filtros por estado,
  ordenación (incluida **Autor · saga · fecha**, que mantiene juntas las sagas
  de cada autor y las ordena por su primera publicación) y un selector con
  **10 formas de verla**: baldas de madera,
  lomos, baldas flotantes, vitrina, pilas, muro de portadas, galería con
  marcos, fichero de biblioteca, rejilla clásica y lista. La opción elegida se
  guarda en el servidor y se comparte entre dispositivos.
- **Sagas**: el nombre de una saga es clicable y abre su propia página
  (`#/saga/…`) con abanico de portadas, progreso de la colección, siguiente
  volumen recomendado, las portadas de la saga en una balda y la ruta de lectura ordenada. Si la
  numeración guardada salta un entero (por ejemplo, tienes el `#1` y el
  `#3`, pero no el `#2`), la ruta marca el hueco en tu colección.
- **Estantería**: solo las portadas, sin títulos, autores, notas ni estados, ordenadas siempre por autor y dentro de cada autor por saga, dentro de una librería clásica frontal lacada en crema con tapa y baldas de pino, laterales moldurados y patas.
- **Descubrir**: recomendación de próxima lectura según tus autores y géneros
  favoritos, ruleta lectora, joyas para releer y pendientes olvidados.
- **Reto anual**: objetivo editable, anillo de progreso, hitos (25/50/75/100 %),
  indicador de ritmo y vitrina de libros completados.
- **Estadísticas**: páginas, nota media, libros por mes/día, géneros, formatos,
  idiomas, autores y distribución de puntuaciones (global, por año o por mes).
  Cada gráfico puede verse como columnas, línea, área, filas o donut cuando el
  tipo de dato lo permite. Si hay sesiones en el diario, también muestra
  páginas por día/mes/año, días activos, media diaria, sesiones, rachas y
  libros con más actividad.
- **Ficha completa de libro**: al tocar una portada o un título se abre una
  página propia del libro (no el formulario de edición), con portada grande,
  estado (incluido «Abandonado»), puntuación con medias estrellas, formato,
  idioma amplio, páginas, fecha de publicación, saga y número dentro de la
  saga, tags, sinopsis, notas, actividad y el **diario lector abierto** por
  sesiones. Editar sigue estando disponible con su botón. La portada puede
  subirse desde el ordenador/móvil o copiarse desde una URL. El servidor la
  guarda automáticamente al crear, editar o importar libros —y al arrancar
  copia también las portadas antiguas que aún fueran externas—, para que siga
  viéndose aunque la URL original desaparezca. Las imágenes idénticas comparten
  un único archivo SHA-256; al sustituir o borrar una portada, el archivo
  anterior se elimina cuando ya no lo usa ningún otro libro.
- **Alta por ISBN** con autocompletado desde Google Books y Open Library.
- **Importación desde TheStoryGraph**: CSV oficial de la biblioteca y, si se
  quiere recuperar el avance por fechas, JSON/CSV del Reading Journal generado
  localmente con el extractor incluido. Se pueden subir juntos o aplicar el
  diario sobre libros que ya estén en Bilibook.
- **Libros sin portada**: se genera una portada tipográfica automática.
- **Lomos**: en la vista de lomos, Bilibook intenta primero una imagen de
  lomo asociada al ISBN mediante OpenCover y solo la usa si carga con una
  proporción plausible. Hoy no existe una fuente general fiable de
  fotografías reales de lomos para la mayoría de ediciones (Open Library y
  servicios similares publican la portada frontal), así que, cuando no hay
  imagen válida, compone un lomo legible con la portada guardada, título,
  autor, número de saga y un grosor según las páginas. Esa composición no se
  presenta como fotografía del lomo físico.
- **Biblioteca de ejemplo** con un clic si empiezas de cero.

## Importar el diario de StoryGraph

El CSV oficial de StoryGraph contiene datos por libro, pero no el historial de
avances del Reading Journal. Para recuperarlo sin introducir las sesiones a
mano:

1. Exporta la biblioteca desde StoryGraph (**Manage Account → Export**) si esos
   libros todavía no están en Bilibook.
2. Abre **Importar** en Bilibook y despliega «¿Aún no tienes el JSON? Prepara
   el extractor». Desde ahí puedes instalar o descargar
   `public/tools/storygraph-journal-exporter.user.js`.
3. Instala el userscript con Tampermonkey/Violentmonkey (o copia su contenido
   en la consola del navegador) y ábrelo en StoryGraph con tu sesión iniciada.
   El script trabaja solo en tu navegador: hace peticiones GET a StoryGraph,
   no pide contraseña ni cookies y no envía tus datos a Bilibook.
4. Ejecuta la exportación (extractor **1.0.6 o posterior**) y descarga el
   **JSON** (recomendado) o el CSV gemelo. Deja activada la opción de
   pendientes si también quieres traer los datos de tu lista *to read*. Antes
   de descargarlo, el registro indica cuántos libros traen portada, idioma,
   formato, páginas, fecha de publicación, estado, puntuación y saga.
5. Vuelve a Bilibook → **Importar**. Sube el CSV oficial, el diario, o ambos.
   Si la biblioteca ya está importada, sube solo el diario para no duplicar
   libros.

Bilibook vincula cada sesión por ID de StoryGraph, ISBN/UID o título y autor.
Convierte páginas acumuladas y porcentajes en páginas de cada sesión, conserva
las entradas manuales, separa las relecturas y usa el ID original de cada
avance para que reimportar el mismo archivo actualice sin duplicar. Si un
archivo o diario antiguo trae el total/100 % repetido en sesiones intermedias,
la ficha reconstruye la página alcanzada desde las páginas de sesión y la
página actual guardada; el extractor 1.0.6 ya no confunde anchos CSS de
maquetación con el porcentaje lector. Para las
portadas y datos, el extractor lee el panel de cada libro en StoryGraph
(`.book-pane[data-book-id]` → `.book-cover img`), con respaldo en la imagen
enlazada a `/books/{id}` y, si aún falta portada, ISBN, idioma, formato,
páginas o fecha de publicación, en la ficha individual del libro (visita que
también puede completar puntuación o saga si allí aparecen).
El estado se decide por la lista de origen (leídos, en lectura, abandonados o
pendientes), no por los botones de acción de StoryGraph. Guarda la portada
en `books[].coverUrl`, en cada entrada y en la columna `cover_url` del CSV;
los demás datos viajan también en `books[]`, entradas y columnas
`language`, `format`, `publish_date`, `read_status`, `rating`, `series` y
`series_position`. Al importar, un valor no vacío de StoryGraph actualiza el
libro vinculado (incluida la portada), también si el libro solo aparece en
los metadatos del JSON sin avances exportables, como un pendiente. Los
valores vacíos no borran datos introducidos a mano. La vista previa y el
informe final distinguen portadas recibidas, sustituidas, ya coincidentes,
no vinculadas, copias guardadas en el servidor y libros cuyos datos se han
completado; si el JSON trae `0` portadas, Bilibook lo avisa antes de importar.

> El extractor solo puede recuperar avances que realmente se registraron en
> StoryGraph. Si un libro se marcó como leído retrospectivamente, puede que
> solo existan la fecha de inicio/fin o una única entrada; en ese caso no es
> posible reconstruir con exactitud cuántas páginas se leyeron cada día.

## 🎨 Paletas y temas

Toda la interfaz usa *tokens* de diseño (variables CSS), así que cambiar de
paleta recolorea la app entera —incluidos gráficos, estantería y portadas
generadas—. Se elige desde **Ajustes → Apariencia** o desde las muestras
de la barra lateral, y queda guardado en el servidor:

| Paleta | Descripción |
|---|---|
| **Rincón cálido** | Papel crema, terracota y verde salvia, serif editorial (Fraunces). |
| **Minimal** | Neutros limpios, acento índigo, radios pequeños. Tipo Notion/Linear. |
| **Nocturno** | Tinta y dorado, siempre oscuro. Para leer de noche. |
| **Vibrante** | Violeta y rosa, formas muy redondeadas, tipografía Nunito. |
| **Océano** | Azul claro, espuma y turquesa. |
| **Bosque** | Verdes botánicos y dorados suaves. |
| **Atardecer** | Coral, ámbar y ciruela. |
| **Lavanda** | Lilas suaves con rosa y menta. |

También puedes crear paletas personalizadas: nombre, estilo base y seis colores
para los modos claro y oscuro. Bilibook deriva automáticamente bordes, textos
secundarios, estados, series de gráficos y baldas. Las paletas guardadas pueden
aplicarse, editarse y borrarse desde **Apariencia**.

La apariencia completa —tema, modo claro/oscuro y paletas personalizadas—, la
vista de Biblioteca y los tipos de gráficos se guardan en el servidor. Los
cambios llegan automáticamente a los dispositivos conectados mediante SSE;
si la conexión se interrumpe, se vuelve a consultar al recuperar el foco y cada
15 segundos. Los cambios de ajustes no confirmados se reintentan mientras la
página siga abierta; si se cierra antes de confirmarlos no se garantiza su
conservación. **Ajustes** muestra si el servidor confirmó el cambio o si hay
un problema, sin exigir ninguna acción para sincronizar.

En producción, Express entrega el HTML sin caché con los ajustes actuales
incrustados. Al actualizar desde una versión anterior, las paletas que solo
estuvieran en un navegador se intentan subir en segundo plano sin bloquear los
ajustes del servidor ni activar una selección antigua. Las antiguas preferencias
locales de vista y gráficos no se importan automáticamente para evitar que un
dispositivo sobrescriba las del servidor.

Todos los temas integrados (excepto Nocturno, oscuro por definición) tienen
modo claro y oscuro. Una paleta personalizada con base Nocturno sí puede usar
su variante clara guardada.
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
| `npm test` | Pruebas del diario de StoryGraph, extractor y paletas personalizadas |

## Producción (Docker)

```bash
docker compose up --build
```

Sirve la app en http://localhost:8080. Los datos persisten en un volumen
(`book-tracker-data`): `db.json` guarda libros, tags, objetivo, apariencia, vista de biblioteca y preferencias de gráficos, y la
carpeta `covers/` guarda automáticamente las portadas subidas, enlazadas o
importadas (nombre = hash SHA-256). La misma imagen se almacena una sola vez;
al sustituirla, quitarla o borrar el libro se retira el archivo anterior si
ningún otro libro lo comparte, y al arrancar se limpian huérfanos antiguos.

## Estructura

```
src/
  App.tsx            Shell: sidebar (PC) + cabecera y barra inferior (móvil)
  index.css          Tokens de las 8 paletas (claro/oscuro) y estilos base
  types.ts           Tipos y metadatos de estado/tema
  themePalettes.ts   Validación y generación de paletas personalizadas
  hooks.ts           Libros, ajustes (objetivo, tema, paletas, modo) y tags
  api.ts             Cliente de la API REST
  lib.ts             ISBN (Google Books/Open Library) y parser CSV StoryGraph
  bookMetadata.ts    Normalización de idioma, formato, fecha, estado y saga
  series.ts          Agrupación, orden por autor/fecha y huecos de sagas
  bookSpine.ts       ISBN-13, candidato de lomo y grosor visual
  libraryViews.ts    Las 10 vistas disponibles en Biblioteca
  storyGraphJournal.ts Parser JSON/CSV y fusión idempotente del diario
  coverStorage.ts    Copia de portadas externas en el servidor
  demo.ts            Biblioteca de ejemplo
  components/
    ui.tsx           Primitivas: Modal, BookCover, badges, botones…
    ThemePicker.tsx  Selector de apariencia con vistas previas
    SettingsMenu.tsx Menú superior de ajustes y sincronización
    ReadingNow · Library · LibraryViews · Bookshelf · Discover · ReadingChallenge · Statistics
    BookDetail · SeriesDetail · BookForm · JournalModal · ImportModal · TagManager · Charts · StarRating
public/tools/
  storygraph-journal-exporter.user.js  Extractor local del Reading Journal
tests/
  storyGraphJournal.test.mjs           Pruebas del importador del diario
  storygraphExtractor.test.mjs         Pruebas del extractor local
  themePalettes.test.mjs               Pruebas de paletas personalizadas
  coverStorage.test.mjs                Subida y servido de portadas (requiere `npm --prefix server install`)
  seriesAndSpines.test.mjs             Orden de sagas, huecos, ISBN y grosor de lomos
  settingsSync.test.mjs                Sincronización de apariencia entre dispositivos
server/
  index.js           API Express, portadas guardadas y servido del build
```
