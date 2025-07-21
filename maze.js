/*
 * FPS Maze Game
 *
 * This implementation renders a first‑person maze using a simple raycasting
 * engine on a HTML canvas.  The maze is procedurally generated via a
 * depth‑first search algorithm.  Controls use the keyboard (WASD or arrow
 * keys) to move and rotate.  No external libraries are required.
 */

(() => {
  const canvas = document.getElementById('viewport');
  const ctx = canvas.getContext('2d');
  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');
  const stageCounterEl = document.getElementById('stageCounter');

  // Current stage of the game, starts at 1.
  let stage = 1;
  // View mode: 'first' for first-person, 'map' for top-down map.
  let viewMode = 'first';

  // Adjust canvas size to fill the browser window
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Basic maze generation using depth‑first search.  Returns an array of
  // cells where each cell has walls on the north, south, west and east.
  function generateMaze(width, height) {
    const maze = [];
    for (let y = 0; y < height; y++) {
      maze[y] = [];
      for (let x = 0; x < width; x++) {
        maze[y][x] = {
          visited: false,
          walls: { north: true, south: true, west: true, east: true },
        };
      }
    }
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    function carve(x, y) {
      maze[y][x].visited = true;
      const dirs = shuffle(['north', 'south', 'west', 'east']);
      for (const dir of dirs) {
        let nx = x;
        let ny = y;
        if (dir === 'north') ny = y - 1;
        if (dir === 'south') ny = y + 1;
        if (dir === 'west') nx = x - 1;
        if (dir === 'east') nx = x + 1;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !maze[ny][nx].visited) {
          maze[y][x].walls[dir] = false;
          if (dir === 'north') maze[ny][nx].walls['south'] = false;
          if (dir === 'south') maze[ny][nx].walls['north'] = false;
          if (dir === 'west') maze[ny][nx].walls['east'] = false;
          if (dir === 'east') maze[ny][nx].walls['west'] = false;
          carve(nx, ny);
        }
      }
    }
    carve(0, 0);
    return maze;
  }

  // Convert the cell‑based maze description to a tile grid with walls
  // occupying entire tiles.  Walls are represented by 1s and open spaces
  // by 0s.  The resulting grid has dimensions (height*2+1) x (width*2+1).
  function mazeToGrid(maze) {
    const h = maze.length;
    const w = maze[0].length;
    const gridH = h * 2 + 1;
    const gridW = w * 2 + 1;
    const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(1));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = maze[y][x];
        const gy = y * 2 + 1;
        const gx = x * 2 + 1;
        grid[gy][gx] = 0; // cell interior
        if (!cell.walls.north) grid[gy - 1][gx] = 0;
        if (!cell.walls.south) grid[gy + 1][gx] = 0;
        if (!cell.walls.west) grid[gy][gx - 1] = 0;
        if (!cell.walls.east) grid[gy][gx + 1] = 0;
      }
    }
    return grid;
  }

  // Player state
  const player = {
    x: 1.5, // will be initialised later based on grid
    y: 1.5,
    angle: 0,
    moveSpeed: 3.0, // units per second
    rotSpeed: Math.PI, // radians per second
  };

  let grid;
  let mazeWidth;
  let mazeHeight;
  let exitX;
  let exitY;
  // Starting cell grid coordinates remain constant (1,1) in the tile grid.
  const startGridX = 1;
  const startGridY = 1;

  function initGame() {
    // Base size for the maze.  Difficulty increases by adding two cells
    // horizontally and vertically for each subsequent stage.
    const baseSize = 8;
    mazeWidth = baseSize + (stage - 1) * 2;
    mazeHeight = baseSize + (stage - 1) * 2;
    const maze = generateMaze(mazeWidth, mazeHeight);
    grid = mazeToGrid(maze);
    // Starting position inside the first cell (1,1 in grid coordinates).
    player.x = 1.5;
    player.y = 1.5;
    player.angle = 0;
    // Exit is the last maze cell interior
    exitX = mazeWidth * 2 - 1;
    exitY = mazeHeight * 2 - 1;
    // Update stage counter element
    if (stageCounterEl) {
      stageCounterEl.textContent = `ステージ: ${stage}`;
    }
  }

  initGame();

  // Key state tracking
  const keys = {
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
  };

  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.forward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.backward = true;
        break;
      case 'KeyA':
        keys.strafeLeft = true;
        break;
      case 'KeyD':
        keys.strafeRight = true;
        break;
      case 'ArrowLeft':
        keys.turnLeft = true;
        break;
      case 'ArrowRight':
        keys.turnRight = true;
        break;
      case 'KeyM':
        // Toggle between first-person and map view
        viewMode = viewMode === 'first' ? 'map' : 'first';
        // When switching to map, release pointer lock to avoid stuck controls.
        // When switching back to first-person, request pointer lock automatically on desktop.
        if (viewMode === 'map') {
          if (document.pointerLockElement === canvas) {
            document.exitPointerLock();
          }
        } else {
          // Only request pointer lock on desktop (non‑touch devices) if not already locked.
          if (!('ontouchstart' in window) && document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
          }
        }
        break;
    }
  }
  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.backward = false;
        break;
      case 'KeyA':
        keys.strafeLeft = false;
        break;
      case 'KeyD':
        keys.strafeRight = false;
        break;
      case 'ArrowLeft':
        keys.turnLeft = false;
        break;
      case 'ArrowRight':
        keys.turnRight = false;
        break;
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Pointer lock for mouse look on desktop
  if (!('ontouchstart' in window)) {
    canvas.addEventListener('click', () => {
      // request pointer lock only if not already locked and not in map view
      if (viewMode === 'first' && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && viewMode === 'first') {
        const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        // Adjust sensitivity to taste
        player.angle += movementX * 0.002;
      }
    });
  }

  // Touch controls for mobile devices: left half moves, right half looks
  const ongoingTouches = {};
  function updateTouchMovement() {
    let forward = false;
    let backward = false;
    let strafeLeft = false;
    let strafeRight = false;
    for (const id in ongoingTouches) {
      const info = ongoingTouches[id];
      if (info.type === 'move') {
        const dx = info.lastX - info.startX;
        const dy = info.lastY - info.startY;
        const threshold = 20;
        if (dy < -threshold) forward = true;
        if (dy > threshold) backward = true;
        if (dx < -threshold) strafeLeft = true;
        if (dx > threshold) strafeRight = true;
      }
    }
    keys.forward = forward;
    keys.backward = backward;
    keys.strafeLeft = strafeLeft;
    keys.strafeRight = strafeRight;
  }
  if ('ontouchstart' in window) {
    canvas.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        ongoingTouches[t.identifier] = {
          startX: t.clientX,
          startY: t.clientY,
          lastX: t.clientX,
          lastY: t.clientY,
          type: t.clientX < window.innerWidth / 2 ? 'move' : 'look',
        };
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const info = ongoingTouches[t.identifier];
        if (!info) continue;
        if (info.type === 'move') {
          info.lastX = t.clientX;
          info.lastY = t.clientY;
        } else if (info.type === 'look') {
          // Only adjust viewing angle in first-person mode
          if (viewMode === 'first') {
            const dx = t.clientX - info.lastX;
            // Choose a sensitivity factor
            player.angle += dx * 0.005;
          }
          info.lastX = t.clientX;
          info.lastY = t.clientY;
        }
      }
      updateTouchMovement();
    }, { passive: false });
    function handleEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const info = ongoingTouches[t.identifier];
        if (!info) continue;
        delete ongoingTouches[t.identifier];
      }
    updateTouchMovement();
    }
    

    canvas.addEventListener('touchend', handleEnd);
    canvas.addEventListener('touchcancel', handleEnd);
  }

  // Raycasting function.  Cast a ray from (posX,posY) at the given angle and
  // return the distance to the nearest wall and the side hit (for shading).
  function castRay(posX, posY, rayAngle) {
    const rayDirX = Math.cos(rayAngle);
    const rayDirY = Math.sin(rayAngle);
    // Map grid coordinates
    let mapX = Math.floor(posX);
    let mapY = Math.floor(posY);
    // Precalculate distances to step in each direction
    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
    let stepX, stepY;
    let sideDistX, sideDistY;
    // Step direction and initial side distance
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (posX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - posX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (posY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - posY) * deltaDistY;
    }
    let side = 0;
    let hit = false;
    // Flags to indicate if this ray passes through start or exit cells before hitting a wall
    // Determine if the ray originates in the start or exit cell
    let startSeen = (Math.floor(posX) === startGridX && Math.floor(posY) === startGridY);
    let exitSeenFlag = (Math.floor(posX) === exitX && Math.floor(posY) === exitY);
    // Perform DDA until a wall is hit or we exceed map bounds
    while (!hit) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      // Check if outside map
      if (mapX < 0 || mapX >= grid[0].length || mapY < 0 || mapY >= grid.length) {
        return { dist: Infinity, side: 0, startSeen: false, exitSeen: false };
      }
      // Check if this cell is open (0) before hitting a wall to see start/exit
      if (!hit && grid[mapY][mapX] === 0) {
        if (mapX === startGridX && mapY === startGridY) startSeen = true;
        if (mapX === exitX && mapY === exitY) exitSeenFlag = true;
      }
      if (grid[mapY][mapX] === 1) {
        hit = true;
      }
    }
    // Calculate distance to the point of impact
    let perpWallDist;
    if (side === 0) {
      perpWallDist = (mapX - posX + (1 - stepX) / 2) / (rayDirX === 0 ? 1e-6 : rayDirX);
    } else {
      perpWallDist = (mapY - posY + (1 - stepY) / 2) / (rayDirY === 0 ? 1e-6 : rayDirY);
    }
    return { dist: perpWallDist, side, startSeen, exitSeen: exitSeenFlag };
  }

  // Draw one frame: perform raycasting for each vertical pixel column
  function render() {
    const w = canvas.width;
    const h = canvas.height;
    // If the player is in map view, render the overhead map instead of the 3D scene
    if (viewMode === 'map') {
      renderMap();
      return;
    }
    // Fill sky with a deep blue and ground with a dark grey to aid visual separation.
    ctx.fillStyle = '#4a6fa5';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#3b3b46';
    ctx.fillRect(0, h / 2, w, h / 2);
    const fov = Math.PI / 3; // 60 degrees
    for (let x = 0; x < w; x++) {
      // Angle for this vertical stripe
      const rayAngle = player.angle - fov / 2 + (x / w) * fov;
      const result = castRay(player.x, player.y, rayAngle);
      let distance = result.dist;
      // Fix fish‑eye effect by projecting onto camera plane
      const correctedDist = distance * Math.cos(rayAngle - player.angle);
      // Calculate line height.  Avoid division by zero by adding epsilon
      const lineHeight = correctedDist > 0 ? Math.floor((h / correctedDist)) : h;
      let drawStart = Math.floor(-lineHeight / 2 + h / 2);
      if (drawStart < 0) drawStart = 0;
      let drawEnd = Math.floor(lineHeight / 2 + h / 2);
      if (drawEnd >= h) drawEnd = h - 1;
      // Wall shading: darker for side hits; lighten with distance
      let shade = result.side === 1 ? 180 : 220;
      // Diminish brightness with distance and clamp to sensible range
      let brightness = shade - correctedDist * 40;
      if (brightness < 30) brightness = 30;
      if (brightness > 255) brightness = 255;
      const color = `rgb(${Math.floor(brightness)},${Math.floor(brightness)},${Math.floor(brightness)})`;
      // Draw wall slice
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, drawStart);
      ctx.lineTo(x + 0.5, drawEnd);
      ctx.stroke();
      // Floor highlighting: draw coloured floor for start or exit cells if they intersect the ray
      if (result.exitSeen || result.startSeen) {
        // Compute brightness for floor highlight based on distance
        let floorBrightness = 200 - correctedDist * 20;
        if (floorBrightness < 30) floorBrightness = 30;
        if (floorBrightness > 255) floorBrightness = 255;
        if (result.exitSeen) {
          ctx.strokeStyle = `rgb(${Math.floor(floorBrightness)},20,20)`;
        } else if (result.startSeen) {
          ctx.strokeStyle = `rgb(20,20,${Math.floor(floorBrightness)})`;
        }
        ctx.beginPath();
        // Draw the floor from halfway down the screen (or bottom of wall) to the bottom
        const floorStart = Math.max(drawEnd, h / 2);
        ctx.moveTo(x + 0.5, floorStart);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
    }
  }

  // Render overhead map view
  function renderMap() {
    const w = canvas.width;
    const h = canvas.height;
    // Fill background
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, 0, w, h);
    const rows = grid.length;
    const cols = grid[0].length;
    const cellW = w / cols;
    const cellH = h / rows;
    // Draw tiles
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Walls are bright, open space is dark
        if (grid[y][x] === 1) {
          ctx.fillStyle = '#444444';
        } else {
          ctx.fillStyle = '#222222';
        }
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
    // Highlight start cell in blue
    ctx.fillStyle = 'rgba(40,80,200,0.8)';
    ctx.fillRect(startGridX * cellW, startGridY * cellH, cellW, cellH);
    // Highlight exit cell in red
    ctx.fillStyle = 'rgba(200,40,40,0.8)';
    ctx.fillRect(exitX * cellW, exitY * cellH, cellW, cellH);
    // Draw player as a triangle oriented by angle
    const px = player.x * cellW;
    const py = player.y * cellH;
    const radius = Math.min(cellW, cellH) * 0.4;
    const a = player.angle;
    const p1x = px + Math.cos(a) * radius;
    const p1y = py + Math.sin(a) * radius;
    const p2x = px + Math.cos(a + 2.5) * radius;
    const p2y = py + Math.sin(a + 2.5) * radius;
    const p3x = px + Math.cos(a - 2.5) * radius;
    const p3y = py + Math.sin(a - 2.5) * radius;
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.closePath();
    ctx.fill();
  }

  // Update player position and orientation
  function update(delta) {
    // If map view is active, we do not update player motion or check exit conditions
    if (viewMode === 'map') {
      return;
    }
    // Rotate left/right
    if (keys.turnLeft) player.angle -= player.rotSpeed * delta;
    if (keys.turnRight) player.angle += player.rotSpeed * delta;
    // Wrap angle between 0 and 2PI
    if (player.angle < 0) player.angle += Math.PI * 2;
    if (player.angle >= Math.PI * 2) player.angle -= Math.PI * 2;
    // Movement forward/backwards and strafing
    let moveStep = 0;
    if (keys.forward) moveStep += player.moveSpeed * delta;
    if (keys.backward) moveStep -= player.moveSpeed * delta;
    let strafeStep = 0;
    if (keys.strafeLeft) strafeStep -= player.moveSpeed * delta;
    if (keys.strafeRight) strafeStep += player.moveSpeed * delta;
    const newX = player.x + Math.cos(player.angle) * moveStep + Math.cos(player.angle + Math.PI / 2) * strafeStep;
    const newY = player.y + Math.sin(player.angle) * moveStep + Math.sin(player.angle + Math.PI / 2) * strafeStep;
    // Collision detection: only move if next cell is not a wall
    // We provide a small radius so the player doesn't clip walls
    const radius = 0.2;
    function isWall(x, y) {
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      if (gx < 0 || gx >= grid[0].length || gy < 0 || gy >= grid.length) return true;
      return grid[gy][gx] === 1;
    }
    // Check horizontally and vertically separately to allow sliding along walls
    // Horizontal move
    if (!isWall(newX + Math.cos(player.angle) * radius, player.y)) {
      player.x = newX;
    }
    // Vertical move
    if (!isWall(player.x, newY + Math.sin(player.angle) * radius)) {
      player.y = newY;
    }
    // Check exit condition
    const cellX = Math.floor(player.x);
    const cellY = Math.floor(player.y);
    if (cellX === exitX && cellY === exitY) {
      // Show winning message and restart with increased difficulty

setTimeout(() => {
        stage += 1;
        alert('Congratulations! You reached the exit. A more challenging maze will now be generated.');
        initGame();
      }, 10);
    }
  }

  // Main animation loop
  let lastTime = performance.now();
  function frame(time) {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    update(delta);
    render();
    requestAnimationFrame(frame);
  }

  // Start the game on click: hide the instructions overlay and kick off
  // the animation loop.  We don't use pointer lock here so that the
  // game can run when served from a local file without special
  // permissions.  Users control the view solely via the keyboard.
  function startGame() {
    blocker.style.display = 'none';
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  blocker.addEventListener('click', () => {
    // Hide overlay and begin the loop
    startGame();
  });
})();
