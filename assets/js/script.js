// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const MAPS = ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"];
let db, auth;
let currentTool = 'draw';
let activeAgent = null;

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        // Auth Listener
        auth.onAuthStateChanged(user => {
            const lock = document.getElementById('hubLocked');
            const unlock = document.getElementById('hubUnlocked');

            if (user) {
                if (lock) lock.style.display = 'none';
                if (unlock) unlock.style.display = 'block';
                document.getElementById('userProfile').innerText = user.displayName ? user.displayName.toUpperCase() : "OPERATOR";

                // Init Modules
                initStratbook();
                loadCaptainMessage();
                loadMapVeto();
                loadAbsences();
                loadDashboardEvents();
            } else {
                if (lock) lock.style.display = 'flex';
                if (unlock) unlock.style.display = 'none';
            }
        });
    }
});

// --- 3. NAVIGATION ---
window.loginWithDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => alert(e.message));
};

window.showTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    // Canvas Resize Fix when switching to stratbook
    if (id === 'stratbook') {
        const c = document.getElementById('vpCanvas');
        if (c) {
            c.width = c.parentElement.clientWidth;
            c.height = c.parentElement.clientHeight;
        }
    }
};

// --- 4. CAPTAIN'S MESSAGE ---
function loadCaptainMessage() {
    db.collection("general").doc("captain_message").onSnapshot(doc => {
        if (doc.exists) {
            document.getElementById('captain-msg-text').innerText = `"${doc.data().text}"`;
        }
    });
}

window.editCaptainMessage = () => {
    document.getElementById('captain-msg-text').style.display = 'none';
    document.getElementById('captain-msg-edit').style.display = 'block';
    // Pre-fill
    document.getElementById('captain-msg-input').value = document.getElementById('captain-msg-text').innerText.replace(/"/g, '');
};

window.saveCaptainMessage = () => {
    const txt = document.getElementById('captain-msg-input').value;
    db.collection("general").doc("captain_message").set({ text: txt }, { merge: true });
    document.getElementById('captain-msg-text').style.display = 'block';
    document.getElementById('captain-msg-edit').style.display = 'none';
};

// --- 5. ABSENCE LOG ---
function loadAbsences() {
    db.collection("leaves").orderBy("start").onSnapshot(snap => {
        const list = document.getElementById('absence-list');
        list.innerHTML = "";
        if (snap.empty) {
            list.innerHTML = "No upcoming absences.";
            return;
        }
        snap.forEach(doc => {
            const l = doc.data();
            list.innerHTML += `<div><span style="color:var(--red); font-weight:bold;">${l.user}</span>: ${l.start} to ${l.end}</div>`;
        });
    });
}

window.logAbsence = () => {
    const start = document.getElementById('abs-start').value;
    const end = document.getElementById('abs-end').value;
    const reason = document.getElementById('abs-reason').value;

    if (!start || !end) return alert("Please select dates.");

    db.collection("leaves").add({
        user: auth.currentUser.displayName,
        start, end, reason,
        uid: auth.currentUser.uid
    }).then(() => {
        alert("Absence logged.");
        document.getElementById('abs-reason').value = "";
    });
};

// --- 6. DASHBOARD EVENTS ---
function loadDashboardEvents() {
    const today = new Date().toISOString().split('T')[0];
    db.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
        const list = document.getElementById('dash-event-list');
        const badge = document.getElementById('active-ops-badge');
        const countDisplay = document.getElementById('dash-active-ops');

        list.innerHTML = "";
        badge.innerText = `${snap.size} ACTIVE`;
        countDisplay.innerText = snap.size;

        if (snap.empty) {
            list.innerHTML = `<div class="empty-state">No upcoming operations scheduled.</div>`;
            document.getElementById('dash-next-match').innerText = "No upcoming operations scheduled.";
        } else {
            let first = true;
            snap.forEach(doc => {
                const m = doc.data();
                if (first) {
                    document.getElementById('dash-next-match').innerHTML = `
                        <div style="font-size:1.5rem; font-weight:900; color:white;">VS ${m.opponent}</div>
                        <div style="color:var(--red); font-weight:bold;">${m.date} @ ${m.time}</div>
                        <div style="font-size:0.8rem; color:#888;">${m.type} // ${m.map || 'TBD'}</div>
                    `;
                    first = false;
                }
                list.innerHTML += `
                    <div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div style="font-weight:bold; color:white;">VS ${m.opponent}</div>
                        <div style="font-size:0.8rem; color:#888;">${m.date} @ ${m.time}</div>
                    </div>
                `;
            });
        }
    });
}

// --- 7. MAP VETO SYSTEM ---
function loadMapVeto() {
    const grid = document.getElementById('veto-grid');
    if (!grid) return;

    db.collection("general").doc("map_veto").onSnapshot(doc => {
        const data = doc.exists ? doc.data() : {};
        grid.innerHTML = "";

        MAPS.forEach(map => {
            const status = data[map] || 'neutral'; // neutral, ban, pick
            // Map images placeholder logic

            grid.innerHTML += `
                <div class="veto-card ${status}" onclick="window.toggleVeto('${map}', '${status}')" style="background-image: url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')">
                    <div class="veto-overlay">
                        <div>
                            <div>${map}</div>
                            <div style="font-size:0.6rem; color:${status === 'ban' ? 'red' : (status === 'pick' ? '#0f0' : '#ccc')}">${status}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

window.toggleVeto = (map, currentStatus) => {
    const nextStatus = currentStatus === 'neutral' ? 'ban' : (currentStatus === 'ban' ? 'pick' : 'neutral');
    db.collection("general").doc("map_veto").set({
        [map]: nextStatus
    }, { merge: true });
};

window.resetVeto = () => {
    if (confirm("Reset the board?")) {
        db.collection("general").doc("map_veto").set({});
    }
};

// --- 8. STRATBOOK (Minimal Canvas Logic) ---
let canvas, ctx, isDrawing = false;

function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Agent Palette
    fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true')
        .then(res => res.json())
        .then(json => {
            document.getElementById('agent-list').innerHTML = json.data.map(a => `
                <div onclick="window.prepAgent('${a.displayIcon}')" style="width:40px; height:40px; display:inline-block; margin:2px; cursor:pointer; border:1px solid #333;">
                    <img src="${a.displayIcon}" style="width:100%; height:100%;">
                </div>
            `).join('');
        });

    // Drawing Events
    canvas.onmousedown = (e) => {
        if (currentTool === 'draw') {
            isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        } else if (currentTool === 'agent' && activeAgent) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = activeAgent;
            img.onload = () => {
                ctx.drawImage(img, e.offsetX - 20, e.offsetY - 20, 40, 40);
            };
        }
    };
    canvas.onmousemove = (e) => {
        if (!isDrawing || currentTool !== 'draw') return;
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 3;
        ctx.stroke();
    };
    window.onmouseup = () => isDrawing = false;
}

window.setTool = (t) => {
    currentTool = t;
    document.querySelectorAll('.tool').forEach(e => e.classList.remove('active'));
    document.getElementById('tool-' + t).classList.add('active');
};

window.prepAgent = (url) => {
    activeAgent = url;
    window.setTool('agent');
};

window.clearPlanner = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.changeMap = () => {
    const map = document.getElementById('vpMapSelect').value;
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    window.clearPlanner();
};