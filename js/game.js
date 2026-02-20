/* ==============================================
   MAGIC STATUE – Game Engine
   A webcam pose-matching party game for kids 3-5
   ============================================== */

// ─── CONFIGURATION ────────────────────────────
const CFG = {
    confidence:       0.25,   // keypoint confidence threshold
    matchThreshold:   0.62,   // % match to begin hold
    holdMs:           2500,   // ms to hold a pose
    previewMs:        3200,   // ms to show pose intro
    celebrateMs:      2800,   // ms of celebration
    countdownSec:     3,      // 3-2-1 countdown
    videoW:           640,
    videoH:           480,
};

// ─── SKELETON DRAWING CONNECTIONS ─────────────
//  pairs of MoveNet keypoint indices
const BONES = [
    [5,7],[7,9],      // left arm
    [6,8],[8,10],     // right arm
    [5,6],            // shoulders
    [5,11],[6,12],    // torso
    [11,12],          // hips
    [11,13],[13,15],  // left leg
    [12,14],[14,16],  // right leg
];
const PLAYER_COLORS = ['#FF6B9D','#4ECDC4','#FFD93D','#7B2FF7'];

// ─── POSE DEFINITIONS ────────────────────────
const POSES = [
    {
        id:'reach_high',  name:'Reach for the Stars!', emoji:'🌟',
        instruction:'Reach BOTH arms UP high!',
        color:'#FFD93D',
    },
    {
        id:'starfish', name:'Starfish!', emoji:'⭐',
        instruction:'Arms AND legs out wide!',
        color:'#FF6B9D',
    },
    {
        id:'tiny_mouse', name:'Tiny Mouse!', emoji:'🐭',
        instruction:'Crouch down really small!',
        color:'#7B2FF7',
    },
    {
        id:'airplane', name:'Airplane!', emoji:'✈️',
        instruction:'Arms straight out to the sides!',
        color:'#4ECDC4',
    },
    {
        id:'touch_toes', name:'Touch Your Toes!', emoji:'🦶',
        instruction:'Bend down and reach for your toes!',
        color:'#FF8C42',
    },
];

// ─── GAME STATE ───────────────────────────────
const S = {
    phase: 'title',          // title|loading|countdown|preview|matching|holding|celebrate|victory|error
    poseOrder: [],           // shuffled indices into POSES
    poseIdx: 0,              // current index within poseOrder
    detector: null,
    detected: [],            // raw poses from TF.js
    detecting: false,
    smoothScore: 0,
    holdStart: 0,
    holdProgress: 0,
    confetti: [],
    audioCtx: null,
    animId: null,
    titleAnimId: null,
    video: null,
    canvas: null,
    ctx: null,
    cCanvas: null,
    cCtx: null,
    titleCanvas: null,
    titleCtx: null,
    ready: false,            // true when camera+model loaded and player found
    cameraReady: false,
    modelReady: false,
    playersFound: 0,
    titleDetecting: false,
};

// ─── DOM HELPERS ──────────────────────────────
const $ = id => document.getElementById(id);

// ─── ENTRY POINT ──────────────────────────────
// Auto-init: start camera+model setup on page load
window.addEventListener('DOMContentLoaded', () => {
    initAudio();
    initNarrator();
    beginSetup();
});

async function beginSetup() {
    // 1) Camera
    try {
        await initCamera();
        S.cameraReady = true;
        markSetupDone('setup-camera', '📷 Camera ready!');
        narrate('Camera is ready! I can see you!');
    } catch (e) {
        console.error(e);
        markSetupDone('setup-camera', '📷 Camera not available ✘');
        showError('Could not start the camera. Please allow camera access and reload!');
        return;
    }

    // Start title preview loop
    startTitlePreview();
    show($('setup-tips'));

    // 2) Model
    try {
        await initDetector();
        S.modelReady = true;
        markSetupDone('setup-model', '🪄 Magic loaded!');
    } catch (e) {
        console.error(e);
        markSetupDone('setup-model', '🪄 Could not load magic ✘');
        showError('Could not load the pose model. Check your internet connection and reload!');
        return;
    }

    narrate('Step in front of the camera so I can see you!');
}

