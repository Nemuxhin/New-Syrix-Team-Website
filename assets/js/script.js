const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

let db, auth;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Reveal Scroll Logic
    const reveals = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', reveals);
    reveals();

    // Firebase Setup
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        // Global Listeners
        auth.onAuthStateChanged(user => {
            const lock = document.getElementById('hubLocked');
            const unlocked = document.getElementById('hubUnlocked');
            if (user && lock) {
                lock.style.display = 'none';
                unlocked.style.display = 'block';
                document.getElementById('userProfile').innerText = `OPERATOR: ${user.displayName.toUpperCase()}`;
                initHubData();
                initPlanner();
            }
        });

        // Load Home Data if elements exist
        if (document.getElementById('stat-record')) loadLiveStats();
    }
});

// --- HUB FUNCTIONS ---
window.loginWithDiscord = function () {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(err => alert("Discord Auth Blocked: Check Firebase Authorized Domains."));
};

window.showTab = function (id, btn) {
    document.querySelectorAll('.tabView').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.hubTab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
};

// --- DATA LOGIC ---
function loadLiveStats() {
    db.collection("events").onSnapshot(snap => {
        let w = 0, l = 0;
        snap.forEach(doc => {
            const res = doc.data().result;
            if (res) (parseInt(res.myScore) > parseInt(res.enemyScore)) ? w++ : l++;
        });
        document.getElementById('stat-record').innerText = `${w}W - ${l}L`;
        document.getElementById('stat-winrate').innerText = `${Math.round((w / (w + l || 1)) * 100)}%`;
    });
    db.collection("roster").onSnapshot(snap => {
        document.getElementById('stat-roster').innerText = snap.size;
    });
    db.collection("news").limit(3).onSnapshot(snap => {
        const feed = document.getElementById('live-news');
        if (feed) {
            feed.innerHTML = "";
            snap.forEach(doc => {
                const n = doc.data();
                feed.innerHTML += `<div class="newsCard"><h3>${n.title}</h3><p>${n.body.substring(0, 100)}...</p></div>`;
            });
        }
    });
}

function initHubData() {
    db.collection("roster").onSnapshot(snap => {
        const list = document.getElementById('rosList');
        if (!list) return;
        list.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            list.innerHTML += `<div class="hubItem" style="padding:15px; border-bottom:1px solid var(--border-soft);">
                <strong>${doc.id}</strong> <small style="color:var(--red);">${p.role} // ${p.rank}</small>
            </div>`;
        });
    });
}

// --- PLANNER LOGIC ---
let canvas, ctx, drawing = false;
function initPlanner() {
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
}

window.clearPlanner = () => ctx.clearRect(0, 0, 1200, 800);
window.changeMap = () => {
    const map = document.getElementById('vpMapSelect').value;
    const maps = { ascent: "7eaecc1b-4337-bbf6-6130-03a4d7090581", bind: "2c9d57bc-4f8a-4e22-8e6b-b784297d04a5", haven: "2bee0ca3-4471-9193-c139-3a1154054a16" };
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/${maps[map]}/stylizedicon.png`;
};

// Trailer Logic
window.openTrailer = () => {
    document.getElementById('modal').classList.add('active');
    document.getElementById('trailerFrame').src = "https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1";
};
window.closeTrailer = () => {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('trailerFrame').src = "";
};