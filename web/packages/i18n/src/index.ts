import en from './en.json';

type Messages = Record<string, string>;

const catalogs: Record<string, Messages> = { en };

let locale = 'en';

export function setLocale(next: string): void {
  locale = next;
}

export function t(key: string): string {
  const messages = catalogs[locale] ?? en;
  return messages[key] ?? key;
}

export { en };
