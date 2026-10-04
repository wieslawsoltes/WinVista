import { EventBus } from "../core/index.js";

const GPU_SHADER = `
struct Params { viewport: vec2f, image: vec2f, tint: vec4f };
@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Output { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> Output {
  let vertices = array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));
  var o: Output; o.position=vec4f(vertices[i],0.,1.);o.uv=vec2f((vertices[i].x+1.)*.5,1.-(vertices[i].y+1.)*.5);return o;
}
@fragment fn fs(i:Output)->@location(0) vec4f {
  let va=params.viewport.x/params.viewport.y;let ia=params.image.x/params.image.y;
  let scale=select(vec2f(1.,ia/va),vec2f(va/ia,1.),va<ia);
  let uv=(i.uv-.5)*scale+.5;let color=textureSample(tex,smp,uv);
  return vec4f(mix(color.rgb,params.tint.rgb,params.tint.a),1.);
}`;
const FILTER_SHADER = `
struct Params { count:u32, mode:u32, width:u32, unused:u32 };
@group(0) @binding(0) var<storage,read> input:array<u32>;
@group(0) @binding(1) var<storage,read_write> output:array<u32>;
@group(0) @binding(2) var<uniform> params:Params;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id:vec3u){
 let i=id.x+id.y*params.width; if(i>=params.count){return;}let v=input[i];
 let r=v&255u;let g=(v>>8u)&255u;let b=(v>>16u)&255u;let a=v&0xff000000u;
 let lum=299u*r+587u*g+114u*b;var q=vec3u(r,g,b);
 if(params.mode==0u){q=vec3u(255u)-q;}
 else if(params.mode==1u){q=vec3u((lum+500u)/1000u);}
 else if(params.mode==2u){q=min(vec3u(255u),vec3u((393u*r+769u*g+189u*b+500u)/1000u,(349u*r+686u*g+168u*b+500u)/1000u,(272u*r+534u*g+131u*b+500u)/1000u));}
 else {q=select(vec3u(0u),vec3u(255u),lum>127000u);}
 output[i]=q.x|(q.y<<8u)|(q.z<<16u)|a;
}`;

/** A retained wallpaper surface and optional compute raster operations.
 * All renderer backends share source image and settings; no model state lives only on the GPU.
 */
