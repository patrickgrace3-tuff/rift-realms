"use strict";
// The open-world atmosphere: a sky dome (gradient, sun and moon, stars, drifting clouds, a ring of distant
// mountains on the horizon), a day/night cycle that moves the sunlight, long-distance haze that melts into
// the horizon, and a detail texture on the ground. The time of day comes from the host's world clock, so
// everyone in a co-op world sees the same sky.

const DAY_LENGTH = 24 * 60;   // seconds for a full day and night
const DAY_START = .3;         // a new world starts in the morning
let SKY = null;

const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
uniform vec3 top, horizon, ground, sunCol, mountCol, cloudCol, sunDir;
uniform float night, time;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(horizon, top, smoothstep(0.0, 0.55, h));
  col = mix(col, ground, smoothstep(0.0, -0.25, h));
  // the sun, its glow, and the moon opposite it
  float s = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(s, 10.0) * 0.3 + pow(s, 180.0) * 0.8 + smoothstep(0.9993, 0.9996, s) * 2.0);
  float m = max(dot(d, -sunDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9991, 0.9994, m) * night;
  // stars come out at night
  if(h > 0.0){ vec2 sp = floor(vec2(atan(d.z, d.x) * 140.0, h * 180.0)); col += vec3(step(0.9965, hash(sp)) * night * smoothstep(0.0, 0.25, h)); }
  // drifting clouds
  if(h > 0.0){
    vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(time * 0.004, time * 0.0015);
    float c = fbm(uv * 1.4), cl = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.2, h);
    col = mix(col, cloudCol, cl * 0.85);
  }
  // a ring of far-off mountains on the horizon, softened by haze
  float az = atan(d.z, d.x); vec2 ring = vec2(cos(az), sin(az));
  float mh = 0.012 + 0.05 * noise(ring * 3.0 + 7.0) + 0.025 * noise(ring * 11.0 + 3.0);
  float mm = (1.0 - smoothstep(mh - 0.003, mh, h)) * step(-0.08, h);
  col = mix(col, mix(mountCol, horizon, 0.25 + 0.45 * (1.0 - smoothstep(-0.03, mh, h))), mm);
  gl_FragColor = vec4(col, 1.0);
}`;

function buildSky(){
  const u = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
    mountCol: { value: new THREE.Color() }, cloudCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 }, time: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat); mesh.renderOrder = -10; mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  SKY = { mesh, u };
  // a fine detail texture on every outdoor ground (it multiplies the ground's own colours)
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#ececec"; g.fillRect(0, 0, 256, 256);
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let i = 0; i < 2600; i++){ const v = 190 + rnd() * 65 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 2 + rnd() * 5); }   // grass strokes and grit
  for(let i = 0; i < 90; i++){ const v = 200 + rnd() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 4 + rnd() * 14, 0, Math.PI * 2); g.fill(); }   // soft patches
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(46, 46); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  zone.traverse(o => { if(o.isMesh && o.material && o.material.vertexColors && o.geometry.type === "PlaneGeometry" && o.geometry.parameters.widthSegments >= 200){ o.material.map = tex; o.material.needsUpdate = true; } });
}

// colours of the sky through the day, by the sun's height (-1 midnight … 1 noon)
const SKYC = window.THREE ? {
  nightTop: new THREE.Color(0x0a1430), dayTop: new THREE.Color(0x3f86d8), twiTop: new THREE.Color(0x3a4a86),
  nightHor: new THREE.Color(0x1c2540), dayHor: new THREE.Color(0xb4d6ee), twiHor: new THREE.Color(0xf2a070),
  nightCloud: new THREE.Color(0x2a3048), dayCloud: new THREE.Color(0xffffff), twiCloud: new THREE.Color(0xffa880),
  nightMount: new THREE.Color(0x121a2c), dayMount: new THREE.Color(0x7088a6),
  sunLow: new THREE.Color(0xff8a40), sunHigh: new THREE.Color(0xfff2d0), moon: new THREE.Color(0x9ab4ff),
  hemiDay: new THREE.Color(0xdff1ff), hemiNight: new THREE.Color(0x6a7aa8), tmp: new THREE.Color(),
} : null;
const timeOfDay = () => ((G && G.snap ? G.snap.t : 0) / DAY_LENGTH + DAY_START) % 1;
function dayPhaseName(dt){ return dt < .2 || dt > .85 ? "Night" : dt < .3 ? "Dawn" : dt < .45 ? "Morning" : dt < .6 ? "Midday" : dt < .72 ? "Afternoon" : "Dusk"; }
function updateAtmosphere(meSnap, t){
  if(!SKY || !meSnap) return;
  const inCath = meSnap.y > DZ && meSnap.x <= ZS;
  SKY.mesh.visible = !inCath;
  if(inCath) return;                      // the cathedral keeps its own darkness
  const dt = timeOfDay(), ang = (dt - .25) * Math.PI * 2, e = Math.sin(ang);
  const sunDir = new THREE.Vector3(Math.cos(ang) * .8, e, .45).normalize();
  const day = THREE.MathUtils.smoothstep(e, -.12, .25), twi = Math.max(0, 1 - Math.abs(e - .02) / .24), C = SKYC, u = SKY.u;
  u.top.value.copy(C.nightTop).lerp(C.dayTop, day).lerp(C.twiTop, twi * .5);
  u.horizon.value.copy(C.nightHor).lerp(C.dayHor, day).lerp(C.twiHor, twi * .65);
  // each zone tints its sky: snowy grey-blue in the Peaks, humid green in the jungle, hot gold in the desert
  const jungle = inJungle(meSnap.x, meSnap.y), desert = inDesert(meSnap.x, meSnap.y), peaks = Math.max(0, Math.min(1, (meSnap.y - (ZS - 600)) / 1400));
  if(desert){ u.horizon.value.lerp(DESERT_FOG, .5 * (.3 + .7 * day)); u.top.value.lerp(DESERT_FOG, .08); }
  else if(jungle){ u.horizon.value.lerp(JUNGLE_FOG, .4 * (.4 + .6 * day)); u.top.value.lerp(JUNGLE_FOG, .12); }
  else if(peaks > 0) u.horizon.value.lerp(SKY_PEAKS, .35 * peaks * (.4 + .6 * day));
  u.ground.value.copy(u.horizon.value).multiplyScalar(.7);
  u.cloudCol.value.copy(C.nightCloud).lerp(C.dayCloud, day).lerp(C.twiCloud, twi * .55);
  u.mountCol.value.copy(C.nightMount).lerp(C.dayMount, day).lerp(u.horizon.value, .25);
  u.sunCol.value.copy(C.sunLow).lerp(C.sunHigh, THREE.MathUtils.smoothstep(e, 0, .45)).multiplyScalar(e > -.08 ? 1 : 0);
  u.sunDir.value.copy(sunDir); u.night.value = 1 - THREE.MathUtils.smoothstep(e, -.2, .05); u.time.value = t;
  SKY.mesh.position.copy(camera.position);
  // the fog is the horizon, so the land fades into the sky
  scene.fog.color.copy(u.horizon.value); scene.background.copy(u.horizon.value);
  // sunlight by day, cool moonlight by night (never so dark you can't play)
  const sunUp = e > -.06;
  SUN.position.copy(sunUp ? sunDir : sunDir.clone().negate()).multiplyScalar(500);
  SUN.color.copy(sunUp ? C.tmp.copy(C.sunLow).lerp(C.sunHigh, THREE.MathUtils.smoothstep(e, 0, .45)) : C.moon);
  SUN.intensity = sunUp ? .35 + .75 * day : .38;
  HEMI.color.copy(C.hemiNight).lerp(C.hemiDay, day); HEMI.intensity = .55 + .5 * day;
}
