(() => {
  const avatar = document.querySelector('.avatar');
  const main = document.querySelector('main');
  if (!avatar || !main) return;

  avatar.style.cursor = 'grab';

  const GRAVITY = 2000;
  const RESTITUTION = 0.45;
  const FRICTION = 0.85;
  const REST_VY = 80;
  const REST_FRAMES = 60;

  let physicsMode = false;
  let x = 0, y = 0, w = 0, h = 0;
  let vx = 0, vy = 0;
  let angle = 0, angularVel = 0;
  let lastTs = null;
  let restFrames = 0;
  let animationFrame = null;

  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;
  let lastDragX = 0, lastDragY = 0, lastDragTs = 0;

  function ensurePhysicsMode() {
    if (physicsMode) return;
    physicsMode = true;
    const mainRect = main.getBoundingClientRect();
    const avatarRect = avatar.getBoundingClientRect();
    x = avatarRect.left - mainRect.left;
    y = avatarRect.top - mainRect.top;
    w = avatarRect.width;
    h = avatarRect.height;
    Object.assign(avatar.style, {
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
      right: 'auto',
      bottom: 'auto',
      float: 'none',
      margin: '0',
      willChange: 'transform, top, left',
      touchAction: 'none',
      userSelect: 'none',
    });
  }

  function onPointerDown(e) {
    e.preventDefault();
    ensurePhysicsMode();

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    isDragging = true;
    avatar.style.cursor = 'grabbing';
    try { avatar.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

    const mainRect = main.getBoundingClientRect();
    const px = e.clientX - mainRect.left;
    const py = e.clientY - mainRect.top;
    dragOffsetX = px - x;
    dragOffsetY = py - y;
    lastDragX = px;
    lastDragY = py;
    lastDragTs = performance.now();
    vx = 0;
    vy = 0;

    avatar.addEventListener('pointermove', onPointerMove);
    avatar.addEventListener('pointerup', onPointerUp);
    avatar.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const mainRect = main.getBoundingClientRect();
    const px = e.clientX - mainRect.left;
    const py = e.clientY - mainRect.top;

    x = px - dragOffsetX;
    y = py - dragOffsetY;

    const now = performance.now();
    const dt = (now - lastDragTs) / 1000;
    if (dt > 0) {
      const newVx = (px - lastDragX) / dt;
      const newVy = (py - lastDragY) / dt;
      vx = vx * 0.3 + newVx * 0.7;
      vy = vy * 0.3 + newVy * 0.7;
    }
    lastDragX = px;
    lastDragY = py;
    lastDragTs = now;

    avatar.style.left = `${x}px`;
    avatar.style.top = `${y}px`;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    avatar.style.cursor = 'grab';
    try { avatar.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    avatar.removeEventListener('pointermove', onPointerMove);
    avatar.removeEventListener('pointerup', onPointerUp);
    avatar.removeEventListener('pointercancel', onPointerUp);

    if (Math.abs(vx) < 50 && Math.abs(vy) < 50) {
      vx = (Math.random() * 240) - 120;
      vy = -100;
      angularVel = (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 400);
    } else {
      angularVel = vx * 1.2 + (Math.random() - 0.5) * 200;
    }

    lastTs = null;
    restFrames = 0;
    if (animationFrame === null) {
      animationFrame = requestAnimationFrame(tick);
    }
  }

  function tick(ts) {
    if (lastTs === null) {
      lastTs = ts;
      animationFrame = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min((ts - lastTs) / 1000, 1 / 30);
    lastTs = ts;

    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    angle += angularVel * dt;

    const maxX = main.clientWidth - w;
    const maxY = main.clientHeight - h;

    if (y >= maxY) {
      y = maxY;
      if (Math.abs(vy) < REST_VY) {
        vy = 0;
        vx *= 0.6;
        angularVel *= 0.6;
        restFrames++;
      } else {
        vy = -vy * RESTITUTION;
        vx *= FRICTION;
        angularVel *= FRICTION;
        restFrames = 0;
      }
    } else if (y < 0) {
      y = 0;
      vy = -vy * RESTITUTION;
      vx *= FRICTION;
      angularVel *= FRICTION;
      restFrames = 0;
    } else {
      restFrames = 0;
    }

    if (x < 0) {
      x = 0;
      vx = -vx * RESTITUTION;
      angularVel *= FRICTION;
    } else if (x > maxX) {
      x = maxX;
      vx = -vx * RESTITUTION;
      angularVel *= FRICTION;
    }

    avatar.style.left = `${x}px`;
    avatar.style.top = `${y}px`;
    avatar.style.transform = `rotate(${angle}deg)`;

    if (restFrames > REST_FRAMES && Math.abs(vx) < 1) {
      animationFrame = null;
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  avatar.addEventListener('pointerdown', onPointerDown);
})();
