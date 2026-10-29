import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { selectedAccount, selectAccount } from './accounts.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {selectedAccount() ? <App /> : (
      <main className="min-h-dvh flex items-center justify-center p-5">
        <section className="max-w-md w-full rounded-card border border-line bg-surface p-7 shadow-lift text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">Bienvenidos a Bilibook</h1>
          <p className="mt-3 text-sm text-ink2">¿Quién va a leer? Este navegador recordará tu cuenta. Podéis cambiarla cuando queráis.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="rounded-btn bg-primary text-onprimary font-bold p-4" onClick={() => selectAccount('raul')}>Raúl</button>
            <button className="rounded-btn bg-primary text-onprimary font-bold p-4" onClick={() => selectAccount('pequenaja')}>Pequeñaja</button>
          </div>
          <p className="mt-5 text-xs text-ink3">Las cuentas no tienen contraseña; ambas personas pueden cambiar entre ellas.</p>
        </section>
      </main>
    )}
  </StrictMode>
);
