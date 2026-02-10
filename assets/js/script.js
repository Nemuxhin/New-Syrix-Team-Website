/**
 * SYRIX COMMAND CENTER - LOGIC ENGINE v2.0
 * * 1. CONFIGURATION & STATE
 * 2. AUTHENTICATION & ROUTING
 * 3. LANDING PAGE RENDERER
 * 4. DASHBOARD MODULES
 * 5. STRATBOOK ENGINE
 * 6. MATCH & WAR ROOM LOGIC
 * 7. ADMIN & UTILS
 */

// --- 1. CONFIGURATION & STATE ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

const CONSTANTS = {
    ADMIN_UIDS: ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

// Global State Store
const store = {
    user: null,
    isMember: false,
    isAdmin: false,
    currentTab: 'dashboard',
    stratbook: {
        tool: 'draw',
        activeAgent: null,
        isDrawing: false,
        color: '#ff1e3c'
    },
    warRoom: {
        activeTarget: null
    },
    compEditor: {
        activeSlot: null
    }
};

let db, auth;
let canvas, ctx;

// --- 2. INITIALIZATION & ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Firebase
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            console.log("System: Firebase Initialized");
        } catch (e) {
            console.error("System: Firebase Error", e);
        }

        // 2. Auth Listener
        auth.onAuthStateChanged(user => {
            store.user = user;
            if (document.body.id === 'page-hub') {
                handleHubAuth(user);
            }
        });
    }

    // 3. Page Specific Logic
    const page = document.body.id;
    if (page === 'page-home') {
        initLandingPage();
    } else if (page === 'page-hub') {
        initStratbook();
        // Check URL hash for direct linking
        const hash = window.location.hash.substring(1);
        if (hash) window.router(hash);
    }
});

// --- 3. LANDING PAGE RENDERER ---
function initLandingPage() {
    console.log("System: Loading Landing Page Data...");

    // Scroll Effects
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('nav');
        if (window.scrollY > 50) nav.style.background = "#000";
        else nav.style.background = "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)";
    });

    // Fetch Matches
    db.collection("events").orderBy("date").onSnapshot(snap => {
        const container = document.getElementById('landing-matches-grid');
        if (!container) return;

        container.innerHTML = "";
        const now = new Date().toISOString().split('T')[0];
        let wins = 0, total = 0;

        snap.forEach(doc => {
            const data = doc.data();

            // Calculate Win Rate
            if (data.result) {
                total++;
                if (parseInt(data.result.us) > parseInt(data.result.them)) wins++;
            }

            // Render Upcoming
            if (data.date >= now && !data.result) {
                container.innerHTML += `
                    <div class="newsCard">
                        <span class="match-date">${data.date} // ${data.time || 'TBD'}</span>
                        <div class="match-versus">VS ${data.opponent}</div>
                        <div class="match-meta">${data.map || 'VETO PENDING'} • ${data.type || 'Official'}</div>
                    </div>
                `;
            }
        });

        // Update Stat Bar
        const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
        document.getElementById('stat-record').innerText = `${wins}W - ${total - wins}L`;
        document.getElementById('stat-winrate').innerText = `${wr}%`;
    });

    // Fetch Roster
    db.collection("roster").onSnapshot(snap => {
        const grid = document.getElementById('landing-roster-grid');
        if (!grid) return;

        grid.innerHTML = "";
        document.getElementById('stat-roster').innerText = snap.size;

        snap.forEach(doc => {
            const p = doc.data();
            // Default image if missing
            const img = p.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80';

            grid.innerHTML += `
                <div class="roster-card">
                    <img src="${img}" alt="${doc.id}">
                    <div class="roster-info">
                        <h3>${doc.id}</h3>
                        <span>${p.role}</span>
                    </div>
                </div>
            `;
        });
    });
}

