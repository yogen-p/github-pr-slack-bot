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

function persist(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

const store = load();

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
