import test from 'node:test';
import assert from 'node:assert/strict';

test('shared selections retain Chinese names and Pages subdirectory', async () => {
  const {selectionURL, readSelection} = await import('../src/state.mjs');
  const url = selectionURL('https://name.github.io/live2d-viewer/', '大愛麗絲', '極怒_閉眼');
  assert.equal(new URL(url).pathname, '/live2d-viewer/');
  assert.deepEqual(readSelection(url), {modelId:'大愛麗絲', motion:'極怒_閉眼'});
});

test('unknown selection falls back to a real model and its default motion', async () => {
  const {resolveSelection} = await import('../src/state.mjs');
  const models = [{id:'艾', defaultMotion:'一般', motions:[{id:'一般'}]}];
  assert.deepEqual(resolveSelection(models, {modelId:'missing', motion:'missing'}), {model:models[0], motion:models[0].motions[0]});
});
