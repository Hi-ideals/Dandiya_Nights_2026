/**
 * Minimal in-memory Firestore implementing the subset of the Admin SDK API used by
 * the app (doc/collection refs, where/orderBy/limit queries, transactions).
 * Transactions are serialised, so they model Firestore's isolation for tests.
 */
const clone = (value) => structuredClone(value);

const comparable = (v) => (v instanceof Date ? v.getTime() : v);

function getField(data, path) {
  return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), data);
}

class DocSnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = data !== undefined;
    this._data = data;
  }

  data() {
    return this.exists ? clone(this._data) : undefined;
  }
}

class DocRef {
  constructor(db, collection, id) {
    this.db = db;
    this.collection = collection;
    this.id = id;
    this.path = `${collection}/${id}`;
  }

  async get() {
    return new DocSnapshot(this, this.db._read(this.path));
  }

  async set(data, options) {
    this.db._write(this.path, data, options?.merge ? 'merge' : 'set');
  }

  async update(data) {
    this.db._write(this.path, data, 'update');
  }

  async create(data) {
    this.db._write(this.path, data, 'create');
  }
}

class Query {
  constructor(db, collection, filters = [], order = null, max = null) {
    this.db = db;
    this.collectionName = collection;
    this.filters = filters;
    this.order = order;
    this.max = max;
  }

  where(field, op, value) {
    return new Query(this.db, this.collectionName, [...this.filters, { field, op, value }], this.order, this.max);
  }

  orderBy(field, direction = 'asc') {
    return new Query(this.db, this.collectionName, this.filters, { field, direction }, this.max);
  }

  limit(n) {
    return new Query(this.db, this.collectionName, this.filters, this.order, n);
  }

  doc(id = Math.random().toString(36).slice(2)) {
    return new DocRef(this.db, this.collectionName, id);
  }

  _matches(data) {
    return this.filters.every(({ field, op, value }) => {
      const actual = comparable(getField(data, field));
      const expected = Array.isArray(value) ? value.map(comparable) : comparable(value);
      switch (op) {
        case '==':
          return actual === expected;
        case 'in':
          return expected.includes(actual);
        case '>=':
          return actual !== undefined && actual >= expected;
        case '<=':
          return actual !== undefined && actual <= expected;
        case '>':
          return actual !== undefined && actual > expected;
        case '<':
          return actual !== undefined && actual < expected;
        case 'array-contains':
          return Array.isArray(actual) && actual.includes(expected);
        default:
          throw new Error(`Unsupported operator ${op}`);
      }
    });
  }

  async get() {
    const prefix = `${this.collectionName}/`;
    let docs = [...this.db.store.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && this._matches(data))
      .map(([path, data]) => new DocSnapshot(new DocRef(this.db, this.collectionName, path.slice(prefix.length)), data));

    if (this.order) {
      const { field, direction } = this.order;
      const sign = direction === 'desc' ? -1 : 1;
      docs = docs
        .filter((d) => getField(d._data, field) !== undefined)
        .sort((a, b) => {
          const x = comparable(getField(a._data, field));
          const y = comparable(getField(b._data, field));
          return x === y ? 0 : x > y ? sign : -sign;
        });
    }
    if (this.max != null) docs = docs.slice(0, this.max);
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
  }
}

class Transaction {
  constructor(db) {
    this.db = db;
    this.writes = [];
  }

  async get(refOrQuery) {
    if (this.writes.length) throw new Error('Firestore transactions require all reads before writes');
    return refOrQuery.get();
  }

  set(ref, data, options) {
    this.writes.push([ref.path, data, options?.merge ? 'merge' : 'set']);
    return this;
  }

  update(ref, data) {
    this.writes.push([ref.path, data, 'update']);
    return this;
  }

  create(ref, data) {
    this.writes.push([ref.path, data, 'create']);
    return this;
  }
}

export class FakeFirestore {
  constructor() {
    this.store = new Map();
    this.queue = Promise.resolve();
    this.failNextTransactions = 0;
  }

  collection(name) {
    return new Query(this, name);
  }

  _read(path) {
    const data = this.store.get(path);
    return data === undefined ? undefined : clone(data);
  }

  _write(path, data, mode) {
    const existing = this.store.get(path);
    if (mode === 'create' && existing) {
      const err = new Error(`ALREADY_EXISTS: ${path}`);
      err.code = 6;
      throw err;
    }
    if (mode === 'update' && !existing) {
      const err = new Error(`NOT_FOUND: ${path}`);
      err.code = 5;
      throw err;
    }
    const next = mode === 'update' || mode === 'merge' ? { ...(existing ?? {}), ...clone(data) } : clone(data);
    this.store.set(path, next);
  }

  /** Simulate a temporary database outage for the next N transactions. */
  failTransactions(n) {
    this.failNextTransactions = n;
  }

  runTransaction(fn) {
    const run = async () => {
      if (this.failNextTransactions > 0) {
        this.failNextTransactions -= 1;
        const err = new Error('UNAVAILABLE: simulated outage');
        err.code = 14;
        throw err;
      }
      const tx = new Transaction(this);
      const result = await fn(tx);
      // Validate all writes before applying any (atomic commit).
      const snapshot = new Map(this.store);
      try {
        tx.writes.forEach(([path, data, mode]) => this._write(path, data, mode));
      } catch (err) {
        this.store = snapshot;
        throw err;
      }
      return result;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  // Test helpers
  all(collection) {
    return [...this.store.entries()]
      .filter(([path]) => path.startsWith(`${collection}/`))
      .map(([path, data]) => ({ id: path.split('/')[1], ...clone(data) }));
  }

  get(collection, id) {
    return this._read(`${collection}/${id}`);
  }
}
