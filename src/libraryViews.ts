export type LibraryViewMode =
  | 'wood'
  | 'spines'
  | 'floating'
  | 'showcase'
  | 'stacks'
  | 'wall'
  | 'gallery'
  | 'catalog'
  | 'grid'
  | 'list';

export const LIBRARY_VIEW_OPTIONS: { value: LibraryViewMode; label: string; description: string }[] = [
  { value: 'wood', label: 'Baldas de madera', description: 'La estantería clásica, con las portadas apoyadas balda a balda.' },
  { value: 'spines', label: 'Lomos', description: 'Solo los lomos, con grosor según las páginas de cada libro.' },
  { value: 'floating', label: 'Baldas flotantes', description: 'Estantería ligera y limpia, con mucho aire entre libros.' },
  { value: 'showcase', label: 'Vitrina', description: 'Cada libro expuesto como en el escaparate de una librería.' },
  { value: 'stacks', label: 'Pilas', description: 'Libros apilados sobre mesas, como las pilas de novedades.' },
  { value: 'wall', label: 'Muro de portadas', description: 'Una pared continua de portadas, sin tarjetas intermedias.' },
  { value: 'gallery', label: 'Galería', description: 'Portadas enmarcadas con su cartela, como en una exposición.' },
  { value: 'catalog', label: 'Fichero', description: 'Fichas de catálogo de biblioteca clásica.' },
  { value: 'grid', label: 'Rejilla clásica', description: 'La rejilla de tarjetas de siempre.' },
  { value: 'list', label: 'Lista', description: 'Tabla compacta para consultar muchos datos de golpe.' },
];