async function startGame() {
    if (!S.ready) return;
    cancelTitlePreview();

    narrate('Here we go! Get ready to play Magic Statue!');
    await wait(1800);

    // Shuffle poses
    S.poseOrder = shuffle([...Array(POSES.length).keys()]);
    S.poseIdx = 0;

    showScreen('screen-game');
    buildProgressDots();
    runCountdown();
}

function restartGame() {
    S.poseOrder = shuffle([...Array(POSES.length).keys()]);
    S.poseIdx = 0;
    S.smoothScore = 0;
    narrate('Let\'s play again! Get ready!');
    showScreen('screen-game');
    buildProgressDots();
    setTimeout(() => runCountdown(), 1500);
}

function markSetupDone(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('done');
}

function checkReady() {
    if (S.ready) return;
    if (S.cameraReady && S.modelReady && S.playersFound > 0) {
        S.ready = true;
        markSetupDone('setup-players', '👀 ' + S.playersFound + ' player' + (S.playersFound>1?'s':'') + ' found!');
        const btn = $('btn-play');
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
        btn.textContent = '▶ PLAY!';
        narrate('I can see ' + S.playersFound + ' player' + (S.playersFound>1?'s':'') + '! Press Play when you\'re ready!');
    }
}

// ─── CAMERA ───────────────────────────────────
async function initCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:CFG.videoW}, height:{ideal:CFG.videoH}, facingMode:'user' },
        audio: false,
    });
    const video = $('webcam');
    video.srcObject = stream;
    await new Promise(r => { video.onloadedmetadata = r; });
    await video.play();

    // Title canvas (background preview)
    const tCanvas = $('title-canvas');
    tCanvas.width  = video.videoWidth;
    tCanvas.height = video.videoHeight;
    S.titleCanvas = tCanvas;
    S.titleCtx    = tCanvas.getContext('2d');

    // Game canvas
    const canvas = $('game-canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    S.video  = video;
    S.canvas = canvas;
    S.ctx    = canvas.getContext('2d');

    // confetti canvas
    S.cCanvas = $('confetti-canvas');
    S.cCanvas.width  = window.innerWidth;
    S.cCanvas.height = window.innerHeight;
    S.cCtx = S.cCanvas.getContext('2d');

    window.addEventListener('resize', () => {
        S.cCanvas.width  = window.innerWidth;
        S.cCanvas.height = window.innerHeight;
    });
}

// ─── TITLE PREVIEW LOOP ──────────────────────
function startTitlePreview() {
    cancelTitlePreview();
    function tick() {
        S.titleAnimId = requestAnimationFrame(tick);
        titleDetect();
        drawTitlePreview();
    }
    tick();
}
function cancelTitlePreview() {
    if (S.titleAnimId) { cancelAnimationFrame(S.titleAnimId); S.titleAnimId = null; }
}

async function titleDetect() {
    if (S.titleDetecting || !S.detector || !S.video || S.video.readyState < 2) return;
    S.titleDetecting = true;
    try {
        S.detected = await S.detector.estimatePoses(S.video);
        const count = Math.min(S.detected.length, 4);
        if (count !== S.playersFound) {
            S.playersFound = count;
            updatePlayerBubbles(count);
            if (count > 0 && S.modelReady) checkReady();
            if (count === 0 && S.ready) {
                // Players left, but button stays enabled
            }
        }
    } catch(_){}
    S.titleDetecting = false;
}

function drawTitlePreview() {
    const {titleCtx: ctx, titleCanvas: canvas, video} = S;
    if (!ctx || !video || video.readyState < 2) return;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw skeletons on title too
    const poses = S.detected;
    const count = Math.min(poses.length, 4);
    const origCtx = S.ctx;
    const origCanvas = S.canvas;
    S.ctx = ctx;
    S.canvas = canvas;
    for (let i = 0; i < count; i++) {
        drawSkeleton(poses[i].keypoints, PLAYER_COLORS[i % PLAYER_COLORS.length]);
    }
    S.ctx = origCtx;
    S.canvas = origCanvas;
}

