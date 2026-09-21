const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Cloud Run image contains and serves every local app-shell asset', () => {
  const index = read('index.html');
  const worker = read('sw.js');
  const dockerfile = read('Dockerfile');
  const dockerignore = new Set(read('.dockerignore').split(/\r?\n/).filter(Boolean));
  const server = read('server/auth-server.mjs');
  const assets = new Set();

  for (const source of [index, worker]) {
    for (const match of source.matchAll(/(?:src|href)=?["']\.\/([^?"']+)|["']\.\/([^?"']+)[?"']/g)) {
      assets.add(match[1] || match[2]);
    }
  }
  assets.add('index.html');

  const copyLine = dockerfile.split(/\r?\n/).find(line => line.startsWith('COPY index.html '));
  assert.ok(copyLine, 'Dockerfile app asset COPY line is missing');
  const copied = new Set(copyLine.split(/\s+/).slice(1, -1));
  const servedMatch = server.match(/const files=new Set\(\[([^\]]+)\]\)/);
  assert.ok(servedMatch, 'server static file allowlist is missing');
  const served = new Set([...servedMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]));

  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} does not exist`);
    assert.ok(copied.has(asset), `${asset} is not copied into the image`);
    assert.ok(dockerignore.has(`!${asset}`), `${asset} is excluded by .dockerignore`);
    assert.ok(served.has(asset), `${asset} is not served by the backend`);
  }
});
