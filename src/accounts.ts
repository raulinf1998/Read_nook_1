export type AccountId = 'raul' | 'pequenaja';
export const ACCOUNT_NAMES: Record<AccountId, string> = { raul: 'Raúl', pequenaja: 'Pequeñaja' };

export function selectedAccount(): AccountId | null {
  const value = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('bilibook-account='))?.split('=')[1];
  return value === 'raul' || value === 'pequenaja' ? value : null;
}

export function selectAccount(account: AccountId, hash = ''): void {
  document.cookie = `bilibook-account=${account}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.location.hash = hash;
  window.location.reload();
}
