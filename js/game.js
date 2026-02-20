/* ==============================================
   MAGIC STATUE – Game Engine
   A webcam pose-matching party game for kids 3-5
   ============================================== */

// ─── CONFIGURATION ────────────────────────────
const CFG = {
    confidence:       0.25,   // keypoint confidence threshold
    matchThreshold:   0.50,   // % match to begin hold (forgiving for kids)
    holdMs:           2000,   // ms to hold a freeze pose
    activeHoldMs:     3500,   // cumulative ms needed for active poses
    holdDecayRate:    0.5,    // freeze hold decays at half fill speed
    previewMs:        3200,   // ms to show pose intro
    celebrateMs:      2800,   // ms of celebration
    countdownSec:     3,      // 3-2-1 countdown
    poseTimeLimit:    30000,  // 30 seconds per pose
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
    // --- Solo poses ---
    {
        id:'reach_high', name:'Reach for the Stars!', emoji:'🌟',
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
    {
        id:'jumping_jacks', name:'Jumping Jacks!', emoji:'🤸',
        instruction:'Do jumping jacks! Arms UP and legs OUT!',
        color:'#FF4081',
        active: true,
    },
    {
        id:'hands_on_head', name:'Hands on Head!', emoji:'🙆',
        instruction:'Put BOTH hands on top of your head!',
        color:'#00BCD4',
    },
    {
        id:'flamingo', name:'Flamingo!', emoji:'🦩',
        instruction:'Stand on ONE leg like a flamingo!',
        color:'#E91E63',
    },
    {
        id:'superhero', name:'Superhero Pose!', emoji:'🦸',
        instruction:'Hands on your hips, stand tall and strong!',
        color:'#3F51B5',
    },
    {
        id:'run_pose', name:'Run in Place!', emoji:'🏃',
        instruction:'Run run run! Lift those knees UP high!',
        color:'#FF5722',
        active: true,
    },
    {
        id:'wave_hello', name:'Wave Hello!', emoji:'👋',
        instruction:'Wave your hand UP high! Say hello!',
        color:'#AB47BC',
        active: true,
    },
    {
        id:'tree_pose', name:'Tree Pose!', emoji:'🌳',
        instruction:'Arms UP together like branches and stand tall!',
        color:'#66BB6A',
    },
    {
        id:'crab_walk', name:'Crab!', emoji:'🦀',
        instruction:'Squat down low and spread your arms like crab claws!',
        color:'#EF5350',
    },
    {
        id:'ballet', name:'Ballet Dancer!', emoji:'🩰',
        instruction:'Arms in a big circle above your head!',
        color:'#CE93D8',
    },
    {
        id:'wide_squat', name:'Sumo Squat!', emoji:'🏋️',
        instruction:'Feet wide, squat down and hold your arms out!',
        color:'#FF7043',
    },
    {
        id:'disco', name:'Disco!', emoji:'🕺',
        instruction:'Dance! Point one arm UP and one DOWN!',
        color:'#FDD835',
        active: true,
    },
    // --- Multiplayer poses (2+ players) ---
    {
        id:'high_five', name:'High Five!', emoji:'🙌',
        instruction:'Give your partner a HIGH FIVE up high!',
        color:'#FFC107',
        multiPlayer: true,
    },
    {
        id:'hold_hands', name:'Hold Hands!', emoji:'🤝',
        instruction:'Hold hands with your partner!',
        color:'#8BC34A',
        multiPlayer: true,
    },
    {
        id:'group_hug', name:'Group Hug!', emoji:'🤗',
        instruction:'Get close and HUG your friends!',
        color:'#FF7043',
        multiPlayer: true,
    },
    {
        id:'mirror_pose', name:'Mirror Mirror!', emoji:'🪞',
        instruction:'Face your partner and copy each other with arms OUT!',
        color:'#26C6DA',
        multiPlayer: true,
    },
    {
        id:'back_to_back', name:'Back to Back!', emoji:'🔙',
        instruction:'Stand BACK to BACK with your partner!',
        color:'#5C6BC0',
        multiPlayer: true,
    },
    {
        id:'wave_together', name:'Wave Together!', emoji:'👐',
        instruction:'Both wave your hands UP high at the same time!',
        color:'#FFB74D',
        multiPlayer: true,
        active: true,
    },
    {
        id:'side_by_side', name:'Side by Side!', emoji:'🤜🤛',
        instruction:'Stand side by side and both reach UP with your outside arm!',
        color:'#81C784',
        multiPlayer: true,
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
    screenshots: [],
    bgMusicPlaying: false,
    bgMusicGain: null,
    bgMusicTimer: null,
    playerScores: [0,0,0,0],
    poseStartTime: 0,
    poseTimerId: null,
    streak: 0,
    bestStreak: 0,
    replayTimerId: null,
    holdAccum: 0,
    lastFrameTime: 0,
    mediaRecorder: null,
    recordedChunks: [],
    autoCountdownId: null,
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

function pickPoses() {
    const soloIdx = POSES.map((p,i) => i).filter(i => !POSES[i].multiPlayer);
    const duoIdx  = POSES.map((p,i) => i).filter(i => POSES[i].multiPlayer);
    const total = 8; // more poses per game for variety
    let selected;
    if (S.playersFound >= 2 && duoIdx.length > 0) {
        // With 2+ players: half the poses are teamwork!
        const dc = Math.min(shuffle([...duoIdx]).length, Math.ceil(total / 2));
        selected = [...shuffle([...duoIdx]).slice(0,dc), ...shuffle([...soloIdx]).slice(0,total-dc)];
    } else {
        selected = shuffle([...soloIdx]).slice(0, total);
    }
    return shuffle(selected);
}

async function startGame() {
    if (!S.ready) return;
    // Clear auto-countdown if running
    if (S.autoCountdownId) { clearInterval(S.autoCountdownId); S.autoCountdownId = null; }
    hide($('auto-countdown'));
    cancelTitlePreview();

    narrate('Here we go! Get ready to play Magic Statue!');
    await wait(1800);

    S.poseOrder = pickPoses();
    S.poseIdx = 0;
    S.screenshots = [];
    S.playerScores = [0,0,0,0];
    S.streak = 0;
    S.bestStreak = 0;

    showScreen('screen-game');
    buildProgressDots();
    buildScoreboard();
    startBgMusic();
    runCountdown();
}

function restartGame() {
    // Clean up any in-progress video recording
    if (S.mediaRecorder && S.mediaRecorder.state !== 'inactive') {
        try { S.mediaRecorder.stop(); } catch(e) {}
    }
    S.mediaRecorder = null;
    S.recordedChunks = [];
    S.poseOrder = pickPoses();
    S.poseIdx = 0;
    S.smoothScore = 0;
    S.screenshots = [];
    S.playerScores = [0,0,0,0];
    S.streak = 0;
    S.bestStreak = 0;
    S.holdAccum = 0;
    S.lastFrameTime = 0;
    narrate('Let\'s play again! Get ready!');
    showScreen('screen-game');
    buildProgressDots();
    buildScoreboard();
    startBgMusic();
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
        // Auto-start countdown instead of waiting for button press
        startAutoCountdown();
    }
}

function startAutoCountdown() {
    const el = $('auto-countdown');
    const textEl = $('auto-countdown-text');
    if (!el || !textEl) { startGame(); return; }
    show(el);
    narrate('I can see you! Anyone else want to play? Jump in front of the camera!');
    let sec = 5;
    textEl.textContent = 'Starting in ' + sec + '…';
    S.autoCountdownId = setInterval(() => {
        sec--;
        if (sec > 0) {
            textEl.textContent = 'Starting in ' + sec + '…';
            if (sec === 3) {
                narrate(S.playersFound > 1
                    ? S.playersFound + ' players ready! Here we go!'
                    : 'Last chance to join!');
            }
        } else {
            clearInterval(S.autoCountdownId);
            S.autoCountdownId = null;
            hide(el);
            startGame();
        }
    }, 1000);
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
    S.holdAccum = 0;
    S.lastFrameTime = performance.now();
    S.poseStartTime = performance.now();
    hide($('hold-overlay'));
    hide($('statue-flash'));
    const pose = currentPose();
    if (pose.active) {
        narrate(pose.multiPlayer ? 'Do this one together! Keep moving!' : 'Keep moving! You can do it!');
        startVideoRecording();
    } else if (pose.multiPlayer) {
        narrate('Do this one together! Work as a team!');
    } else {
        narrate('Now copy the pose! You can do it!');
    }
    startPoseTimer();
    startLoop();
}

async function poseCompleted() {
    S.phase = 'celebrate';
    cancelLoop();
    clearPoseTimer();

    // Capture screenshot before celebration effects
    captureScreenshot();

    // Stop video recording for active poses and attach to screenshot entry
    if (currentPose().active) {
        const videoUrl = await stopVideoRecording();
        if (videoUrl && S.screenshots.length > 0) {
            S.screenshots[S.screenshots.length - 1].video = videoUrl;
        }
    }

    // Streak tracking
    S.streak++;
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;

    // Award points to players (with streak multiplier)
    awardPoints();

    // flash
    const flash = $('statue-flash');
    flash.style.animation = 'none'; void flash.offsetWidth; flash.style.animation = '';
    show(flash);

    // Silly sound effect on success
    playSillySound();
    spawnConfetti(120);

    // Streak combo announcement
    let cheers;
    if (S.streak >= 5) {
        cheers = ['UNSTOPPABLE! ' + S.streak + ' in a row!', 'MEGA COMBO! ' + S.streak + ' poses! WOW!'];
        spawnConfetti(200);
    } else if (S.streak >= 3) {
        cheers = [S.streak + ' in a row! COMBO! Amazing!', 'Streak of ' + S.streak + '! You\'re on fire!'];
        spawnConfetti(80);
    } else {
        cheers = [
            'Amazing! You did it!',
            'Wow, great job! You are a star!',
            'Fantastic! That was perfect!',
            'Hooray! You nailed it!',
            'Superstar! That was awesome!',
        ];
    }
    narrate(cheers[Math.floor(Math.random()*cheers.length)]);

    // Show combo overlay if streak >= 2
    showCombo();

    markDotDone(S.poseIdx);
    updateScoreboard();
    await wait(CFG.celebrateMs);
    hide(flash);
    hideCombo();

    S.poseIdx++;
    if (S.poseIdx >= S.poseOrder.length) {
        showVictory();
    } else {
        startPoseIntro();
    }
}

async function poseTimedOut() {
    S.phase = 'celebrate';
    cancelLoop();
    clearPoseTimer();

    // Discard video recording on timeout
    if (currentPose().active) await stopVideoRecording();

    S.streak = 0; // reset streak on timeout
    playFailSound();
    narrate('Time\'s up! Let\'s try the next one!');
    markDotDone(S.poseIdx);
    await wait(2000);

    S.poseIdx++;
    if (S.poseIdx >= S.poseOrder.length) {
        showVictory();
    } else {
        startPoseIntro();
    }
}

// ─── POSE TIMER ───────────────────────────────
function startPoseTimer() {
    clearPoseTimer();
    S.poseStartTime = performance.now();
    const tick = () => {
        if (S.phase !== 'matching' && S.phase !== 'holding') return;
        const elapsed = performance.now() - S.poseStartTime;
        const remaining = Math.max(0, CFG.poseTimeLimit - elapsed);
        const pct = (remaining / CFG.poseTimeLimit) * 100;
        const secs = Math.ceil(remaining / 1000);
        const fill = $('timer-fill');
        const text = $('timer-text');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = secs;
        if (fill) {
            fill.classList.remove('timer-warn','timer-danger');
            if (secs <= 5) fill.classList.add('timer-danger');
            else if (secs <= 10) fill.classList.add('timer-warn');
        }
        if (remaining <= 0) {
            poseTimedOut();
            return;
        }
        S.poseTimerId = requestAnimationFrame(tick);
    };
    tick();
}
function clearPoseTimer() {
    if (S.poseTimerId) { cancelAnimationFrame(S.poseTimerId); S.poseTimerId = null; }
}

// ─── SCORING ──────────────────────────────────
function awardPoints() {
    const poses = S.detected;
    const count = Math.min(poses.length, 4);
    const pose = currentPose();
    const elapsed = performance.now() - S.poseStartTime;
    // Time bonus: faster = more points (max 100, min 10)
    const timeBonus = Math.max(10, Math.round(100 * (1 - elapsed / CFG.poseTimeLimit)));
    // Streak multiplier: 1x, 1x, 1.5x, 2x, 2.5x, 3x...
    const streakMult = S.streak >= 3 ? 1 + (S.streak - 2) * 0.5 : 1;

    if (pose.multiPlayer) {
        // All detected players share the points equally
        for (let i = 0; i < count; i++) S.playerScores[i] += Math.round(timeBonus * streakMult);
    } else {
        for (let i = 0; i < count; i++) {
            const score = checkPose(poses[i].keypoints, pose.id);
            const pts = Math.round(timeBonus * Math.max(score, 0.5) * streakMult);
            S.playerScores[i] += pts;
        }
    }
    updateScoreboard();
}

function buildScoreboard() {
    const el = $('scoreboard');
    if (!el) return;
    el.innerHTML = '';
    const count = Math.max(S.playersFound, 1);
    for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'score-chip';
        d.id = 'score-chip-' + i;
        d.style.borderColor = PLAYER_COLORS[i % PLAYER_COLORS.length];
        d.innerHTML = '<span class="score-player">P' + (i+1) + '</span><span class="score-pts" id="score-pts-'+i+'">0</span>';
        el.appendChild(d);
    }
}

function updateScoreboard() {
    const count = Math.max(S.playersFound, 1);
    for (let i = 0; i < count; i++) {
        const el = $('score-pts-' + i);
        if (el) el.textContent = S.playerScores[i];
    }
}

function buildFinalScores() {
    const el = $('final-scores');
    if (!el) return;
    el.innerHTML = '';
    const count = Math.max(S.playersFound, 1);
    const maxScore = Math.max(...S.playerScores.slice(0, count));
    for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'final-score-card' + (S.playerScores[i] === maxScore ? ' winner' : '');
        d.style.borderColor = PLAYER_COLORS[i % PLAYER_COLORS.length];
        const crown = S.playerScores[i] === maxScore ? '👑 ' : '';
        d.innerHTML = '<div class="final-score-label">' + crown + 'P' + (i+1) + '</div>'
            + '<div class="final-score-pts">' + S.playerScores[i] + '</div>'
            + '<div class="final-score-unit">points</div>';
        el.appendChild(d);
    }
}

