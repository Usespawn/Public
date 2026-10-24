// Search for banner images in the workspace
const fs = require('fs');
const path = require('path');

const root = 'C:/Users/ramad/.cline/data/workspaces/chat/spawnpad';
const results = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(full);
    } else {
      const lname = e.name.toLowerCase();
      if (lname.includes('banner') || lname.includes('spawnpad') || /\.(png|jpg|jpeg|webp|svg)$/.test(lname)) {
        results.push(full);
      }
    }
  }
}

walk(root);
results.sort().forEach(r => console.log(r));
console.log('TOTAL', results.length);