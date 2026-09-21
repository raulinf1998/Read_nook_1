import type { Book } from './types';

const API_BASE = '/api';

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
  getTags: () => api<string[]>('/tags'),
  addTag: (tag: string) =>
    api<string[]>('/tags', { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (tag: string) =>
    api<string[]>(`/tags/${tag}`, { method: 'DELETE' }),
  getSettings: () => api<{ goal: number; dark: boolean }>('/settings'),
  setSettings: (settings: Partial<{ goal: number; dark: boolean }>) =>
    api<{ goal: number; dark: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
