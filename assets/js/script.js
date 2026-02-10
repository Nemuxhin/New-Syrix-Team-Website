/**
 * SYRIX ESPORTS - DIRECT TARGET LOGIC
 * TARGET: Schedule > fw3Kmjdedt0auIH9O3Kp
 */

// 1. CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e"
};

// 2. APP STATE
const app = {
    db: null, auth: null, user: null,
    root: null, // This will be your specific folder
    tool: 'draw',
    currentEnemy: null,

    // 3. STARTUP
    init: () => {
        try {
            firebase.initializeApp(firebaseConfig);
            app.db = firebase.firestore();
            app.auth = firebase.auth();

            // POINT DIRECTLY TO YOUR FOLDER
            app.root = app.db.collection("Schedule").doc("fw3Kmjdedt0auIH9O3Kp");
            console.log("Linked to Schedule/fw3Kmjdedt0auIH9O3Kp");

            // CHECK AUTH
            app.auth.onAuthStateChanged(user => {
                document.getElementById('loader').style.display = 'none';
                if (user) {
                    app.user = user;
                    document.getElementById('auth-screen').style.display = 'none';
                    document.getElementById('app-ui').style.display = 'flex';
                    document.getElementById('user-name').innerText = user.displayName.toUpperCase();
                    app.loadAll();
                } else {
                    document.getElementById('auth-screen').style.display = 'flex';
                    document.getElementById('app-ui').style.display = 'none';
                }
            });

        } catch (e) { alert("Error: " + e.message); }
    },

    login: () => {
        const p = new firebase.auth.OAuthProvider('oidc.discord');
        app.auth.signInWithPopup(p).catch(e => alert(e.message));
    },

    nav: (id, btn) => {
        document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        btn.classList.add('active');
        if (id === 'stratbook') app.initCanvas();
    },

    // 4. DATA LOADING (Everything uses app.root.collection)
    loadAll: () => {
        // Captain Message
        app.root.collection("general").doc("captain_message").onSnapshot(d => {
            if (d.exists) document.getElementById('capt-msg').innerText = `"${d.data().text}"`;
        });

        // Events
        app.root.collection("events").orderBy("date").onSnapshot(snap => {
            const list = document.getElementById('dash-events');
            const fullList = document.getElementById('match-list');
            list.innerHTML = ""; fullList.innerHTML = "";
            snap.forEach(d => {
                const m = d.data();
                const html = `<div class="list-item"><b>VS ${m.opponent}</b> <small>${m.date}</small></div>`;
                fullList.innerHTML += html;
                if (m.date >= new Date().toISOString().split('T')[0]) list.innerHTML += html;
            });
        });

        // War Room
        app.root.collection("war_room").onSnapshot(snap => {
            const list = document.getElementById('enemy-list'); list.innerHTML = "";
            snap.forEach(d => {
                list.innerHTML += `<div class="list-item" style="cursor:pointer;" onclick="app.openEnemy('${d.id}')"><b>${d.data().name}</b></div>`;
            });
        });

        // Veto
        app.root.collection("general").doc("veto").onSnapshot(d => {
            const data = d.data() || {};
            const maps = ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset"];
            document.getElementById('veto-grid').innerHTML = maps.map(m => {
                const s = data[m] || 'neutral';
                return `<div class="veto-card ${s}" onclick="app.toggleVeto('${m}', '${s}')"><b>${m}</b><small>${s}</small></div>`;
            }).join('');
        });

        // Roster
        app.root.collection("roster").onSnapshot(snap => {
            const div = document.getElementById('roster-list'); div.innerHTML = "";
            snap.forEach(d => div.innerHTML += `<div class="list-item"><b>${d.id}</b> <small>${d.data().role}</small></div>`);
        });
    },

    // 5. ACTIONS
    editMsg: () => {
        const newMsg = prompt("New Message:");
        if (newMsg) app.root.collection("general").doc("captain_message").set({ text: newMsg }, { merge: true });
    },

    addMatch: () => {
        const opp = document.getElementById('m-opp').value;
        const date = document.getElementById('m-date').value;
        if (opp && date) app.root.collection("events").add({ opponent: opp, date: date, map: "TBD" });
    },

    addEnemy: () => {
        const n = prompt("Name:");
        if (n) app.root.collection("war_room").add({ name: n, notes: "" });
    },

    openEnemy: (id) => {
        app.currentEnemy = id;
        app.root.collection("war_room").doc(id).get().then(d => {
            document.getElementById('wr-name').innerText = d.data().name;
            document.getElementById('wr-notes').value = d.data().notes;
        });
    },

    saveIntel: () => {
        if (app.currentEnemy) app.root.collection("war_room").doc(app.currentEnemy).update({ notes: document.getElementById('wr-notes').value });
    },

    toggleVeto: (map, status) => {
        const next = status === 'neutral' ? 'ban' : (status === 'ban' ? 'pick' : 'neutral');
        app.root.collection("general").doc("veto").set({ [map]: next }, { merge: true });
    },

    resetVeto: () => app.root.collection("general").doc("veto").set({}),

    // 6. STRATBOOK
    initCanvas: () => {
        const cvs = document.getElementById('vpCanvas');
        cvs.width = cvs.parentElement.clientWidth;
        cvs.height = cvs.parentElement.clientHeight;
        const ctx = cvs.getContext('2d');
        let drawing = false;

        cvs.onmousedown = e => {
            if (app.tool === 'draw') { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); }
        };
        cvs.onmousemove = e => {
            if (drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.strokeStyle = 'red'; ctx.lineWidth = 3; ctx.stroke(); }
        };
        window.onmouseup = () => drawing = false;
    },

    saveStrat: () => {
        const cvs = document.getElementById('vpCanvas');
        app.root.collection("strats").add({ img: cvs.toDataURL(), date: new Date().toISOString() })
            .then(() => alert("Strat Saved"));
    }
};

// BOOT
document.addEventListener('DOMContentLoaded', app.init);