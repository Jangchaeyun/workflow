export type SearchResultKind = 'task' | 'client' | 'deal' | 'nav';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  href: string;
}
