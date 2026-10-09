import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

let overrides = null;
let firestore;

/** Fails fast with a readable message when the service-account file is missing. */
export function assertCredentialsAvailable() {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (env.firebase.serviceAccountBase64 || process.env.FIRESTORE_EMULATOR_HOST || !file) return;
  if (!fs.existsSync(path.resolve(file))) {
    throw new Error(
      `Service account file not found: ${path.resolve(file)}\n` +
        'Download it from Firebase Console -> Project settings -> Service accounts -> Generate new private key, ' +
        'save it at that path (or update GOOGLE_APPLICATION_CREDENTIALS in server/.env).',
    );
  }
}

function ensureApp() {
  if (getApps().length) return getApps()[0];
  assertCredentialsAvailable();

  const options = { projectId: env.firebase.projectId };
  if (env.firebase.serviceAccountBase64) {
    const json = JSON.parse(Buffer.from(env.firebase.serviceAccountBase64, 'base64').toString('utf8'));
    options.credential = cert(json);
    options.projectId ??= json.project_id;
  } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS or the host's attached service account.
    options.credential = applicationDefault();
  }
  return initializeApp(options);
}

export function getDb() {
  if (overrides?.db) return overrides.db;
  if (!firestore) {
    firestore = getFirestore(ensureApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function getAuthClient() {
  if (overrides?.auth) return overrides.auth;
  return getAuth(ensureApp());
}

export function serverTimestamp() {
  if (overrides?.serverTimestamp) return overrides.serverTimestamp();
  return FieldValue.serverTimestamp();
}

/** Test hook: replace Firestore/Auth with in-memory fakes. */
export function setFirebaseOverrides(value) {
  overrides = value;
}
