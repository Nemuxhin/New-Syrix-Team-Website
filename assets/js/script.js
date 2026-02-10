// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const ADMIN_UIDS = ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"];
const MAPS = ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"];

let db, auth, currentUser;
let canvas, ctx, tool = 'draw', activeAgent = null, isDrawing = false;
let currentEnemyId = null;
let currentRosterId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        // Check Auth
        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') handleHubAuth(user);
        });

        // Page Logic
        if (document.body.id === 'page-home') loadLandingData();
        if (document.body.id === 'page-hub') initStratbook();
    }
});

// --- LANDING PAGE LOGIC ---
function loadLandingData() {
    // Matches
    db.collection("events").orderBy("date").onSnapshot(snap => {
        const div = document.getElementById('landing-matches');
        if (div) {
            div.innerHTML = "";
            let wins = 0, total = 0;
            snap.forEach(doc => {
                const m = doc.data();
                if (m.result) { // Completed match
                    total++;
                    if (parseInt(m.result.us) > parseInt(m.result.them)) wins++;
                } else if (m.date >= new Date().toISOString().split('T')[0]) { // Upcoming
                    div.innerHTML += `
                        <div class="newsCard">
                            <small style="color:var(--red); font-weight:900;">${m.date}</small>
                            <h3 style="margin:5px 0;">VS ${m.opponent}</h3>
                            <p style="font-size:0.8rem; color:#888;">${m.map || 'TBD'}</p>
                        </div>`;
                }
            });
            // Update Stats
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            const rec = document.getElementById('stat-record');
            const wrEl = document.getElementById('stat-winrate');
            if (rec) rec.innerText = `${wins}W - ${total - wins}L`;
            if (wrEl) wrEl.innerText = `${wr}%`;
        }
    });

    // Roster
    db.collection("roster").onSnapshot(snap => {
        const div = document.getElementById('landing-roster');
        const stat = document.getElementById('stat-roster');
        if (div) {
            div.innerHTML = "";
            if (stat) stat.innerText = snap.size;
            snap.forEach(doc => {
                const p = doc.data();
                div.innerHTML += `
                    <div class="roster-card">
                        <img src="${p.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}">
                        <div class="roster-info">
                            <h3>${doc.id}</h3>
                            <span>${p.role}</span>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- HUB AUTH ---
function handleHubAuth(user) {
    const lock = document.getElementById('hubLocked');
    const unlock = document.getElementById('hubUnlocked');
    const form = document.getElementById('app-form');
    const msg = document.getElementById('auth-msg');

    if (!user) {
        lock.style.display = 'flex';
        unlock.style.display = 'none';
        return;
    }

    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        if (!snap.empty || ADMIN_UIDS.includes(user.uid)) {
            // Authorized
            lock.style.display = 'none';
            unlock.style.display = 'block';
            document.getElementById('user-name').innerText = user.displayName.toUpperCase();

            if (ADMIN_UIDS.includes(user.uid)) document.querySelector('.admin-only').style.display = 'inline-block';

            // Load Hub Data
            loadCaptainMsg();
            loadAbsences();
            loadHubMatches();
            loadEnemies();
            loadLineups();
            loadRosterList();
            loadMapVeto();
            if (ADMIN_UIDS.includes(user.uid)) loadApplications();

        } else {
            // Unauthorized - Show Application
            msg.innerText = `WELCOME, ${user.displayName}. NOT ENLISTED.`;
            form.style.display = 'block';
        }
    });
}

window.loginDiscord = () => auth.signInWithPopup(new firebase.auth.OAuthProvider('oidc.discord'));

window.submitApp = () => {
    const ign = document.getElementById('app-ign').value;
    const why = document.getElementById('app-why').value;
    const rank = document.getElementById('app-rank').value;
    const role = document.getElementById('app-role').value;
    const tracker = document.getElementById('app-tracker').value;

    if (!ign || !why) return alert("Required fields missing");

    // 1. Save to Firebase
    db.collection("applications").add({
        user: ign,
        uid: currentUser.uid,
        rank: rank,
        role: role,
        tracker: tracker,
        why: why,
        date: new Date().toISOString()
    }).then(() => {
        // 2. Send to Discord Webhook
        const webhookURL = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";

        const payload = {
            embeds: [{
                title: `New Application: ${ign}`,
                color: 16776960, // Yellow
                fields: [
                    { name: 'Rank', value: rank, inline: true },
                    { name: 'Role', value: role, inline: true },
                    { name: 'Tracker', value: tracker }
                ]
            }]
        };

        fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Discord Webhook Failed", err));

        alert("Application Submitted successfully.");
        document.getElementById('app-form').style.display = 'none';
    });
};
// --- NAVIGATION ---
window.setTab = (id, btn) => {
    document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    // Resize canvas if needed
    if (id === 'stratbook') {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
};

// --- 1. DASHBOARD MODULES ---
function loadCaptainMsg() {
    db.collection("general").doc("captain_message").onSnapshot(doc => {
        if (doc.exists) document.getElementById('capt-msg').innerText = `"${doc.data().text}"`;
    });
}
window.editMsg = () => document.getElementById('capt-edit').style.display = 'block';
window.saveMsg = () => {
    const txt = document.getElementById('capt-input').value;
    db.collection("general").doc("captain_message").set({ text: txt }, { merge: true });
    document.getElementById('capt-edit').style.display = 'none';
};

function loadAbsences() {
    db.collection("leaves").orderBy("start").onSnapshot(snap => {
        const div = document.getElementById('abs-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            div.innerHTML += `<div><b style="color:var(--red)">${l.user}</b>: ${l.start} to ${l.end}</div>`;
        });
    });
}
window.logAbsence = () => {
    db.collection("leaves").add({
        user: currentUser.displayName,
        start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value,
        reason: document.getElementById('abs-reason').value
    }).then(() => {
        document.getElementById('abs-reason').value = "";
        alert("Logged");
    });
};

// --- 2. STRATBOOK ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Load Agents
    fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then(r => r.json()).then(d => {
        document.getElementById('agent-palette').innerHTML = d.data.map(a =>
            `<img src="${a.displayIcon}" onclick="window.activeAgent='${a.displayIcon}'; window.tool='agent'" style="width:100%; cursor:pointer; border:1px solid #333;">`
        ).join('');
    });

    // Drawing
    canvas.onmousedown = e => {
        if (window.tool === 'draw') {
            isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY);
        } else if (window.tool === 'agent' && window.activeAgent) {
            const i = new Image(); i.src = window.activeAgent; i.crossOrigin = "anonymous";
            i.onload = () => ctx.drawImage(i, e.offsetX - 15, e.offsetY - 15, 30, 30);
        }
    };
    canvas.onmousemove = e => {
        if (!isDrawing) return;
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.strokeStyle = document.getElementById('vpColor').value;
        ctx.lineWidth = 3;
        ctx.stroke();
    };
    window.onmouseup = () => isDrawing = false;
}
window.changeMap = () => {
    const m = document.getElementById('vpMapSelect').value;
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`; // Simplified for demo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.saveStrat = () => {
    // Combine canvases logic (simplified)
    alert("Strategy saved to Cloud (Simulated)");
};

// --- 3. MATCHES ---
function loadHubMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const list = document.getElementById('match-list');
        const dashList = document.getElementById('dash-events');
        list.innerHTML = "";
        dashList.innerHTML = "";

        let active = 0;
        snap.forEach(doc => {
            const m = doc.data();
            const el = `
                <div class="list-item">
                    <div>
                        <div style="font-weight:bold; color:white;">VS ${m.opponent}</div>
                        <div style="font-size:0.8rem; color:#888;">${m.date} • ${m.map}</div>
                        ${m.result ? `<div style="color:${parseInt(m.result.us) > parseInt(m.result.them) ? 'green' : 'red'}">${m.result.us} - ${m.result.them}</div>` : ''}
                    </div>
                    <button style="color:red; background:none; border:none; cursor:pointer;" onclick="window.delMatch('${doc.id}')">✕</button>
                </div>`;

            list.innerHTML += el;
            if (!m.result && active < 5) {
                dashList.innerHTML += el;
                active++;
            }
        });
        document.getElementById('stat-ops').innerText = active;
    });
}
window.addMatch = () => {
    const res = document.getElementById('m-us').value;
    const data = {
        opponent: document.getElementById('m-opp').value,
        date: document.getElementById('m-date').value,
        map: document.getElementById('m-map').value,
        result: res ? { us: res, them: document.getElementById('m-them').value } : null
    };
    db.collection("events").add(data).then(() => alert("Match Added"));
};
window.delMatch = (id) => { if (confirm("Delete?")) db.collection("events").doc(id).delete(); };

// --- 4. WAR ROOM ---
function loadEnemies() {
    db.collection("war_room").onSnapshot(snap => {
        const l = document.getElementById('enemy-list');
        l.innerHTML = "";
        snap.forEach(doc => {
            const e = doc.data();
            l.innerHTML += `<div class="list-item" style="cursor:pointer" onclick="window.openEnemy('${doc.id}')"><b>${e.name}</b></div>`;
        });
    });
}
window.newEnemy = () => {
    const n = prompt("Team Name:");
    if (n) db.collection("war_room").add({ name: n, notes: "" });
};
window.openEnemy = (id) => {
    currentEnemyId = id;
    db.collection("war_room").doc(id).get().then(doc => {
        document.getElementById('wr-title').innerText = doc.data().name;
        document.getElementById('wr-notes').value = doc.data().notes;
        document.getElementById('wr-content').style.display = 'block';
    });
};
window.saveIntel = () => db.collection("war_room").doc(currentEnemyId).update({ notes: document.getElementById('wr-notes').value });
window.deleteEnemy = () => db.collection("war_room").doc(currentEnemyId).delete().then(() => document.getElementById('wr-content').style.display = 'none');

// --- 5. LINEUPS ---
function loadLineups() {
    // Placeholder - would load from collection("lineups")
    document.getElementById('lineup-grid').innerHTML = `<div class="gallery-card" onclick="alert('Add Lineup Feature')" style="display:flex; justify-content:center; align-items:center; border:2px dashed #444;">+ ADD</div>`;
}

// --- 6. ROSTER MGR ---
function loadRosterList() {
    db.collection("roster").onSnapshot(snap => {
        const l = document.getElementById('roster-list-edit');
        l.innerHTML = "";
        snap.forEach(doc => {
            l.innerHTML += `<div class="list-item" onclick="window.editRoster('${doc.id}')" style="cursor:pointer;">${doc.id} <span style="font-size:0.7rem; color:#888;">${doc.data().role}</span></div>`;
        });
    });
}
window.editRoster = (id) => {
    currentRosterId = id;
    document.getElementById('r-id').value = id;
    document.getElementById('roster-edit-form').style.display = 'block';
};
window.saveRosterProfile = () => {
    db.collection("roster").doc(currentRosterId).update({
        role: document.getElementById('r-role').value,
        pfp: document.getElementById('r-pfp').value
    }).then(() => alert("Profile Updated"));
};

// --- 7. MAP VETO ---
function loadMapVeto() {
    db.collection("general").doc("veto").onSnapshot(doc => {
        const d = doc.data() || {};
        const g = document.getElementById('veto-grid');
        g.innerHTML = "";
        MAPS.forEach(m => {
            const s = d[m] || 'neutral';
            let color = '#333';
            if (s === 'ban') color = 'rgba(255,0,0,0.5)';
            if (s === 'pick') color = 'rgba(0,255,0,0.3)';

            g.innerHTML += `
                <div class="gallery-card" onclick="window.toggleVeto('${m}', '${s}')" style="background:${color}; display:flex; align-items:center; justify-content:center;">
                    <h3>${m}</h3>
                    <div class="gallery-info">${s.toUpperCase()}</div>
                </div>`;
        });
    });
}
window.toggleVeto = (m, s) => {
    const n = s === 'neutral' ? 'ban' : (s === 'ban' ? 'pick' : 'neutral');
    db.collection("general").doc("veto").set({ [m]: n }, { merge: true });
};
window.resetVeto = () => db.collection("general").doc("veto").set({});

// --- 8. ADMIN ---
function loadApplications() {
    db.collection("applications").onSnapshot(snap => {
        const l = document.getElementById('admin-list');
        l.innerHTML = "";
        snap.forEach(doc => {
            const a = doc.data();
            l.innerHTML += `
                <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                    <div style="font-weight:bold; color:white;">${a.user} <span style="font-size:0.8rem; color:#888;">${a.rank}</span></div>
                    <div style="font-style:italic; font-size:0.9rem;">"${a.why}"</div>
                    <div style="display:flex; gap:10px; margin-top:10px; width:100%;">
                        <button class="btn primary" onclick="window.acceptApp('${doc.id}', '${a.user}', '${a.uid}')" style="flex:1;">ACCEPT</button>
                        <button class="btn ghost" onclick="window.rejectApp('${doc.id}')" style="flex:1;">REJECT</button>
                    </div>
                </div>`;
        });
    });
}
window.acceptApp = (id, user, uid) => {
    db.collection("roster").doc(user).set({
        uid: uid, role: "Tryout", rank: "Unranked", joined: new Date().toISOString()
    }).then(() => db.collection("applications").doc(id).delete());
};
window.rejectApp = (id) => db.collection("applications").doc(id).delete();