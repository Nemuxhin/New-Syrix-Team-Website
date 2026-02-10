// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w", // Warning: Secure this in production!
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

let db, auth;
let currentTool = 'draw';
let activeAgent = null;

// --- 2. INITIALIZATION ENGINE ---
document.addEventListener('DOMContentLoaded', () => {

    // Initialize Firebase
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase System: ONLINE");
    } else {
        console.error("Firebase SDK missing.");
    }

    // Identify Current Page
    const pageId = document.body.id;

    // --- HOME PAGE LOGIC ---
    if (pageId === 'page-home') {
        initScrollReveal();
        if (db) loadLandingStats();

        // Navbar Scroll Effect
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('nav');
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });
    }

    // --- HUB PAGE LOGIC ---
    if (pageId === 'page-hub') {
        if (auth) initHubAuth();
    }
});

// --- 3. HOME PAGE FUNCTIONS ---
function initScrollReveal() {
    const runReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', runReveal);
    runReveal(); // Run once on load
}

function loadLandingStats() {
    // Fake data logic if DB is empty, or use real listener
    db.collection("events").onSnapshot(snap => {
        let w = 0, l = 0;
        snap.forEach(doc => {
            const r = doc.data().result;
            if (r && r.myScore && r.enemyScore) {
                (parseInt(r.myScore) > parseInt(r.enemyScore)) ? w++ : l++;
            }
        });

        // Safe Element Updates
        safeText('stat-record', `${w}W - ${l}L`);
        safeText('stat-winrate', `${Math.round((w / (w + l || 1)) * 100)}%`);
    }, err => console.log("Stats Offline (Auth Required?)"));

    // Roster Count
    db.collection("roster").onSnapshot(snap => {
        safeText('stat-roster', snap.size);
    }, () => { }); // Suppress errors for clean UI
}

// --- 4. HUB AUTH & NAVIGATION ---
function initHubAuth() {
    auth.onAuthStateChanged(user => {
        const lock = document.getElementById('hubLocked');
        const unlocked = document.getElementById('hubUnlocked');

        if (user) {
            if (lock) lock.style.display = 'none';
            if (unlocked) unlocked.style.display = 'block';
            safeText('userProfile', user.displayName ? user.displayName.toUpperCase() : "OPERATOR");

            // Only init planner if we are actually allowed in
            initPlanner();
            syncHubData();
        } else {
            if (lock) lock.style.display = 'flex';
            if (unlocked) unlocked.style.display = 'none';
        }
    });
}

window.loginWithDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => alert("Auth Failed: " + e.message));
};

window.showTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));

    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

// --- 5. STRATBOOK (CANVAS ENGINE) ---
let canvas, ctx, isDrawing = false;

function initPlanner() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');

    // Set internal resolution to match container visual size 1:1 for accuracy
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;

    // Handle Resize
    window.addEventListener('resize', () => {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
    });

    // Mouse Events
    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    window.onmouseup = () => { isDrawing = false; };

    loadAgentPalette();
}

function startDraw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'draw') {
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (currentTool === 'agent' && activeAgent) {
        stampAgent(x, y);
    }
}

function draw(e) {
    if (!isDrawing || currentTool !== 'draw') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = document.getElementById('vpColor').value;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
}

window.setTool = (t) => {
    currentTool = t;
    document.querySelectorAll('.tool').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`tool-${t}`);
    if (btn) btn.classList.add('active');
};

async function loadAgentPalette() {
    try {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        const palette = document.getElementById('agent-list');
        if (palette) {
            palette.innerHTML = json.data.map(a => `
                <div class="agent-icon" onclick="window.prepAgent('${a.displayIcon}')">
                    <img src="${a.displayIcon}" title="${a.displayName}">
                </div>`).join('');
        }
    } catch (e) { console.error("Agent API Failed"); }
}

window.prepAgent = (url) => {
    activeAgent = url;
    window.setTool('agent');
};

function stampAgent(x, y) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = activeAgent;
    img.onload = () => {
        const size = 40; // Icon size
        ctx.drawImage(img, x - (size / 2), y - (size / 2), size, size);
        // Add a ring around it
        ctx.strokeStyle = "#ff1e3c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, (size / 2) + 2, 0, Math.PI * 2);
        ctx.stroke();
    };
}

window.clearPlanner = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

window.changeMap = () => {
    const val = document.getElementById('vpMapSelect').value;
    const maps = {
        ascent: "7eaecc1b-4337-bbf6-6130-03a4d7090581",
        bind: "2c9d57bc-4f8a-4e22-8e6b-b784297d04a5",
        haven: "2bee0ca3-4471-9193-c139-3a1154054a16",
        lotus: "2fe4ed3d-450f-aa44-0b05-a2e116a401f1",
        split: "d960549e-4a55-526b-577a-45a85c963155",
        sunset: "92584fbe-486a-b1b2-9faa-39b0f486b498"
    };
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/${maps[val] || maps.ascent}/stylizedicon.png`;
    window.clearPlanner();
};

window.saveStrategy = () => {
    // Create a temporary canvas to combine map + drawing
    const tempCanvas = document.createElement('canvas');
    const w = canvas.width;
    const h = canvas.height;
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');

    // Draw Map Image first
    const mapImg = document.getElementById('vpMapImg');
    tCtx.drawImage(mapImg, 0, 0, w, h);
    // Draw Drawing on top
    tCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `SYRIX_STRAT_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
};

// --- 6. UTILS & MODALS ---
function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function syncHubData() {
    // Only runs if elements exist
    if (!document.getElementById('rosList')) return;

    db.collection("roster").onSnapshot(snap => {
        const list = document.getElementById('rosList');
        list.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            list.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222;">${doc.id}</div>`;
        });
    });
}

window.openTrailer = () => {
    document.getElementById('modal').classList.add('active');
    document.getElementById('trailerFrame').src = "https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1";
};

window.closeTrailer = () => {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('trailerFrame').src = "";
};