'use strict';

// ============================================================
// 🔥 FIREBASE CONFIGURATION - REMPLACEZ PAR VOS VALEURS
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyDK7eRyDOCgITy_rMiTu-kOvWlPWuwze7E",
    authDomain: "budget-5372e.firebaseapp.com",
    projectId: "budget-5372e",
    storageBucket: "budget-5372e.firebasestorage.app",
    messagingSenderId: "871085643686",
    appId: "1:871085643686:web:9a4dd73501ddb6657b2167"
};

// ============================================================




firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
    console.warn('Firestore persistence:', err.code);
});

let currentUser = null;
let isGuestMode = false;
let unsubHoraires = null;
let unsubDepenses = null;
let unsubPaiements = null;
let unsubExtras = null;
let unsubEpargne = null;
let unsubShopping = null;
let unsubSettings = null;

auth.onAuthStateChanged(function(user) {
    currentUser = user;
    if (user && !isGuestMode) onUserLoggedIn(user);
});

async function loginWithEmail(email, password) {
    var cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
}

async function registerWithEmail(email, password) {
    var cred = await auth.createUserWithEmailAndPassword(email, password);
    return cred.user;
}

async function resetPassword(email) {
    await auth.sendPasswordResetEmail(email);
}

async function logout() {
    if (unsubHoraires) { unsubHoraires(); unsubHoraires = null; }
    if (unsubDepenses) { unsubDepenses(); unsubDepenses = null; }
    if (unsubPaiements) { unsubPaiements(); unsubPaiements = null; }
    if (unsubExtras) { unsubExtras(); unsubExtras = null; }
    if (unsubEpargne) { unsubEpargne(); unsubEpargne = null; }
    if (unsubShopping) { unsubShopping(); unsubShopping = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    await auth.signOut();
    currentUser = null;
    isGuestMode = false;
}

function onUserLoggedIn(user) {
    updateSyncUI('online', user.email);
    startRealtimeSync(user.uid);
    uploadLocalDataIfNeeded(user.uid);
}

function updateSyncUI(status, email) {
    var dot = document.getElementById('syncDot');
    var label = document.getElementById('syncLabel');
    var accEmail = document.getElementById('accountEmail');
    var accStatus = document.getElementById('accountStatus');
    var accInfo = document.getElementById('accountInfo');
    var loginBtn = document.getElementById('btnLoginFromSettings');
    var loggedActions = document.getElementById('loggedInActions');
    var accountActions = document.getElementById('accountActions');
    if (!dot) return;
    if (status === 'online') {
        dot.className = 'sync-dot online';
        label.textContent = 'Cloud';
        if (accEmail) accEmail.textContent = email || 'Connecté';
        if (accStatus) accStatus.textContent = '☁️ Synchronisé';
        if (accInfo) accInfo.classList.add('connected');
        if (loginBtn) loginBtn.style.display = 'none';
        if (accountActions) accountActions.style.display = 'none';
        if (loggedActions) loggedActions.classList.remove('hidden');
    } else if (status === 'syncing') {
        dot.className = 'sync-dot syncing';
        label.textContent = 'Sync...';
    } else {
        dot.className = 'sync-dot offline';
        label.textContent = 'Local';
        if (accEmail) accEmail.textContent = 'Mode local';
        if (accStatus) accStatus.textContent = 'Non connecté';
        if (accInfo) accInfo.classList.remove('connected');
        if (loginBtn) loginBtn.style.display = 'block';
        if (accountActions) accountActions.style.display = 'block';
        if (loggedActions) loggedActions.classList.add('hidden');
    }
}

async function uploadLocalDataIfNeeded(uid) {
    var uploaded = localStorage.getItem('mb_uploaded_' + uid);
    if (uploaded) return;
    updateSyncUI('syncing');
    try {
        var ref = db.collection('users').doc(uid);
        var cloudSettings = await ref.collection('data').doc('settings').get();
        if (!cloudSettings.exists && App.horaires.length > 0) {
            await ref.collection('data').doc('settings').set({
                tauxHoraire: App.settings.tauxHoraire,
                devise: App.settings.devise,
                arrondi: App.settings.arrondi || 'none',
                theme: App.settings.theme || 'purple',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            var batch1 = db.batch();
            App.horaires.forEach(function(h) {
                var docRef = ref.collection('horaires').doc(String(h.id));
                batch1.set(docRef, Object.assign({}, h, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
            });
            await batch1.commit();
            var batch2 = db.batch();
            App.depenses.forEach(function(d) {
                var docRef = ref.collection('depenses').doc(String(d.id));
                batch2.set(docRef, Object.assign({}, d, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
            });
            await batch2.commit();
            if (App.paiements && App.paiements.length > 0) {
                var batch3 = db.batch();
                App.paiements.forEach(function(p) {
                    var docRef = ref.collection('paiements').doc(String(p.id));
                    batch3.set(docRef, Object.assign({}, p, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
                });
                await batch3.commit();
            }
            if (App.extras && App.extras.length > 0) {
                var batch4 = db.batch();
                App.extras.forEach(function(e) {
                    var docRef = ref.collection('extras').doc(String(e.id));
                    batch4.set(docRef, Object.assign({}, e, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
                });
                await batch4.commit();
            }
            if (App.epargne && App.epargne.length > 0) {
                var batch5 = db.batch();
                App.epargne.forEach(function(e) {
                    var docRef = ref.collection('epargne').doc(String(e.id));
                    batch5.set(docRef, Object.assign({}, e, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
                });
                await batch5.commit();
            }
            if (App.shopping && App.shopping.length > 0) {
                var batch6 = db.batch();
                App.shopping.forEach(function(s) {
                    var docRef = ref.collection('shopping').doc(String(s.id));
                    batch6.set(docRef, Object.assign({}, s, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
                });
                await batch6.commit();
            }
            showToast('☁️ Données synchronisées !');
        }
        localStorage.setItem('mb_uploaded_' + uid, '1');
    } catch (e) { console.error('Upload error:', e); }
    updateSyncUI('online', currentUser ? currentUser.email : null);
}

function startRealtimeSync(uid) {
    var ref = db.collection('users').doc(uid);
    unsubHoraires = ref.collection('horaires').onSnapshot(function(snapshot) {
        App.horaires = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.horaires.push(data);
        });
        App.horaires.sort(function(a, b) { return b.date.localeCompare(a.date); });
        saveLocalData();
        if (typeof renderAll === 'function') renderAll();
    }, function(err) { console.error('Horaires:', err); });

    unsubDepenses = ref.collection('depenses').onSnapshot(function(snapshot) {
        App.depenses = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.depenses.push(data);
        });
        App.depenses.sort(function(a, b) { return b.date.localeCompare(a.date); });
        saveLocalData();
        if (typeof renderAll === 'function') renderAll();
    }, function(err) { console.error('Depenses:', err); });

    unsubPaiements = ref.collection('paiements').onSnapshot(function(snapshot) {
        App.paiements = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.paiements.push(data);
        });
        App.paiements.sort(function(a, b) { return b.mois.localeCompare(a.mois); });
        saveLocalData();
        if (typeof renderAll === 'function') renderAll();
    }, function(err) { console.error('Paiements:', err); });

    unsubExtras = ref.collection('extras').onSnapshot(function(snapshot) {
        App.extras = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.extras.push(data);
        });
        App.extras.sort(function(a, b) { return b.date.localeCompare(a.date); });
        saveLocalData();
        if (typeof renderAll === 'function') renderAll();
    }, function(err) { console.error('Extras:', err); });

    unsubEpargne = ref.collection('epargne').onSnapshot(function(snapshot) {
        App.epargne = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.epargne.push(data);
        });
        App.epargne.sort(function(a, b) { return b.date.localeCompare(a.date); });
        saveLocalData();
        if (typeof renderEpargne === 'function') renderEpargne();
        if (typeof renderDashboard === 'function') renderDashboard();
    }, function(err) { console.error('Epargne:', err); });

    unsubShopping = ref.collection('shopping').onSnapshot(function(snapshot) {
        App.shopping = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            delete data.updatedAt;
            App.shopping.push(data);
        });
        saveLocalData();
        if (typeof renderShopping === 'function') renderShopping();
    }, function(err) { console.error('Shopping:', err); });

    unsubSettings = ref.collection('data').doc('settings').onSnapshot(function(doc) {
        if (doc.exists) {
            var data = doc.data();
            if (data.tauxHoraire !== undefined) App.settings.tauxHoraire = data.tauxHoraire;
            if (data.devise !== undefined) App.settings.devise = data.devise;
            if (data.arrondi !== undefined) App.settings.arrondi = data.arrondi;
            if (data.theme !== undefined) {
                App.settings.theme = data.theme;
                if (typeof applyTheme === 'function') applyTheme(data.theme);
            }
            saveLocalData();
            if (typeof renderAll === 'function') renderAll();
        }
    }, function(err) { console.error('Settings:', err); });
}

async function cloudAddHoraire(h) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('horaires').doc(String(h.id));
        await ref.set(Object.assign({}, h, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (e) { console.error('Cloud add horaire:', e); }
}

async function cloudDeleteHoraire(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('horaires').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete horaire:', e); }
}

async function cloudAddDepense(d) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('depenses').doc(String(d.id));
        await ref.set(Object.assign({}, d, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (e) { console.error('Cloud add depense:', e); }
}

async function cloudDeleteDepense(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('depenses').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete depense:', e); }
}

async function cloudAddPaiement(p) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('paiements').doc(String(p.id));
        await ref.set(Object.assign({}, p, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (e) { console.error('Cloud add paiement:', e); }
}

async function cloudDeletePaiement(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('paiements').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete paiement:', e); }
}

async function cloudAddExtra(e) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('extras').doc(String(e.id));
        await ref.set(Object.assign({}, e, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (er) { console.error('Cloud add extra:', er); }
}

async function cloudDeleteExtra(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('extras').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete extra:', e); }
}

async function cloudAddEpargne(e) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('epargne').doc(String(e.id));
        await ref.set(Object.assign({}, e, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (er) { console.error('Cloud add epargne:', er); }
}

async function cloudDeleteEpargne(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('epargne').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete epargne:', e); }
}

async function cloudAddShopItem(s) {
    if (!currentUser || isGuestMode) return;
    try {
        var ref = db.collection('users').doc(currentUser.uid).collection('shopping').doc(String(s.id));
        await ref.set(Object.assign({}, s, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } catch (e) { console.error('Cloud add shop:', e); }
}

async function cloudDeleteShopItem(id) {
    if (!currentUser || isGuestMode) return;
    try { await db.collection('users').doc(currentUser.uid).collection('shopping').doc(String(id)).delete(); }
    catch (e) { console.error('Cloud delete shop:', e); }
}

async function cloudSaveSettings() {
    if (!currentUser || isGuestMode) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('data').doc('settings').set({
            tauxHoraire: App.settings.tauxHoraire,
            devise: App.settings.devise,
            arrondi: App.settings.arrondi || 'none',
            theme: App.settings.theme || 'purple',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error('Cloud save settings:', e); }
}

async function cloudDeleteAll() {
    if (!currentUser || isGuestMode) return;
    try {
        var uid = currentUser.uid;
        var ref = db.collection('users').doc(uid);
        var horaires = await ref.collection('horaires').get();
        var batch1 = db.batch();
        horaires.forEach(function(doc) { batch1.delete(doc.ref); });
        await batch1.commit();
        var depenses = await ref.collection('depenses').get();
        var batch2 = db.batch();
        depenses.forEach(function(doc) { batch2.delete(doc.ref); });
        await batch2.commit();
        var paiements = await ref.collection('paiements').get();
        var batch3 = db.batch();
        paiements.forEach(function(doc) { batch3.delete(doc.ref); });
        await batch3.commit();
        var extras = await ref.collection('extras').get();
        var batch4 = db.batch();
        extras.forEach(function(doc) { batch4.delete(doc.ref); });
        await batch4.commit();
        var epargne = await ref.collection('epargne').get();
        var batch5 = db.batch();
        epargne.forEach(function(doc) { batch5.delete(doc.ref); });
        await batch5.commit();
        var shopping = await ref.collection('shopping').get();
        var batch6 = db.batch();
        shopping.forEach(function(doc) { batch6.delete(doc.ref); });
        await batch6.commit();
    } catch (e) { console.error('Cloud delete all:', e); }
}

function saveLocalData() {
    localStorage.setItem('mb_horaires', JSON.stringify(App.horaires));
    localStorage.setItem('mb_depenses', JSON.stringify(App.depenses));
    localStorage.setItem('mb_paiements', JSON.stringify(App.paiements || []));
    localStorage.setItem('mb_extras', JSON.stringify(App.extras || []));
    localStorage.setItem('mb_epargne', JSON.stringify(App.epargne || []));
    localStorage.setItem('mb_shopping', JSON.stringify(App.shopping || []));
    localStorage.setItem('mb_settings', JSON.stringify(App.settings));
}
