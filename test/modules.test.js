import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'public');

function moduleFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return moduleFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

// Catches broken relative imports after a refactor — the modules are loaded by
// the browser at runtime, so a typo would otherwise only show up in devtools.
test('every relative import in the client resolves to a real file', () => {
  const files = moduleFiles(publicDir);
  assert.ok(files.length > 5);
  let checked = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(fs.existsSync(target), `${path.relative(root, file)} imports missing ${match[1]}`);
      checked += 1;
    }
  }
  assert.ok(checked > 10, 'expected a healthy number of imports');
});

test('server-side renderer logic is importable outside the browser', async () => {
  const module = await import(pathToFileURL(path.join(publicDir, 'src', 'renderer.js')).href);
  assert.equal(typeof module.renderFrame, 'function');
  assert.equal(typeof module.tileVariantFrame, 'function');
});

test('index.html loads the client as an ES module', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(html, /<script[^>]*type="module"[^>]*src="\/?client\.js"/);
  assert.match(html, /socket\.io/i);
});

// The contract every plug-and-play client module must satisfy (see
// memory/03-module-architecture.md). Importing in Node also proves the file
// has no top-level DOM access.
test('every client module follows the plug-and-play contract', async () => {
  const dir = path.join(publicDir, 'src', 'modules');
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.js'));
  assert.ok(files.length >= 3, 'expected at least three client modules');
  for (const file of files) {
    const module = await import(pathToFileURL(path.join(dir, file)).href);
    const definition = module.default;
    assert.ok(definition, `${file} has a default export`);
    assert.equal(typeof definition.setup, 'function', `${file} has setup(ctx)`);
    assert.ok(typeof definition.name === 'string' && definition.name.length > 0, `${file} declares a name`);
    if (definition.priority !== undefined) assert.ok(Number.isFinite(definition.priority), `${file} priority is numeric`);
  }
});

// The master emits render hooks inside the camera transform; a module that
// draws on them must be wired through the bus, so assert the renderer emits.
test('the renderer emits the three module render hooks', () => {
  const source = fs.readFileSync(path.join(publicDir, 'src', 'renderer.js'), 'utf8');
  for (const hook of ['render:world', 'render:fx', 'render:overlay']) {
    assert.ok(source.includes(`'${hook}'`), `renderer emits ${hook}`);
  }
});
