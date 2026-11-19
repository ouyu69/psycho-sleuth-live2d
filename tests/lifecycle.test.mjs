import test from 'node:test';
import assert from 'node:assert/strict';

test('texture download failure releases the partially created Core model and cached textures', async () => {
  const {loadOwnedModel}=await import('../src/model-loader.mjs');
  let coreAlive=0,textureAlive=1;
  const texture={destroy(){textureAlive--;}};
  class Model {
    constructor(){this.textures=[];}
    once(name,callback){if(name==='settingsLoaded')this.onSettings=callback;}
    destroy(){coreAlive--;for(const texture of this.textures)texture.destroy();}
  }
  const runtime={utils:{TextureCache:{'texture.png':texture}},live2d:{Live2DModel:Model,
    Live2DFactory:{async setupLive2DModel(model){
      model.onSettings({textures:['texture.png'],resolveURL:path=>path});
      model.internalModel={};coreAlive++;
      throw new Error('Texture loading error');
    }}}};
  await assert.rejects(loadOwnedModel(runtime,'broken.model3.json',{}),/Texture loading error/);
  assert.equal(coreAlive,0,'failed construction must release the Core allocation');
  assert.equal(textureAlive,0,'textures allocated before rejection must be destroyed');
});