function updatePlayerBubbles(count) {
    const el = $('player-bubbles');
    if (!el) return;
    el.innerHTML = '';
    if (count === 0) {
        el.innerHTML = '<span class="no-players">👀 No players yet — step in front of the camera!</span>';
        return;
    }
    for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = 'player-bubble';
        b.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
        b.textContent = 'P' + (i+1);
        el.appendChild(b);
    }
}

// ─── POSE DETECTOR ────────────────────────────
async function initDetector() {
    await tf.ready();
    S.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
          enableSmoothing: true,
          enableTracking: true,
          trackerType: poseDetection.TrackerType.BoundingBox }
    );
}

async function detect() {
    if (S.detecting || !S.detector || !S.video || S.video.readyState < 2) return;
    S.detecting = true;
    try { S.detected = await S.detector.estimatePoses(S.video); }
    catch(_){}
    S.detecting = false;
}

// ─── GAME FLOW ────────────────────────────────
async function runCountdown() {
    S.phase = 'countdown';
    const overlay = $('countdown-overlay');
    const numEl  = $('countdown-num');
    show(overlay);

    narrate('3, 2, 1, Go!');
    for (let n = CFG.countdownSec; n >= 1; n--) {
        numEl.textContent = n;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;           // reflow
        numEl.style.animation = '';
        playTone(220 + n*110, .15);
        await wait(900);
    }
    numEl.textContent = 'GO!';
    numEl.style.color = '#6BCB77';
    playTone(880, .25);
    await wait(600);
    hide(overlay);
    numEl.style.color = '';

    startPoseIntro();
}

async function startPoseIntro() {
    S.phase = 'preview';
    const pose = currentPose();
    setPoseUI(pose);
    updateProgressDots();

    // big overlay
    $('pose-intro-emoji').textContent = pose.emoji;
    $('pose-intro-name').textContent  = pose.name;
    $('pose-intro-desc').textContent  = pose.instruction;
    const intro = $('pose-intro');
    intro.style.animation = 'none'; void intro.offsetWidth; intro.style.animation = '';
    show(intro);

    // Narrator announces the pose
    narrate('Next pose: ' + pose.name + ' ' + pose.instruction);
    playTone(523, .12);
    await wait(CFG.previewMs);
    hide(intro);

    beginMatching();
}

function beginMatching() {
    S.phase = 'matching';
    S.smoothScore = 0;
    S.holdStart   = 0;
    S.holdProgress = 0;
    hide($('hold-overlay'));
    hide($('statue-flash'));
    narrate('Now copy the pose! You can do it!');
    startLoop();
}

async function poseCompleted() {
    S.phase = 'celebrate';
    cancelLoop();

    // flash
    const flash = $('statue-flash');
    flash.style.animation = 'none'; void flash.offsetWidth; flash.style.animation = '';
    show(flash);
    playChord();
    spawnConfetti(120);

    // Narrator celebration
    const cheers = [
        'Amazing! You did it!',
        'Wow, great job! You are a star!',
        'Fantastic! That was perfect!',
        'Hooray! You nailed it!',
        'Superstar! That was awesome!',
    ];
    narrate(cheers[Math.floor(Math.random()*cheers.length)]);

    markDotDone(S.poseIdx);
    await wait(CFG.celebrateMs);
    hide(flash);

    S.poseIdx++;
    if (S.poseIdx >= S.poseOrder.length) {
        showVictory();
    } else {
        startPoseIntro();
    }
}

function showVictory() {
    S.phase = 'victory';
    cancelLoop();
    spawnConfetti(200);
    showScreen('screen-victory');
    playChord(); setTimeout(()=>playChord(),400);
    narrate('You did ALL the poses! You are a Magic Statue Champion! Great job everyone!');
}

// ─── MAIN GAME LOOP ──────────────────────────
function startLoop() {
    cancelLoop();
    function tick() {
        S.animId = requestAnimationFrame(tick);
        detect();           // fire-and-forget async
        drawFrame();
        updateConfetti();
        if (S.phase === 'matching' || S.phase === 'holding') updateLogic();
    }
    tick();
}
function cancelLoop() { if (S.animId) { cancelAnimationFrame(S.animId); S.animId = null; } }

