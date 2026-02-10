/**
 * SYRIX ESPORTS - CENTRAL LOGIC KERNEL vFINAL
 * STRUCTURE: NAMESPACED MODULES FOR ROBUSTNESS
 */

// --- 1. CORE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDcV7KFuLn3I99M5JpW5amR-HSSHFEVVUY",
    authDomain: "database-for-new-website.firebaseapp.com",
    projectId: "database-for-new-website",
    storageBucket: "database-for-new-website.firebasestorage.app",
    messagingSenderId: "844714745171",
    appId: "1:844714745171:web:3ce89bf2b81e3697ff95a6",
    measurementId: "G-PYTWP3TH31"
};

const CONSTANTS = {
    ROOT_COLLECTION: "Schedule",
    ROOT_DOC_ID: "fw3Kmjdedt0auIH9O3Kp",
    ADMIN_UIDS: ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"],
    MAPS: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    DAYS: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    WEBHOOK: "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD"
};

let db, auth, rootRef, currentUser;

// --- 2. SYSTEM BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof firebase === 'undefined') throw new Error("Firebase SDK not loaded");

        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        rootRef = db.collection(CONSTANTS.ROOT_COLLECTION).doc(CONSTANTS.ROOT_DOC_ID);

        console.log("System: Firebase Linked Successfully.");
        document.getElementById('system-loader').style.display = 'none';

        // Auth Listener
        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (document.body.id === 'page-hub') AuthSystem.handleAuth(user);
        });

        // Page Routing
        if (document.body.id === 'page-home') LandingModule.init();
        if (document.body.id === 'page-hub') {
            StratbookModule.init();
            API.fetchAgents();
        }

    } catch (e) {
        alert("CRITICAL SYSTEM FAILURE: " + e.message);
    }
});

// --- 3. SHARED API UTILITIES ---
const API = {
    fetchAgents: async () => {
        const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
        const json = await res.json();
        const agents = json.data;

        const sp = document.getElementById('agent-palette');
        const cp = document.getElementById('comp-agent-list');

        if (sp) sp.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.StratbookModule.prepAgent('${a.displayIcon}')" title="${a.displayName}">`).join('');
        if (cp) cp.innerHTML = agents.map(a => `<img src="${a.displayIcon}" onclick="window.CompsModule.setSlot('${a.displayIcon}')" title="${a.displayName}">`).join('');
    }
};

// --- 4. AUTHENTICATION SYSTEM ---
const AuthSystem = {
    handleAuth: (user) => {
        if (!user) {
            document.getElementById('hubLocked').style.display = 'flex';
            document.getElementById('hubUnlocked').style.display = 'none';
            return;
        }

        // Auto-Init Check (Your Request)
        rootRef.collection("roster").get().then(snap => {
            if (snap.empty) this.initializeDatabase();
        });

        rootRef.collection("roster").where("uid", "==", user.uid).get().then(snap => {
            if (!snap.empty || CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
                document.getElementById('hubLocked').style.display = 'none';
                document.getElementById('hubUnlocked').style.display = 'flex';
                document.getElementById('user-name').innerText = user.displayName.toUpperCase();

                if (CONSTANTS.ADMIN_UIDS.includes(user.uid)) {
                    document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'inline-block');
                }

                // Initialize All Modules
                DashboardModule.init();
                MatchesModule.init();
                WarRoomModule.init();
                VetoModule.init();
                RosterModule.init();
                CompsModule.init();
                LineupsModule.init();
                PlaybookModule.init();
                PartnersModule.init();
                AdminModule.init();

            } else {
                document.getElementById('auth-status').innerText = "NOT ENLISTED";
                document.getElementById('login-module').style.display = 'none';
                document.getElementById('app-module').style.display = 'block';
            }
        });
    },

    login: () => auth.signInWithPopup(new firebase.auth.OAuthProvider('oidc.discord')),

    submitApplication: () => {
        const d = {
            user: document.getElementById('app-ign').value,
            uid: currentUser.uid,
            rank: document.getElementById('app-rank').value,
            role: document.getElementById('app-role').value,
            tracker: document.getElementById('app-tracker').value,
            why: document.getElementById('app-why').value,
            submitted: new Date().toISOString()
        };
        if (!d.user || !d.why) return alert("Required fields missing");

        rootRef.collection("applications").add(d).then(() => {
            fetch(CONSTANTS.WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: `New App: ${d.user}`, color: 16711680 }] }) });
            alert("Application Transmitted Successfully.");
        });
    },

    initializeDatabase: async () => {
        console.log("Auto-Initializing Database...");
        await rootRef.collection("roster").doc("ExampleUser").set({ role: "Captain", rank: "Radiant", uid: currentUser.uid });
        await rootRef.collection("general").doc("captain_message").set({ text: "Welcome to the Hub." });
        window.location.reload();
    }
};

