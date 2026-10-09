#!/usr/bin/env node
/**
 * Provision an admin or staff account (there is no public sign-up).
 *
 *   npm run create-admin -- --email admin@example.com --name "Event Admin" [--role admin|staff]
 *
 * The password is read from ADMIN_PASSWORD, or prompted for interactively.
 * Re-running for an existing email updates the role (and password, if given).
 */
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { assertCredentialsAvailable, getAuthClient, getDb, serverTimestamp } from '../src/config/firebase.js';
import { COLLECTIONS, ROLES } from '../src/config/constants.js';
import { env } from '../src/config/env.js';

/** Reads a line without echoing it (shows * per character). */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output, terminal: true });
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted) output.write(text);
      else if (text.includes('\n') || text.includes('\r')) output.write('\n');
      else output.write('*'.repeat(text.length));
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[(i += 1)];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || env.adminEmail || '').trim().toLowerCase();
  const name = args.name || 'Event Admin';
  const role = args.role || ROLES.admin;

  if (!email) throw new Error('Provide --email or set ADMIN_EMAIL');
  if (!Object.values(ROLES).includes(role)) throw new Error(`--role must be one of: ${Object.values(ROLES).join(', ')}`);

  // Check Firebase credentials before asking for a password.
  assertCredentialsAvailable();

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = (await promptHidden('Password (min 10 chars; leave blank to keep existing): ')).trim();
  }
  if (password && password.length < 10) throw new Error('Use a password of at least 10 characters');

  const auth = getAuthClient();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    if (password) await auth.updateUser(user.uid, { password, displayName: name });
    console.log(`Updating existing user ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    if (!password) throw new Error('A password is required to create a new user');
    user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
    console.log(`Created user ${email}`);
  }

  await auth.setCustomUserClaims(user.uid, { role });
  // Revoke old sessions so the new role claim is picked up on next sign-in.
  await auth.revokeRefreshTokens(user.uid);

  const ref = getDb().collection(COLLECTIONS.admins).doc(user.uid);
  const existing = await ref.get();
  await ref.set(
    {
      uid: user.uid,
      name,
      email,
      role,
      active: true,
      ...(existing.exists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`Done: ${email} now has role "${role}" (uid ${user.uid}).`);
  process.exit(0);
}

main().catch((err) => {
  if (err.code === 5) {
    console.error(
      'create-admin failed: Firestore database not found.\n' +
        'Create it in Firebase Console -> Build -> Firestore Database -> Create database ' +
        '(database ID "(default)", Production mode), then run this command again.',
    );
    process.exit(1);
  }
  console.error(`create-admin failed: ${err.message}`);
  process.exit(1);
});
