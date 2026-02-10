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

// --- 2. CORE INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 2a. Visual Reveal (Priority 1)
    const runReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', runReveal);
    setTimeout(runReveal, 100); // Kickstart

    // 2b. Firebase Boot (Priority 2)
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
                }
            });

            if (document.getElementById('stat-record')) loadHomeData();
        }
    } catch (e) { console.warn("Firebase wait..."); }
});

// --- 3. LANDING PAGE LOGIC ---
function loadHomeData() {
    db.collection("events").onSnapshot(snap => {
        let w = 0, l = 0;
        snap.forEach(doc => {
            const r = doc.data().result;
            if (r) (parseInt(r.myScore) > parseInt(r.enemyScore)) ? w++ : l++;
        });
        document.getElementById('stat-record').innerText = `${w}W - ${l}L`;
        document.getElementById('stat-winrate').innerText = `${Math.round((w / (w + l || 1)) * 100)}%`;
    });
}

// --- 4. HUB & STRATBOOK LOGIC ---
window.loginWithDiscord = function () {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(err => alert("Auth Blocked. Ensure your URL is in Firebase Authorized Domains."));
};

window.showTab = function (id, btn) {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

let canvas, ctx, drawing = false;
function initHubLogic() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = 1200; canvas.height = 800;

    canvas.onmousedown = (e) => {
        drawing = true; ctx.beginPath();
        const r = canvas.getBoundingClientRect();
        ctx.moveTo((e.clientX - r.left) * (1200 / r.width), (e.clientY - r.top) * (800 / r.height));
    };
    canvas.onmousemove = (e) => {
        if (!drawing) return;
        const r = canvas.getBoundingClientRect();
        ctx.lineTo((e.clientX - r.left) * (1200 / r.width), (e.clientY - r.top) * (800 / r.height));
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    };
    window.onmouseup = () => drawing = false;
    loadAgentIcons();
}

async function loadAgentIcons() {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const json = await res.json();
    const list = document.getElementById('agent-list');
    if (list) {
        list.innerHTML = json.data.slice(0, 12).map(a => `
            <div class="agent-icon" onclick="alert('Place logic ready')">
                <img src="${a.displayIcon}">
            </div>`).join('');
    }
}