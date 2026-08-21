export const apiUrl = import.meta.env.VITE_API_URL || '';

export const apiFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    return fetch(apiUrl + input, init);
  }
  return fetch(input, init);
};
