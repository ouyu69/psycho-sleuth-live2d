import test from 'node:test';
import assert from 'node:assert/strict';
import {Stage} from '../src/stage.mjs';

test('a motion switch preserves the displayed pose and eases unkeyed parameters back to defaults', async () => {
  const stage = Object.create(Stage.prototype);
  const values = Float32Array.of(0, 1);
  const defaultValues = Float32Array.of(1, 0);
  let beforeRender;
  let rendered;
  const clip = {setIsLoop() {}, setFadeInTime() {}, setFadeOutTime() {}};
  const manager = {
    async loadMotion() {return clip;},
    stopAllMotions() {},
    async startMotion() {return true;},
    definitions: {Tap: [{FadeInTime: 0.5}]}
  };
  const internal = {
    coreModel: {getModel: () => ({parameters: {values, defaultValues}}), saveParameters() {}},
    motionManager: manager,
    on(event, callback) {assert.equal(event, 'beforeModelUpdate'); beforeRender = callback;}
  };
  const model = {internalModel: internal, update() {}};
  Object.assign(stage, {
    model, generation: 1, motionGeneration: 0, motion: {id: 'closed'},
    app: {renderer: {render() {
      values[0] = 1; // The new clip keys eye openness, but leaves parameter 1 alone.
      beforeRender();
      rendered = [...values];
    }}},
    events: {motion() {}, playing() {}, loop() {}}
  });
  stage.trackRenderedPose(internal);
  beforeRender(); // Capture the old closed-eye pose before Cubism restores its saved values.
  await stage.selectMotion({id: 'open', group: 'Tap', index: 0, duration: 2});
  assert.deepEqual(rendered, [0, 1]);

  stage.transition.elapsed = stage.transition.duration / 2;
  values.set(defaultValues);
  beforeRender();
  assert.deepEqual([...values], [0.5, 0.5]);

  stage.transition.elapsed = stage.transition.duration;
  values.set(defaultValues);
  beforeRender();
  assert.deepEqual([...values], [1, 0]);
  assert.equal(stage.transition, null);

  const authoredLoop = {id: 'idle-loop', group: 'Tap', index: 0, duration: 2, loop: true};
  await stage.selectMotion(authoredLoop);
  assert.equal(stage.loop, true);

  stage.setLoop(false);
  await stage.selectMotion(authoredLoop);
  assert.equal(stage.loop, false, 'replaying the same clip preserves a manual override');

  stage.setLoop(true);
  await stage.selectMotion({id: 'reaction', group: 'Tap', index: 0, duration: 1, loop: false});
  assert.equal(stage.loop, false, 'a one-shot reaction does not inherit another clip’s loop setting');
});
