import { getAuthClient, getDb } from '../config/firebase.js';
import { COLLECTIONS, ROLES } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';

async function verifyBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  }
  try {
    return await getAuthClient().verifyIdToken(token, true);
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Your session has expired. Please sign in again.');
  }
}

async function resolveRole(decoded) {
  // Custom claim set by scripts/create-admin.js is the fast path.
  if (decoded.role && Object.values(ROLES).includes(decoded.role)) return decoded.role;

  const snap = await getDb().collection(COLLECTIONS.admins).doc(decoded.uid).get();
  if (!snap.exists) return null;
  const profile = snap.data();
  return profile.active === false ? null : profile.role;
}

const toUser = (decoded, role) => ({
  uid: decoded.uid,
  email: decoded.email ?? null,
  name: decoded.name ?? null,
  role,
});

/** Any signed-in attendee (Google sign-in). Role is taken from the custom claim only. */
export async function requireUser(req, _res, next) {
  const decoded = await verifyBearer(req);
  if (!decoded.email) {
    throw new AppError(403, 'EMAIL_REQUIRED', 'Please sign in with a Google account that has an email address');
  }
  req.user = toUser(decoded, Object.values(ROLES).includes(decoded.role) ? decoded.role : null);
  next();
}

/**
 * Verifies a Firebase ID token and enforces admin/staff roles.
 * The Admin SDK bypasses Firestore rules, so this is the only gate for admin data.
 */
export const requireRole = (...allowedRoles) => async (req, _res, next) => {
  const decoded = await verifyBearer(req);
  const role = await resolveRole(decoded);
  if (!role || !allowedRoles.includes(role)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
  }
  req.user = toUser(decoded, role);
  next();
};

export const requireAdmin = requireRole(ROLES.admin);
export const requireStaff = requireRole(ROLES.admin, ROLES.staff);

/**
 * The signed-in user must own the booking (admins may open any). Responds 404 for both
 * "missing" and "not yours" so booking numbers cannot be probed. Use after requireUser.
 */
export function requireBookingOwner(getRegistrationNumber) {
  return async (req, _res, next) => {
    const registrationNumber = getRegistrationNumber(req);
    const snap = registrationNumber
      ? await getDb().collection(COLLECTIONS.registrations).doc(registrationNumber).get()
      : null;
    const owns = snap?.exists && (snap.data().userId === req.user.uid || req.user.role === ROLES.admin);
    if (!owns) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    next();
  };
}