function showVictory() {
    S.phase = 'victory';
    cancelLoop();
    stopBgMusic();
    spawnConfetti(200);
    showScreen('screen-victory');
    playChord(); setTimeout(()=>playChord(),400);
    const streakMsg = S.bestStreak >= 3 ? ' Best streak: ' + S.bestStreak + ' in a row!' : '';
    narrate('You did ALL the poses! You are a Magic Statue Champion!' + streakMsg);
    buildFinalScores();
    // Start replay slideshow, then show gallery after
    startReplaySlideshow(() => {
        buildGallery();
    });
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
    const now = performance.now();
    const dt = now - S.lastFrameTime;
    S.lastFrameTime = now;

    if (count === 0) {
        S.smoothScore = lerp(S.smoothScore, 0, 0.15);
        updateMeter(S.smoothScore);
        if (S.phase === 'holding') {
            const pose = currentPose();
            if (pose.active) {
                // Active: keep overlay, just pause accumulation
            } else {
                // Freeze: gradual decay instead of instant reset
                S.holdAccum = Math.max(0, S.holdAccum - dt * CFG.holdDecayRate);
                S.holdProgress = S.holdAccum / CFG.holdMs;
                $('hold-ring-fg').style.strokeDashoffset = 327 * (1 - S.holdProgress);
                if (S.holdAccum <= 0) {
                    S.phase = 'matching';
                    S.holdProgress = 0;
                    hide($('hold-overlay'));
                    $('hold-ring-fg').style.strokeDashoffset = 327;
                }
            }
        }
        return;
    }

    const pose = currentPose();
    let avg;

    if (pose.multiPlayer) {
        avg = (count >= 2) ? checkMultiPose(poses.slice(0, count), pose.id) : 0;
    } else {
        let total = 0;
        for (let i = 0; i < count; i++) {
            total += checkPose(poses[i].keypoints, pose.id);
        }
        avg = total / count;
    }

    S.smoothScore = lerp(S.smoothScore, avg, 0.25);
    updateMeter(S.smoothScore);

    // camera glow
    const cam = $('camera-area');
    cam.classList.remove('glow-red','glow-yellow','glow-green');
    if (S.smoothScore > CFG.matchThreshold) cam.classList.add('glow-green');
    else if (S.smoothScore > 0.4) cam.classList.add('glow-yellow');
    else if (S.smoothScore > 0.2) cam.classList.add('glow-red');

    const isActive = pose.active;
    const holdTarget = isActive ? CFG.activeHoldMs : CFG.holdMs;

    if (S.smoothScore >= CFG.matchThreshold) {
        if (S.phase === 'matching') {
            S.phase = 'holding';
            show($('hold-overlay'));
            playTone(440, .1);
            narrate(isActive ? 'Great! Keep going!' : 'Hold it! Freeze like a statue!');
        }
        if (S.phase === 'holding') {
            S.holdAccum = Math.min(S.holdAccum + dt, holdTarget);
            S.holdProgress = S.holdAccum / holdTarget;
            $('hold-ring-fg').style.strokeDashoffset = 327 * (1 - S.holdProgress);
            $('hold-text').textContent = S.holdProgress < 1 ? (isActive ? 'KEEP GOING!' : 'HOLD IT!') : 'YES!';
            if (S.holdProgress >= 1) poseCompleted();
        }
    } else {
        if (S.phase === 'holding') {
            if (isActive) {
                // Active: progress pauses, no decay — keep overlay visible
            } else {
                // Freeze: gradual decay instead of instant reset
                S.holdAccum = Math.max(0, S.holdAccum - dt * CFG.holdDecayRate);
                S.holdProgress = S.holdAccum / holdTarget;
                $('hold-ring-fg').style.strokeDashoffset = 327 * (1 - S.holdProgress);
                if (S.holdAccum <= 0) {
                    S.phase = 'matching';
                    S.holdProgress = 0;
                    hide($('hold-overlay'));
                    $('hold-ring-fg').style.strokeDashoffset = 327;
                }
            }
        }
    }
}

