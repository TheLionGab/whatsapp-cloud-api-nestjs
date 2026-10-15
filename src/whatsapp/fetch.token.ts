/** Token de DI do `fetch`, para trocar por um falso nos testes. */
export const FETCH = Symbol("FETCH");
export type FetchLike = typeof fetch;
