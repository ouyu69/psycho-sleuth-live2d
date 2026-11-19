// Retain ownership before the vendor factory starts allocating Core/texture resources.
export async function loadOwnedModel(runtime, url, options) {
  const model=new runtime.live2d.Live2DModel(options);
  let textureURLs=[];
  model.once('settingsLoaded',settings=>{textureURLs=settings.textures.map(path=>settings.resolveURL(path));});
  try {
    await runtime.live2d.Live2DFactory.setupLive2DModel(model,url,options);
    return model;
  } catch(error) {
    // Promise.all may reject before assigning the successfully allocated textures.
    const textures=new Set([...model.textures,...textureURLs.map(url=>runtime.utils.TextureCache[url]).filter(Boolean)]);
    model.textures=[...textures];
    if(model.internalModel) model.destroy({children:true,texture:true,baseTexture:true});
    else {
      // Vendor destroy assumes an internalModel exists; construction can fail earlier.
      model.emit('destroy');
      for(const texture of textures)texture.destroy(true);
      runtime.Container.prototype.destroy.call(model,{children:true});
    }
    throw error;
  }
}
