import {loadOwnedModel} from './model-loader.mjs';
/* Keep Cubism-specific internals here; UI and catalog remain runtime-independent. */
export class Stage {
  constructor(canvas, container, events) {
    if (!window.PIXI?.live2d || !window.Live2DCubismCore) {
      throw new Error('播放器组件未能载入，请刷新页面。');
    }
    this.events = events;
    this.container = container;
    this.canvas = canvas;
    this.app = new PIXI.Application({view:canvas, backgroundAlpha:0, antialias:true,
      autoStart:false, resolution:Math.min(devicePixelRatio || 1, 2), autoDensity:true,
      preserveDrawingBuffer:true});
    this.playing = false;
    this.speed = 1;
    this.loop = false;
    this.follow = false;
    this.physicsEnabled = true;
    this.zoom = 1;
    this.offset = {x:0,y:0};
    this.position = 0;
    this.generation = 0;
    this.motionGeneration = 0;
    this.loadQueue = Promise.resolve();
    this.lastFrame = performance.now();
    this.fpsTime = this.lastFrame;
    this.frames = 0;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.bindPointer();
    this.resize();
    this.tick = this.tick.bind(this);
    this.frame = requestAnimationFrame(this.tick);
    // Avoid a stale large timestep when returning from a background tab.
    document.addEventListener('visibilitychange', () => {this.lastFrame = performance.now();});
  }

  async load(meta, motion) {
    const token = ++this.generation;
    ++this.motionGeneration;
    this.playing = false;
    this.events.loading(meta);
    // Serialize Core construction and destruction; rapid choices coalesce to the latest.
    const job = this.loadQueue.catch(() => {}).then(async () => {
      if (token !== this.generation) return;
      this.disposeModel();
      let next;
      try {
        next = await loadOwnedModel(PIXI, encodeURI(meta.url), {
          autoUpdate:false, autoInteract:false, motionPreload:'NONE', idleMotionGroup:'__none__'
        });
        if (token !== this.generation) {next.destroy({children:true,texture:true,baseTexture:true}); return;}
        this.model = next;
        this.meta = meta;
        this.app.stage.addChild(next);
        this.physics = next.internalModel.physics;
        if (!this.physicsEnabled) next.internalModel.physics = undefined;
        next.internalModel.breath = undefined;
        // The source models include their own parameter tracks; disable runtime-added breathing.
        next.internalModel.updateNaturalMovements = () => {};
        next.internalModel.motionManager.groups.idle = '__none__';
        this.trackRenderedPose(next.internalModel);
        this.bounds = {x:0,y:0,width:next.internalModel.width,height:next.internalModel.height};
        await this.selectMotion(motion);
        if (token !== this.generation) return;
        this.fitVisibleBounds();
        this.resetView();
        this.events.ready(meta);
      } catch (error) {
        if (token === this.generation) {
          this.disposeModel();
          this.events.error(error);
        }
      }
    });
    this.loadQueue = job;
    return job;
  }

  disposeModel() {
    if (!this.model) return;
    // Restore the owned physics object so that runtime cleanup can release it.
    this.model.internalModel.physics = this.physics;
    this.app.stage.removeChild(this.model);
    this.model.destroy({children:true, texture:true, baseTexture:true});
    this.model = null;
    this.physics = null;
    this.motion = null;
    this.renderedPose = null;
    this.transition = null;
  }

  trackRenderedPose(internal) {
    const parameters = internal.coreModel.getModel().parameters;
    const rendered = new Float32Array(parameters.values.length);
    internal.on('beforeModelUpdate', () => {
      // Cubism has already evaluated the target motion and physics. Blend only
      // the displayed frame, leaving its saved animation parameters untouched.
      const values = parameters.values;
      const transition = this.transition;
      if (transition) {
        const progress = Math.min(1, transition.elapsed / transition.duration);
        if (progress === 1) {
          this.transition = null;
        } else {
          const weight = progress * progress * (3 - 2 * progress);
          for (let i = 0; i < values.length; i++) {
            values[i] = transition.from[i] + (values[i] - transition.from[i]) * weight;
          }
        }
      }
      rendered.set(values);
      this.renderedPose = rendered;
    });
  }

  async selectMotion(meta, {loopRestart = false} = {}) {
    if (!this.model) return;
    const model = this.model;
    const generation = this.generation;
    const token = ++this.motionGeneration;
    const manager = model.internalModel.motionManager;
    this.pendingMotion = token;
    let motion;
    try {
      motion = await manager.loadMotion(meta.group, meta.index);
    } finally {
      if (this.pendingMotion === token) this.pendingMotion = null;
    }
    if (token !== this.motionGeneration || generation !== this.generation || model !== this.model) return;
    if (!motion) throw new Error(`无法载入动作「${meta.name}」`);
    this.playing = false;
    const fadeIn = manager.definitions[meta.group]?.[meta.index]?.FadeInTime;
    const duration = Math.min(loopRestart ? 180 : (fadeIn > 0 ? fadeIn * 1000 : 350), meta.duration * 400);
    this.transition = this.motion && this.renderedPose && duration > 0
      ? {from: this.renderedPose.slice(), elapsed: 0, duration}
      : null;
    manager.stopAllMotions();
    // The incoming pose starts from defaults. The display blend fades out old
    // values even when the incoming clip has no track for those parameters.
    const core = model.internalModel.coreModel;
    const data = core.getModel().parameters;
    data.values.set(data.defaultValues);
    core.saveParameters();
    motion.setIsLoop(false);
    // The viewer owns the transition and must hold the final pose at the end.
    motion.setFadeInTime(0);
    motion.setFadeOutTime(0);
    await manager.startMotion(meta.group, meta.index, 3);
    if (token !== this.motionGeneration || generation !== this.generation) return;
    const changedMotion = this.motion?.id !== meta.id;
    this.motion = meta;
    if (changedMotion) this.setLoop(meta.loop === true);
    this.position = 0;
    this.playing = true;
    this.ended = false;
    model.update(0.01);
    this.app.renderer.render(this.app.stage);
    this.events.motion(meta);
    this.events.playing(true);
  }