// --- 5. NAVIGATION ---
const Navigation = {
    setTab: (id, btn) => {
        document.querySelectorAll('.tabView').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.nav-pill').forEach(e => e.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        btn.classList.add('active');
        if (id === 'stratbook') StratbookModule.resize();
    }
};

// --- 6. DASHBOARD MODULE ---
const DashboardModule = {
    init: () => {
        // Captain Message
        rootRef.collection("general").doc("captain_message").onSnapshot(d => {
            if (d.exists) document.getElementById('capt-msg').innerText = `"${d.data().text}"`;
        });

        // Absences
        rootRef.collection("leaves").orderBy("start").onSnapshot(snap => {
            const div = document.getElementById('abs-list');
            div.innerHTML = "";
            snap.forEach(doc => {
                const l = doc.data();
                div.innerHTML += `<div class="list-item" style="font-size:0.8rem;"><b>${l.user}</b>: ${l.start}</div>`;
            });
        });

        // Upcoming Events
        const today = new Date().toISOString().split('T')[0];
        rootRef.collection("events").where("date", ">=", today).orderBy("date").limit(3).onSnapshot(snap => {
            const div = document.getElementById('dash-events');
            div.innerHTML = "";
            document.getElementById('ops-badge').innerText = `${snap.size} ACTIVE`;
            snap.forEach(doc => div.innerHTML += `<div class="list-item"><b>VS ${doc.data().opponent}</b> <small>${doc.data().date}</small></div>`);
        });

        // Heatmap
        this.loadHeatmap();
    },

    loadHeatmap: () => {
        rootRef.collection("availabilities").onSnapshot(snap => {
            const counts = {};
            snap.forEach(doc => {
                (doc.data().slots || []).forEach(s => {
                    for (let h = parseInt(s.start); h < parseInt(s.end); h++) counts[`${s.day}-${h}`] = (counts[`${s.day}-${h}`] || 0) + 1;
                });
            });
            let html = "";
            CONSTANTS.DAYS.forEach(day => {
                let row = `<div class="heatmap-row"><span style="width:30px;font-size:0.6rem;color:#666;">${day.substring(0, 3)}</span>`;
                for (let h = 0; h < 24; h++) {
                    const a = Math.min((counts[`${day}-${h}`] || 0) * 0.2, 1);
                    row += `<div class="heat-bar" style="background:rgba(255,30,60,${a});" title="${day} ${h}:00"></div>`;
                }
                html += row + "</div>";
            });
            document.getElementById('avail-heatmap').innerHTML = html;
        });
    },

    saveAvail: () => {
        const ref = rootRef.collection("availabilities").doc(currentUser.displayName);
        ref.get().then(doc => {
            let slots = doc.exists ? doc.data().slots : [];
            slots.push({
                day: document.getElementById('av-day').value,
                start: document.getElementById('av-start').value,
                end: document.getElementById('av-end').value
            });
            ref.set({ slots }, { merge: true }).then(() => alert("Slot Added"));
        });
    },

    toggleEditMsg: () => document.getElementById('capt-edit').style.display = 'block',
    saveMsg: () => {
        rootRef.collection("general").doc("captain_message").set({ text: document.getElementById('capt-input').value }, { merge: true });
        document.getElementById('capt-edit').style.display = 'none';
    },
    logAbsence: () => {
        rootRef.collection("leaves").add({
            user: currentUser.displayName,
            start: document.getElementById('abs-start').value,
            end: document.getElementById('abs-end').value,
            reason: document.getElementById('abs-reason').value
        }).then(() => alert("Absence Logged"));
    }
};