// ─── POSE MATCHING ────────────────────────────
function checkPose(kp, id) {
    switch (id) {
        case 'reach_high':    return checkReachHigh(kp);
        case 'starfish':      return checkStarfish(kp);
        case 'tiny_mouse':    return checkTinyMouse(kp);
        case 'airplane':      return checkAirplane(kp);
        case 'touch_toes':    return checkTouchToes(kp);
        case 'jumping_jacks': return checkJumpingJacks(kp);
        case 'hands_on_head': return checkHandsOnHead(kp);
        case 'flamingo':      return checkFlamingo(kp);
        case 'superhero':     return checkSuperhero(kp);
        case 'run_pose':      return checkRunPose(kp);
        case 'wave_hello':    return checkWaveHello(kp);
        case 'tree_pose':     return checkTreePose(kp);
        case 'crab_walk':     return checkCrabWalk(kp);
        case 'ballet':        return checkBallet(kp);
        case 'wide_squat':    return checkWideSquat(kp);
        case 'disco':         return checkDisco(kp);
        default: return 0;
    }
}

function checkMultiPose(allPoses, id) {
    const valid = allPoses.filter(p => p.keypoints && p.keypoints.length >= 17);
    if (valid.length < 2) return 0;
    switch (id) {
        case 'high_five':     return checkHighFive(valid);
        case 'hold_hands':    return checkHoldHands(valid);
        case 'group_hug':     return checkGroupHug(valid);
        case 'mirror_pose':   return checkMirrorPose(valid);
        case 'back_to_back':  return checkBackToBack(valid);
        case 'wave_together': return checkWaveTogether(valid);
        case 'side_by_side':  return checkSideBySide(valid);
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

// --- New solo pose checks ---

function checkJumpingJacks(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    const la=kp[15],ra=kp[16],lh=kp[11],rh=kp[12];
    if(kpOk(lw)&&kpOk(nose)){n++;if(lw.y<nose.y)s++;}
    if(kpOk(rw)&&kpOk(nose)){n++;if(rw.y<nose.y)s++;}
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)>sw*1.3)s++;
    }
    if(kpOk(la)&&kpOk(ra)&&kpOk(lh)&&kpOk(rh)){
        const hw=Math.abs(lh.x-rh.x);
        n++;if(Math.abs(la.x-ra.x)>Math.max(hw*1.3,40))s++;
    }
    return n?s/n:0;
}

function checkHandsOnHead(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],nose=kp[0],ls=kp[5],rs=kp[6];
    if(kpOk(lw)&&kpOk(ls)){n++;if(lw.y<ls.y)s++;}
    if(kpOk(rw)&&kpOk(rs)){n++;if(rw.y<rs.y)s++;}
    if(kpOk(lw)&&kpOk(rw)&&kpOk(nose)&&kpOk(ls)){
        const headH=Math.abs(nose.y-ls.y);
        const avgW=(lw.y+rw.y)/2;
        n++;if(Math.abs(avgW-nose.y)<headH*1.2)s++;
    }
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)<sw*1.5)s++;
    }
    return n?s/n:0;
}

function checkFlamingo(kp){
    let s=0, n=0;
    const la=kp[15],ra=kp[16],lk=kp[13],rk=kp[14];
    const lh=kp[11],rh=kp[12],ls=kp[5],nose=kp[0];
    if(kpOk(la)&&kpOk(ra)){
        const diff=Math.abs(la.y-ra.y);
        const legLen=kpOk(lh)?Math.abs(Math.max(la.y,ra.y)-lh.y):100;
        n++;if(diff>legLen*0.3)s++;
    }
    if(kpOk(lk)&&kpOk(rk)&&kpOk(lh)&&kpOk(rh)){
        const lD=Math.abs(lk.y-lh.y), rD=Math.abs(rk.y-rh.y);
        const torso=kpOk(ls)?Math.abs(lh.y-ls.y):100;
        n++;if(Math.min(lD,rD)<torso*0.6)s++;
    }
    if(kpOk(nose)&&kpOk(lh)){n++;if(nose.y<lh.y)s++;}
    return n?s/n:0;
}

function checkSuperhero(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    const le=kp[7],re=kp[8],lh=kp[11],rh=kp[12];
    if(kpOk(lw)&&kpOk(lh)&&kpOk(ls)){
        const t=Math.abs(lh.y-ls.y);
        n++;if(Math.abs(lw.y-lh.y)<t*0.5)s++;
    }
    if(kpOk(rw)&&kpOk(rh)&&kpOk(rs)){
        const t=Math.abs(rh.y-rs.y);
        n++;if(Math.abs(rw.y-rh.y)<t*0.5)s++;
    }
    if(kpOk(le)&&kpOk(re)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(le.x-re.x)>sw*1.1)s++;
    }
    if(kpOk(kp[0])&&kpOk(lh)&&kpOk(ls)){
        const t=Math.abs(lh.y-ls.y);
        n++;if(lh.y-kp[0].y>t*1.5)s++;
    }
    return n?s/n:0;
}

function checkRunPose(kp){
    let s=0, n=0;
    const lk=kp[13],rk=kp[14],lh=kp[11],rh=kp[12];
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    if(kpOk(lk)&&kpOk(rk)){
        const diff=Math.abs(lk.y-rk.y);
        const legLen=kpOk(lh)?Math.abs(lh.y-Math.max(lk.y,rk.y)):100;
        n++;if(diff>legLen*0.3)s++;
    }
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const avgS=(ls.y+rs.y)/2;
        n++;if(lw.y<avgS||rw.y<avgS)s++;
    }
    if(kpOk(kp[0])&&kpOk(lh)){n++;if(kp[0].y<lh.y)s++;}
    return n?s/n:0;
}

// --- Additional solo pose checks ---

function checkWaveHello(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    // At least one wrist above nose
    if(kpOk(nose)){
        if(kpOk(lw)){n++;if(lw.y<nose.y)s++;}
        if(kpOk(rw)){n++;if(rw.y<nose.y)s++;}
    }
    // Only one arm way up (not both — that's reach_high)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const lUp=lw.y<ls.y, rUp=rw.y<rs.y;
        n++;if(lUp!==rUp)s++; // exactly one arm up
    }
    // Wrist above head spread from center
    if(kpOk(lw)&&kpOk(rw)&&kpOk(nose)){
        const upW=lw.y<rw.y?lw:rw;
        n++;if(Math.abs(upW.x-nose.x)>20)s++;
    }
    return n?s/n:0;
}

