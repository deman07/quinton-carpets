/**
 * The hanging sample in the home banner: a piece of carpet under a
 * header card, pinned along its top edge and moving in a slow
 * draught. After Meng To's Woven Cloth (MIT), rebuilt without
 * three.js — a verlet cloth and one lit, textured mesh in plain WebGL.
 *
 * It stops when the banner scrolls away or the tab is hidden, and
 * reduced motion gets one settled frame instead of the loop.
 */

const cloth = document.querySelector<HTMLCanvasElement>("#cloth");

if (cloth) {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The cloth in world units, and the grid it is simulated on. Cells
  // stay near square so the constraints pull evenly both ways.
  const BW = 3;
  const BH = 3.5;
  const GX = 28;
  const GY = 33;
  // The header card is stiff, so its rows are pinned and only the
  // carpet below it moves.
  const CARD_ROWS = 7;
  const PINNED = (GX + 1) * (CARD_ROWS + 1);
  const N = (GX + 1) * (GY + 1);
  const idx = (ix: number, iy: number) => ix + iy * (GX + 1);
  const GRAV = -3.1;
  const DAMP = 0.985;
  const DT = 1 / 60;
  const FOV = (42 * Math.PI) / 180;

  const cur = new Float32Array(N * 3);
  const prev = new Float32Array(N * 3);
  const normals = new Float32Array(N * 3);
  const uvs = new Float32Array(N * 2);
  for (let iy = 0; iy <= GY; iy++) {
    for (let ix = 0; ix <= GX; ix++) {
      const i = idx(ix, iy);
      cur[i * 3] = (ix / GX - 0.5) * BW;
      cur[i * 3 + 1] = (0.5 - iy / GY) * BH;
      uvs[i * 2] = ix / GX;
      uvs[i * 2 + 1] = iy / GY;
    }
  }
  prev.set(cur);

  const tris: number[] = [];
  for (let iy = 0; iy < GY; iy++) {
    for (let ix = 0; ix < GX; ix++) {
      const a = idx(ix, iy);
      const b = idx(ix, iy + 1);
      const c = idx(ix + 1, iy + 1);
      const d = idx(ix + 1, iy);
      tris.push(a, b, d, b, c, d);
    }
  }
  const index = new Uint16Array(tris);

  /* ---------------- the simulation ---------------- */

  const solve = (a: number, b: number, len: number) => {
    const pa = a < PINNED;
    const pb = b < PINNED;
    const ax = a * 3;
    const bx = b * 3;
    let dx = cur[bx] - cur[ax];
    let dy = cur[bx + 1] - cur[ax + 1];
    let dz = cur[bx + 2] - cur[ax + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const k = ((d - len) / d) * 0.5;
    dx *= k;
    dy *= k;
    dz *= k;
    if (!pa) {
      const s = pb ? 2 : 1;
      cur[ax] += dx * s;
      cur[ax + 1] += dy * s;
      cur[ax + 2] += dz * s;
    }
    if (!pb) {
      const s = pa ? 2 : 1;
      cur[bx] -= dx * s;
      cur[bx + 1] -= dy * s;
      cur[bx + 2] -= dz * s;
    }
  };

  const nudge = (j: number, force: number) => {
    const v = (cur[j] - prev[j]) * DAMP;
    prev[j] = cur[j];
    cur[j] += v + force * DT * DT;
  };

  // The draught travels down the cloth and grows towards the hem.
  // Carpet is heavy, so it sways where the original banner billowed.
  const step = (t: number) => {
    const gust = 0.6 + 0.42 * Math.sin(t * 0.6) + 0.18 * Math.sin(t * 1.9 + 1.3);
    for (let iy = CARD_ROWS + 1; iy <= GY; iy++) {
      const cy = (iy - CARD_ROWS) / (GY - CARD_ROWS);
      const travel = t * 1.2 - cy * 3.6;
      const fx = Math.sin(t * 0.7 + cy * 2.2) * 0.4 * cy;
      const fy = GRAV - 0.4 * cy;
      for (let ix = 0; ix <= GX; ix++) {
        const cx = ix / GX;
        const fz =
          (Math.sin(travel + cx * 3.3) + 0.5 * Math.sin(travel * 1.7 + cx * 6)) * 2.6 * cy * gust;
        const j = idx(ix, iy) * 3;
        nudge(j, fx);
        nudge(j + 1, fy);
        nudge(j + 2, fz);
      }
    }
    for (let it = 0; it < 3; it++) {
      for (let iy = 0; iy <= GY; iy++) {
        for (let ix = 0; ix < GX; ix++) solve(idx(ix, iy), idx(ix + 1, iy), BW / GX);
      }
      for (let iy = 0; iy < GY; iy++) {
        for (let ix = 0; ix <= GX; ix++) solve(idx(ix, iy), idx(ix, iy + 1), BH / GY);
      }
    }
  };

  // Summed face normals; the shader normalises them.
  const computeNormals = () => {
    normals.fill(0);
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3;
      const b = index[t + 1] * 3;
      const c = index[t + 2] * 3;
      const ux = cur[b] - cur[a], uy = cur[b + 1] - cur[a + 1], uz = cur[b + 2] - cur[a + 2];
      const vx = cur[c] - cur[a], vy = cur[c + 1] - cur[a + 1], vz = cur[c + 2] - cur[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) {
        normals[v] += nx;
        normals[v + 1] += ny;
        normals[v + 2] += nz;
      }
    }
  };

  /* ---------------- the sample's face ---------------- */

  // Drawn at the cloth's own proportions onto a power-of-two square,
  // so it can mipmap in WebGL 1; the mesh stretches it back.
  const paintSample = (photo: HTMLImageElement, name: string) => {
    const S = 1024;
    const W = 1024;
    const H = Math.round((W * BH) / BW);
    const HEAD = Math.round((H * CARD_ROWS) / GY);
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    if (!x) return c;
    x.scale(1, S / H);

    // The carpet, cropped to fill everything under the card.
    x.fillStyle = "#A69C86";
    x.fillRect(0, HEAD, W, H - HEAD);
    if (photo.complete && photo.naturalWidth) {
      const scale = Math.max(W / photo.naturalWidth, (H - HEAD) / photo.naturalHeight);
      const sw = W / scale;
      const sh = (H - HEAD) / scale;
      x.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, 0, HEAD, W, H - HEAD);
    }
    // Bound edges, as on a real sample.
    x.strokeStyle = "#15120C";
    x.lineWidth = 16;
    x.strokeRect(8, HEAD, W - 16, H - HEAD - 8);

    // The header card, with its hanger eyelets.
    x.fillStyle = "#FFC61A";
    x.fillRect(0, 0, W, HEAD);
    x.fillStyle = "#15120C";
    x.fillRect(0, HEAD - 10, W, 10);
    for (const ex of [66, W - 66]) {
      x.beginPath();
      x.arc(ex, 60, 18, 0, Math.PI * 2);
      x.fill();
    }
    x.textAlign = "center";
    x.letterSpacing = "6px";
    x.font = '500 26px "DM Mono", monospace';
    x.fillText(`SAMPLE · ${name.toUpperCase()}`, W / 2, 70);
    x.fillText("FAMILY RUN · HAGLEY ROAD WEST", W / 2, 218);
    x.letterSpacing = "0px";
    x.fontStretch = "expanded";
    x.font = '800 100px Archivo, sans-serif';
    const fit = Math.min(100, (100 * (W - 150)) / x.measureText("QUINTON CARPETS").width);
    x.font = `800 ${Math.floor(fit)}px Archivo, sans-serif`;
    x.fillText("QUINTON CARPETS", W / 2, 168);

    // Threads across the card, then a little slub over everything.
    x.lineWidth = 1;
    x.strokeStyle = "rgba(60,30,20,0.06)";
    for (let y = 0; y < HEAD; y += 3) x.strokeRect(0, y + 0.5, W, 0);
    x.strokeStyle = "rgba(255,250,235,0.08)";
    for (let px = 0; px < W; px += 3) x.strokeRect(px + 0.5, 0, 0, HEAD);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const img = x.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() * 2 - 1) * 7;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  /* ---------------- WebGL ---------------- */

  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform mat4 uProj;
    uniform vec3 uEye;
    varying vec3 vView;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vView = uEye - aPos;
      vNormal = aNormal;
      vUv = aUv;
      gl_Position = uProj * vec4(aPos - uEye, 1.0);
    }`;

  // A warm key light from the upper left, a yellow rim from the lower
  // right, and a faint sheen on the pile. Lit in linear light.
  const FRAG = `
    precision mediump float;
    uniform sampler2D uMap;
    varying vec3 vView;
    varying vec3 vNormal;
    varying vec2 vUv;
    const vec3 KEY = vec3(-0.535, 0.624, 0.570);
    const vec3 RIM = vec3(0.768, -0.384, 0.512);
    void main() {
      vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      vec3 albedo = pow(texture2D(uMap, vUv).rgb, vec3(2.2));
      vec3 light = vec3(1.0, 0.86, 0.72) * 0.4
        + vec3(1.0, 0.94, 0.86) * 0.85 * max(dot(n, KEY), 0.0)
        + vec3(1.0, 0.56, 0.02) * 0.3 * max(dot(n, RIM), 0.0);
      float sheen = pow(max(dot(n, normalize(KEY + normalize(vView))), 0.0), 14.0) * 0.05;
      gl_FragColor = vec4(pow(albedo * light + sheen, vec3(1.0 / 2.2)), 1.0);
    }`;

  const boot = async () => {
    const photo = new Image();
    photo.src = cloth.dataset.photo ?? "";
    // A missing photo or font still paints a sample, just a plainer one.
    await Promise.allSettled([
      photo.decode(),
      document.fonts.load('800 100px "Archivo"'),
      document.fonts.load('500 26px "DM Mono"'),
    ]);

    const gl = cloth.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return; // no WebGL: the sample simply isn't drawn

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const attribute = (data: Float32Array, name: string, size: number, usage: number) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return buf;
    };
    const posBuf = attribute(cur, "aPos", 3, gl.DYNAMIC_DRAW);
    const nrmBuf = attribute(normals, "aNormal", 3, gl.DYNAMIC_DRAW);
    attribute(uvs, "aUv", 2, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintSample(photo, cloth.dataset.name ?? ""));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const uProj = gl.getUniformLocation(prog, "uProj");
    const uEye = gl.getUniformLocation(prog, "uEye");

    // Frame the whole cloth, with room for the hem to swing.
    const fit = () => {
      const r = cloth.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cloth.width = Math.max(1, Math.round(r.width * dpr));
      cloth.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, cloth.width, cloth.height);
      const aspect = r.width / r.height || 1;
      const f = 1 / Math.tan(FOV / 2);
      const near = 0.1;
      const far = 100;
      gl.uniformMatrix4fv(uProj, false, [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
      ]);
      gl.uniform3f(uEye, 0, 0, Math.max(BH / 2, BW / 2 / aspect) * f * 1.16 + 0.4);
    };

    const draw = () => {
      computeNormals();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, cur);
      gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, normals);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
    };

    // Fixed steps, so the cloth moves at the same pace at 60Hz or 144Hz.
    let t = 0;
    let raf = 0;
    let last = 0;
    let lag = 0;
    let onScreen = true;
    const frame = (now: number) => {
      lag += Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      while (lag >= DT) {
        t += DT;
        step(t);
        lag -= DT;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      if (raf || RM || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Let it fall into a hang first, rather than start flat.
    for (const end = RM ? 220 : 120; t < end * DT; t += DT) step(t);

    fit();
    draw();
    cloth.classList.add("on");

    new ResizeObserver(() => {
      fit();
      if (!raf) draw();
    }).observe(cloth);
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) run();
      else stop();
    }).observe(cloth);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : run()));
    run();
  };

  void boot();
}