// --- 7. STRATBOOK MODULE ---
const StratbookModule = {
    canvas: null, ctx: null, tool: 'draw', activeAgent: null, isDrawing: false,

    init: () => {
        this.canvas = document.getElementById('vpCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.canvas.onmousedown = e => {
            if (this.tool === 'draw') { this.isDrawing = true; this.ctx.beginPath(); this.ctx.moveTo(e.offsetX, e.offsetY); }
            else if (this.activeAgent) {
                const i = new Image(); i.src = this.activeAgent; i.crossOrigin = "anonymous";
                i.onload = () => this.ctx.drawImage(i, e.offsetX - 15, e.offsetY - 15, 30, 30);
            }
        };
        this.canvas.onmousemove = e => {
            if (!this.isDrawing) return;
            this.ctx.lineTo(e.offsetX, e.offsetY);
            this.ctx.strokeStyle = document.getElementById('vpColor').value;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        };
        window.onmouseup = () => this.isDrawing = false;
    },

    resize: () => {
        if (this.canvas) {
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.canvas.height = this.canvas.parentElement.clientHeight;
        }
    },

    setTool: (t, btn) => {
        this.tool = t;
        document.querySelectorAll('.tool-icon').forEach(e => e.classList.remove('active'));
        btn.classList.add('active');
    },
    prepAgent: (url) => { this.activeAgent = url; this.tool = 'agent'; },
    clear: () => this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height),
    changeMap: () => {
        document.getElementById('vpMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
        this.clear();
    },
    saveStrat: () => {
        const data = this.canvas.toDataURL();
        rootRef.collection("strats").add({
            author: currentUser.displayName,
            map: document.getElementById('vpMapSelect').value,
            img: data,
            date: new Date().toISOString()
        }).then(() => alert("Snapshot Saved"));
    }
};

// --- 8. MATCHES MODULE ---
const MatchesModule = {
    init: () => {
        rootRef.collection("events").orderBy("date", "desc").onSnapshot(snap => {
            const div = document.getElementById('match-list');
            div.innerHTML = "";
            let w = 0, t = 0;
            snap.forEach(doc => {
                const m = doc.data();
                if (m.result) { t++; if (parseInt(m.result.us) > parseInt(m.result.them)) w++; }
                div.innerHTML += `
                    <div class="list-item">
                        <div><b>VS ${m.opponent}</b> <small>${m.map}</small> ${m.result ? `(${m.result.us}-${m.result.them})` : ''}</div>
                        <button class="btn-xs danger" onclick="window.MatchesModule.delete('${doc.id}')">X</button>
                    </div>`;
            });
            document.getElementById('stat-win').innerText = t > 0 ? Math.round((w / t) * 100) + "%" : "--%";
        });
    },
    addMatch: () => {
        const res = document.getElementById('m-us').value;
        rootRef.collection("events").add({
            opponent: document.getElementById('m-opp').value,
            date: document.getElementById('m-date').value,
            map: document.getElementById('m-map').value,
            result: res ? {
                us: res, them: document.getElementById('m-them').value,
                pistols: document.getElementById('m-pistol').value,
                eco: document.getElementById('m-eco').value,
                fb: document.getElementById('m-fb').value
            } : null
        }).then(() => alert("Operation Logged"));
    },
    delete: (id) => { if (confirm("Delete?")) rootRef.collection("events").doc(id).delete(); }
};

// --- 9. COMPS MODULE ---
const CompsModule = {
    slotIndex: null,

    init: () => { }, // Handled by loadComp
    loadComp: () => {
        const map = document.getElementById('comp-map').value;
        rootRef.collection("comps").doc(map).get().then(doc => {
            const agents = doc.exists ? doc.data().agents : [null, null, null, null, null];
            for (let i = 0; i < 5; i++) {
                const slot = document.getElementById(`cs-${i}`);
                slot.innerHTML = agents[i] ? `<img src="${agents[i]}">` : '?';
                slot.dataset.img = agents[i] || "";
            }
            document.getElementById('comp-display').innerHTML = agents.map(a => a ? `<img src="${a}" style="width:45px; border-radius:50%;">` : '').join('');
        });
    },
    editSlot: (i) => {
        this.slotIndex = i;
        document.getElementById('comp-picker').style.display = 'block';
    },
    setSlot: (url) => {
        document.getElementById(`cs-${this.slotIndex}`).dataset.img = url;
        document.getElementById(`cs-${this.slotIndex}`).innerHTML = `<img src="${url}">`;
        document.getElementById('comp-picker').style.display = 'none';
    },
    saveComp: () => {
        const agents = [];
        for (let i = 0; i < 5; i++) agents.push(document.getElementById(`cs-${i}`).dataset.img);
        rootRef.collection("comps").doc(document.getElementById('comp-map').value).set({ agents }).then(() => alert("Meta Saved"));
    }
};

