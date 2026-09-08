// Render each real game scene once, retain the image, then release its WebGL context.
// No match loops or eight continuously running canvases on the collection menu.
const games = {
  padel: ['CourtView', 'PadelGame'], football: ['FootballView', 'FootballGame'],
  golf: ['GolfView', 'GolfGame'], waterpolo: ['WaterPoloView', 'WaterPoloGame'],
  petanca: ['PetancaView', 'PetancaGame'], pickleball: ['PickleballView', 'PickleballGame'],
  curling: ['CurlingView', 'CurlingGame'], pool: ['PoolView', 'PoolGame'],
};
const queue = []; let busy = false;
async function thumbnail(container) {
  const name = container.dataset.preview, [viewName, gameName] = games[name];
  let view;
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); container.append(canvas);
  try {
    const [render, simulation] = await Promise.all([import(`./${name}/render.js`), import(`./${name}/simulation.js`)]);
    const game = new simulation[gameName]({ seed: 17 }); view = new render[viewName](canvas);
    view.setLobby?.(false);
    if (name === 'golf') {
      view.load(game.hole); game.ball.x = game.hole.cup.x; game.ball.z = game.hole.cup.z + 14; view.follow = true;
    }
    if (name === 'curling') {
      for (let i = 0; i < 8000 && game.shots < 6; i++) game.step(1 / 120, { autoplay: true });
    }
    if (name === 'petanca') {
      game.placeJack();
      for (let i = 0; i < 5000 && (game.balls.length < 4 || game.stage === 'rolling'); i++) {
        if (game.stage === 'aim' && game.balls.length < 4) { game.aimJack(); game.shoot(); }
        game.step(1 / 120);
      }
    }
    const rect = container.getBoundingClientRect(), width = Math.max(300, rect.width), height = Math.max(240, rect.height);
    view.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); view.renderer.setSize(width, height, false);
    view.width = width; view.height = height;
    view.render(game, 1, 0);
    const camera = view.camera; camera.clearViewOffset?.();
    if (camera.isPerspectiveCamera) { camera.aspect = width / height; camera.fov = 40; }
    let position = [16, 22, 28], focus = [0, 0, 0];
    if (name === 'pickleball') { position = [11, 19, 23]; focus = [0, 0, -1.5]; }
    if (name === 'waterpolo') position = [27, 32, 29];
    if (name === 'football') { position = [75, 100, 70]; const h = Math.max(119, 140 * height / width); camera.left = -h * width / height / 2; camera.right = -camera.left; camera.top = h / 2; camera.bottom = -h / 2; }
    if (name === 'golf') { const p = game.hole.cup; position = [p.x + 25, 34, p.z + 40]; focus = [p.x, 0, p.z + 8]; }
    if (name === 'petanca') { position = [7, 17, 13]; const h = Math.max(17, 12 * height / width); camera.left = -h * width / height / 2; camera.right = -camera.left; camera.top = h / 2; camera.bottom = -h / 2; }
    if (name === 'curling' || name === 'pool') {
      const curling = name === 'curling', h = curling ? 11 : 11.3;
      camera.left = -h * width / height / 2; camera.right = -camera.left; camera.top = h / 2; camera.bottom = -h / 2;
      position = curling ? [8, 19, 8] : [8, 16, 13]; focus = curling ? [0, 0, -4] : [0, 0, 0];
    }
    camera.position.set(...position); camera.lookAt(...focus); camera.updateProjectionMatrix();
    view.renderer.render(view.scene, camera);
    const image = new Image(); image.alt = `${name === 'pool' ? '8-ball pool' : name} game: actual Three.js notebook scene`; image.width = Math.round(width); image.height = Math.round(height);
    image.src = canvas.toDataURL('image/png'); await image.decode(); container.replaceChildren(image); container.classList.add('ready');
  } catch (error) {
    container.replaceChildren(); const text = document.createElement('span'); text.className = 'preview-fallback'; text.textContent = 'OPEN THE PLAYING FIELD ↗'; container.append(text);
    console.warn(`Preview unavailable: ${name}`, error);
  } finally {
    if (view) {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      view.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) { materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      view.renderer.dispose(); view.renderer.forceContextLoss();
    }
  }
}
async function drain() {
  if (busy) return; busy = true;
  while (queue.length) { await thumbnail(queue.shift()); await new Promise(resolve => setTimeout(resolve, 0)); }
  busy = false;
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); queue.push(entry.target); }
  drain();
}, { rootMargin: '200px' });
await document.fonts.ready;
for (const container of document.querySelectorAll('[data-preview]')) observer.observe(container);