// --- 4. HUB AUTHENTICATION ---
function handleHubAuth(user) {
    const screens = {
        locked: document.getElementById('hubLocked'),
        unlocked: document.getElementById('hubUnlocked'),
        appForm: document.getElementById('application-module'),
        login: document.getElementById('login-module')
    };

    if (!user) {
        screens.locked.style.display = 'flex';
        screens.unlocked.style.display = 'none';
        return;
    }

    // Check Permissions
    db.collection("roster").where("uid", "==", user.uid).get().then(snap => {
        const isAdmin = CONSTANTS.ADMIN_UIDS.includes(user.uid);
        const isRoster = !snap.empty;

        if (isRoster || isAdmin) {
            // AUTHORIZED
            store.isMember = true;
            store.isAdmin = isAdmin;

            screens.locked.style.display = 'none';
            screens.unlocked.style.display = 'flex';

            document.getElementById('user-name').innerText = user.displayName.toUpperCase();
            if (isAdmin) {
                document.getElementById('nav-admin').style.display = 'inline-block';
                document.getElementById('user-role-badge').innerText = "ADMINISTRATOR";
                document.getElementById('user-role-badge').style.color = "#fff";
                document.getElementById('user-role-badge').style.background = "red";
            }

            // Load Initial Data
            loadDashboard();
        } else {
            // UNAUTHORIZED -> Show Application
            screens.login.style.display = 'none';
            screens.appForm.style.display = 'block';
        }
    });
}

// Auth Actions
window.loginDiscord = () => {
    const provider = new firebase.auth.OAuthProvider('oidc.discord');
    auth.signInWithPopup(provider).catch(e => alert("Login Failed: " + e.message));
};

window.submitApp = () => {
    const form = {
        ign: document.getElementById('app-ign').value,
        rank: document.getElementById('app-rank').value,
        role: document.getElementById('app-role').value,
        tracker: document.getElementById('app-tracker').value,
        why: document.getElementById('app-why').value
    };

    if (!form.ign || !form.why) return alert("Critical information missing.");

    db.collection("applications").add({
        ...form,
        uid: store.user.uid,
        discordTag: store.user.displayName,
        submittedAt: new Date().toISOString()
    }).then(() => {
        // Send Webhook
        fetch(CONSTANTS.WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Syrix Bot",
                embeds: [{
                    title: "New Application Recieved",
                    color: 16711680,
                    fields: [
                        { name: "User", value: form.ign, inline: true },
                        { name: "Rank", value: form.rank, inline: true },
                        { name: "Tracker", value: form.tracker }
                    ]
                }]
            })
        });
        alert("Dossier Transmitted. Stand by for review.");
    });
};

// --- 5. DASHBOARD ROUTER & LOGIC ---
window.router = (viewId) => {
    // 1. Update State
    store.currentTab = viewId;
    window.location.hash = viewId;

    // 2. UI Update
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(`view-${viewId}`).classList.add('active');

    // Find button to highlight (simple approach)
    const btns = document.querySelectorAll('.nav-item');
    btns.forEach(btn => {
        if (btn.innerText.toLowerCase().includes(viewId.substring(0, 4))) btn.classList.add('active');
    });

    // 3. Load Data for View
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'warroom') loadWarRoom();
    if (viewId === 'stratbook') resizeCanvas();
    if (viewId === 'roster') loadRosterMgr();
    if (viewId === 'mapveto') loadMapVeto();
    if (viewId === 'admin') loadAdmin();
};