// --- 10. WAR ROOM MODULE ---
const WarRoomModule = {
    currentId: null,
    init: () => {
        rootRef.collection("war_room").onSnapshot(snap => {
            const div = document.getElementById('enemy-list');
            div.innerHTML = "";
            snap.forEach(doc => div.innerHTML += `<div class="list-item" onclick="window.WarRoomModule.open('${doc.id}')" style="cursor:pointer;"><b>${doc.data().name}</b></div>`);
        });
    },
    newEnemy: () => { const n = prompt("Team Name:"); if (n) rootRef.collection("war_room").add({ name: n, notes: "" }); },
    open: (id) => {
        this.currentId = id;
        rootRef.collection("war_room").doc(id).get().then(doc => {
            document.getElementById('wr-title').innerText = doc.data().name;
            document.getElementById('wr-notes').value = doc.data().notes;
            document.getElementById('wr-content').style.display = 'flex';
        });
    },
    saveIntel: () => rootRef.collection("war_room").doc(this.currentId).update({ notes: document.getElementById('wr-notes').value }).then(() => alert("Intel Updated")),
    deleteEnemy: () => rootRef.collection("war_room").doc(this.currentId).delete().then(() => document.getElementById('wr-content').style.display = 'none')
};

// --- 11. LINEUPS MODULE ---
const LineupsModule = {
    currentId: null, x: 0, y: 0,
    init: () => this.changeMap(),
    changeMap: () => {
        const m = document.getElementById('luMapSelect').value;
        document.getElementById('luMapImg').src = `https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/stylizedicon.png`;
        rootRef.collection("lineups").where("map", "==", m).onSnapshot(s => {
            const c = document.getElementById('lineup-pins'); c.innerHTML = "";
            s.forEach(d => {
                const p = document.createElement('div');
                p.className = "pin"; p.style.left = `${d.data().x}%`; p.style.top = `${d.data().y}%`;
                p.onclick = e => { e.stopPropagation(); this.view(d.id, d.data()); };
                c.appendChild(p);
            });
        });
    },
    mapClick: (e) => {
        const r = document.getElementById('lu-map-wrap').getBoundingClientRect();
        this.x = ((e.clientX - r.left) / r.width) * 100;
        this.y = ((e.clientY - r.top) / r.height) * 100;
        document.getElementById('lineup-form').style.display = 'block';
        document.getElementById('lineup-viewer').style.display = 'none';
    },
    save: () => rootRef.collection("lineups").add({
        map: document.getElementById('luMapSelect').value, x: this.x, y: this.y,
        title: document.getElementById('lu-title').value, url: document.getElementById('lu-url').value, desc: document.getElementById('lu-desc').value
    }).then(() => { document.getElementById('lineup-form').style.display = 'none'; alert("Pin Saved"); }),
    view: (id, d) => {
        this.currentId = id;
        document.getElementById('lineup-form').style.display = 'none';
        document.getElementById('lineup-viewer').style.display = 'block';
        document.getElementById('view-lu-title').innerText = d.title;
        document.getElementById('view-lu-link').href = d.url;
        document.getElementById('view-lu-desc').innerText = d.desc;
    },
    delete: () => { if (confirm("Delete Pin?")) rootRef.collection("lineups").doc(this.currentId).delete().then(() => document.getElementById('lineup-viewer').style.display = 'none'); }
};

