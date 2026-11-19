import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

test('catalog contains all 24 models and 333 unique original motions', () => {
  const path = new URL('../assets/catalog.json', import.meta.url);
  assert.ok(existsSync(path), 'generated model catalog exists');
  const catalog = JSON.parse(readFileSync(path));
  assert.equal(catalog.models.length, 24);
  assert.equal(catalog.models.reduce((n, m) => n + m.motions.length, 0), 333);
  for (const model of catalog.models) {
    assert.ok(existsSync(resolve(import.meta.dirname, '..', model.url)), model.url);
    assert.equal(new Set(model.motions.map(m => m.file)).size, model.motions.length);
    assert.ok(model.motions.some(m => m.id === model.defaultMotion));
  }
});