function checkTreePose(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    const la=kp[15],ra=kp[16];
    // Both wrists above nose
    if(kpOk(lw)&&kpOk(nose)){n++;if(lw.y<nose.y)s++;}
    if(kpOk(rw)&&kpOk(nose)){n++;if(rw.y<nose.y)s++;}
    // Wrists close together (arms up together)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)<sw*0.8)s++;
    }
    // Ankles close together (standing tall)
    if(kpOk(la)&&kpOk(ra)){
        const hw=kpOk(kp[11])&&kpOk(kp[12])?Math.abs(kp[11].x-kp[12].x):60;
        n++;if(Math.abs(la.x-ra.x)<hw*2)s++;
    }
    return n?s/n:0;
}

function checkCrabWalk(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    const lh=kp[11],rh=kp[12],lk=kp[13],rk=kp[14];
    const la=kp[15],ra=kp[16];
    // Squatting: hips close to knees
    if(kpOk(lh)&&kpOk(lk)&&kpOk(ls)){
        const torso=Math.abs(lh.y-ls.y);
        n++;if(Math.abs(lk.y-lh.y)<torso*0.7)s++;
    }
    // Arms spread wide
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)>sw*1.3)s++;
    }
    // Legs spread wide
    if(kpOk(la)&&kpOk(ra)&&kpOk(lh)&&kpOk(rh)){
        const hw=Math.abs(lh.x-rh.x);
        n++;if(Math.abs(la.x-ra.x)>Math.max(hw*1.2,35))s++;
    }
    return n?s/n:0;
}

function checkBallet(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    const le=kp[7],re=kp[8];
    // Both wrists above head
    if(kpOk(lw)&&kpOk(nose)){n++;if(lw.y<nose.y)s++;}
    if(kpOk(rw)&&kpOk(nose)){n++;if(rw.y<nose.y)s++;}
    // Wrists close together (forming circle top)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)<sw*1.0)s++;
    }
    // Elbows out wide (circle shape)
    if(kpOk(le)&&kpOk(re)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(le.x-re.x)>sw*1.1)s++;
    }
    return n?s/n:0;
}

function checkWideSquat(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
    const lh=kp[11],rh=kp[12],lk=kp[13],rk=kp[14];
    const la=kp[15],ra=kp[16],nose=kp[0];
    // Squatting: hips close to knees
    if(kpOk(lh)&&kpOk(lk)&&kpOk(ls)){
        const torso=Math.abs(lh.y-ls.y);
        n++;if(Math.abs(lk.y-lh.y)<torso*0.7)s++;
    }
    // Legs/ankles wide apart
    if(kpOk(la)&&kpOk(ra)&&kpOk(lh)&&kpOk(rh)){
        const hw=Math.abs(lh.x-rh.x);
        n++;if(Math.abs(la.x-ra.x)>Math.max(hw*1.3,40))s++;
    }
    // Arms out (not at sides)
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)>sw*1.2)s++;
    }
    // Head above hips (not fully bending)
    if(kpOk(nose)&&kpOk(lh)){n++;if(nose.y<lh.y)s++;}
    return n?s/n:0;
}

function checkDisco(kp){
    let s=0, n=0;
    const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6],nose=kp[0];
    const lh=kp[11],rh=kp[12];
    // One arm above nose, one below hips (pointing up/down)
    const lUp=kpOk(lw)&&kpOk(nose)&&lw.y<nose.y;
    const rUp=kpOk(rw)&&kpOk(nose)&&rw.y<nose.y;
    const lDown=kpOk(lw)&&kpOk(lh)&&lw.y>lh.y;
    const rDown=kpOk(rw)&&kpOk(rh)&&rw.y>rh.y;
    n++;if((lUp&&rDown)||(rUp&&lDown))s++;
    // Arms spread apart
    if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
        const sw=Math.abs(ls.x-rs.x);
        n++;if(Math.abs(lw.x-rw.x)>sw*0.8)s++;
    }
    // Big height difference between wrists
    if(kpOk(lw)&&kpOk(rw)){
        const diff=Math.abs(lw.y-rw.y);
        const bodyH=kpOk(ls)&&kpOk(lh)?Math.abs(lh.y-ls.y):150;
        n++;if(diff>bodyH*0.6)s++;
    }
    return n?s/n:0;
}

// --- Multiplayer pose checks ---

function checkHighFive(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkHighFivePair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkHighFivePair(kp1,kp2){
    let s=0, n=0;
    const w1=[kp1[9],kp1[10]].filter(kpOk);
    const w2=[kp2[9],kp2[10]].filter(kpOk);
    if(!w1.length||!w2.length) return 0;
    let minD=Infinity,bw1,bw2;
    for(const a of w1) for(const b of w2){
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<minD){minD=d;bw1=a;bw2=b;}
    }
    const body=(kpOk(kp1[5])&&kpOk(kp1[6]))?Math.abs(kp1[5].x-kp1[6].x):100;
    n++;if(minD<body*2.5)s++;
    const s1=(kpOk(kp1[5])&&kpOk(kp1[6]))?(kp1[5].y+kp1[6].y)/2:300;
    const s2=(kpOk(kp2[5])&&kpOk(kp2[6]))?(kp2[5].y+kp2[6].y)/2:300;
    n++;if(bw1.y<s1)s++;
    n++;if(bw2.y<s2)s++;
    return n?s/n:0;
}

function checkHoldHands(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkHoldHandsPair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkHoldHandsPair(kp1,kp2){
    let s=0, n=0;
    const w1=[kp1[9],kp1[10]].filter(kpOk);
    const w2=[kp2[9],kp2[10]].filter(kpOk);
    if(!w1.length||!w2.length) return 0;
    let minD=Infinity,bw1,bw2;
    for(const a of w1) for(const b of w2){
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<minD){minD=d;bw1=a;bw2=b;}
    }
    const body=(kpOk(kp1[5])&&kpOk(kp1[6]))?Math.abs(kp1[5].x-kp1[6].x):100;
    n++;if(minD<body*2.5)s++;
    n++;if(Math.abs(bw1.y-bw2.y)<body*1.5)s++;
    const s1=(kpOk(kp1[5])&&kpOk(kp1[6]))?(kp1[5].y+kp1[6].y)/2:200;
    n++;if(bw1.y>s1-20)s++;
    return n?s/n:0;
}

function checkGroupHug(allPoses){
    if(allPoses.length<2) return 0;
    let s=0, n=0;
    // Get body centers (shoulder midpoints) for each person
    const bodies=allPoses.map(p=>{
        const l=p.keypoints[5],r=p.keypoints[6];
        const lh=p.keypoints[11],rh=p.keypoints[12];
        if(!kpOk(l)||!kpOk(r)) return null;
        return {
            cx:(l.x+r.x)/2,
            cy:(l.y+r.y)/2,
            w:Math.abs(l.x-r.x),
            hipY:(kpOk(lh)&&kpOk(rh))?(lh.y+rh.y)/2:l.y+100,
            kp:p.keypoints
        };
    }).filter(v=>v!==null);
    if(bodies.length<2) return 0;

    // Estimate average body width for scaling
    const avgBody=bodies.reduce((a,b)=>a+b.w,0)/bodies.length || 100;

    // 1) Players are close together (centers within ~3 body widths)
    let totalDist=0, pairs=0;
    for(let i=0;i<bodies.length;i++)
        for(let j=i+1;j<bodies.length;j++){
            totalDist+=Math.abs(bodies[i].cx-bodies[j].cx); pairs++;
        }
    const avgDist=totalDist/pairs;
    n++; if(avgDist<avgBody*6) s+=0.5;
    n++; if(avgDist<avgBody*4) s++;

    // 2) At least one pair of wrists crosses between players (arms reaching toward each other)
    let crossCount=0;
    for(let i=0;i<bodies.length;i++)
        for(let j=i+1;j<bodies.length;j++){
            const kpA=bodies[i].kp, kpB=bodies[j].kp;
            const wrists=[[kpA[9],kpA[10]],[kpB[9],kpB[10]]];
            for(const wa of wrists[0].filter(kpOk))
                for(const wb of wrists[1].filter(kpOk)){
                    const d=Math.hypot(wa.x-wb.x,wa.y-wb.y);
                    if(d<avgBody*4) crossCount++;
                }
        }
    n++; if(crossCount>0) s++;

    // 3) Arms are NOT straight at sides (reaching out = hugging)
    for(let i=0;i<bodies.length;i++){
        const kp=bodies[i].kp;
        const lw=kp[9],rw=kp[10],ls=kp[5],rs=kp[6];
        if(kpOk(lw)&&kpOk(rw)&&kpOk(ls)&&kpOk(rs)){
            const wristSpread=Math.abs(lw.x-rw.x);
            const shoulderW=Math.abs(ls.x-rs.x);
            // In a hug, wrists are typically near or past shoulders (arms out)
            n++; if(wristSpread > shoulderW*0.8) s++;
        }
    }

    return n?s/n:0;
}