// --- 12. VETO MODULE ---
const VetoModule = {
    init: () => {
        rootRef.collection("general").doc("veto").onSnapshot(d => {
            const data = d.data() || {};
            document.getElementById('veto-grid').innerHTML = CONSTANTS.MAPS.map(m =>
                `<div class="veto-card ${data[m] || 'neutral'}" onclick="window.VetoModule.toggle('${m}','${data[m] || 'neutral'}')" style="background-image:url('https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6130-03a4d7090581/splash.png')">
                    <div class="veto-overlay"><div>${m}</div><small>${data[m] || 'NEUTRAL'}</small></div>
                </div>`).join('');
        });
    },
    toggle: (m, s) => {
        if (!CONSTANTS.ADMIN_UIDS.includes(currentUser.uid)) return;
        const n = s === 'neutral' ? 'ban' : s === 'ban' ? 'pick' : 'neutral';
        rootRef.collection("general").doc("veto").set({ [m]: n }, { merge: true });
    },
    reset: () => { if (confirm("Reset Board?")) rootRef.collection("general").doc("veto").set({}); }
};

// --- 13. PLAYBOOK MODULE ---
const PlaybookModule = {
    init: () => this.load(),
    load: () => {
        const id = `${document.getElementById('pb-map').value}_${document.getElementById('pb-side').value}`;
        rootRef.collection("playbooks").doc(id).get().then(d => document.getElementById('pb-text').value = d.exists ? d.data().text : "");
    },
    save: () => {
        const id = `${document.getElementById('pb-map').value}_${document.getElementById('pb-side').value}`;
        rootRef.collection("playbooks").doc(id).set({ text: document.getElementById('pb-text').value }).then(() => alert("Protocols Saved"));
    }
};

// --- 14. PARTNERS & CONTENT ---
const PartnersModule = {
    init: () => rootRef.collection("partners").onSnapshot(s => {
        document.getElementById('partner-list').innerHTML = "";
        s.forEach(d => document.getElementById('partner-list').innerHTML += `<div class="list-item"><b>${d.data().name}</b> <small>${d.data().contact}</small></div>`);
    }),
    add: () => rootRef.collection("partners").add({ name: document.getElementById('pt-name').value, contact: document.getElementById('pt-contact').value })
};

const ContentModule = {
    addNews: () => rootRef.collection("news").add({ title: document.getElementById('news-title').value, body: document.getElementById('news-body').value }).then(() => alert("Posted")),
    addIntel: () => rootRef.collection("intel").add({ title: document.getElementById('intel-title').value, url: document.getElementById('intel-url').value }).then(() => alert("Added"))
};

// --- 15. ROSTER & ADMIN ---
const RosterModule = {
    currentId: null,
    init: () => rootRef.collection("roster").onSnapshot(s => {
        document.getElementById('roster-list-mgr').innerHTML = "";
        s.forEach(d => document.getElementById('roster-list-mgr').innerHTML += `<div class="list-item" onclick="window.RosterModule.edit('${d.id}')" style="cursor:pointer;">${d.id} <span class="badge">${d.data().role}</span></div>`);
    }),
    edit: (id) => {
        this.currentId = id;
        document.getElementById('r-id').value = id;
        document.getElementById('roster-editor').style.display = 'block';
    },
    save: () => rootRef.collection("roster").doc(this.currentId).update({ role: document.getElementById('r-role').value, pfp: document.getElementById('r-pfp').value }).then(() => alert("Profile Updated"))
};

const AdminModule = {
    init: () => rootRef.collection("applications").onSnapshot(s => {
        document.getElementById('admin-list').innerHTML = "";
        s.forEach(d => document.getElementById('admin-list').innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start;"><div><b>${d.data().user}</b></div><i>"${d.data().why}"</i><div style="width:100%; display:flex; gap:5px;"><button class="btn primary" style="background:green" onclick="window.AdminModule.decide('${d.id}','${d.data().user}','${d.data().uid}',true)">ACCEPT</button><button class="btn primary" style="background:red" onclick="window.AdminModule.decide('${d.id}',null,null,false)">REJECT</button></div></div>`);
    }),
    decide: (id, user, uid, accept) => {
        if (accept) rootRef.collection("roster").doc(user).set({ uid, role: "Tryout", rank: "Unranked" }).then(() => rootRef.collection("applications").doc(id).delete());
        else if (confirm("Reject?")) rootRef.collection("applications").doc(id).delete();
    }
};

// --- 16. LANDING MODULE ---
const LandingModule = {
    init: () => loadLandingData() // Reuse the renderer
};