// ─── DRAW ─────────────────────────────────────
function drawFrame() {
    const {ctx, canvas, video} = S;
    if (!ctx || !video) return;

    // draw mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // skeletons
    const poses = S.detected;
    const count = Math.min(poses.length, 4);
    for (let i = 0; i < count; i++) {
        drawSkeleton(poses[i].keypoints, PLAYER_COLORS[i % PLAYER_COLORS.length]);
    }

    updatePlayerCount(count);
}

function drawSkeleton(kp, color) {
    const {ctx, canvas} = S;
    const mx = x => canvas.width - x;          // mirror x

    // bones
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (const [a, b] of BONES) {
        if (kp[a].score > CFG.confidence && kp[b].score > CFG.confidence) {
            ctx.beginPath();
            ctx.moveTo(mx(kp[a].x), kp[a].y);
            ctx.lineTo(mx(kp[b].x), kp[b].y);
            ctx.stroke();
        }
    }

    // joints
    for (const p of kp) {
        if (p.score > CFG.confidence) {
            ctx.beginPath();
            ctx.arc(mx(p.x), p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }
}

// ─── LOGIC ────────────────────────────────────
function updateLogic() {
    const poses = S.detected;
    const count = Math.min(poses.length, 4);
    if (count === 0) {
        S.smoothScore = lerp(S.smoothScore, 0, 0.15);
        updateMeter(S.smoothScore);
        if (S.phase === 'holding') {
            S.phase = 'matching';
            hide($('hold-overlay'));
        }
        return;
    }

    const pose = currentPose();
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += checkPose(poses[i].keypoints, pose.id);
    }
    const avg = total / count;
    S.smoothScore = lerp(S.smoothScore, avg, 0.25);
    updateMeter(S.smoothScore);

    // camera glow
    const cam = $('camera-area');
    cam.classList.remove('glow-red','glow-yellow','glow-green');
    if (S.smoothScore > CFG.matchThreshold) cam.classList.add('glow-green');
    else if (S.smoothScore > 0.4) cam.classList.add('glow-yellow');
    else if (S.smoothScore > 0.2) cam.classList.add('glow-red');

    if (S.smoothScore >= CFG.matchThreshold) {
        if (S.phase === 'matching') {
            S.phase = 'holding';
            S.holdStart = performance.now();
            show($('hold-overlay'));
            playTone(440, .1);
            narrate('Hold it! Freeze like a statue!');
        }
        if (S.phase === 'holding') {
            const elapsed = performance.now() - S.holdStart;
            S.holdProgress = Math.min(elapsed / CFG.holdMs, 1);
            $('hold-ring-fg').style.strokeDashoffset = 327 * (1 - S.holdProgress);
            $('hold-text').textContent = S.holdProgress < 1 ? 'HOLD IT!' : 'YES!';
            if (S.holdProgress >= 1) poseCompleted();
        }
    } else {
        if (S.phase === 'holding') {
            S.phase = 'matching';
            S.holdProgress = 0;
            hide($('hold-overlay'));
            $('hold-ring-fg').style.strokeDashoffset = 327;
        }
    }
}

// ─── POSE MATCHING ────────────────────────────
function checkPose(kp, id) {
    switch (id) {
        case 'reach_high':  return checkReachHigh(kp);
        case 'starfish':    return checkStarfish(kp);
        case 'tiny_mouse':  return checkTinyMouse(kp);
        case 'airplane':    return checkAirplane(kp);
        case 'touch_toes':  return checkTouchToes(kp);
        default: return 0;
    }
}

function kpOk(p){ return p && p.score > CFG.confidence; }

function checkReachHigh(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    // left wrist above left shoulder
    if(kpOk(lw)&&kpOk(ls)){n++;if(lw.y<ls.y)s++;}
    // right wrist above right shoulder
    if(kpOk(rw)&&kpOk(rs)){n++;if(rw.y<rs.y)s++;}
    // at least one wrist above nose
    if(kpOk(nose)){
        if(kpOk(lw)||kpOk(rw)){
            n++;
            if((kpOk(lw)&&lw.y<nose.y)||(kpOk(rw)&&rw.y<nose.y))s++;
        }
    }
    // arms somewhat apart (not crossed behind head)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;
        if(Math.abs(lw.x-rw.x)>sw*0.3)s++;
    }
    return n?s/n:0;
}

