import axios from 'axios';
import { auth } from '../firebase/config';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Single API client. When someone is signed in (attendee via Google, or admin/staff),
 * a fresh Firebase ID token is attached; the backend decides what that user may access.
 */
export const api = axios.create({ baseURL, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const user = auth?.currentUser;
  if (user) {
    config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  return config;
});

// Kept as a named alias so admin pages read clearly.
export const adminApi = api;

export function errorCode(err) {
  return err?.response?.data?.error?.code;
}

export function fieldErrors(err) {
  return err?.response?.data?.error?.fields ?? {};
}

/** Human-readable message for any API/network error (handles blob error bodies too). */
export async function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
    return 'Unable to reach the server. Please check your internet connection.';
  }
  let data = err.response.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  return data?.error?.message || fallback;
}

/** Downloads a binary response (PDF/XLSX) and triggers a browser save. */
export async function downloadFile(url, { params, fallbackName }) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
