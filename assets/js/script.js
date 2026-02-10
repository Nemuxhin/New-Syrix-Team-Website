// --- 1. GLOBAL STATE & CONFIG ---
let db, auth;

document.addEventListener('DOMContentLoaded', () => {
    // Reveal animations
    const reveals = () => {
        document.querySelectorAll('.reveal').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add('active');
        });
    };
    window.addEventListener('scroll', reveals);
    reveals();

    // Modal Controls
    const modal = document.getElementById('modal');
    const trailerFrame = document.getElementById('trailerFrame');
    const btnWatch = document.getElementById('btnWatch');
    if (btnWatch) {
        btnWatch.onclick = () => {
            modal.classList.add('active');
            trailerFrame.src = "https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1";
        };
    }
    window.closeModal = () => {
        modal.classList.remove('active');
        trailerFrame.src = "";
    };
    if (document.getElementById('modalClose')) document.getElementById('modalClose').onclick = closeModal;

    // Initialize Firebase v8
    const firebaseConfig = {
        apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
        authDomain: "syrix-team-schedule.firebaseapp.com",
        projectId: "syrix-team-schedule",
        storageBucket: "syrix-team-schedule.firebasestorage.app",
        messagingSenderId: "571804588891",
        appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
    };

    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        loadLiveLandingData(); // Load the old React functionality
    }
});

// --- 2. LIVE DATA PORT (FROM REACT APP) ---
function loadLiveLandingData() {
    // Fetch Stats (Winrate/Record)
    db.collection("events").onSnapshot((snap) => {
        let wins = 0; let losses = 0;
        snap.forEach(doc => {
            const m = doc.data();
            if (m.result) {
                if (parseInt(m.result.myScore) > parseInt(m.result.enemyScore)) wins++;
                else losses++;
            }
        });
        const rate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
        if (document.getElementById('stat-record')) document.getElementById('stat-record').innerText = `${wins}W - ${losses}L`;
        if (document.getElementById('stat-winrate')) document.getElementById('stat-winrate').innerText = `${rate}%`;
    });

    // Fetch Roster Count
    db.collection("roster").onSnapshot(snap => {
        if (document.getElementById('stat-roster')) document.getElementById('stat-roster').innerText = `${snap.size} Players`;
    });

    // Fetch Live News Feed
    db.collection("news").orderBy("date", "desc").limit(3).onSnapshot(snap => {
        const feed = document.getElementById('live-news-feed');
        if (!feed) return;
        feed.innerHTML = "";
        snap.forEach(doc => {
            const n = doc.data();
            feed.innerHTML += `
                <div class="newsCard">
                    <small style="color:var(--red); font-weight:bold;">${n.date}</small>
                    <h3 style="margin-top:5px;">${n.title}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted);">${n.body.substring(0, 80)}...</p>
                </div>`;
        });
    });
}

// --- 1. ROSTER SYNCING ---
function initHubData() {
    const rosterDiv = document.getElementById('hubRosterList');
    if (!rosterDiv) return;

    window.db.collection("roster").onSnapshot((snap) => {
        rosterDiv.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            rosterDiv.innerHTML += `
                <div class="hubItem" style="padding: 20px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-soft);">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <img src="${p.pfp || ''}" style="width:45px; height:45px; border-radius:4px; border: 1px solid var(--red);">
                        <div>
                            <div style="font-weight:900; font-size:1.1rem; color:#fff;">${doc.id}</div>
                            <div style="font-size:0.6rem; color:var(--red); font-weight:bold; text-transform:uppercase;">${p.role} // ${p.rank}</div>
                        </div>
                    </div>
                    <div style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${p.ingameRole || 'FLEX'}</div>
                </div>
            `;
        });
    });
}

// --- 2. PLANNER CONTROLS ---
window.clearPlanner = function () {
    const canvas = document.getElementById('vpCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// --- 3. AUTH REDIRECT LOGIC ---
// Ensure this is inside your auth.onAuthStateChanged listener
function handleHubAuth(user) {
    if (user) {
        document.getElementById('userProfile').innerText = `OPERATOR: ${user.displayName.toUpperCase()}`;
        initHubData();
        // Heatmap initialization would go here next
    }
}

// Global Hub Link
window.loginWithDiscord = function () {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => alert(e.message));
};