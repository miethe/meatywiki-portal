const DEFAULT_DOCS_URL = "http://127.0.0.1:8000";

export function getDocsUrl(): string {
  return (process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL ?? DEFAULT_DOCS_URL).replace(/\/+$/, "");
}
