/* A tiny software canvas for Node: just enough of CanvasRenderingContext2D for the web version's pixel art (fillRect,
   clearRect, drawImage with nearest-neighbour scaling, globalAlpha, translate/scale/rotate, simple paths), plus a PNG
   encoder. The exporter uses it to render pixel art exactly as the browser draws it and save it for Unity. */
const zlib = require('zlib');

function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 0];
  s = s.trim();
  if (s[0] === '#') {
    let h = s.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map((v) => parseFloat(v)); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  if (s === 'white') return [255, 255, 255, 1]; if (s === 'black') return [0, 0, 0, 1]; if (s === 'transparent') return [0, 0, 0, 0];
  return [0, 0, 0, 1];
}

class Ctx {
  constructor(c) { this.canvas = c; this.fillStyle = '#000'; this.strokeStyle = '#000'; this.globalAlpha = 1; this.lineWidth = 1; this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.path = []; this.imageSmoothingEnabled = false; this.font = ''; this.textAlign = 'left'; this.textBaseline = 'alphabetic'; this.globalCompositeOperation = 'source-over'; }
  save() { this.stack.push({ m: this.m.slice(), a: this.globalAlpha, f: this.fillStyle, s: this.strokeStyle }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.globalAlpha = s.a; this.fillStyle = s.f; this.strokeStyle = s.s; } }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  pt(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  inv(x, y) { const [a, b, c, d, e, f] = this.m, det = a * d - b * c; x -= e; y -= f; return [(d * x - c * y) / det, (-b * x + a * y) / det]; }
  blend(X, Y, r, g, b, a) {
    const C = this.canvas; if (X < 0 || Y < 0 || X >= C.width || Y >= C.height || a <= 0) return;
    const i = (Y * C.width + X) * 4, d = C.data, da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = Math.round((r * a + d[i] * da * (1 - a)) / oa); d[i + 1] = Math.round((g * a + d[i + 1] * da * (1 - a)) / oa); d[i + 2] = Math.round((b * a + d[i + 2] * da * (1 - a)) / oa); d[i + 3] = Math.round(oa * 255);
  }
  /** Fill device pixels whose centres fall inside the transformed rectangle. */
  fillRect(x, y, w, h) {
    if (w === 0 || h === 0) return;
    const [r, g, b, a0] = parseColor(this.fillStyle), a = a0 * this.globalAlpha;
    const p = [this.pt(x, y), this.pt(x + w, y), this.pt(x, y + h), this.pt(x + w, y + h)];
    const x0 = Math.min(...p.map((q) => q[0])), x1 = Math.max(...p.map((q) => q[0])), y0 = Math.min(...p.map((q) => q[1])), y1 = Math.max(...p.map((q) => q[1]));
    const axis = this.m[1] === 0 && this.m[2] === 0;
    for (let Y = Math.max(0, Math.round(y0)); Y < Math.min(this.canvas.height, Math.round(y1)); Y++)
      for (let X = Math.max(0, Math.round(x0)); X < Math.min(this.canvas.width, Math.round(x1)); X++) {
        if (!axis) { const [u, v] = this.inv(X + 0.5, Y + 0.5); if (u < Math.min(x, x + w) || u >= Math.max(x, x + w) || v < Math.min(y, y + h) || v >= Math.max(y, y + h)) continue; }
        this.blend(X, Y, r, g, b, a);
      }
  }
  clearRect(x, y, w, h) {
    const [px, py] = this.pt(x, y), C = this.canvas;
    for (let Y = Math.max(0, Math.round(py)); Y < Math.min(C.height, Math.round(py + h)); Y++) for (let X = Math.max(0, Math.round(px)); X < Math.min(C.width, Math.round(px + w)); X++) C.data.fill(0, (Y * C.width + X) * 4, (Y * C.width + X) * 4 + 4);
  }
  drawImage(img, ...a) {
    if (!img || !img.data) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; } else if (a.length === 4) { [dx, dy, dw, dh] = a; } else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    if (!dw || !dh) return;
    const p = [this.pt(dx, dy), this.pt(dx + dw, dy), this.pt(dx, dy + dh), this.pt(dx + dw, dy + dh)];
    const x0 = Math.min(...p.map((q) => q[0])), x1 = Math.max(...p.map((q) => q[0])), y0 = Math.min(...p.map((q) => q[1])), y1 = Math.max(...p.map((q) => q[1]));
    for (let Y = Math.max(0, Math.round(y0)); Y < Math.min(this.canvas.height, Math.round(y1)); Y++)
      for (let X = Math.max(0, Math.round(x0)); X < Math.min(this.canvas.width, Math.round(x1)); X++) {
        const [u, v] = this.inv(X + 0.5, Y + 0.5); if (u < dx || u >= dx + dw || v < dy || v >= dy + dh) continue;
        const ix = Math.floor(sx + ((u - dx) / dw) * sw), iy = Math.floor(sy + ((v - dy) / dh) * sh); if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) continue;
        const i = (iy * img.width + ix) * 4, d = img.data; if (!d[i + 3]) continue;
        this.blend(X, Y, d[i], d[i + 1], d[i + 2], (d[i + 3] / 255) * this.globalAlpha);
      }
  }
  // paths: polygons, rectangles, ellipses and arcs are flattened into points and filled with the even-odd rule
  beginPath() { this.path = []; this.cur = null; }
  moveTo(x, y) { this.cur = [this.pt(x, y)]; this.path.push(this.cur); }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.pt(x, y)); }
  closePath() { }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); }
  ellipse(cx, cy, rx, ry, rot, a0, a1) { const n = 48; for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(t) * rx, y = cy + Math.sin(t) * ry; i === 0 && !this.cur ? this.moveTo(x, y) : this.lineTo(x, y); } }
  arc(cx, cy, r, a0, a1) { this.ellipse(cx, cy, r, r, 0, a0, a1); }
  fill() {
    const [r, g, b, a0] = parseColor(this.fillStyle), a = a0 * this.globalAlpha, C = this.canvas;
    const polys = this.path.filter((q) => q.length > 2); if (!polys.length) return;
    let ys = polys.flat().map((q) => q[1]); const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(C.height - 1, Math.ceil(Math.max(...ys)));
    for (let Y = y0; Y <= y1; Y++) {
      const cy = Y + 0.5, xs = [];
      for (const poly of polys) for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let X = Math.max(0, Math.ceil(xs[k] - 0.5)); X <= Math.min(C.width - 1, Math.floor(xs[k + 1] - 0.5)); X++) this.blend(X, Y, r, g, b, a);
    }
  }
  stroke() {
    const [r, g, b, a0] = parseColor(this.strokeStyle), a = a0 * this.globalAlpha;
    for (const poly of this.path) for (let i = 0; i + 1 < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay)) || 1;
      for (let k = 0; k <= n; k++) this.blend(Math.floor(ax + ((bx - ax) * k) / n), Math.floor(ay + ((by - ay) * k) / n), r, g, b, a);
    }
  }
  strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.cur.push(this.cur[0]); this.stroke(); }
  setLineDash() {}
  fillText() {} strokeText() {} measureText(t) { return { width: String(t).length * 6 }; }
  getImageData(x, y, w, h) { const C = this.canvas, out = new Uint8ClampedArray(w * h * 4); for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) { const si = ((y + Y) * C.width + (x + X)) * 4, di = (Y * w + X) * 4; if (x + X >= 0 && y + Y >= 0 && x + X < C.width && y + Y < C.height) for (let k = 0; k < 4; k++) out[di + k] = C.data[si + k]; } return { data: out, width: w, height: h }; }
  putImageData(img, x, y) { const C = this.canvas; for (let Y = 0; Y < img.height; Y++) for (let X = 0; X < img.width; X++) { const di = ((y + Y) * C.width + (x + X)) * 4, si = (Y * img.width + X) * 4; if (x + X >= 0 && y + Y >= 0 && x + X < C.width && y + Y < C.height) for (let k = 0; k < 4; k++) C.data[di + k] = img.data[si + k]; } }
  createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
}

class Canvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); this.style = {}; this._ctx = null; }
  get width() { return this._w; } set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { return this._ctx || (this._ctx = new Ctx(this)); }
  toDataURL() { return 'data:image/png;base64,' + toPNG(this).toString('base64'); }
  addEventListener() {} setAttribute() {} get classList() { return { add() {}, remove() {}, toggle() {} }; }
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
/** Encode a canvas (or {width, height, data}) as a PNG file. */
function toPNG(c) {
  const w = c.width, h = c.height, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(c.data.buffer, c.data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { Canvas, Ctx, toPNG, parseColor };
