// --- 1. CONFIGURATION ---
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

// --- 2. INITIALIZATION ENGINE ---
document.addEventListener('DOMContentLoaded', () => {
    // Reveal Visuals (Landing Page)
    const runReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', runReveal);
    setTimeout(runReveal, 150);

    // Initialize Firebase v8
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        // Auth State Listener
        auth.onAuthStateChanged(user => {
            const lock = document.getElementById('hubLocked');
            const unlocked = document.getElementById('hubUnlocked');

            if (user) {
                if (lock) lock.style.display = 'none';
                if (unlocked) unlocked.style.display = 'block';

                const profile = document.getElementById('userProfile');
                if (profile) profile.innerText = user.displayName ? user.displayName.toUpperCase() : "OPERATOR";

                initPlanner();
                syncHubData();
            } else {
                if (lock) lock.style.display = 'flex';
                if (unlocked) unlocked.style.display = 'none';
            }
        });

        // Load Landing Page Data
        if (document.getElementById('stat-record')) loadLandingStats();
    }
});

// --- 3. LANDING PAGE LOGIC ---
function loadLandingStats() {
    // Record & Winrate
    db.collection("events").onSnapshot(snap => {
        let w = 0, l = 0;
        snap.forEach(doc => {
            const r = doc.data().result;
            if (r && r.myScore && r.enemyScore) {
                (parseInt(r.myScore) > parseInt(r.enemyScore)) ? w++ : l++;
            }
        });
        const rec = document.getElementById('stat-record');
        const wr = document.getElementById('stat-winrate');
        if (rec) rec.innerText = `${w}W - ${l}L`;
        if (wr) wr.innerText = `${Math.round((w / (w + l || 1)) * 100)}%`;
    });

    // Roster Count
    db.collection("roster").onSnapshot(snap => {
        const ros = document.getElementById('stat-roster');
        if (ros) ros.innerText = snap.size;
    });

    // News Feed
    db.collection("news").orderBy("date", "desc").limit(3).onSnapshot(snap => {
        const feed = document.getElementById('live-news');
        if (!feed) return;
        feed.innerHTML = "";
        snap.forEach(doc => {
            const n = doc.data();
            feed.innerHTML += `
                <div class="newsCard">
                    <small style="color:var(--red); font-weight:800; letter-spacing:1px;">${n.date || 'SIGNAL_LOST'}</small>
                    <h3 style="margin: 10px 0;">${n.title}</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted);">${n.body ? n.body.substring(0, 120) + '...' : ''}</p>
                </div>`;
        });
    });
}

// --- 4. HUB INTERFACE LOGIC ---
window.loginWithDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => {
        console.error("Auth Error:", e);
        alert("Authentication failed. Check Firebase Authorized Domains.");
    });
};

window.showTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));

    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        btn.classList.add('active');
    }
};

// --- 5. STRATBOOK (CANVAS ENGINE) ---
let canvas, ctx, drawing = false;

function initPlanner() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Lock Internal Resolution for HD Drawing
    canvas.width = 1920;
    canvas.height = 1080;

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        if (currentTool === 'draw') {
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else if (currentTool === 'agent' && activeAgent) {
            stampAgent(x, y);
        }
    };

    canvas.onmousemove = (e) => {
        if (!drawing || currentTool !== 'draw') return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        ctx.lineTo(x, y);
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
    };

    window.onmouseup = () => { drawing = false; };
    loadAgentPalette();
}

window.setTool = (t) => {
    currentTool = t;
    document.querySelectorAll('.tool').forEach(el => el.classList.remove('active'));
    document.getElementById(`tool-${t}`).classList.add('active');
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
    } catch (e) { console.error("Agent API Failure"); }
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
        ctx.drawImage(img, x - 50, y - 50, 100, 100);
        ctx.strokeStyle = "#ff1e3c";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, 52, 0, Math.PI * 2);
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
        lotus: "2fe4ed3d-450f-aa44-0b05-a2e116a401f1"
    };
    const img = document.getElementById('vpMapImg');
    if (img) img.src = `https://media.valorant-api.com/maps/${maps[val] || maps.ascent}/stylizedicon.png`;
    window.clearPlanner();
};

window.saveStrategy = () => {
    const link = document.createElement('a');
    link.download = `SYRIX_PLAN_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
};

// --- 6. DATA SYNC ---
function syncHubData() {
    const rosList = document.getElementById('rosList');
    if (rosList) {
        db.collection("roster").onSnapshot(snap => {
            rosList.innerHTML = "";
            snap.forEach(doc => {
                const p = doc.data();
                rosList.innerHTML += `
                    <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <img src="${p.pfp || ''}" style="width:40px; height:40px; border-radius:50%; border:1px solid var(--red);">
                            <div>
                                <div style="font-weight:900;">${doc.id}</div>
                                <div style="font-size:0.6rem; color:var(--red); letter-spacing:1px;">${p.role} // ${p.rank}</div>
                            </div>
                        </div>
                    </div>`;
            });
        });
    }
}

// --- 7. TRAILER MODAL ---
window.openTrailer = () => {
    const m = document.getElementById('modal');
    const f = document.getElementById('trailerFrame');
    if (m && f) {
        m.classList.add('active');
        f.src = "https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1";
    }
};
window.closeTrailer = () => {
    const m = document.getElementById('modal');
    const f = document.getElementById('trailerFrame');
    if (m && f) {
        m.classList.remove('active');
        f.src = "";
    }
};