  fitVisibleBounds() {
    const internal = this.model.internalModel;
    const core = internal.coreModel;
    const drawables = core.getModel().drawables;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (let i=0; i<drawables.count; i++) {
      if (drawables.opacities[i] < 0.01) continue;
      const vertices = internal.getDrawableVertices(i);
      for (let j=0; j<vertices.length; j+=2) {
        const point = internal.localTransform.apply({x:vertices[j],y:vertices[j+1]});
        minX=Math.min(minX,point.x); maxX=Math.max(maxX,point.x);
        minY=Math.min(minY,point.y); maxY=Math.max(maxY,point.y);
      }
    }
    if (maxX>minX && maxY>minY) this.bounds={x:minX,y:minY,width:maxX-minX,height:maxY-minY};
  }

  resize() {
    this.app.renderer.resize(Math.max(1,this.container.clientWidth), Math.max(1,this.container.clientHeight));
    this.layout();
  }

  layout() {
    if (!this.model || !this.bounds) return;
    const {width:w,height:h}=this.app.screen;
    const bounds=this.bounds;
    const scale=Math.min((w-65)/bounds.width,(h-110)/bounds.height)*this.zoom;
    this.model.scale.set(scale);
    this.model.position.set(w/2-(bounds.x+bounds.width/2)*scale+this.offset.x,
      h/2-(bounds.y+bounds.height/2)*scale+8+this.offset.y);
  }

  resetView() {this.zoom=1; this.offset={x:0,y:0}; this.layout(); this.events.zoom(this.zoom);}
  setZoom(value) {this.zoom=Math.min(5,Math.max(.25,value));this.layout();this.events.zoom(this.zoom);}
  setPhysics(enabled) {this.physicsEnabled=enabled;if(this.model)this.model.internalModel.physics=enabled?this.physics:undefined;}
  setLoop(enabled) {
    this.loop = enabled;
    this.events.loop(enabled);
  }

  async togglePlay() {
    if (!this.model || !this.motion) return;
    if (this.ended) return this.selectMotion(this.motion);
    this.playing=!this.playing;
    this.lastFrame=performance.now();
    this.events.playing(this.playing);
  }

  tick(now) {
    this.frame=requestAnimationFrame(this.tick);
    const dt=Math.min(Math.max(now-this.lastFrame,0),50)*this.speed;
    this.lastFrame=now;
    try {
      if (this.model && this.motion && this.playing) {
        const duration=this.motion.duration;
        const remaining=Math.max(0,duration-this.position);
        const step=Math.min(dt,remaining*1000);
        if (this.transition) this.transition.elapsed += step;
        this.model.update(step);
        this.position+=step/1000;
        this.app.renderer.render(this.app.stage);
        if (this.position>=duration) {
          this.playing=false;
          if (this.loop && !this.pendingMotion) {
            this.selectMotion(this.motion, {loopRestart:true}).catch(error=>this.events.error(error));
          }
          else {this.ended=true;this.events.playing(false);}
        }
      } else this.app.renderer.render(this.app.stage);
      this.events.time(this.position,this.motion?.duration || 0);
      this.frames++;
      if (now-this.fpsTime>1000) {
        this.events.fps(Math.round(this.frames*1000/(now-this.fpsTime)));
        this.frames=0;this.fpsTime=now;
      }
    } catch(error) {
      this.playing=false;
      this.events.error(error);
      // Prevent the same render error from repeating every frame.
      this.disposeModel();
    }
  }

  bindPointer() {
    let drag;
    this.canvas.addEventListener('pointerdown',event=>{
      if (event.button !== 0) return;
      drag={x:event.clientX,y:event.clientY,ox:this.offset.x,oy:this.offset.y};
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(drag){this.offset={x:drag.ox+event.clientX-drag.x,y:drag.oy+event.clientY-drag.y};this.layout();}
      else if(this.follow&&this.model){const rect=this.canvas.getBoundingClientRect();this.model.focus(event.clientX-rect.left,event.clientY-rect.top);}
    });
    const finish=()=>{drag=null;};
    this.canvas.addEventListener('pointerup',finish);
    this.canvas.addEventListener('pointercancel',finish);
    this.canvas.addEventListener('pointerleave',()=>{
      if(this.follow&&this.model)this.model.internalModel.focusController.focus(0,0);
    });
    this.canvas.addEventListener('dblclick',()=>this.resetView());
    this.canvas.addEventListener('wheel',event=>{event.preventDefault();this.setZoom(this.zoom*Math.exp(-event.deltaY*.001));},{passive:false});
  }

  screenshot() {
    if(!this.model) throw new Error('请等待模型载入完成');
    this.app.renderer.render(this.app.stage);
    return this.canvas.toDataURL('image/png');
  }
}
