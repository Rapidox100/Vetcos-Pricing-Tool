// Thin fetch wrapper. In dev, Vite proxies /api -> :3000 (see vite.config.js),
// so relative URLs work in both dev and production.
const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
    credentials: 'include', // send the httpOnly session cookie
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) {
    data = await res.json();
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  // Absolute URL for PDF links (opened in a new tab).
  pdfUrl: (p) => BASE + p,
};
