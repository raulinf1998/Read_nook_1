import type { Book } from './types';

type DemoBook = Omit<Book, 'id' | 'createdAt'>;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

/** Biblioteca de ejemplo para explorar la app sin tener que teclear libros a mano. */
export function buildDemoBooks(): DemoBook[] {
  const base: DemoBook = {
    title: '', author: '', coverUrl: '', status: 'read', rating: 0, notes: '',
    pages: 0, currentPage: 0, format: 'paperback', language: 'es',
    publishDate: '', description: '', tags: [], isbn: '',
    startedAt: null, finishedAt: null, journal: [],
  };
  const read = (daysAgo: number, durationDays = 12) => ({
    status: 'read' as const,
    finishedAt: now - daysAgo * DAY,
    startedAt: now - (daysAgo + durationDays) * DAY,
  });

  return [
    {
      ...base, title: 'El nombre del viento', author: 'Patrick Rothfuss', isbn: '9788401352836',
      coverUrl: cover('9788401352836'), pages: 880, currentPage: 512, format: 'paperback',
      tags: ['Fantasía', 'Aventura'], publishDate: '2007',
      status: 'reading', startedAt: now - 21 * DAY,
      description: 'La historia de Kvothe, mago, músico y leyenda, contada por él mismo.',
      journal: [
        { id: 'd1', date: now - 3 * DAY, pages: 64, note: 'La Universidad por fin. Qué maravilla de sistema de magia.' },
        { id: 'd2', date: now - 9 * DAY, pages: 120, note: 'Tarbean me ha dejado roto.' },
        { id: 'd3', date: now - 18 * DAY, pages: 180, note: 'Empieza la troupe. Rothfuss escribe como un ángel.' },
      ],
    },
    {
      ...base, title: 'Proyecto Hail Mary', author: 'Andy Weir', isbn: '9780593135204',
      coverUrl: cover('9780593135204'), pages: 496, currentPage: 148, format: 'ebook', language: 'en',
      tags: ['Ciencia ficción', 'Aventura'], publishDate: '2021',
      status: 'reading', startedAt: now - 8 * DAY,
      description: 'Un hombre despierta en una nave sin recordar su misión: salvar a la humanidad.',
      journal: [
        { id: 'd4', date: now - 2 * DAY, pages: 52, note: 'Rocky es oficialmente mi personaje favorito del año.' },
      ],
    },
    {
      ...base, title: 'La biblioteca de la medianoche', author: 'Matt Haig', isbn: '9780525559474',
      coverUrl: cover('9780525559474'), pages: 304, currentPage: 304, format: 'hardcover',
      tags: ['Fantasía', 'Contemporánea'], publishDate: '2020', rating: 4,
      description: 'Entre la vida y la muerte hay una biblioteca donde cada libro es una vida que pudo ser.',
      ...read(14, 6),
    },
    {
      ...base, title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719',
      coverUrl: cover('9780441172719'), pages: 688, currentPage: 688, format: 'paperback',
      tags: ['Ciencia ficción', 'Clásico'], publishDate: '1965', rating: 5, language: 'en',
      description: 'Paul Atreides y el planeta desierto Arrakis, fuente de la especia melange.',
      ...read(48, 24),
    },
    {
      ...base, title: 'Cien años de soledad', author: 'Gabriel García Márquez', isbn: '9780060883287',
      coverUrl: cover('9780060883287'), pages: 417, currentPage: 417, format: 'paperback',
      tags: ['Clásico', 'Contemporánea'], publishDate: '1967', rating: 4.5,
      description: 'La saga de los Buendía en Macondo, cumbre del realismo mágico.',
      ...read(86, 18),
    },
    {
      ...base, title: 'La sombra del viento', author: 'Carlos Ruiz Zafón', isbn: '9788408172179',
      coverUrl: cover('9788408172179'), pages: 576, currentPage: 576, format: 'hardcover',
      tags: ['Misterio', 'Histórica'], publishDate: '2001', rating: 4.5,
      description: 'Un niño, un libro misterioso y el Cementerio de los Libros Olvidados en la Barcelona de posguerra.',
      ...read(120, 15),
    },
    {
      ...base, title: 'Sapiens', author: 'Yuval Noah Harari', isbn: '9780062316097',
      coverUrl: cover('9780062316097'), pages: 464, currentPage: 464, format: 'ebook',
      tags: ['Ensayo', 'Histórica'], publishDate: '2011', rating: 4,
      description: 'De animales a dioses: una breve historia de la humanidad.',
      ...read(160, 20),
    },
    {
      ...base, title: '1984', author: 'George Orwell', isbn: '9780451524935',
      coverUrl: cover('9780451524935'), pages: 328, currentPage: 328, format: 'paperback',
      tags: ['Clásico', 'Ciencia ficción'], publishDate: '1949', rating: 5,
      description: 'Winston Smith contra el Gran Hermano en la distopía definitiva.',
      ...read(215, 9),
    },
    {
      ...base, title: 'Orgullo y prejuicio', author: 'Jane Austen', isbn: '9780141439518',
      coverUrl: cover('9780141439518'), pages: 432, currentPage: 432, format: 'paperback',
      tags: ['Romance', 'Clásico'], publishDate: '1813', rating: 4, language: 'en',
      description: 'Elizabeth Bennet y el señor Darcy, entre bailes, orgullo y malentendidos.',
      ...read(280, 14),
    },
    {
      ...base, title: 'El principito', author: 'Antoine de Saint-Exupéry', isbn: '9780156012195',
      coverUrl: cover('9780156012195'), pages: 96, currentPage: 96, format: 'hardcover',
      tags: ['Clásico', 'Juvenil'], publishDate: '1943', rating: 5,
      description: 'Lo esencial es invisible a los ojos.',
      ...read(340, 2),
    },
    {
      ...base, title: 'Piranesi', author: 'Susanna Clarke', isbn: '9781635575569',
      coverUrl: cover('9781635575569'), pages: 256, format: 'hardcover',
      tags: ['Fantasía', 'Misterio'], publishDate: '2020', status: 'pending',
      description: 'Una Casa infinita con un océano en los pasillos y un solo habitante.',
    },
    {
      ...base, title: 'Klara y el sol', author: 'Kazuo Ishiguro', isbn: '9780593318171',
      coverUrl: cover('9780593318171'), pages: 320, format: 'paperback',
      tags: ['Ciencia ficción', 'Drama'], publishDate: '2021', status: 'pending', language: 'en',
      description: 'Klara, una Amiga Artificial, observa el mundo esperando ser elegida.',
    },
    {
      ...base, title: 'El hobbit', author: 'J.R.R. Tolkien', isbn: '9780547928227',
      coverUrl: cover('9780547928227'), pages: 310, format: 'paperback',
      tags: ['Fantasía', 'Aventura', 'Juvenil'], publishDate: '1937', status: 'pending',
      description: 'Bilbo Bolsón, Gandalf, trece enanos y un dragón llamado Smaug.',
    },
    {
      ...base, title: 'Crimen y castigo', author: 'Fiódor Dostoievski', isbn: '9780143058144',
      coverUrl: cover('9780143058144'), pages: 671, format: 'paperback',
      tags: ['Clásico', 'Drama'], publishDate: '1866', status: 'pending',
      description: 'Raskólnikov y el peso de la culpa en San Petersburgo.',
    },
  ];
}
