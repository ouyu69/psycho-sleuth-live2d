export function readSelection(href) {
  const params = new URL(href).searchParams;
  return {modelId: params.get('modelId'), motion: params.get('motion')};
}

export function selectionURL(href, modelId, motion) {
  const url = new URL(href);
  url.searchParams.set('modelId', modelId);
  url.searchParams.set('motion', motion);
  return url.href;
}

export function resolveSelection(models, selection) {
  const model = models.find(m => m.id === selection.modelId) || models[0];
  const motion = model.motions.find(m => m.id === selection.motion)
    || model.motions.find(m => m.id === model.defaultMotion) || model.motions[0];
  return {model, motion};
}
