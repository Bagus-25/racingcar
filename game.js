const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── UI Elements ──────────────────────────────────────────────────────────────
const startScreen       = document.getElementById('start-screen');
const gameOverScreen    = document.getElementById('game-over-screen');
const scoreDisplay      = document.getElementById('score-display');
const speedDisplay      = document.getElementById('speed-display');
const scoreSpan         = document.getElementById('score');
const speedLevelSpan    = document.getElementById('speed-level');
const finalScoreSpan    = document.getElementById('final-score');
const finalLevelSpan    = document.getElementById('final-level');
const startBtn          = document.getElementById('start-btn');
const restartBtn        = document.getElementById('restart-btn');
const nosContainer      = document.getElementById('nos-container');
const nosBarFill        = document.getElementById('nos-bar-fill');
const nosNextContainer  = document.getElementById('nos-next-container');
const nosCountdownSpan  = document.getElementById('nos-countdown');

// ── Canvas ────────────────────────────────────────────────────────────────────
const CANVAS_WIDTH  = 400;
const CANVAS_HEIGHT = 600;
canvas.width  = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ── Road Layout ───────────────────────────────────────────────────────────────
const ROAD_LEFT  = 70;
const ROAD_RIGHT = 330;
const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

// ── Images (new PNG, proper orientation) ─────────────────────────────────────
// Yellow car in image faces LEFT → rotate +90° CW → faces UP  (player ✓)
// Pickup/Truck in image face RIGHT → rotate +90° CW → face DOWN (enemy ✓)
const playerImg = new Image();  playerImg.src = 'player_car.png';
const pickupImg = new Image();  pickupImg.src = 'pickup.png';
const truckImg  = new Image();  truckImg.src  = 'truck.png';

// ── Game State ────────────────────────────────────────────────────────────────
let isPlaying  = false;
let score      = 0;
let speedLevel = 1;
let baseSpeed  = 5;          // Increases every 100 score
let roadOffset = 0;
let frameCount = 0;
let animationId;
let player;
let enemies = [];

// ── NOS State ─────────────────────────────────────────────────────────────────
const NOS_BOOST_AMOUNT = 10;   // Extra speed during NOS
const NOS_DURATION     = 360;  // 6 seconds at 60fps
const NOS_SPAWN_FRAMES = 1800; // Spawn every 30 seconds (60fps × 30)

let nosPickups      = [];
let nosActive       = false;
let nosTimer        = 0;
let nosSpawnTimer   = 0;
let nosParticles    = [];
let speedBeforeNos  = 5;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = { ArrowLeft:false, ArrowRight:false, ArrowUp:false, ArrowDown:false,
               a:false, d:false, w:false, s:false };
