const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function filePath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(filePath(), JSON.stringify(data));
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const data = load();
  data[key] = value;
  save(data);
}

module.exports = { get, set };