// --- Additional multiplayer pose checks ---

function checkMirrorPose(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkMirrorPair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkMirrorPair(kp1,kp2){
    let s=0, n=0;
    const lw1=kp1[9],rw1=kp1[10],ls1=kp1[5],rs1=kp1[6];
    const lw2=kp2[9],rw2=kp2[10],ls2=kp2[5],rs2=kp2[6];
    // Both have arms out wide
    if(kpOk(lw1)&&kpOk(rw1)&&kpOk(ls1)&&kpOk(rs1)){
        const sw=Math.abs(ls1.x-rs1.x);
        n++;if(Math.abs(lw1.x-rw1.x)>sw*1.3)s++;
    }
    if(kpOk(lw2)&&kpOk(rw2)&&kpOk(ls2)&&kpOk(rs2)){
        const sw=Math.abs(ls2.x-rs2.x);
        n++;if(Math.abs(lw2.x-rw2.x)>sw*1.3)s++;
    }
    // Both wrists at roughly same height (mirroring)
    if(kpOk(lw1)&&kpOk(rw1)&&kpOk(lw2)&&kpOk(rw2)){
        const avgH1=(lw1.y+rw1.y)/2, avgH2=(lw2.y+rw2.y)/2;
        const bodyH=kpOk(ls1)&&kpOk(kp1[11])?Math.abs(kp1[11].y-ls1.y):150;
        n++;if(Math.abs(avgH1-avgH2)<bodyH*0.5)s++;
    }
    return n?s/n:0;
}

function checkBackToBack(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkBackToBackPair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkBackToBackPair(kp1,kp2){
    let s=0, n=0;
    const ls1=kp1[5],rs1=kp1[6],ls2=kp2[5],rs2=kp2[6];
    const lh1=kp1[11],rh1=kp1[12],lh2=kp2[11],rh2=kp2[12];
    // Shoulders close together (bodies near each other)
    if(kpOk(ls1)&&kpOk(rs1)&&kpOk(ls2)&&kpOk(rs2)){
        const c1x=(ls1.x+rs1.x)/2, c2x=(ls2.x+rs2.x)/2;
        const c1y=(ls1.y+rs1.y)/2, c2y=(ls2.y+rs2.y)/2;
        const bw=Math.abs(ls1.x-rs1.x);
        n++;if(Math.abs(c1x-c2x)<bw*4)s++;
        // Shoulders at similar height
        n++;if(Math.abs(c1y-c2y)<bw*2)s++;
    }
    // Hips close
    if(kpOk(lh1)&&kpOk(rh1)&&kpOk(lh2)&&kpOk(rh2)){
        const hc1x=(lh1.x+rh1.x)/2, hc2x=(lh2.x+rh2.x)/2;
        const bw=kpOk(ls1)&&kpOk(rs1)?Math.abs(ls1.x-rs1.x):80;
        n++;if(Math.abs(hc1x-hc2x)<bw*4)s++;
    }
    return n?s/n:0;
}

function checkWaveTogether(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkWaveTogetherPair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkWaveTogetherPair(kp1,kp2){
    let s=0, n=0;
    const nose1=kp1[0],nose2=kp2[0];
    // Player 1: at least one wrist above nose
    const w1=[kp1[9],kp1[10]].filter(kpOk);
    if(w1.length&&kpOk(nose1)){
        n++;if(w1.some(w=>w.y<nose1.y))s++;
    }
    // Player 2: at least one wrist above nose
    const w2=[kp2[9],kp2[10]].filter(kpOk);
    if(w2.length&&kpOk(nose2)){
        n++;if(w2.some(w=>w.y<nose2.y))s++;
    }
    // Both have arms up at similar height
    if(w1.length&&w2.length){
        const minY1=Math.min(...w1.map(w=>w.y));
        const minY2=Math.min(...w2.map(w=>w.y));
        const bodyH=kpOk(kp1[5])&&kpOk(kp1[11])?Math.abs(kp1[11].y-kp1[5].y):150;
        n++;if(Math.abs(minY1-minY2)<bodyH*0.6)s++;
    }
    return n?s/n:0;
}

function checkSideBySide(allPoses){
    let best=0;
    for(let i=0;i<allPoses.length;i++)
        for(let j=i+1;j<allPoses.length;j++)
            best=Math.max(best,checkSideBySidePair(allPoses[i].keypoints,allPoses[j].keypoints));
    return best;
}
function checkSideBySidePair(kp1,kp2){
    let s=0, n=0;
    const ls1=kp1[5],rs1=kp1[6],ls2=kp2[5],rs2=kp2[6];
    const lw1=kp1[9],rw1=kp1[10],lw2=kp2[9],rw2=kp2[10];
    // Standing next to each other (shoulder centers within range)
    if(kpOk(ls1)&&kpOk(rs1)&&kpOk(ls2)&&kpOk(rs2)){
        const c1x=(ls1.x+rs1.x)/2, c2x=(ls2.x+rs2.x)/2;
        const bw=Math.abs(ls1.x-rs1.x);
        n++;if(Math.abs(c1x-c2x)<bw*6)s++;
    }
    // At least one wrist above nose for each player
    if(kpOk(kp1[0])){
        const wrists=[lw1,rw1].filter(kpOk);
        if(wrists.length){n++;if(wrists.some(w=>w.y<kp1[0].y))s++;}
    }
    if(kpOk(kp2[0])){
        const wrists=[lw2,rw2].filter(kpOk);
        if(wrists.length){n++;if(wrists.some(w=>w.y<kp2[0].y))s++;}
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

// ─── SILLY SOUND EFFECTS ──────────────────────
function playSillySound(){
    const sounds = [playSfxBoing, playSfxPop, playSfxWhoosh, playSfxTaDa, playSfxSparkle];
    sounds[Math.floor(Math.random()*sounds.length)]();
}

function playSfxBoing(){
    const a=S.audioCtx; if(!a) return;
    if(a.state==='suspended') a.resume();
    const osc=a.createOscillator(), g=a.createGain();
    osc.connect(g); g.connect(a.destination);
    osc.type='sine';
    osc.frequency.setValueAtTime(150, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, a.currentTime+0.15);
    osc.frequency.exponentialRampToValueAtTime(200, a.currentTime+0.3);
    g.gain.setValueAtTime(0.25, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+0.4);
    osc.start(a.currentTime); osc.stop(a.currentTime+0.4);
}

function playSfxPop(){
    const a=S.audioCtx; if(!a) return;
    if(a.state==='suspended') a.resume();
    const osc=a.createOscillator(), g=a.createGain();
    osc.connect(g); g.connect(a.destination);
    osc.type='sine';
    osc.frequency.setValueAtTime(900, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, a.currentTime+0.1);
    g.gain.setValueAtTime(0.3, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+0.15);
    osc.start(a.currentTime); osc.stop(a.currentTime+0.15);
    // second pop
    setTimeout(()=>{
        const o2=a.createOscillator(), g2=a.createGain();
        o2.connect(g2); g2.connect(a.destination);
        o2.type='sine';
        o2.frequency.setValueAtTime(1200, a.currentTime);
        o2.frequency.exponentialRampToValueAtTime(400, a.currentTime+0.1);
        g2.gain.setValueAtTime(0.2, a.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, a.currentTime+0.12);
        o2.start(a.currentTime); o2.stop(a.currentTime+0.12);
    }, 80);
}

function playSfxWhoosh(){
    const a=S.audioCtx; if(!a) return;
    if(a.state==='suspended') a.resume();
    // Noise burst via oscillator
    const osc=a.createOscillator(), g=a.createGain();
    const filter=a.createBiquadFilter();
    osc.connect(filter); filter.connect(g); g.connect(a.destination);
    osc.type='sawtooth';
    filter.type='bandpass';
    filter.frequency.setValueAtTime(1000, a.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, a.currentTime+0.15);
    filter.frequency.exponentialRampToValueAtTime(500, a.currentTime+0.3);
    filter.Q.value=0.5;
    osc.frequency.setValueAtTime(100, a.currentTime);
    g.gain.setValueAtTime(0.12, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+0.35);
    osc.start(a.currentTime); osc.stop(a.currentTime+0.35);
    // Chime at end
    setTimeout(()=>playTone(1047, 0.2), 200);
}

function playSfxTaDa(){
    playTone(523,.2); 
    setTimeout(()=>playTone(659,.2), 120);
    setTimeout(()=>{ playTone(784,.35); playTone(1047,.35); }, 250);
}

function playSfxSparkle(){
    const notes=[1047,1319,1568,2093];
    notes.forEach((f,i)=>{
        setTimeout(()=>playTone(f, 0.15), i*70);
    });
}

function playFailSound(){
    const a=S.audioCtx; if(!a) return;
    if(a.state==='suspended') a.resume();
    // Sad trombone: descending notes
    const notes=[392, 370, 349, 293];
    notes.forEach((f,i)=>{
        setTimeout(()=>{
            const osc=a.createOscillator(), g=a.createGain();
            osc.connect(g); g.connect(a.destination);
            osc.type='triangle';
            osc.frequency.value=f;
            g.gain.setValueAtTime(0.15, a.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+(i===3?0.5:0.25));
            osc.start(a.currentTime); osc.stop(a.currentTime+(i===3?0.5:0.25));
        }, i*200);
    });
}

// ─── COMBO OVERLAY ────────────────────────────
function showCombo(){
    const el=$('combo-overlay');
    if(!el || S.streak < 2) return;
    const mult = S.streak >= 3 ? ' (' + (1+(S.streak-2)*0.5).toFixed(1) + 'x)' : '';
    el.querySelector('.combo-count').textContent = S.streak + ' IN A ROW!' + mult;
    el.querySelector('.combo-label').textContent = S.streak >= 5 ? '🔥 MEGA COMBO 🔥' : S.streak >= 3 ? '⚡ COMBO ⚡' : '✨ NICE ✨';
    el.style.animation='none'; void el.offsetWidth; el.style.animation='';
    show(el);
}
function hideCombo(){
    const el=$('combo-overlay');
    if(el) hide(el);
}

// ─── NARRATOR (Web Speech Synthesis) ─────────
let narratorVoice = null;
let narratorTimeout = null;

function initNarrator() {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (!voices.length) return;
        // Ranked preference: natural/neural voices first
        const ranks = [
            v => /Microsoft.*Online.*Natural/i.test(v.name) && /en/i.test(v.lang),
            v => /(aria|jenny|ana|guy|ryan)/i.test(v.name) && /Microsoft/i.test(v.name),
            v => /Google.*US/i.test(v.name),
            v => /Google/i.test(v.name) && /en/i.test(v.lang),
            v => /(samantha|karen|moira|tessa).*premium/i.test(v.name),
            v => /(samantha|karen|moira|tessa)/i.test(v.name),
            v => /(natural|neural|premium|enhanced)/i.test(v.name) && /en/i.test(v.lang),
            v => /en[-_]US/i.test(v.lang),
            v => /en[-_]/i.test(v.lang),
        ];
        for (const test of ranks) {
            const m = voices.find(test);
            if (m) { narratorVoice = m; return; }
        }
        narratorVoice = voices[0] || null;
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

    // Duck music while speaking
    duckMusic();

    // Speak aloud
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    // Auto-tune prosody based on content
    const excited = /!|amazing|wow|fantastic|hooray|superstar|champion|great.job|nailed|awesome|star/i.test(text);
    const instruct = /copy|hold|freeze|step|stand|reach|spread|crouch|bend|lift|put|run|jump|hug|high.five/i.test(text);
    if (excited) {
        utter.rate = 1.0;
        utter.pitch = 1.25;
    } else if (instruct) {
        utter.rate = 0.88;
        utter.pitch = 1.1;
    } else {
        utter.rate = 0.92;
        utter.pitch = 1.12;
    }
    utter.volume = 1;
    if (narratorVoice) utter.voice = narratorVoice;
    utter.onend = () => unduckMusic();
    utter.onerror = () => unduckMusic();
    speechSynthesis.speak(utter);
}

// ─── BACKGROUND MUSIC (Web Audio procedural) ─
function startBgMusic() {
    const ctx = S.audioCtx;
    if (!ctx || S.bgMusicPlaying) return;
    if (ctx.state === 'suspended') ctx.resume();
    S.bgMusicPlaying = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    gain.connect(ctx.destination);
    S.bgMusicGain = gain;
    playMusicLoop();
}

function stopBgMusic() {
    S.bgMusicPlaying = false;
    if (S.bgMusicTimer) { clearTimeout(S.bgMusicTimer); S.bgMusicTimer = null; }
    if (S.bgMusicGain && S.audioCtx) {
        try { S.bgMusicGain.gain.linearRampToValueAtTime(0, S.audioCtx.currentTime + 0.5); } catch(_){}
    }
}

function duckMusic() {
    if (S.bgMusicGain && S.audioCtx)
        try { S.bgMusicGain.gain.linearRampToValueAtTime(0.025, S.audioCtx.currentTime + 0.2); } catch(_){}
}
function unduckMusic() {
    if (S.bgMusicGain && S.audioCtx && S.bgMusicPlaying)
        try { S.bgMusicGain.gain.linearRampToValueAtTime(0.07, S.audioCtx.currentTime + 0.4); } catch(_){}
}

function playMusicLoop() {
    if (!S.bgMusicPlaying || !S.audioCtx) return;
    const ctx = S.audioCtx;
    const dest = S.bgMusicGain;
    const bpm = 128;
    const eighth = 60 / bpm / 2;
    const now = ctx.currentTime + 0.05;

    // Cheerful pentatonic melody
    const melody = [
        523,659,784,659, 880,784,659,523,
        587,784,880,784, 659,587,523,0,
        784,880,1047,880, 784,659,587,659,
        784,880,784,659, 587,659,523,0
    ];
    // Bass line (quarter notes)
    const bass = [131,131,110,175, 196,165,147,131];

    melody.forEach((freq, i) => {
        if (!freq) return;
        const t = now + i * eighth;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(dest);
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + eighth * 0.85);
        osc.start(t); osc.stop(t + eighth);
    });

    bass.forEach((freq, i) => {
        const t = now + i * eighth * 4;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(dest);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + eighth * 3.8);
        osc.start(t); osc.stop(t + eighth * 4);
    });

    // Soft hi-hat rhythm
    for (let i = 0; i < 32; i += 2) {
        const t = now + i * eighth;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(dest);
        osc.type = 'square';
        osc.frequency.value = 6000 + Math.random() * 2000;
        g.gain.setValueAtTime(0.012, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.05);
    }

    const loopLen = melody.length * eighth;
    S.bgMusicTimer = setTimeout(() => playMusicLoop(), (loopLen - 0.1) * 1000);
}

// ─── VIDEO RECORDING (active poses) ──────────
function startVideoRecording() {
    try {
        const stream = S.canvas.captureStream(30);
        S.recordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : '';
        const opts = mimeType ? { mimeType } : {};
        const recorder = new MediaRecorder(stream, opts);
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) S.recordedChunks.push(e.data);
        };
        S.mediaRecorder = recorder;
        recorder.start(100);
    } catch (e) {
        console.warn('Video recording not supported:', e);
        S.mediaRecorder = null;
    }
}

function stopVideoRecording() {
    return new Promise(resolve => {
        if (!S.mediaRecorder || S.mediaRecorder.state === 'inactive') {
            S.mediaRecorder = null;
            resolve(null);
            return;
        }
        const recorder = S.mediaRecorder;
        recorder.onstop = () => {
            const blob = new Blob(S.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            S.mediaRecorder = null;
            S.recordedChunks = [];
            resolve(url);
        };
        recorder.stop();
    });
}

// ─── SCREENSHOTS & GALLERY ───────────────────
function captureScreenshot() {
    try {
        const dataUrl = S.canvas.toDataURL('image/jpeg', 0.85);
        S.screenshots.push({ image: dataUrl, pose: currentPose() });
    } catch(e) { console.warn('Screenshot failed:', e); }
}

function buildGallery() {
    const el = $('photo-gallery');
    if (!el) return;
    el.innerHTML = '';
    if (!S.screenshots.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');

    const title = document.createElement('h3');
    title.className = 'gallery-title';
    title.textContent = '\ud83d\udcf8 Your Magic Moments!';
    el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    el.appendChild(grid);

    S.screenshots.forEach((shot, i) => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.style.animationDelay = (i * 0.15) + 's';
        if (shot.video) {
            const vid = document.createElement('video');
            vid.src = shot.video;
            vid.controls = true;
            vid.loop = true;
            vid.muted = true;
            vid.autoplay = true;
            vid.playsInline = true;
            vid.style.width = '100%';
            vid.style.borderRadius = '8px';
            card.appendChild(vid);
        } else {
            const img = document.createElement('img');
            img.src = shot.image;
            img.alt = shot.pose.name;
            card.appendChild(img);
        }
        const label = document.createElement('div');
        label.className = 'gallery-label';
        label.textContent = shot.pose.emoji + ' ' + shot.pose.name + (shot.video ? ' 🎬' : '');
        card.appendChild(label);
        grid.appendChild(card);
    });

    // Download collage button
    if (S.screenshots.length >= 2) {
        const btn = document.createElement('button');
        btn.className = 'btn-big btn-collage';
        btn.textContent = '\ud83d\udcf8 Save Photo Collage!';
        btn.onclick = downloadCollage;
        el.appendChild(btn);
    }
}

// ─── REPLAY SLIDESHOW ─────────────────────────
function startReplaySlideshow(onComplete) {
    if (!S.screenshots.length) { if (onComplete) onComplete(); return; }
    const el = $('replay-slideshow');
    if (!el) { if (onComplete) onComplete(); return; }

    const imgEl = el.querySelector('.replay-img');
    const labelEl = el.querySelector('.replay-label');
    const counterEl = el.querySelector('.replay-counter');
    show(el);
    let idx = 0;

    function showSlide() {
        if (idx >= S.screenshots.length) {
            hide(el);
            if (onComplete) onComplete();
            return;
        }
        const shot = S.screenshots[idx];
        imgEl.src = shot.image;
        imgEl.alt = shot.pose.name;
        labelEl.textContent = shot.pose.emoji + ' ' + shot.pose.name;
        counterEl.textContent = (idx+1) + ' / ' + S.screenshots.length;
        imgEl.style.animation = 'none'; void imgEl.offsetWidth; imgEl.style.animation = '';
        playSfxSparkle();
        idx++;
        S.replayTimerId = setTimeout(showSlide, 1400);
    }
    showSlide();
}

// ─── SHAREABLE PHOTO COLLAGE ──────────────────
function downloadCollage() {
    if (!S.screenshots.length) return;
    const shots = S.screenshots;
    const cols = Math.min(shots.length, 4);
    const rows = Math.ceil(shots.length / cols);
    const thumbW = 320, thumbH = 240;
    const pad = 12, headerH = 80, footerH = 50;
    const cW = cols * thumbW + (cols+1) * pad;
    const cH = headerH + rows * thumbH + (rows+1) * pad + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = cW; canvas.height = cH;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0,0,cW,cH);
    grad.addColorStop(0, '#667eea');
    grad.addColorStop(1, '#764ba2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cW, cH);

    // Header
    ctx.fillStyle = '#FFD93D';
    ctx.font = 'bold 36px Fredoka One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2728 Magic Statue Champion! \u2728', cW/2, headerH/2 + 14);

    // Load and draw images
    let loaded = 0;
    const images = [];
    shots.forEach((shot, i) => {
        const img = new Image();
        img.onload = () => {
            loaded++;
            images[i] = img;
            if (loaded === shots.length) drawCollageImages();
        };
        img.onerror = () => {
            loaded++;
            if (loaded === shots.length) drawCollageImages();
        };
        img.src = shot.image;
    });

    function drawCollageImages() {
        shots.forEach((shot, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = pad + col * (thumbW + pad);
            const y = headerH + pad + row * (thumbH + pad);

            // Rounded rect clip
            const r = 14;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x+r, y);
            ctx.lineTo(x+thumbW-r, y);
            ctx.quadraticCurveTo(x+thumbW, y, x+thumbW, y+r);
            ctx.lineTo(x+thumbW, y+thumbH-r);
            ctx.quadraticCurveTo(x+thumbW, y+thumbH, x+thumbW-r, y+thumbH);
            ctx.lineTo(x+r, y+thumbH);
            ctx.quadraticCurveTo(x, y+thumbH, x, y+thumbH-r);
            ctx.lineTo(x, y+r);
            ctx.quadraticCurveTo(x, y, x+r, y);
            ctx.clip();

            if (images[i]) ctx.drawImage(images[i], x, y, thumbW, thumbH);
            ctx.restore();

            // Label
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(x, y+thumbH-30, thumbW, 30);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(shot.pose.emoji + ' ' + shot.pose.name, x+thumbW/2, y+thumbH-10);
        });

        // Footer with score
        const count = Math.max(S.playersFound, 1);
        const maxScore = Math.max(...S.playerScores.slice(0, count));
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 18px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\ud83c\udfc6 Score: ' + maxScore + ' pts | Best Streak: ' + S.bestStreak, cW/2, cH - footerH/2 + 6);

        // Download
        try {
            const link = document.createElement('a');
            link.download = 'magic-statue-champion.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch(e) { console.warn('Collage download failed:', e); }
    }
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

        jumping_jacks: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,40,20)}${limb(100,95,160,20)}
            ${limb(100,95,100,175)}
            ${limb(100,175,40,268,'#FF6B9D')}${limb(100,175,160,268,'#FF6B9D')}
            ${head(100,58)}${hand(40,20)}${hand(160,20)}
            ${foot(40,272)}${foot(160,272)}
            <text x="100" y="16" text-anchor="middle" font-size="16">🎉</text>
        </svg>`,

        hands_on_head: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,82,42)}${limb(100,95,118,42)}
            ${limb(100,95,100,175)}
            ${limb(100,175,78,260,'#FF6B9D')}${limb(100,175,122,260,'#FF6B9D')}
            ${head(100,58)}${hand(82,42)}${hand(118,42)}
            ${foot(78,264)}${foot(122,264)}
        </svg>`,

        flamingo: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,50,65)}${limb(100,95,150,65)}
            ${limb(100,95,100,175)}
            ${limb(100,175,100,260,'#FF6B9D')}
            ${limb(100,175,140,195,'#FF6B9D')}${limb(140,195,130,170,'#FF6B9D')}
            ${head(100,58)}${hand(50,65)}${hand(150,65)}
            ${foot(100,264)}
            <text x="158" y="165" text-anchor="middle" font-size="18">🦩</text>
        </svg>`,

        superhero: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,55,95)}${limb(55,95,72,168)}
            ${limb(100,95,145,95)}${limb(145,95,128,168)}
            ${limb(100,95,100,175)}
            ${limb(100,175,65,268,'#FF6B9D')}${limb(100,175,135,268,'#FF6B9D')}
            ${head(100,58)}${hand(72,168)}${hand(128,168)}
            ${foot(65,272)}${foot(135,272)}
            <text x="100" y="22" text-anchor="middle" font-size="22">💪</text>
        </svg>`,

        run_pose: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,55,55)}${limb(100,95,150,120)}
            ${limb(100,95,100,175)}
            ${limb(100,175,70,210,'#FF6B9D')}${limb(70,210,80,260,'#FF6B9D')}
            ${limb(100,175,130,260,'#FF6B9D')}
            ${head(100,58)}${hand(55,55)}${hand(150,120)}
            ${foot(80,264)}${foot(130,264)}
        </svg>`,

        high_five: `<svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(80,100,40,25)}${limb(80,100,148,40)}
            ${limb(80,100,80,180)}
            ${limb(80,180,58,264,'#FF6B9D')}${limb(80,180,102,264,'#FF6B9D')}
            ${head(80,62)}${hand(40,25)}${foot(58,268)}${foot(102,268)}
            ${limb(240,100,280,25,'#4ECDC4')}${limb(240,100,172,40,'#4ECDC4')}
            ${limb(240,100,240,180,'#4ECDC4')}
            ${limb(240,180,218,264,'#FF6B9D')}${limb(240,180,262,264,'#FF6B9D')}
            ${head(240,62)}${hand(280,25)}${foot(218,268)}${foot(262,268)}
            ${hand(148,40)}${hand(172,40)}
            <text x="160" y="30" text-anchor="middle" font-size="22">⭐</text>
        </svg>`,

        hold_hands: `<svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(80,100,30,65)}${limb(80,100,150,140)}
            ${limb(80,100,80,180)}
            ${limb(80,180,58,264,'#FF6B9D')}${limb(80,180,102,264,'#FF6B9D')}
            ${head(80,62)}${hand(30,65)}${foot(58,268)}${foot(102,268)}
            ${limb(240,100,290,65,'#4ECDC4')}${limb(240,100,170,140,'#4ECDC4')}
            ${limb(240,100,240,180,'#4ECDC4')}
            ${limb(240,180,218,264,'#FF6B9D')}${limb(240,180,262,264,'#FF6B9D')}
            ${head(240,62)}${hand(290,65)}${foot(218,268)}${foot(262,268)}
            ${hand(150,140)}${hand(170,140)}
            <text x="160" y="130" text-anchor="middle" font-size="18">💕</text>
        </svg>`,

        group_hug: `<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,100,60,70)}${limb(100,100,170,110)}
            ${limb(100,100,100,180)}
            ${limb(100,180,78,264,'#FF6B9D')}${limb(100,180,122,264,'#FF6B9D')}
            ${head(100,62)}${hand(60,70)}${foot(78,268)}${foot(122,268)}
            ${limb(180,100,220,70,'#4ECDC4')}${limb(180,100,110,110,'#4ECDC4')}
            ${limb(180,100,180,180,'#4ECDC4')}
            ${limb(180,180,158,264,'#FF6B9D')}${limb(180,180,202,264,'#FF6B9D')}
            ${head(180,62)}${hand(220,70)}${foot(158,268)}${foot(202,268)}
            ${hand(170,110)}${hand(110,110)}
            <text x="140" y="48" text-anchor="middle" font-size="22">🤗</text>
        </svg>`,

        wave_hello: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,145,20)}${limb(100,95,55,120)}
            ${limb(100,95,100,175)}
            ${limb(100,175,78,260,'#FF6B9D')}${limb(100,175,122,260,'#FF6B9D')}
            ${head(100,58)}${hand(145,20)}${hand(55,120)}
            ${foot(78,264)}${foot(122,264)}
            <text x="155" y="16" text-anchor="middle" font-size="18">👋</text>
        </svg>`,

        tree_pose: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,90,15)}${limb(100,95,110,15)}
            ${limb(100,95,100,175)}
            ${limb(100,175,90,260,'#FF6B9D')}${limb(100,175,110,260,'#FF6B9D')}
            ${head(100,58)}${hand(90,15)}${hand(110,15)}
            ${foot(90,264)}${foot(110,264)}
            <text x="100" y="10" text-anchor="middle" font-size="18">🌳</text>
        </svg>`,

        crab_walk: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,165,30,140)}${limb(100,165,170,140)}
            ${limb(100,150,100,190)}
            ${limb(100,190,55,258,'#FF6B9D')}${limb(100,190,145,258,'#FF6B9D')}
            ${head(100,130)}${hand(30,140)}${hand(170,140)}
            ${foot(55,262)}${foot(145,262)}
            <text x="100" y="115" text-anchor="middle" font-size="18">🦀</text>
        </svg>`,

        ballet: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,60,40)}${limb(100,95,140,40)}
            ${limb(60,40,95,15)}${limb(140,40,105,15)}
            ${limb(100,95,100,175)}
            ${limb(100,175,78,260,'#FF6B9D')}${limb(100,175,122,260,'#FF6B9D')}
            ${head(100,58)}${hand(95,15)}${hand(105,15)}
            ${foot(78,264)}${foot(122,264)}
            <text x="100" y="10" text-anchor="middle" font-size="16">🩰</text>
        </svg>`,

        wide_squat: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,140,30,120)}${limb(100,140,170,120)}
            ${limb(100,120,100,180)}
            ${limb(100,180,40,258,'#FF6B9D')}${limb(100,180,160,258,'#FF6B9D')}
            ${head(100,100)}${hand(30,120)}${hand(170,120)}
            ${foot(40,262)}${foot(160,262)}
            <text x="100" y="82" text-anchor="middle" font-size="16">🏋️</text>
        </svg>`,

        disco: `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,95,145,15)}${limb(100,95,55,200)}
            ${limb(100,95,100,175)}
            ${limb(100,175,78,260,'#FF6B9D')}${limb(100,175,122,260,'#FF6B9D')}
            ${head(100,58)}${hand(145,15)}${hand(55,200)}
            ${foot(78,264)}${foot(122,264)}
            <text x="148" y="12" text-anchor="middle" font-size="18">🕺</text>
        </svg>`,

        mirror_pose: `<svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(80,100,10,70)}${limb(80,100,150,70)}
            ${limb(80,100,80,180)}
            ${limb(80,180,58,264,'#FF6B9D')}${limb(80,180,102,264,'#FF6B9D')}
            ${head(80,62)}${hand(10,70)}${hand(150,70)}${foot(58,268)}${foot(102,268)}
            ${limb(240,100,170,70,'#4ECDC4')}${limb(240,100,310,70,'#4ECDC4')}
            ${limb(240,100,240,180,'#4ECDC4')}
            ${limb(240,180,218,264,'#FF6B9D')}${limb(240,180,262,264,'#FF6B9D')}
            ${head(240,62)}${hand(170,70)}${hand(310,70)}${foot(218,268)}${foot(262,268)}
            <text x="160" y="50" text-anchor="middle" font-size="18">🪞</text>
        </svg>`,

        back_to_back: `<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(110,100,60,65)}${limb(110,100,80,135)}
            ${limb(110,100,110,180)}
            ${limb(110,180,88,264,'#FF6B9D')}${limb(110,180,132,264,'#FF6B9D')}
            ${head(100,62)}${hand(60,65)}${hand(80,135)}${foot(88,268)}${foot(132,268)}
            ${limb(170,100,220,65,'#4ECDC4')}${limb(170,100,200,135,'#4ECDC4')}
            ${limb(170,100,170,180,'#4ECDC4')}
            ${limb(170,180,148,264,'#FF6B9D')}${limb(170,180,192,264,'#FF6B9D')}
            ${head(180,62)}${hand(220,65)}${hand(200,135)}${foot(148,268)}${foot(192,268)}
            <text x="140" y="50" text-anchor="middle" font-size="18">🔙</text>
        </svg>`,

        wave_together: `<svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(80,100,40,20)}${limb(80,100,30,100)}
            ${limb(80,100,80,180)}
            ${limb(80,180,58,264,'#FF6B9D')}${limb(80,180,102,264,'#FF6B9D')}
            ${head(80,62)}${hand(40,20)}${hand(30,100)}${foot(58,268)}${foot(102,268)}
            ${limb(240,100,280,20,'#4ECDC4')}${limb(240,100,290,100,'#4ECDC4')}
            ${limb(240,100,240,180,'#4ECDC4')}
            ${limb(240,180,218,264,'#FF6B9D')}${limb(240,180,262,264,'#FF6B9D')}
            ${head(240,62)}${hand(280,20)}${hand(290,100)}${foot(218,268)}${foot(262,268)}
            <text x="160" y="18" text-anchor="middle" font-size="18">👐</text>
        </svg>`,

        side_by_side: `<svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg">
            ${limb(100,100,50,25)}${limb(100,100,148,120)}
            ${limb(100,100,100,180)}
            ${limb(100,180,78,264,'#FF6B9D')}${limb(100,180,122,264,'#FF6B9D')}
            ${head(100,62)}${hand(50,25)}${hand(148,120)}${foot(78,268)}${foot(122,268)}
            ${limb(220,100,172,120,'#4ECDC4')}${limb(220,100,270,25,'#4ECDC4')}
            ${limb(220,100,220,180,'#4ECDC4')}
            ${limb(220,180,198,264,'#FF6B9D')}${limb(220,180,242,264,'#FF6B9D')}
            ${head(220,62)}${hand(172,120)}${hand(270,25)}${foot(198,268)}${foot(242,268)}
            <text x="160" y="110" text-anchor="middle" font-size="18">🤜🤛</text>
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
