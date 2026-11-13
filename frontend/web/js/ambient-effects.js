import {createFrameBudget,visualActive,observeVisualActivity} from './render-budget.js';
import { EFFECTS, DOODLE_PARTICLES, RENDER_BUDGET } from './constants.js';

// Build the star once; reuse its geometry for every particle and frame.
const star = new Path2D();
for (let i = 0; i < 10; i++) {
  const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? .42 : 1;
  const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  i ? star.lineTo(x, y) : star.moveTo(x, y);
}
star.closePath();

function drawDoodle(ctx, shape, x, y, size, rotation, alpha) {
  if (shape === 'star') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size, size);
    ctx.globalAlpha = alpha; ctx.lineWidth = 1.3 / size; ctx.stroke(star); ctx.restore(); return;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size, size);
  ctx.strokeStyle = `rgba(${EFFECTS.ink},${alpha})`; ctx.lineWidth = 1.3 / size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (shape === 'heart') {
    ctx.moveTo(0, .85); ctx.bezierCurveTo(-1.7, -.2, -.7, -1.5, 0, -.5);
    ctx.bezierCurveTo(.75, -1.6, 1.7, -.1, 0, .85);
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? .42 : 1; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
  } else if (shape === 'spark') {
    ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.moveTo(0, -1); ctx.lineTo(0, 1); ctx.moveTo(-.65, -.65); ctx.lineTo(.65, .65); ctx.moveTo(.65, -.65); ctx.lineTo(-.65, .65);
  } else if (shape === 'spiral') {
    for (let i = 0; i <= 30; i++) { const angle = i / 30 * Math.PI * 3, radius = i / 30; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  } else if (shape === 'ring') {
    ctx.ellipse(0, 0, 1, .8, .2, .3, Math.PI * 2); ctx.moveTo(.7, -.8); ctx.lineTo(1.2, -1.2);
  } else {
    ctx.moveTo(-1, -.6); ctx.lineTo(-.3, -1); ctx.lineTo(-.55, .3); ctx.lineTo(.7, -.4); ctx.lineTo(.3, 1);
  }
  ctx.stroke(); ctx.restore();
}

