const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/store.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// One-time migration: rewrite plain numeric keys (old format) to "owner/repo#number".
// Requires GITHUB_REPO_OWNER and GITHUB_REPO_NAME to be set during the first deploy.
function migrateNumericKeys() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!owner || !repo) return;

  let changed = false;
  for (const key of Object.keys(store)) {
    if (/^\d+$/.test(key)) {
      store[`${owner}/${repo}#${key}`] = store[key];
      delete store[key];
      changed = true;
    }
  }
  if (changed) persist(store);
}

function persist(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

const store = load();
migrateNumericKeys();

module.exports = {
  set(prNumber, data) {
    store[String(prNumber)] = data;
    persist(store);
  },
  get(prNumber) {
    return store[String(prNumber)];
  },
  getAll() {
    return store;
  },
  delete(prNumber) {
    delete store[String(prNumber)];
    persist(store);
  },
};