export class DesktopRenderer extends EventBus {
  constructor(host, settings) {
    super();
    this.host = host;
    this.settings = settings;
    this.canvas = null;
    this.backend = "Initializing";
    this.device = null;
    this.destroyed = false;
    this.pending = false;
    this.image = null;
    this.version = 0;
    this.resources = [];
    this.lifecycle = new AbortController();
    this.observer = new ResizeObserver(() => this.invalidate());
    this.observer.observe(host);
  }
  newCanvas() {
    this.canvas?.remove();
    this.canvas = document.createElement("canvas");
    this.canvas.className = "desktop-wallpaper";
    this.canvas.setAttribute("aria-hidden", "true");
    this.host.prepend(this.canvas);
    return this.canvas;
  }
  async init() {
    await this.loadImage(
      this.settings.get("wallpaper", "/assets/wallpaper.jpg"),
    );
    const preferred = this.settings.get("renderer", "auto");
    if (preferred === "auto" || preferred === "webgpu") {
      try {
        if (navigator.gpu) {
          const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "low-power",
          });
          if (adapter) {
            this.device = await adapter.requestDevice();
            if (this.destroyed) {
              this.device.destroy();
              return this;
            }
            await this.initGPU();
            this.backend = "WebGPU";
            this.device.lost.then((info) => {
              if (!this.destroyed) {
                this.device = null;
                this.emit("lost", info);
                this.fallback();
              }
            });
          }
        }
      } catch (e) {
        this.emit("diagnostic", e.message);
        this.device?.destroy();
        this.device = null;
      }
    }
    if (this.backend !== "WebGPU") this.fallback(preferred === "canvas2d");
    this.emit("ready", this.backend);
    this.invalidate();
    return this;
  }
  async loadImage(url) {
    const version = ++this.version;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      if (url !== "/assets/wallpaper.jpg") {
        img.src = "/assets/wallpaper.jpg";
        await img.decode();
      } else throw new Error("The desktop wallpaper could not be loaded.");
    }
    if (this.destroyed || version !== this.version) return;
    this.image = img;
    if (this.backend === "WebGPU") this.uploadGPU();
    else if (this.backend === "WebGL2") this.uploadGL();
    this.invalidate();
  }
  async initGPU() {
    const d = this.device,
      c = this.newCanvas(),
      ctx = c.getContext("webgpu");
    if (!ctx) throw new Error("WebGPU canvas unavailable");
    this.context = ctx;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device: d, format: this.format, alphaMode: "opaque" });
    d.pushErrorScope("validation");
    const module = d.createShaderModule({ code: GPU_SHADER });
    this.pipeline = await d.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: {
        module,
        entryPoint: "fs",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const error = await d.popErrorScope();
    if (error) throw new Error(error.message);
    this.uniform = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.sampler = d.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    this.uploadGPU();
  }
  textureSource(maximum) {
    const width = this.image.naturalWidth,
      height = this.image.naturalHeight,
      scale = Math.min(1, maximum / Math.max(width, height));
    if (scale === 1) return { source: this.image, width, height };
    const source = document.createElement("canvas");
    source.width = Math.max(1, Math.round(width * scale));
    source.height = Math.max(1, Math.round(height * scale));
    source
      .getContext("2d")
      .drawImage(this.image, 0, 0, source.width, source.height);
    return { source, width: source.width, height: source.height };
  }
  uploadGPU() {
    if (!this.device || !this.image) return;
    const d = this.device,
      source = this.textureSource(this.device.limits.maxTextureDimension2D);
    this.texture?.destroy();
    this.texture = d.createTexture({
      size: [source.width, source.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    d.queue.copyExternalImageToTexture(
      { source: source.source },
      { texture: this.texture },
      [source.width, source.height],
    );
    this.bindGroup = d.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.uniform } },
      ],
    });
  }
  fallback(force2D = false) {
    if (this.destroyed) return;
    this.backend = "Canvas 2D";
    this.gl = null;
    this.context = null;
    const canvas = this.newCanvas();
    if (!force2D)
      try {
        const gl = canvas.getContext("webgl2", {
          alpha: false,
          antialias: false,
          powerPreference: "low-power",
        });
        if (gl) {
          this.initGL(gl);
          this.backend = "WebGL2";
        }
      } catch (e) {
        this.emit("diagnostic", e.message);
        this.newCanvas();
      }
    if (this.backend === "Canvas 2D") {
      if (this.canvas.getContext("2d") === null) this.newCanvas();
      this.context = this.canvas.getContext("2d", { alpha: false });
    }
    this.emit("ready", this.backend);
    this.invalidate();
  }
  initGL(gl) {
    this.gl = gl;
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = compile(
      gl.VERTEX_SHADER,
      "#version 300 es\nout vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}",
    );
    const fs = compile(
      gl.FRAGMENT_SHADER,
      "#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D image;uniform vec2 scale;out vec4 color;void main(){color=texture(image,(uv-.5)*scale+.5);}",
    );
    this.glProgram = gl.createProgram();
    gl.attachShader(this.glProgram, vs);
    gl.attachShader(this.glProgram, fs);
    gl.linkProgram(this.glProgram);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.glProgram, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.glProgram));
    this.glTexture = gl.createTexture();
    this.uploadGL();
    this.canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        this.fallback(true);
      },
      { signal: this.lifecycle.signal },
    );
  }
  uploadGL() {
    const gl = this.gl;
    if (!gl || !this.image) return;
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.textureSource(gl.getParameter(gl.MAX_TEXTURE_SIZE)).source,
    );
  }
  invalidate() {
    if (this.pending || this.destroyed) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.draw();
    });
  }
  draw() {
    if (this.destroyed || !this.image || !this.canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2),
      max = this.device?.limits.maxTextureDimension2D || 8192,
      w = Math.max(1, Math.min(max, Math.round(this.host.clientWidth * dpr))),
      h = Math.max(1, Math.min(max, Math.round(this.host.clientHeight * dpr)));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const iw = this.image.naturalWidth,
      ih = this.image.naturalHeight;
    try {
      if (this.backend === "WebGPU" && this.device) {
        this.device.queue.writeBuffer(
          this.uniform,
          0,
          new Float32Array([w, h, iw, ih, 0, 0, 0, 0]),
        );
        const encoder = this.device.createCommandEncoder(),
          pass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: this.context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0.1, b: 0.2, a: 1 },
                storeOp: "store",
              },
            ],
          });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
      } else if (this.backend === "WebGL2") {
        const gl = this.gl;
        gl.viewport(0, 0, w, h);
        gl.useProgram(this.glProgram);
        gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
        const va = w / h,
          ia = iw / ih;
        gl.uniform2f(
          gl.getUniformLocation(this.glProgram, "scale"),
          va < ia ? va / ia : 1,
          va < ia ? 1 : ia / va,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else {
        const ctx = this.context,
          scale = Math.max(w / iw, h / ih),
          dw = iw * scale,
          dh = ih * scale;
        ctx.drawImage(this.image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    } catch (error) {
      this.emit("diagnostic", error.message);
      this.fallback(true);
    }
  }
  async filter(imageData, mode = 0) {
    const bytes = imageData.data,
      count = imageData.width * imageData.height,
      d = this.device;
    if (
      d &&
      count > 0 &&
      bytes.byteLength <=
        Math.min(d.limits.maxStorageBufferBindingSize, d.limits.maxBufferSize)
    ) {
      const resources = [];
      let scoped = false;
      try {
        if (!this.filterPipeline) {
          const module = d.createShaderModule({ code: FILTER_SHADER });
          this.filterPipeline = await d.createComputePipelineAsync({
            layout: "auto",
            compute: { module, entryPoint: "main" },
          });
        }
        d.pushErrorScope("validation");
        scoped = true;
        const buffer = (size, usage) => {
          const b = d.createBuffer({ size, usage });
          resources.push(b);
          return b;
        };
        const input = buffer(
            bytes.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          ),
          output = buffer(
            bytes.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
          ),
          params = buffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
          read = buffer(
            bytes.byteLength,
            GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
          );
        const groups = Math.ceil(count / 256),
          columns = Math.min(groups, d.limits.maxComputeWorkgroupsPerDimension),
          rows = Math.ceil(groups / columns);
        if (rows > d.limits.maxComputeWorkgroupsPerDimension)
          throw new Error("Image exceeds GPU dispatch limits.");
        d.queue.writeBuffer(input, 0, bytes);
        d.queue.writeBuffer(
          params,
          0,
          new Uint32Array([count, mode, columns * 256, 0]),
        );
        const group = d.createBindGroup({
          layout: this.filterPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: input } },
            { binding: 1, resource: { buffer: output } },
            { binding: 2, resource: { buffer: params } },
          ],
        });
        const encoder = d.createCommandEncoder(),
          pass = encoder.beginComputePass();
        pass.setPipeline(this.filterPipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(columns, rows);
        pass.end();
        encoder.copyBufferToBuffer(output, 0, read, 0, bytes.byteLength);
        d.queue.submit([encoder.finish()]);
        const error = await d.popErrorScope();
        scoped = false;
        if (error) throw new Error(error.message);
        await read.mapAsync(GPUMapMode.READ);
        const result = new Uint8ClampedArray(read.getMappedRange().slice(0));
        read.unmap();
        return new ImageData(result, imageData.width, imageData.height);
      } catch (error) {
        this.emit("diagnostic", error.message);
      } finally {
        if (scoped) await d.popErrorScope().catch(() => {});
        for (const resource of resources) resource.destroy();
      }
    }
    return new ImageData(
      filterPixels(bytes, mode),
      imageData.width,
      imageData.height,
    );
  }
  dispose() {
    this.destroyed = true;
    this.lifecycle.abort();
    this.observer.disconnect();
    this.texture?.destroy();
    this.uniform?.destroy();
    this.device?.destroy();
    if (this.gl) {
      this.gl.deleteProgram(this.glProgram);
      this.gl.deleteTexture(this.glTexture);
    }
    this.canvas?.remove();
  }
}

/** Byte-identical rounding policy shared with the compute shader. */
export function filterPixels(bytes, mode = 0) {
  const result = new Uint8ClampedArray(bytes),
    round = (value) => Math.min(255, Math.max(0, Math.floor(value + 0.5)));
  for (let i = 0; i < result.length; i += 4) {
    const r = bytes[i],
      g = bytes[i + 1],
      b = bytes[i + 2];
    if (mode === 0) {
      result[i] = 255 - r;
      result[i + 1] = 255 - g;
      result[i + 2] = 255 - b;
    } else if (mode === 1) {
      result[i] =
        result[i + 1] =
        result[i + 2] =
          round((299 * r + 587 * g + 114 * b) / 1000);
    } else if (mode === 2) {
      result[i] = round((393 * r + 769 * g + 189 * b) / 1000);
      result[i + 1] = round((349 * r + 686 * g + 168 * b) / 1000);
      result[i + 2] = round((272 * r + 534 * g + 131 * b) / 1000);
    } else {
      result[i] =
        result[i + 1] =
        result[i + 2] =
          299 * r + 587 * g + 114 * b > 127000 ? 255 : 0;
    }
  }
  return result;
}