function checkStarfish(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    const la=kp[15],ra=kp[16],lh=kp[11],rh=kp[12];
    // wrists spread wide
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++; if(Math.abs(lw.x-rw.x)>sw*1.7)s++;
    }
    // ankles spread wide
    if(kpOk(la)&&kpOk(ra)&&kpOk(lh)&&kpOk(rh)){
        const hw=Math.abs(lh.x-rh.x);
        n++; if(Math.abs(la.x-ra.x)>Math.max(hw*1.3,40))s++;
    }
    // wrists roughly at or below shoulder height (not above head)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const avgW=(lw.y+rw.y)/2, avgS=(ls.y+rs.y)/2;
        n++; if(avgW > avgS - 40)s++;   // allow some above-shoulder leeway
    }
    return n?s/n:0;
}

function checkTinyMouse(kp){
    let s=0, n=0;
    const nose=kp[0],ls=kp[5],rs=kp[6],lh=kp[11],rh=kp[12];
    const lk=kp[13],rk=kp[14],la=kp[15],ra=kp[16];

    // hips close to knees (squat)
    if(kpOk(lh)&&kpOk(lk)){
        const torso = (kpOk(ls))? Math.abs(lh.y-ls.y) : 100;
        n++; if(Math.abs(lk.y-lh.y)< torso*0.7)s++;
    }
    if(kpOk(rh)&&kpOk(rk)){
        const torso = (kpOk(rs))? Math.abs(rh.y-rs.y) : 100;
        n++; if(Math.abs(rk.y-rh.y)< torso*0.7)s++;
    }
    // body compact vertically
    if(kpOk(nose)&&(kpOk(la)||kpOk(ra))){
        const ankleY = kpOk(la)?la.y:ra.y;
        const bodyH  = ankleY - nose.y;
        if(kpOk(ls)&&kpOk(rs)){
            const sw=Math.abs(ls.x-rs.x);
            n++; if(bodyH < sw*3.5)s++;
        }
    }
    return n?s/n:0;
}

function checkAirplane(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    const la=kp[15],ra=kp[16],lh=kp[11],rh=kp[12];
    // wrists spread wide
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++; if(Math.abs(lw.x-rw.x)>sw*1.7)s++;
    }
    // wrists near shoulder height
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const avgW=(lw.y+rw.y)/2, avgS=(ls.y+rs.y)/2;
        const torso=(kpOk(lh))?Math.abs(lh.y-ls.y):120;
        n++; if(Math.abs(avgW-avgS)<torso*0.5)s++;
    }
    // ankles close together (not starfish)
    if(kpOk(la)&&kpOk(ra)&&kpOk(lh)&&kpOk(rh)){
        const hw=Math.abs(lh.x-rh.x);
        n++; if(Math.abs(la.x-ra.x)<hw*2)s++;
    }
    return n?s/n:0;
}

function checkTouchToes(kp){
    let s=0, n=0;
    const nose=kp[0],lw=kp[9],rw=kp[10];
    const ls=kp[5],rs=kp[6],lh=kp[11],rh=kp[12];
    // at least one wrist below hips
    if(kpOk(lw)&&kpOk(lh)){ n++; if(lw.y>lh.y)s++; }
    if(kpOk(rw)&&kpOk(rh)){ n++; if(rw.y>rh.y)s++; }
    // nose near or below shoulder level
    if(kpOk(nose)&&kpOk(ls)&&kpOk(rs)){
        const avgS=(ls.y+rs.y)/2;
        n++; if(nose.y > avgS - 30)s++;
    }
    // head close to hips (bending)
    if(kpOk(nose)&&kpOk(lh)&&kpOk(rh)){
        const avgH=(lh.y+rh.y)/2;
        const torso=(kpOk(ls))?Math.abs(avgH-ls.y):100;
        n++; if(avgH-nose.y < torso*1.2)s++;
    }
    return n?s/n:0;
}

// ─── UI UPDATES ───────────────────────────────
function currentPose(){ return POSES[S.poseOrder[S.poseIdx]]; }

function setPoseUI(pose){
    $('pose-emoji-bar').textContent  = pose.emoji;
    $('pose-name-bar').textContent   = pose.name;
    $('pose-instruction').textContent= pose.instruction;
    $('pose-illustration').innerHTML = getPoseSVG(pose.id);
}