// Two bounded canvas layers; events never prevent or capture normal interaction.
export function mountAmbientEffects(registry) {
  const create = className => {
    const canvas = document.createElement('canvas');
    canvas.className = className; canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    return { canvas, ctx: canvas.getContext('2d') };
  };
  const background = create('ambient-canvas'), pointer = create('pointer-fx-canvas');
  if (!background.ctx || !pointer.ctx) { background.canvas.remove(); pointer.canvas.remove(); return () => {}; }
  const budget=createFrameBudget(()=>particles.length?RENDER_BUDGET.pointerFps:RENDER_BUDGET.ambientFps);
  let width = 0, height = 0, frame = 0, last = 0, lastBackground = 0, elapsed = 0, dirty = true, pointerDrawn = false;
  let particles = [];
  // A modal dialog is above every ordinary z-index. Use a non-interactive
  // manual popover in the same top layer, promoted after the active dialog.
  const topLayer=typeof pointer.canvas.showPopover==='function';
  if(topLayer){pointer.canvas.setAttribute('popover','manual');Object.assign(pointer.canvas.style,{position:'fixed',inset:'0',margin:'0',padding:'0',border:'0',background:'transparent',pointerEvents:'none',width:'100vw',height:'100vh',maxWidth:'none',maxHeight:'none'});}
  const promote=()=>{if(!topLayer)return;pointer.canvas.style.zoom=String(1/(document.body.currentCSSZoom||((parseFloat(getComputedStyle(document.body).zoom)||1)*(parseFloat(getComputedStyle(document.documentElement).zoom)||1))));if(pointer.canvas.matches(':popover-open'))pointer.canvas.hidePopover();pointer.canvas.showPopover();};
  const modalOpened=event=>{if(event.target instanceof HTMLDialogElement&&event.newState==='open'&&particles.length)promote();};
  document.addEventListener('toggle',modalOpened,true);
  const active = () => registry.state.motionEnabled && visualActive();
  const color = alpha => `rgba(${EFFECTS.ink},${alpha})`;
  function draw(now) {
    frame = 0;
    if (!active()) return;
    const delta = last ? Math.min((now - last) / 1000, EFFECTS.maxDelta) : 0;
    last = now; elapsed += delta;
    if (dirty) {
      width = innerWidth; height = innerHeight;
      for (const { canvas, ctx } of [background, pointer]) {
        const dpr=Math.min(devicePixelRatio||1,canvas===background.canvas?RENDER_BUDGET.ambientMaxDpr:EFFECTS.maxDpr);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      dirty = false;
    }
    const bg = background.ctx;
    // Slow ambient motion has its own budget; click particles retain faster frames.
    if (now - lastBackground >= 1000 / RENDER_BUDGET.ambientFps) {
    lastBackground = now;
    bg.clearRect(0, 0, width, height);
    // Large broken ink arcs drift in the page margins, outside the content focus.
    for (let i = 0; i < EFFECTS.orbitCount; i++) {
      const radius = Math.min(width, height) * (.25 + i * .11);
      bg.strokeStyle = color(DOODLE_PARTICLES.backgroundAlpha); bg.lineWidth = 1; bg.beginPath();
      bg.ellipse(i % 2 ? width : 0, height * .55, radius, radius * .8,
        elapsed * .09 * (i % 2 ? 1 : -1), .25, Math.PI * 1.7);
      bg.stroke();
    }
    }
    const ctx = pointer.ctx;
    if (pointerDrawn) ctx.clearRect(0, 0, width, height);
    const seconds = now / 1000;
    let count = 0;
    for (let i = 0; i < particles.length; i++) if (seconds - particles[i].time < DOODLE_PARTICLES.lifetime) particles[count++] = particles[i];
    particles.length = count;
    pointerDrawn = count > 0;
    ctx.strokeStyle = color(1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const blocked=count?Array.from(document.querySelectorAll(EFFECTS.excludedRegions),el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height):[];
    for (const particle of particles) {
      const age = seconds - particle.time, fade = 1 - age / DOODLE_PARTICLES.lifetime;
      const distance = particle.size + particle.speed * (1 - Math.exp(-DOODLE_PARTICLES.drag * age)) / DOODLE_PARTICLES.drag;
      const x = particle.x + Math.cos(particle.angle) * distance;
      const y = particle.y + Math.sin(particle.angle) * distance + DOODLE_PARTICLES.gravity * age * age / 2;
      if(blocked.some(r=>x+particle.size>=r.left&&x-particle.size<=r.right&&y+particle.size>=r.top&&y-particle.size<=r.bottom))continue;
      drawDoodle(ctx, particle.shape, x, y, particle.size * (.5 + fade * .5), particle.rotation + particle.spin * age, Math.min(1, fade * 2));
    }
    if(!count&&topLayer&&pointer.canvas.matches(':popover-open'))pointer.canvas.hidePopover();
    pointer.canvas.hidden=!count;
    frame = budget.request(draw);
  }
  const click = event => {
    if (!active() || event.button !== 0 || event.composedPath().some(el=>el instanceof Element&&el.matches(EFFECTS.excludedRegions))) return;
    pointer.canvas.hidden=false;promote();
    const time = performance.now() / 1000;
    for (let i = 0; i < DOODLE_PARTICLES.burstCount; i++) particles.push({ x: event.clientX, y: event.clientY, time,
      shape: DOODLE_PARTICLES.shapes[i % DOODLE_PARTICLES.shapes.length],
      angle: (i + Math.random() * .7) / DOODLE_PARTICLES.burstCount * Math.PI * 2,
      speed: DOODLE_PARTICLES.speedMin + Math.random() * (DOODLE_PARTICLES.speedMax - DOODLE_PARTICLES.speedMin),
      size: DOODLE_PARTICLES.sizeMin + Math.random() * (DOODLE_PARTICLES.sizeMax - DOODLE_PARTICLES.sizeMin),
      rotation: Math.random() * Math.PI * 2, spin: (Math.random() * 2 - 1) * DOODLE_PARTICLES.spin });
    particles = particles.slice(-EFFECTS.particleLimit);
  };
  const wake = () => {
    if (!active()) {
      budget.cancel(frame); frame = 0; last = 0; particles = [];
      if(topLayer&&pointer.canvas.matches(':popover-open'))pointer.canvas.hidePopover();
      for (const { canvas, ctx } of [background, pointer]) { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.hidden = true; }
    } else {
      background.canvas.hidden = false; pointer.canvas.hidden = !particles.length;
      if (!frame) frame = budget.request(draw);
    }
  };
  const resize = () => { dirty = true; wake(); };
  document.addEventListener('pointerdown', click, { passive: true });
  const offActivity=observeVisualActivity(wake);
  window.addEventListener('resize', resize, { passive: true });
  const off = registry.subscribe(['motionEnabled'], wake);
  return () => {
    off(); budget.cancel(frame);
    document.removeEventListener('pointerdown', click);
    document.removeEventListener('toggle',modalOpened,true);
    offActivity(); window.removeEventListener('resize', resize);
    background.canvas.remove(); pointer.canvas.remove();
  };
}
