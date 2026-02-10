// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

let db, auth;
let currentTool = 'draw';
let activeAgent = null;
let history = []; // For Undo functionality

// --- 2. CORE INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 2a. Visual Reveal (Fail-safe for Landing Page)
    const runReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', runReveal);
    setTimeout(runReveal, 100);

    // 2b. Firebase Boot
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();

            auth.onAuthStateChanged(user => {
                const lock = document.getElementById('hubLocked');
                const unlocked = document.getElementById('hubUnlocked');
                if (user && lock) {
                    lock.style.display = 'none';
                    unlocked.style.display = 'grid';
                    document.getElementById('userProfile').innerText = `OPERATOR: ${user.displayName.toUpperCase()}`;
                    initHubLogic();
                    syncRoster();
                }
            });

            if (document.getElementById('stat-record')) loadHomeData();
        }
    } catch (e) { console.warn("Firebase initialization pending..."); }
});

// --- 3. LANDING PAGE LOGIC ---
function loadHomeData() {
    db.collection("events").onSnapshot(snap => {
        let w = 0, l = 0;
        snap.forEach(doc => {
            const r = doc.data().result;
            if (r && r.myScore && r.enemyScore) {
                (parseInt(r.myScore) > parseInt(r.enemyScore)) ? w++ : l++;
            }
        });
        const recordEl = document.getElementById('stat-record');
        const winrateEl = document.getElementById('stat-winrate');
        if (recordEl) recordEl.innerText = `${w}W - ${l}L`;
        if (winrateEl) winrateEl.innerText = `${Math.round((w / (w + l || 1)) * 100)}%`;
    });

    db.collection("roster").onSnapshot(snap => {
        const rosterStat = document.getElementById('stat-roster');
        if (rosterStat) rosterStat.innerText = snap.size;
    });

    // Landing Page News Feed
    db.collection("news").orderBy("date", "desc").limit(3).onSnapshot(snap => {
        const feed = document.getElementById('live-news');
        if (!feed) return;
        feed.innerHTML = "";
        snap.forEach(doc => {
            const n = doc.data();
            feed.innerHTML += `
                <div class="newsCard">
                    <small style="color:var(--red); font-weight:bold;">${n.date || ''}</small>
                    <h3 style="margin-top:5px;">${n.title}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted);">${n.body ? n.body.substring(0, 100) + '...' : ''}</p>
                </div>`;
        });
    });
}

// --- 4. HUB NAVIGATION ---
window.loginWithDiscord = function () {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(err => alert("Auth Error: Check Firebase Authorized Domains."));
};

window.showTab = function (id, btn) {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

// --- 5. STRATBOOK (PLANNER) LOGIC ---
let canvas, ctx, drawing = false;

function initHubLogic() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 800;

    canvas.onmousedown = (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (1200 / r.width);
        const y = (e.clientY - r.top) * (800 / r.height);

        if (currentTool === 'draw') {
            saveHistory();
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else if (currentTool === 'agent' && activeAgent) {
            saveHistory();
            placeAgentOnCanvas(x, y);
        }
    };

    canvas.onmousemove = (e) => {
        if (!drawing || currentTool !== 'draw') return;
        const r = canvas.getBoundingClientRect();
        ctx.lineTo((e.clientX - r.left) * (1200 / r.width), (e.clientY - r.top) * (800 / r.height));
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    };

    window.onmouseup = () => { drawing = false; };
    loadAgentIcons();
}

window.setTool = (tool) => {
    currentTool = tool;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    document.getElementById(`tool-${tool}`).classList.add('active');
};

async function loadAgentIcons() {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const json = await res.json();
    const list = document.getElementById('agent-list');
    if (list) {
        list.innerHTML = json.data.map(a => `
            <div class="agent-icon" onclick="window.selectAgent('${a.displayIcon}')">
                <img src="${a.displayIcon}">
            </div>`).join('');
    }
}

window.selectAgent = (iconUrl) => {
    activeAgent = iconUrl;
    window.setTool('agent');
};

function placeAgentOnCanvas(x, y) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = activeAgent;
    img.onload = () => {
        ctx.drawImage(img, x - 25, y - 25, 50, 50);
        // Draw selection ring
        ctx.strokeStyle = '#ff1e3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.stroke();
    };
}

window.clearPlanner = () => {
    saveHistory();
    ctx.clearRect(0, 0, 1200, 800);
};

window.undoPlanner = () => {
    if (history.length > 0) {
        const lastState = history.pop();
        const img = new Image();
        img.src = lastState;
        img.onload = () => {
            ctx.clearRect(0, 0, 1200, 800);
            ctx.drawImage(img, 0, 0);
        };
    }
};

function saveHistory() {
    history.push(canvas.toDataURL());
    if (history.length > 20) history.shift(); // Limit memory usage
}

window.changeMap = () => {
    const map = document.getElementById('vpMapSelect').value;
    const maps = {
        ascent: "7eaecc1b-4337-bbf6-6130-03a4d7090581",
        bind: "2c9d57bc-4f8a-4e22-8e6b-b784297d04a5",
        haven: "2bee0ca3-4471-9193-c139-3a1154054a16",
        lotus: "2fe4ed3d-450f-aa44-0b05-a2e116a401f1",
        abyss: "22050f2d-4d43-2646-63c3-6385b0d4530d"
    };
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/${maps[map]}/stylizedicon.png`;
    window.clearPlanner();
};

window.saveStrategy = () => {
    const link = document.createElement('a');
    link.download = `SYRIX_STRAT_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
};

// --- 6. ROSTER SYNC ---
function syncRoster() {
    const rosList = document.getElementById('rosList');
    if (!rosList) return;

    db.collection("roster").onSnapshot(snap => {
        rosList.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            rosList.innerHTML += `
                <div class="hubPanel" style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="${p.pfp || ''}" style="width:40px; height:40px; border-radius:50%; border:1px solid var(--red);" onerror="this.style.display='none'">
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem;">${doc.id}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">${p.role} // ${p.rank}</div>
                        </div>
                    </div>
                    <div style="font-family:monospace; color:var(--red); font-size:0.8rem;">${p.ingameRole || 'FLEX'}</div>
                </div>`;
        });
    });
}

// --- 7. TRAILER UTILS ---
window.openTrailer = () => {
    document.getElementById('modal').classList.add('active');
    document.getElementById('trailerFrame').src = "https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1";
};
window.closeTrailer = () => {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('trailerFrame').src = "";
};