function updateMeter(v){
    const pct = Math.round(v * 100);
    const fill = $('meter-fill');
    fill.style.width = pct + '%';
    fill.className = 'meter-fill ' +
        (pct >= 65 ? 'perfect' : pct >= 45 ? 'high' : pct >= 25 ? 'medium' : 'low');
    $('meter-label').textContent = pct + '%';
}

function updatePlayerCount(n){
    const el = $('player-count');
    if (n === 0) el.textContent = '👀 Step in front of the camera!';
    else el.textContent = '👤'.repeat(n) + ' ' + n + ' player' + (n>1?'s':'') + ' found!';
}

function buildProgressDots(){
    const c = $('progress-dots');
    c.innerHTML = '';
    for(let i=0;i<S.poseOrder.length;i++){
        const d = document.createElement('div');
        d.className = 'progress-dot';
        d.id = 'dot-'+i;
        c.appendChild(d);
    }
}
function updateProgressDots(){
    for(let i=0;i<S.poseOrder.length;i++){
        const d = $('dot-'+i);
        if(!d) continue;
        d.classList.remove('current','done');
        if(i < S.poseIdx) d.classList.add('done');
        if(i === S.poseIdx) d.classList.add('current');
    }
}
function markDotDone(i){
    const d=$('dot-'+i); if(d){d.classList.remove('current');d.classList.add('done');}
}

function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $(id).classList.add('active');
}
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

function setLoadMsg(msg, pct){
    $('loading-status').textContent = msg;
    $('loading-fill').style.width = pct + '%';
}
function showError(msg){
    $('error-message').textContent = msg;
    showScreen('screen-error');
}

// ─── CONFETTI ─────────────────────────────────
function spawnConfetti(count){
    const W = S.cCanvas.width, H = S.cCanvas.height;
    const colors = ['#FF6B9D','#FFD93D','#6BCB77','#4ECDC4','#FF8C42','#7B2FF7','#ff0000','#00aaff'];
    for(let i=0;i<count;i++){
        S.confetti.push({
            x: Math.random()*W,
            y: Math.random()*-H*0.5,
            w: Math.random()*10+5,
            h: Math.random()*6+3,
            color: colors[Math.floor(Math.random()*colors.length)],
            vx: (Math.random()-0.5)*4,
            vy: Math.random()*4+2,
            rot: Math.random()*360,
            rv: (Math.random()-0.5)*12,
            life: 1,
        });
    }
}
function updateConfetti(){
    const {cCtx:ctx, cCanvas:c, confetti} = S;
    if(!ctx) return;
    ctx.clearRect(0,0,c.width,c.height);
    for(let i=confetti.length-1;i>=0;i--){
        const p=confetti[i];
        p.x+=p.vx;  p.y+=p.vy;  p.vy+=0.12;
        p.rot+=p.rv; p.life-=0.003;
        if(p.y>c.height+20||p.life<=0){ confetti.splice(i,1); continue; }
        ctx.save();
        ctx.globalAlpha=Math.max(0,p.life);
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle=p.color;
        ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
    }
}

