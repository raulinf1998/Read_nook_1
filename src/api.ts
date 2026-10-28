import type { Book, CustomPalette, ThemeId } from './types';

const API_BASE = '/api';

async function responseError(res: Response): Promise<Error> {
  try {
    const data = await res.clone().json();
    if (data && typeof data.error === 'string' && data.error.trim()) return new Error(data.error);
  } catch {
    /* La respuesta puede no ser JSON; se usa el estado HTTP como respaldo. */
  }
  return new Error(`API error: ${res.status}`);
}

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw await responseError(res);
  return res.json();
}

export interface StoredCover {
  coverUrl: string;
  filename: string;
  size: number;
  contentType: string;
  sourceUrl?: string;
}

export interface Settings {
  goal: number;
  dark: boolean;
  theme: ThemeId;
  customPalettes: CustomPalette[];
  customPaletteId: string | null;
  /** Crece en el servidor con cada cambio; sirve para sincronizar dispositivos. */
  settingsVersion: number;
}

export const apiClient = {
  getBooks: () => api<Book[]>('/books'),
  addBook: (book: Omit<Book, 'id' | 'createdAt'>) =>
    api<Book>('/books', { method: 'POST', body: JSON.stringify(book) }),
  updateBook: (id: string, patch: Partial<Book>) =>
    api<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteBook: (id: string) =>
    api<{ ok: boolean }>(`/books/${id}`, { method: 'DELETE' }),
  importBooks: (books: Omit<Book, 'id' | 'createdAt'>[]) =>
    api<{ imported: number }>('/books/import', { method: 'POST', body: JSON.stringify({ books }) }),
  storeCoverFromUrl: (url: string) =>
    api<StoredCover>('/covers/from-url', { method: 'POST', body: JSON.stringify({ url }) }),
  uploadCover: async (file: File): Promise<StoredCover> => {
    const res = await fetch(`${API_BASE}/covers/upload`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) throw await responseError(res);
    return res.json();
  },
  getTags: () => api<string[]>('/tags'),
  addTag: (tag: string) =>
    api<string[]>('/tags', { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (tag: string) =>
    api<string[]>(`/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }),
  getSettings: () => api<Settings>('/settings', { cache: 'no-store' }),
  setSettings: (settings: Partial<Omit<Settings, 'settingsVersion'>>) =>
    api<Settings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  saveCustomPalette: (palette: CustomPalette, activate = true) =>
    api<Settings>(`/settings/custom-palettes/${encodeURIComponent(palette.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ palette, activate }),
    }),
  deleteCustomPalette: (id: string) =>
    api<Settings>(`/settings/custom-palettes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