document.addEventListener('keydown', e => {
    if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => {
    if (e.key in keys) keys[e.key] = false;
});

// ── Desert Scenery ────────────────────────────────────────────────────────────
let desertElements = [];

function generateDesert() {
    desertElements = [];
    ['left', 'right'].forEach(side => {
        // Rocks
        for (let i = 0; i < 14; i++) {
            const x = side === 'left'
                ? 5 + Math.random() * (ROAD_LEFT - 15)
                : ROAD_RIGHT + 5 + Math.random() * (CANVAS_WIDTH - ROAD_RIGHT - 15);
            desertElements.push({ type:'rock',   x, y: Math.random() * CANVAS_HEIGHT,
                                  size: 4 + Math.random() * 14 });
        }
        // Cacti
        for (let i = 0; i < 7; i++) {
            const x = side === 'left'
                ? 14 + Math.random() * (ROAD_LEFT - 26)
                : ROAD_RIGHT + 14 + Math.random() * (CANVAS_WIDTH - ROAD_RIGHT - 26);
            desertElements.push({ type:'cactus', x, y: Math.random() * CANVAS_HEIGHT,
                                  size: 6 + Math.random() * 10 });
        }
        // Bones
        for (let i = 0; i < 3; i++) {
            const x = side === 'left'
                ? 8 + Math.random() * (ROAD_LEFT - 18)
                : ROAD_RIGHT + 8 + Math.random() * (CANVAS_WIDTH - ROAD_RIGHT - 18);
            desertElements.push({ type:'bone',   x, y: Math.random() * CANVAS_HEIGHT,
                                  size: 4 + Math.random() * 4 });
        }
    });
}
generateDesert();

function drawDesert() {
    // Left desert strip
    const lGrad = ctx.createLinearGradient(0, 0, ROAD_LEFT, 0);
    lGrad.addColorStop(0, '#a0722a'); lGrad.addColorStop(1, '#d4a84b');
    ctx.fillStyle = lGrad;
    ctx.fillRect(0, 0, ROAD_LEFT, CANVAS_HEIGHT);

    // Right desert strip
    const rGrad = ctx.createLinearGradient(ROAD_RIGHT, 0, CANVAS_WIDTH, 0);
    rGrad.addColorStop(0, '#d4a84b'); rGrad.addColorStop(1, '#a0722a');
    ctx.fillStyle = rGrad;
    ctx.fillRect(ROAD_RIGHT, 0, CANVAS_WIDTH - ROAD_RIGHT, CANVAS_HEIGHT);

    // Road surface
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // Sand dune lines
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.3)';
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(18, y - 5, 40, y + 5, ROAD_LEFT, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ROAD_RIGHT, y);
        ctx.bezierCurveTo(ROAD_RIGHT + 25, y + 5, ROAD_RIGHT + 48, y - 5, CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawDesertElements() {
    for (const el of desertElements) {
        if (el.type === 'rock') {
            ctx.fillStyle = '#8a7055';
            ctx.beginPath();
            ctx.ellipse(el.x, el.y, el.size, el.size * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(200,170,100,0.35)';
            ctx.beginPath();
            ctx.ellipse(el.x - el.size * 0.2, el.y - el.size * 0.15,
                        el.size * 0.45, el.size * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (el.type === 'cactus') {
            ctx.fillStyle = '#3d7a38';
            ctx.beginPath(); ctx.roundRect(el.x - 3, el.y - el.size, 7, el.size * 1.8, 3); ctx.fill();
            ctx.beginPath(); ctx.roundRect(el.x - 13, el.y - el.size * 0.4, 11, 5, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(el.x - 15, el.y - el.size * 0.95, 5, el.size * 0.6, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(el.x + 3,  el.y - el.size * 0.6, 11, 5, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(el.x + 9,  el.y - el.size * 1.15, 5, el.size * 0.6, 2); ctx.fill();
            ctx.fillStyle = 'rgba(100,200,80,0.15)';
            ctx.fillRect(el.x - 1, el.y - el.size, 2, el.size * 1.8);
        } else {
            ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(el.x - el.size, el.y); ctx.lineTo(el.x + el.size, el.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(el.x, el.y - el.size); ctx.lineTo(el.x, el.y + el.size); ctx.stroke();
        }
    }
}

function drawRoadLines() {
    roadOffset += baseSpeed;
    if (roadOffset > 60) roadOffset = 0;

    // Road edge shadows
    const ls = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_LEFT + 14, 0);
    ls.addColorStop(0, 'rgba(0,0,0,0.4)'); ls.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ls; ctx.fillRect(ROAD_LEFT, 0, 14, CANVAS_HEIGHT);

    const rs = ctx.createLinearGradient(ROAD_RIGHT - 14, 0, ROAD_RIGHT, 0);
    rs.addColorStop(0, 'rgba(0,0,0,0)'); rs.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = rs; ctx.fillRect(ROAD_RIGHT - 14, 0, 14, CANVAS_HEIGHT);

    // Lane dashes
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -roadOffset;
    for (let i = 1; i < LANE_COUNT; i++) {
        const lx = ROAD_LEFT + i * LANE_WIDTH;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, CANVAS_HEIGHT); ctx.stroke();
    }
    ctx.setLineDash([]);
}

// ── Car Class ─────────────────────────────────────────────────────────────────
class Car {
    constructor(x, y, img, w, h, isPlayer = false) {
        this.x = x; this.y = y; this.img = img;
        this.width = w; this.height = h; this.isPlayer = isPlayer;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        // Rotate +90° CW: yellow car (faces LEFT) → UP; pickup/truck (face RIGHT) → DOWN
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(this.img, -this.height / 2, -this.width / 2, this.height, this.width);
        ctx.restore();
    }

    update() {
        if (this.isPlayer) {
            let dx = 0, dy = 0;
            if (keys.ArrowLeft || keys.a)      dx = -5;
            else if (keys.ArrowRight || keys.d) dx =  5;
            if (keys.ArrowUp || keys.w)         dy = -4;
            else if (keys.ArrowDown || keys.s)  dy =  4;
            this.x += dx; this.y += dy;
            if (this.x < ROAD_LEFT + 3)                    this.x = ROAD_LEFT + 3;
            if (this.x + this.width > ROAD_RIGHT - 3)      this.x = ROAD_RIGHT - 3 - this.width;
            if (this.y < 10)                               this.y = 10;
            if (this.y + this.height > CANVAS_HEIGHT - 10) this.y = CANVAS_HEIGHT - 10 - this.height;
        } else {
            this.y += nosActive ? baseSpeed + NOS_BOOST_AMOUNT : baseSpeed;
        }
    }
}

// ── NOS Pickup ────────────────────────────────────────────────────────────────
class NosPickup {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 28; this.height = 48;
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
        this.y += nosActive ? baseSpeed + NOS_BOOST_AMOUNT : baseSpeed;
        this.pulse += 0.12;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        const glowIntensity = Math.sin(this.pulse) * 12 + 18;
        ctx.shadowColor = '#00f3ff'; ctx.shadowBlur = glowIntensity;

        // Canister body
        ctx.fillStyle = '#0033aa';
        ctx.beginPath(); ctx.roundRect(-11, -20, 22, 40, 5); ctx.fill();

        // Side highlight
        ctx.fillStyle = 'rgba(0,220,255,0.35)';
        ctx.beginPath(); ctx.roundRect(-8, -17, 7, 34, 3); ctx.fill();

        // NOS label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00f3ff';
        ctx.font = 'bold 9px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NOS', 0, 3);

        // Top valve cap (red)
        ctx.fillStyle = '#dd2200';
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.roundRect(-7, -26, 14, 8, 3); ctx.fill();

        // Bottom nozzle
        ctx.fillStyle = '#888';
        ctx.shadowBlur = 0;
        ctx.fillRect(-4, 20, 8, 6);

        ctx.restore();
    }
}

// ── NOS Flame Particles ───────────────────────────────────────────────────────
function spawnNosParticles() {
    if (!player) return;
    for (let i = 0; i < 4; i++) {
        nosParticles.push({
            x:     player.x + player.width / 2 + (Math.random() - 0.5) * player.width * 0.7,
            y:     player.y + player.height - 4,
            vx:    (Math.random() - 0.5) * 5,
            vy:    Math.random() * 9 + 5,
            alpha: 1,
            size:  Math.random() * 16 + 6,
            color: ['#00f3ff', '#0055ff', '#00ccff', '#aaddff'][Math.floor(Math.random() * 4)]
        });
    }
}

function drawNosParticles() {
    for (let i = nosParticles.length - 1; i >= 0; i--) {
        const p = nosParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.alpha -= 0.045; p.size *= 0.94;
        if (p.alpha <= 0) { nosParticles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 15;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// ── Enemy Spawner ─────────────────────────────────────────────────────────────
function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const cx   = ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const usePU = Math.random() < 0.5;
    const img   = usePU ? pickupImg : truckImg;
    const w = 44, h = usePU ? 90 : 115;
    const x = cx - w / 2;

    for (const e of enemies) {
        if (Math.abs(e.x - x) < w + 5 && e.y < 10) return;
    }
    enemies.push(new Car(x, -h - 10, img, w, h, false));
}

// ── NOS Activator ─────────────────────────────────────────────────────────────
function activateNos() {
    speedBeforeNos = baseSpeed;
    nosActive      = true;
    nosTimer       = NOS_DURATION;
    nosContainer.classList.remove('hidden');
    nosNextContainer.classList.add('hidden');
}

function deactivateNos() {
    nosActive = false;
    nosTimer  = 0;
    baseSpeed = speedBeforeNos;   // Restore base speed (score-based speed preserved)
    nosContainer.classList.add('hidden');
    nosParticles = [];
}

function updateNos() {
    if (!nosActive) return;
    nosTimer--;
    nosBarFill.style.width = (nosTimer / NOS_DURATION * 100) + '%';
    if (frameCount % 2 === 0) spawnNosParticles();
    if (nosTimer <= 0) deactivateNos();
}

// ── Collision ─────────────────────────────────────────────────────────────────
function checkCollision(a, b) {
    const m = 9;
    return (a.x + m < b.x + b.width - m &&
            a.x + a.width - m > b.x + m &&
            a.y + m < b.y + b.height - m &&
            a.y + a.height - m > b.y + m);
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    ctx.fillStyle = 'rgba(255,0,0,0.35)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    finalScoreSpan.innerText = score;
    finalLevelSpan.innerText = speedLevel;
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    speedDisplay.classList.add('hidden');
    nosContainer.classList.add('hidden');
    nosNextContainer.classList.add('hidden');
}

// ── Init Game ─────────────────────────────────────────────────────────────────
function initGame() {
    const pw = 44, ph = 80;
    player     = new Car(CANVAS_WIDTH / 2 - pw / 2, CANVAS_HEIGHT - 130, playerImg, pw, ph, true);
    enemies    = [];
    nosPickups = [];
    nosParticles = [];
    score      = 0;
    speedLevel = 1;
    baseSpeed  = 5;
    frameCount = 0;
    roadOffset = 0;
    nosActive  = false;
    nosTimer   = 0;
    nosSpawnTimer = 0;

    scoreSpan.innerText     = 0;
    speedLevelSpan.innerText = 1;
    scoreDisplay.classList.remove('hidden');
    speedDisplay.classList.remove('hidden');
    nosContainer.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    nosNextContainer.classList.remove('hidden');
    nosCountdownSpan.innerText = 30;

    isPlaying = true;
    animate();
}

// ── Main Loop ─────────────────────────────────────────────────────────────────
function animate() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawDesert();
    drawDesertElements();
    drawRoadLines();

    // NOS particles behind player
    drawNosParticles();

    player.update();
    player.draw();

    frameCount++;

    // ── Score & Speed Progression ──────────────────────────────────────────
    if (frameCount % 60 === 0) {
        score += 10;
        scoreSpan.innerText = score;

        // Every 100 score: increase base speed by 0.4, update level
        if (score > 0 && score % 100 === 0) {
            if (!nosActive) baseSpeed += 0.4;
            else             speedBeforeNos += 0.4; // carry increase to post-NOS speed
            speedLevel = Math.floor(score / 100) + 1;
            speedLevelSpan.innerText = speedLevel;
        }
    }

    // ── NOS Spawn Timer ────────────────────────────────────────────────────
    if (!nosActive) {
        nosSpawnTimer++;
        const secLeft = Math.max(0, Math.ceil((NOS_SPAWN_FRAMES - nosSpawnTimer) / 60));
        nosCountdownSpan.innerText = secLeft;

        if (nosSpawnTimer >= NOS_SPAWN_FRAMES) {
            nosSpawnTimer = 0;
            spawnNosPickup();
            nosNextContainer.classList.add('hidden');
        }
    }

    // Update NOS (timer, particles, deactivate)
    updateNos();

    // ── NOS Pickups ────────────────────────────────────────────────────────
    for (let i = nosPickups.length - 1; i >= 0; i--) {
        const np = nosPickups[i];
        np.update(); np.draw();

        if (np.y > CANVAS_HEIGHT) { nosPickups.splice(i, 1); continue; }

        if (checkCollision(player, np)) {
            nosPickups.splice(i, 1);
            activateNos();
        }
    }

    // ── Enemy Spawning ─────────────────────────────────────────────────────
    const spawnRate = Math.max(28, 105 - baseSpeed * 4);
    if (frameCount % Math.floor(spawnRate) === 0) spawnEnemy();

    // ── Update & Draw Enemies ──────────────────────────────────────────────
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update(); e.draw();
        if (e.y > CANVAS_HEIGHT) {
            enemies.splice(i, 1);
            score += 5; scoreSpan.innerText = score;
            continue;
        }
        if (checkCollision(player, e)) { gameOver(); return; }
    }

    animationId = requestAnimationFrame(animate);
}

function spawnNosPickup() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const cx   = ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
    nosPickups.push(new NosPickup(cx - 14, -60));
}

// ── Buttons ───────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);

// Initial background render behind start screen
drawDesert();
drawDesertElements();