// ─── SOUND (Web Audio API tiny tones) ─────────
function initAudio(){
    try{ S.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(_){}
}
function playTone(freq, dur){
    const a = S.audioCtx; if(!a) return;
    if(a.state==='suspended') a.resume();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.connect(gain); gain.connect(a.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.18, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime+dur);
    osc.start(a.currentTime);
    osc.stop(a.currentTime+dur);
}
function playChord(){
    playTone(523,.35); playTone(659,.35); playTone(784,.35);
    setTimeout(()=>playTone(1047,.4), 150);
}

// ─── NARRATOR (Web Speech Synthesis) ─────────
let narratorVoice = null;
let narratorTimeout = null;

function initNarrator() {
    if (!('speechSynthesis' in window)) return;
    // Pre-load voices (some browsers load async)
    const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        // Prefer a friendly English voice
        narratorVoice = voices.find(v => /english.*female|samantha|zira|karen|Google.*US/i.test(v.name))
            || voices.find(v => /en[-_]US|en[-_]GB/i.test(v.lang))
            || voices[0] || null;
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function narrate(text) {
    // Show subtitle bar
    const bar = $('narrator-bar');
    const textEl = $('narrator-text');
    if (bar && textEl) {
        textEl.textContent = text;
        bar.classList.remove('hidden');
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
        clearTimeout(narratorTimeout);
        narratorTimeout = setTimeout(() => bar.classList.add('hidden'), 6000);
    }

    // Speak aloud
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel(); // stop any current speech
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;   // slightly slow for kids
    utter.pitch = 1.15; // slightly higher / friendlier
    utter.volume = 1;
    if (narratorVoice) utter.voice = narratorVoice;
    speechSynthesis.speak(utter);
}

// ─── SVG POSE ILLUSTRATIONS ──────────────────
function getPoseSVG(id){
    const head = (cx,cy)=>`
        <circle cx="${cx}" cy="${cy}" r="26" fill="#FFD93D" stroke="#E8C929" stroke-width="2"/>
        <circle cx="${cx-8}" cy="${cy-5}" r="3.5" fill="#333"/>
        <circle cx="${cx+8}" cy="${cy-5}" r="3.5" fill="#333"/>
        <path d="M ${cx-11} ${cy+6} Q ${cx} ${cy+16} ${cx+11} ${cy+6}"
              stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    const hand = (cx,cy)=>`<circle cx="${cx}" cy="${cy}" r="8" fill="#FFD93D" stroke="#E8C929" stroke-width="1.5"/>`;
    const foot = (cx,cy)=>`<ellipse cx="${cx}" cy="${cy}" rx="13" ry="8" fill="#FF6B9D"/>`;
    const limb = (x1,y1,x2,y2,c='#7B2FF7')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;

    const defs = {
        reach_high: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,55,12)}${limb(100,95,145,12)}
            ${limb(100,95,100,175)}
            ${limb(100,175,78,260,'#FF6B9D')}${limb(100,175,122,260,'#FF6B9D')}
            ${head(100,58)}
            ${hand(55,12)}${hand(145,12)}
            ${foot(78,264)}${foot(122,264)}
            <text x="55" y="10" text-anchor="middle" font-size="18">⭐</text>
            <text x="145" y="10" text-anchor="middle" font-size="18">⭐</text>
        </svg>`,

        starfish: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,15,55)}${limb(100,95,185,55)}
            ${limb(100,95,100,175)}
            ${limb(100,175,32,268,'#FF6B9D')}${limb(100,175,168,268,'#FF6B9D')}
            ${head(100,58)}
            ${hand(15,55)}${hand(185,55)}
            ${foot(32,272)}${foot(168,272)}
        </svg>`,

        tiny_mouse: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,175,60,195)}${limb(100,175,140,195)}
            ${limb(100,155,100,200)}
            ${limb(100,200,65,248,'#FF6B9D')}${limb(100,200,135,248,'#FF6B9D')}
            ${limb(65,248,70,268,'#FF6B9D')}${limb(135,248,130,268,'#FF6B9D')}
            ${head(100,140)}
            ${hand(60,195)}${hand(140,195)}
            ${foot(70,272)}${foot(130,272)}
            <text x="100" y="120" text-anchor="middle" font-size="22">🐭</text>
        </svg>`,

        airplane: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,8,95)}${limb(100,95,192,95)}
            ${limb(100,95,100,175)}
            ${limb(100,175,88,260,'#FF6B9D')}${limb(100,175,112,260,'#FF6B9D')}
            ${head(100,58)}
            ${hand(8,95)}${hand(192,95)}
            ${foot(88,264)}${foot(112,264)}
        </svg>`,

        touch_toes: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(110,120,85,230)}${limb(110,120,135,230)}
            ${limb(110,90,110,170)}
            ${limb(110,170,80,260,'#FF6B9D')}${limb(110,170,140,260,'#FF6B9D')}
            ${head(105,78)}
            ${hand(85,230)}${hand(135,230)}
            ${foot(80,264)}${foot(140,264)}
        </svg>`,
    };
    return defs[id] || '';
}

// ─── UTILITIES ────────────────────────────────
function shuffle(a){
    for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
}
function lerp(a,b,t){ return a+(b-a)*t; }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