function loadDashboard() {
    // Captain's Message
    db.collection("general").doc("captain_message").onSnapshot(doc => {
        if (doc.exists) document.getElementById('dashboard-msg').innerText = `"${doc.data().text}"`;
    });

    // Absences
    db.collection("leaves").where("end", ">=", new Date().toISOString().split('T')[0]).onSnapshot(snap => {
        const list = document.getElementById('dashboard-absences');
        list.innerHTML = "";
        snap.forEach(doc => {
            const l = doc.data();
            list.innerHTML += `<div class="list-item-mini"><span>${l.user}</span> <span class="text-red">${l.start}</span></div>`;
        });
    });

    // Upcoming Events
    const today = new Date().toISOString().split('T')[0];
    db.collection("events").where("date", ">=", today).orderBy("date").limit(5).onSnapshot(snap => {
        const list = document.getElementById('dashboard-events');
        list.innerHTML = "";
        document.getElementById('ops-count').innerText = `${snap.size} ACTIVE`;

        if (snap.empty) {
            list.innerHTML = `<div style="padding:20px; color:#555; text-align:center;">NO OPERATIONS SCHEDULED</div>`;
        }

        snap.forEach(doc => {
            const m = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div style="font-weight:bold;">VS ${m.opponent}</div>
                    <div style="font-size:0.8rem; color:#888;">${m.date} @ ${m.time} // ${m.map}</div>
                </div>
            `;
        });
    });
}

// --- 6. MATCH MANAGER ---
function loadMatches() {
    db.collection("events").orderBy("date", "desc").onSnapshot(snap => {
        const list = document.getElementById('match-list');
        list.innerHTML = "";

        snap.forEach(doc => {
            const m = doc.data();
            const resultHtml = m.result
                ? `<span style="color:${parseInt(m.result.us) > parseInt(m.result.them) ? '#0f0' : '#f00'}">${m.result.us} - ${m.result.them}</span>`
                : `<span style="color:#888">PENDING</span>`;

            list.innerHTML += `
                <div class="list-item">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <div>
                            <span class="text-red" style="font-weight:bold; font-size:0.8rem;">${m.date}</span>
                            <div style="font-weight:900; font-size:1.1rem;">VS ${m.opponent}</div>
                            <div style="font-size:0.8rem; color:#666;">${m.map} • ${m.type}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.5rem; font-weight:900;">${resultHtml}</div>
                            <button class="btn-text danger" onclick="deleteMatch('${doc.id}')">DELETE</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

window.addMatch = () => {
    const opp = document.getElementById('m-opp').value;
    if (!opp) return alert("Opponent Name Required");

    const us = document.getElementById('m-us').value;
    const them = document.getElementById('m-them').value;

    const data = {
        opponent: opp,
        date: document.getElementById('m-date').value,
        time: document.getElementById('m-time').value,
        map: document.getElementById('m-map').value,
        type: document.getElementById('m-type').value,
        result: (us && them) ? { us, them } : null
    };

    db.collection("events").add(data).then(() => {
        alert("Operation Logged");
        document.getElementById('m-opp').value = "";
    });
};

window.deleteMatch = (id) => {
    if (confirm("Confirm deletion of match record?")) db.collection("events").doc(id).delete();
};

// --- 7. WAR ROOM ---
function loadWarRoom() {
    db.collection("war_room").onSnapshot(snap => {
        const list = document.getElementById('enemy-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            list.innerHTML += `
                <div class="list-item" style="cursor:pointer;" onclick="loadEnemyDetails('${doc.id}')">
                    <b style="color:#fff;">${doc.data().name}</b>
                </div>`;
        });
    });
}

window.newEnemy = () => {
    const name = prompt("Target Team Name:");
    if (name) db.collection("war_room").add({ name, notes: "" });
};

window.loadEnemyDetails = (id) => {
    store.warRoom.activeTarget = id;
    db.collection("war_room").doc(id).get().then(doc => {
        const d = doc.data();
        document.getElementById('wr-title').innerText = `INTEL: ${d.name}`;
        document.getElementById('wr-notes').value = d.notes;
        document.getElementById('wr-content').style.display = 'flex';
    });
};

window.saveIntel = () => {
    if (!store.warRoom.activeTarget) return;
    db.collection("war_room").doc(store.warRoom.activeTarget).update({
        notes: document.getElementById('wr-notes').value
    }).then(() => alert("Intel Updated"));
};

// --- 8. STRATBOOK ENGINE ---
function initStratbook() {
    canvas = document.getElementById('vpCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Load Palette
    getAgents().then(agents => {
        document.getElementById('agent-palette').innerHTML = agents.map(a =>
            `<img src="${a.displayIcon}" onclick="window.setAgent('${a.displayIcon}')" title="${a.displayName}">`
        ).join('');
    });

    // Canvas Events
    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    window.onmouseup = () => store.stratbook.isDrawing = false;

    // Resize Observer
    new ResizeObserver(() => resizeCanvas()).observe(document.querySelector('.canvas-container'));
}

function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}

function startDraw(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (store.stratbook.tool === 'draw') {
        store.stratbook.isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (store.stratbook.tool === 'agent' && store.stratbook.activeAgent) {
        const img = new Image();
        img.src = store.stratbook.activeAgent;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, x - 15, y - 15, 30, 30);
            // Draw ring
            ctx.beginPath();
            ctx.arc(x, y, 17, 0, Math.PI * 2);
            ctx.strokeStyle = store.stratbook.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        };
    }
}

function draw(e) {
    if (!store.stratbook.isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = document.getElementById('vpColor').value;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
}

window.setTool = (t) => { store.stratbook.tool = t; };
window.setAgent = (url) => { store.stratbook.activeAgent = url; store.stratbook.tool = 'agent'; };
window.clearStrat = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.changeMap = () => {
    const map = document.getElementById('vpMapSelect').value;
    // Note: In production, these URLs should be local or robust CDN
    document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
    window.clearStrat();
};

// --- 9. MAP VETO SYSTEM ---
function loadMapVeto() {
    const grid = document.getElementById('veto-grid');
    db.collection("general").doc("veto_state").onSnapshot(doc => {
        const data = doc.data() || {};
        grid.innerHTML = "";

        CONSTANTS.MAPS.forEach(map => {
            const status = data[map] || 'neutral';
            grid.innerHTML += `
                <div class="veto-card ${status}" onclick="window.toggleVeto('${map}', '${status}')">
                    <div class="veto-label">${map}</div>
                    <div class="status-marker">${status}</div>
                </div>
            `;
        });
    });
}

window.toggleVeto = (map, current) => {
    const next = current === 'neutral' ? 'ban' : (current === 'ban' ? 'pick' : 'neutral');
    db.collection("general").doc("veto_state").set({
        [map]: next
    }, { merge: true });
};

window.resetVeto = () => {
    if (confirm("Reset Board?")) db.collection("general").doc("veto_state").set({});
};

// --- 10. ROSTER MANAGER ---
function loadRosterMgr() {
    db.collection("roster").onSnapshot(snap => {
        const list = document.getElementById('roster-list-mgr');
        list.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            list.innerHTML += `
                <div class="list-item" onclick="window.editProfile('${doc.id}')" style="cursor:pointer;">
                    <b>${doc.id}</b> <span class="badge">${d.role}</span>
                </div>
            `;
        });
    });
}

window.editProfile = (id) => {
    currentRosterId = id;
    document.getElementById('r-id').value = id;
    document.getElementById('roster-editor').style.display = 'block';
};

window.saveProfile = () => {
    db.collection("roster").doc(currentRosterId).update({
        role: document.getElementById('r-role').value,
        pfp: document.getElementById('r-pfp').value
    }).then(() => alert("Profile Updated"));
};

// --- 11. ADMIN PANEL ---
function loadAdmin() {
    db.collection("applications").onSnapshot(snap => {
        const list = document.getElementById('admin-list');
        list.innerHTML = "";

        if (snap.empty) {
            list.innerHTML = "<div style='padding:20px; text-align:center; color:#555;'>No Pending Applications</div>";
            return;
        }

        snap.forEach(doc => {
            const a = doc.data();
            list.innerHTML += `
                <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                    <div style="font-size:1.1rem; color:#fff; font-weight:900;">${a.user}</div>
                    <div style="font-size:0.8rem; color:#888;">${a.rank} • ${a.role}</div>
                    <div style="margin:10px 0; font-style:italic; padding-left:10px; border-left:2px solid #333;">"${a.why}"</div>
                    <a href="${a.tracker}" target="_blank" style="color:var(--red); font-size:0.8rem; margin-bottom:10px;">View Tracker</a>
                    <div style="display:flex; gap:10px; width:100%;">
                        <button class="btn-sm primary" style="flex:1; background:green;" onclick="window.decideApp('${doc.id}', '${a.user}', '${a.uid}', true)">ACCEPT</button>
                        <button class="btn-sm primary" style="flex:1; background:red;" onclick="window.decideApp('${doc.id}', null, null, false)">REJECT</button>
                    </div>
                </div>
            `;
        });
    });
}

window.decideApp = (docId, username, uid, accepted) => {
    if (accepted) {
        db.collection("roster").doc(username).set({
            uid: uid,
            role: "Tryout",
            rank: "Unranked",
            joinedAt: new Date().toISOString()
        }).then(() => {
            db.collection("applications").doc(docId).delete();
            alert(`${username} Accepted.`);
        });
    } else {
        if (confirm("Reject this applicant?")) {
            db.collection("applications").doc(docId).delete();
        }
    }
};

// --- UTILS ---
window.logAbsence = () => {
    db.collection("leaves").add({
        user: currentUser.displayName,
        start: document.getElementById('abs-start').value,
        end: document.getElementById('abs-end').value,
        reason: document.getElementById('abs-reason').value
    }).then(() => alert("Absence Logged"));
};

window.saveMsg = () => {
    const txt = document.getElementById('capt-input').value;
    db.collection("general").doc("captain_message").set({ text: txt }, { merge: true });
    document.getElementById('capt-edit').style.display = 'none';
};

window.toggleEditMsg = () => {
    document.getElementById('capt-edit').style.display = 'block';
    document.getElementById('capt-input').value = document.getElementById('dashboard-msg').innerText.replace(/"/g, '');
};