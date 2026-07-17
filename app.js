'use strict';

// ===== STATE =====
const App = {
    horaires: [],
    depenses: [],
    paiements: [],
    extras: [],
    epargne: [],
    shopping: [],
    objectifs: [],
    settings: { tauxHoraire: 12.00, devise: '€', arrondi: 'none', theme: 'purple' },
    activeTab: 'horaires'
};

let pinInput = '';
let modalPinInput = '';
let modalPinMode = '';
let modalPinTemp = '';
var epargneMode = 'deposit';

// ===== CONSTANTES =====
const CATEGORIES = [
    {emoji:'🍔',label:'Alimentation'},{emoji:'🏠',label:'Loyer'},{emoji:'🚗',label:'Transport'},
    {emoji:'📱',label:'Téléphone'},{emoji:'⚡',label:'Énergie'},{emoji:'🎮',label:'Loisirs'},
    {emoji:'👕',label:'Vêtements'},{emoji:'💊',label:'Santé'},{emoji:'🛒',label:'Courses'},
    {emoji:'📦',label:'Abonnements'},{emoji:'🎓',label:'Éducation'},{emoji:'🔧',label:'Autre'}
];

const SOURCES_EXTRA = [
    {emoji:'👨‍👩‍👧',label:'Famille'},{emoji:'🎁',label:'Cadeau'},{emoji:'💸',label:'Remboursement'},
    {emoji:'🏷️',label:'Vente'},{emoji:'🤝',label:'Aide'},{emoji:'💼',label:'Freelance'},
    {emoji:'🎰',label:'Gain'},{emoji:'🏦',label:'Prêt'},{emoji:'🔄',label:'Retour'},
    {emoji:'💰',label:'Autre'}
];

const CAT_COLORS = ['#9b59b6','#00d2a0','#e17055','#fdcb6e','#e84393','#a29bfe','#fd79a8','#74b9ff','#ff9f43','#55efc4','#c39bd3','#b2bec3'];

// ===== UTILS =====
function todayStr() { return new Date().toISOString().split('T')[0]; }
function curM() { return todayStr().substring(0, 7); }
function getH(m) { return App.horaires.filter(function(h) { return h.date.startsWith(m); }); }
function getD(m) { return App.depenses.filter(function(d) { return d.date.startsWith(m); }); }
function getPaiementsForMonth(m) { return App.paiements.filter(function(p) { return p.mois === m; }); }
function getPaiementsForYear(y) { return App.paiements.filter(function(p) { return p.mois.startsWith(String(y)); }); }
function getExtrasForMonth(m) { return App.extras.filter(function(e) { return e.date.startsWith(m); }); }
function getEpargneForMonth(m) { return App.epargne.filter(function(e) { return e.date.startsWith(m); }); }

function getEpargneSolde() {
    return App.epargne.reduce(function(s, e) {
        return s + (e.type === 'deposit' ? e.montant : -e.montant);
    }, 0);
}

function getPreviousMonth(m) {
    var parts = m.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getNextMonth(m) {
    var parts = m.split('-').map(Number);
    var d = new Date(parts[0], parts[1], 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function calcMinutes(d, f, p) {
    p = p || 0;
    var dp = d.split(':').map(Number);
    var fp = f.split(':').map(Number);
    var t = (fp[0]*60+fp[1]) - (dp[0]*60+dp[1]);
    if (t < 0) t += 1440;
    t = Math.max(0, t - p);
    return applyArrondi(t);
}

function applyArrondi(minutes) {
    var arrondi = App.settings.arrondi || 'none';
    if (arrondi === 'none' || minutes <= 0) return minutes;
    var step = parseInt(arrondi);
    if (isNaN(step) || step <= 0) return minutes;
    return Math.ceil(minutes / step) * step;
}

function formatDuree(m) { return Math.floor(m/60) + 'h ' + String(m%60).padStart(2,'0'); }
function formatM(a) { return a.toFixed(2).replace('.',',') + ' ' + App.settings.devise; }
function formatDate(d) { var p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

function formatMonthShort(m) {
    var parts = m.split('-').map(Number);
    var months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    return months[parts[1]-1] + ' ' + parts[0];
}

function formatMonthLong(m) {
    var parts = m.split('-').map(Number);
    var months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return months[parts[1]-1] + ' ' + parts[0];
}

function formatMonthYear(date) {
    if (!date) return '';
    var months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    return months[date.getMonth()] + ' ' + date.getFullYear();
}

function formatDuration(mois) {
    if (mois === Infinity) return 'Jamais';
    if (mois === 0) return 'Atteint !';
    if (mois < 12) return mois + ' mois';
    var y = Math.floor(mois / 12);
    var m = mois % 12;
    if (m === 0) return y + ' an' + (y > 1 ? 's' : '');
    return y + ' an' + (y > 1 ? 's' : '') + ' et ' + m + ' mois';
}

function changeMonth(id, delta, cb) {
    var input = document.getElementById(id);
    if (!input.value) return;
    var parts = input.value.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1 + delta, 1);
    input.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    cb();
}

function computeMonthlyRevenue(monthStr) {
    var paieMois = getPaiementsForMonth(monthStr);
    var paieRecue = paieMois.reduce(function(s, p) { return s + p.montant; }, 0);
    var extras = getExtrasForMonth(monthStr);
    var totalExtras = extras.reduce(function(s, e) { return s + e.montant; }, 0);
    var prevMonth = getPreviousMonth(monthStr);
    var horairesPrec = getH(prevMonth);
    var gainPrevu = horairesPrec.reduce(function(s, x) { return s + x.gain; }, 0);
    var salaireEstime = paieRecue === 0 && gainPrevu > 0;
    return {
        paieRecue: paieRecue,
        gainPrevu: gainPrevu,
        salaireEstime: salaireEstime,
        totalExtras: totalExtras,
        nbPaies: paieMois.length,
        nbExtras: extras.length,
        totalReel: paieRecue + totalExtras,
        totalEstime: gainPrevu + totalExtras
    };
}

// ===== STORAGE =====
function loadData() {
    try {
        var h = localStorage.getItem('mb_horaires');
        var d = localStorage.getItem('mb_depenses');
        var p = localStorage.getItem('mb_paiements');
        var e = localStorage.getItem('mb_extras');
        var ep = localStorage.getItem('mb_epargne');
        var sh = localStorage.getItem('mb_shopping');
        var ob = localStorage.getItem('mb_objectifs');
        var s = localStorage.getItem('mb_settings');
        if (h) App.horaires = JSON.parse(h);
        if (d) App.depenses = JSON.parse(d);
        if (p) App.paiements = JSON.parse(p);
        if (e) App.extras = JSON.parse(e);
        if (ep) App.epargne = JSON.parse(ep);
        if (sh) App.shopping = JSON.parse(sh);
        if (ob) App.objectifs = JSON.parse(ob);
        if (s) App.settings = Object.assign({}, App.settings, JSON.parse(s));
    } catch (er) { console.error(er); }
}

function saveData() {
    localStorage.setItem('mb_horaires', JSON.stringify(App.horaires));
    localStorage.setItem('mb_depenses', JSON.stringify(App.depenses));
    localStorage.setItem('mb_paiements', JSON.stringify(App.paiements));
    localStorage.setItem('mb_extras', JSON.stringify(App.extras));
    localStorage.setItem('mb_epargne', JSON.stringify(App.epargne));
    localStorage.setItem('mb_shopping', JSON.stringify(App.shopping));
    localStorage.setItem('mb_objectifs', JSON.stringify(App.objectifs));
    localStorage.setItem('mb_settings', JSON.stringify(App.settings));
}

// ===== THEME =====
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        var colors = { purple:'#0f0a1e', dark:'#0a0a0a', light:'#f5f7fa', blue:'#0a1628', red:'#1a0a0e', green:'#0a1a12' };
        metaTheme.setAttribute('content', colors[theme] || colors.purple);
    }
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ===== AUTH UI =====
function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appWrapper').classList.add('hidden');
    document.getElementById('lockScreen').classList.add('hidden');
}

function hideAuthScreen() {
    document.getElementById('authScreen').classList.add('hidden');
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('resetForm').classList.add('hidden');
    clearAuthErrors();
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('resetForm').classList.add('hidden');
    clearAuthErrors();
}

function showResetPassword() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('resetForm').classList.remove('hidden');
    clearAuthErrors();
}

function clearAuthErrors() {
    document.getElementById('loginError').textContent = '';
    document.getElementById('regError').textContent = '';
    document.getElementById('resetError').textContent = '';
    document.getElementById('resetSuccess').textContent = '';
}

function togglePassword(inputId, btn) {
    var input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
    else { input.type = 'password'; btn.textContent = '👁️'; }
}

function showAuthFromApp() { showAuthScreen(); showLogin(); }

function forceLocalMode() {
    if (typeof isGuestMode !== 'undefined') isGuestMode = true;
    hideAuthScreen();
    checkPinAfterAuth();
}

function getAuthError(code) {
    var errors = {
        'auth/email-already-in-use': 'Email déjà utilisé',
        'auth/invalid-email': 'Email invalide',
        'auth/user-not-found': 'Aucun compte avec cet email',
        'auth/wrong-password': 'Mot de passe incorrect',
        'auth/weak-password': 'Mot de passe trop faible',
        'auth/too-many-requests': 'Trop de tentatives',
        'auth/network-request-failed': 'Erreur réseau',
        'auth/invalid-credential': 'Email ou mot de passe incorrect'
    };
    return errors[code] || 'Erreur : ' + code;
}

async function handleLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');
    var spinner = document.getElementById('loginSpinner');
    var btnText = document.getElementById('loginBtnText');
    if (!email || !password) { errEl.textContent = 'Remplissez tous les champs'; return; }
    if (typeof loginWithEmail !== 'function') { errEl.textContent = 'Firebase non chargé'; return; }
    spinner.classList.add('show');
    btnText.textContent = 'Connexion...';
    errEl.textContent = '';
    try {
        isGuestMode = false;
        await loginWithEmail(email, password);
        hideAuthScreen();
        checkPinAfterAuth();
        showToast('✅ Connecté !');
    } catch (e) { errEl.textContent = getAuthError(e.code); }
    finally { spinner.classList.remove('show'); btnText.textContent = 'Se connecter'; }
}

async function handleRegister() {
    var email = document.getElementById('regEmail').value.trim();
    var password = document.getElementById('regPassword').value;
    var confirm = document.getElementById('regPasswordConfirm').value;
    var errEl = document.getElementById('regError');
    var spinner = document.getElementById('regSpinner');
    var btnText = document.getElementById('regBtnText');
    if (!email || !password || !confirm) { errEl.textContent = 'Remplissez tous les champs'; return; }
    if (password.length < 6) { errEl.textContent = 'Min 6 caractères'; return; }
    if (password !== confirm) { errEl.textContent = 'Mots de passe différents'; return; }
    if (typeof registerWithEmail !== 'function') { errEl.textContent = 'Firebase non chargé'; return; }
    spinner.classList.add('show');
    btnText.textContent = 'Création...';
    errEl.textContent = '';
    try {
        isGuestMode = false;
        await registerWithEmail(email, password);
        hideAuthScreen();
        checkPinAfterAuth();
        showToast('🎉 Compte créé !');
    } catch (e) { errEl.textContent = getAuthError(e.code); }
    finally { spinner.classList.remove('show'); btnText.textContent = 'Créer mon compte'; }
}

async function handleResetPassword() {
    var email = document.getElementById('resetEmail').value.trim();
    var errEl = document.getElementById('resetError');
    var successEl = document.getElementById('resetSuccess');
    var spinner = document.getElementById('resetSpinner');
    var btnText = document.getElementById('resetBtnText');
    if (!email) { errEl.textContent = 'Entrez votre email'; return; }
    if (typeof resetPassword !== 'function') { errEl.textContent = 'Firebase non chargé'; return; }
    spinner.classList.add('show');
    btnText.textContent = 'Envoi...';
    errEl.textContent = '';
    successEl.textContent = '';
    try { await resetPassword(email); successEl.textContent = '📧 Email envoyé !'; }
    catch (e) { errEl.textContent = getAuthError(e.code); }
    finally { spinner.classList.remove('show'); btnText.textContent = 'Envoyer le lien'; }
}

function handleGuestMode() {
    if (typeof isGuestMode !== 'undefined') isGuestMode = true;
    hideAuthScreen();
    if (typeof updateSyncUI === 'function') updateSyncUI('offline');
    checkPinAfterAuth();
}

async function handleLogout() {
    showConfirm('🚪 Se déconnecter ?', 'Données locales conservées.', async function() {
        try {
            if (typeof logout === 'function') await logout();
            if (typeof updateSyncUI === 'function') updateSyncUI('offline');
            showAuthScreen();
            showLogin();
            showToast('👋 Déconnecté');
        } catch (e) { showToast('❌ Erreur'); }
    });
}

async function manualSync() {
    if (typeof currentUser === 'undefined' || !currentUser || isGuestMode) { showToast('⚠️ Connectez-vous'); return; }
    updateSyncUI('syncing');
    try {
        localStorage.removeItem('mb_uploaded_' + currentUser.uid);
        await uploadLocalDataIfNeeded(currentUser.uid);
        showToast('🔄 Synchronisé !');
    } catch (e) { showToast('❌ Erreur sync'); }
    updateSyncUI('online', currentUser.email);
}

// ===== PIN =====
function getStoredPin() { return localStorage.getItem('mb_pin'); }
function setStoredPin(pin) { localStorage.setItem('mb_pin', pin); }
function removeStoredPin() { localStorage.removeItem('mb_pin'); }
function checkPinAfterAuth() { if (getStoredPin()) showLockScreen(); else unlockApp(); }

function showLockScreen() {
    document.getElementById('lockScreen').classList.remove('hidden');
    document.getElementById('appWrapper').classList.add('hidden');
    pinInput = '';
    updateDots('pinDots', '');
    document.getElementById('pinError').textContent = '';
}

function unlockApp() {
    document.getElementById('lockScreen').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    renderAll();
}

function lockApp() {
    if (getStoredPin()) showLockScreen();
    else showToast('🔓 Aucun code défini');
}

function pressKey(num) {
    if (pinInput.length >= 6) return;
    pinInput += num;
    updateDots('pinDots', pinInput);
    if (pinInput.length === 6) setTimeout(handlePinComplete, 200);
}

function pressDelete() {
    pinInput = pinInput.slice(0, -1);
    updateDots('pinDots', pinInput);
    document.getElementById('pinError').textContent = '';
}

function handlePinComplete() {
    if (pinInput === getStoredPin()) {
        setDotsState('pinDots', 'success');
        setTimeout(unlockApp, 400);
    } else {
        setDotsState('pinDots', 'error');
        document.getElementById('pinError').textContent = 'Code incorrect';
        setTimeout(function() { pinInput = ''; updateDots('pinDots', ''); }, 500);
    }
}

function forgotPin() {
    var s = prompt('Tapez RESET pour supprimer le code');
    if (s && s.toUpperCase() === 'RESET') { removeStoredPin(); unlockApp(); showToast('🔓 Code supprimé'); }
}

function updateDots(id, val) {
    document.querySelectorAll('#' + id + ' .dot').forEach(function(d, i) {
        d.classList.remove('filled', 'error', 'success');
        if (i < val.length) d.classList.add('filled');
    });
}

function setDotsState(id, state) {
    document.querySelectorAll('#' + id + ' .dot').forEach(function(d) {
        d.classList.remove('filled', 'error', 'success');
        d.classList.add(state);
    });
}

// ===== PIN MODAL =====
function openPinModal(mode) {
    modalPinMode = mode; modalPinInput = ''; modalPinTemp = '';
    document.getElementById('modalPinError').textContent = '';
    updateDots('modalPinDots', '');
    var t = document.getElementById('pinModalTitle');
    var m = document.getElementById('pinModalMsg');
    if (mode === 'setup') { t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres'; }
    else if (mode === 'change-verify') { t.textContent = '🔄 Changer'; m.textContent = 'Code actuel'; }
    else if (mode === 'remove') { t.textContent = '🗑️ Supprimer'; m.textContent = 'Entrez votre code'; }
    document.getElementById('pinModal').classList.add('show');
}

function closePinModal() { document.getElementById('pinModal').classList.remove('show'); }

function modalPressKey(num) {
    if (modalPinInput.length >= 6) return;
    modalPinInput += num;
    updateDots('modalPinDots', modalPinInput);
    if (modalPinInput.length === 6) setTimeout(handleModalPinComplete, 200);
}

function modalPressDelete() {
    modalPinInput = modalPinInput.slice(0, -1);
    updateDots('modalPinDots', modalPinInput);
    document.getElementById('modalPinError').textContent = '';
}

function handleModalPinComplete() {
    var t = document.getElementById('pinModalTitle');
    var m = document.getElementById('pinModalMsg');
    var err = document.getElementById('modalPinError');
    switch (modalPinMode) {
        case 'setup':
            modalPinTemp = modalPinInput; modalPinInput = ''; modalPinMode = 'confirm';
            t.textContent = '🔐 Confirmer'; m.textContent = 'Même code';
            updateDots('modalPinDots', ''); break;
        case 'confirm':
            if (modalPinInput === modalPinTemp) {
                setDotsState('modalPinDots', 'success'); setStoredPin(modalPinTemp);
                setTimeout(function() { closePinModal(); updatePinStatus(); showToast('🔒 Code activé !'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Codes différents';
                setTimeout(function() { modalPinInput = ''; modalPinMode = 'setup'; modalPinTemp = '';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); err.textContent = ''; }, 800);
            } break;
        case 'change-verify':
            if (modalPinInput === getStoredPin()) {
                setDotsState('modalPinDots', 'success');
                setTimeout(function() { modalPinInput = ''; modalPinMode = 'change-new';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); }, 400);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Code incorrect';
                setTimeout(function() { modalPinInput = ''; updateDots('modalPinDots', ''); }, 500);
            } break;
        case 'change-new':
            modalPinTemp = modalPinInput; modalPinInput = ''; modalPinMode = 'change-confirm';
            t.textContent = '🔐 Confirmer'; m.textContent = 'Même code';
            updateDots('modalPinDots', ''); break;
        case 'change-confirm':
            if (modalPinInput === modalPinTemp) {
                setDotsState('modalPinDots', 'success'); setStoredPin(modalPinTemp);
                setTimeout(function() { closePinModal(); updatePinStatus(); showToast('🔒 Code modifié !'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Codes différents';
                setTimeout(function() { modalPinInput = ''; modalPinMode = 'change-new'; modalPinTemp = '';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); err.textContent = ''; }, 800);
            } break;
        case 'remove':
            if (modalPinInput === getStoredPin()) {
                setDotsState('modalPinDots', 'success'); removeStoredPin();
                setTimeout(function() { closePinModal(); updatePinStatus(); showToast('🔓 Code supprimé'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Code incorrect';
                setTimeout(function() { modalPinInput = ''; updateDots('modalPinDots', ''); }, 500);
            } break;
    }
}

function updatePinStatus() {
    var pin = getStoredPin();
    var icon = document.getElementById('pinStatusIcon');
    var text = document.getElementById('pinStatusText');
    var sub = document.getElementById('pinStatusSub');
    var wrap = document.getElementById('pinStatusWrap');
    if (pin) {
        icon.textContent = '🔒'; text.textContent = 'Code PIN activé';
        sub.textContent = 'App protégée'; wrap.classList.add('active-pin');
        document.getElementById('btnSetPin').style.display = 'none';
        document.getElementById('btnChangePin').style.display = 'block';
        document.getElementById('btnRemovePin').style.display = 'block';
    } else {
        icon.textContent = '🔓'; text.textContent = 'Aucun code';
        sub.textContent = 'Non protégé'; wrap.classList.remove('active-pin');
        document.getElementById('btnSetPin').style.display = 'block';
        document.getElementById('btnChangePin').style.display = 'none';
        document.getElementById('btnRemovePin').style.display = 'none';
    }
}

// ===== TOAST & MODAL =====
function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast show';
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.className = 'toast'; }, 2800);
}

function showConfirm(title, msg, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = msg;
    var o = document.getElementById('modalOverlay');
    o.classList.add('show');
    var close = function() { o.classList.remove('show'); };
    document.getElementById('modalConfirm').onclick = function() { close(); onConfirm(); };
    document.getElementById('modalCancel').onclick = close;
    o.onclick = function(e) { if (e.target === o) close(); };
}

// ===== ADD FUNCTIONS =====
function addHoraire() {
    var date = document.getElementById('dateHoraire').value;
    var debut = document.getElementById('heureDebut').value;
    var fin = document.getElementById('heureFin').value;
    var pause = parseInt(document.getElementById('pauseMinutes').value) || 0;
    var note = document.getElementById('noteHoraire').value.trim();
    if (!date || !debut || !fin) { showToast('⚠️ Remplissez les champs'); return; }
    var minutes = calcMinutes(debut, fin, pause);
    if (minutes <= 0) { showToast('⚠️ Durée invalide'); return; }
    var horaire = {
        id: Date.now(), date: date, debut: debut, fin: fin,
        pause: pause, minutes: minutes, note: note,
        gain: (minutes/60) * App.settings.tauxHoraire
    };
    App.horaires.push(horaire);
    App.horaires.sort(function(a, b) { return b.date.localeCompare(a.date); });
    saveData();
    if (typeof cloudAddHoraire === 'function') cloudAddHoraire(horaire);
    renderAll();
    showToast('✅ ' + formatDuree(minutes) + ' ajouté !');
    document.getElementById('heureDebut').value = '';
    document.getElementById('heureFin').value = '';
    document.getElementById('pauseMinutes').value = '0';
    document.getElementById('noteHoraire').value = '';
    document.getElementById('previewDuree').textContent = '--';
    document.getElementById('previewGain').textContent = '--';
    toggleForm('formCardH', 'btnToggleFormH');
}

function addDepense() {
    var date = document.getElementById('dateDepense').value;
    var montant = parseFloat(document.getElementById('montantDepense').value);
    var categorie = document.getElementById('categorieDepense').value;
    var description = document.getElementById('descriptionDepense').value.trim();
    if (!date || !montant || montant <= 0) { showToast('⚠️ Remplissez date et montant'); return; }
    if (!categorie) { showToast('⚠️ Choisissez une catégorie'); return; }
    var depense = { id: Date.now(), date: date, montant: montant, categorie: categorie, description: description };
    App.depenses.push(depense);
    App.depenses.sort(function(a, b) { return b.date.localeCompare(a.date); });
    saveData();
    if (typeof cloudAddDepense === 'function') cloudAddDepense(depense);
    renderAll();
    showToast('✅ ' + formatM(montant) + ' ajouté !');
    document.getElementById('montantDepense').value = '';
    document.getElementById('descriptionDepense').value = '';
    document.querySelectorAll('.cat-chip').forEach(function(c) { c.classList.remove('selected'); });
    document.getElementById('categorieDepense').value = '';
    toggleForm('formCardD', 'btnToggleFormD');
}

function addPaiement() {
    var mois = document.getElementById('moisPaiement').value;
    var montant = parseFloat(document.getElementById('montantPaiement').value);
    var description = document.getElementById('descriptionPaiement').value.trim();
    if (!mois || !montant || montant <= 0) { showToast('⚠️ Remplissez mois et montant'); return; }
    var paiement = { id: Date.now(), mois: mois, montant: montant, description: description, date: todayStr() };
    App.paiements.push(paiement);
    App.paiements.sort(function(a, b) { return b.mois.localeCompare(a.mois); });
    saveData();
    if (typeof cloudAddPaiement === 'function') cloudAddPaiement(paiement);
    renderAll();
    renderPaiements();
    showToast('✅ Paie de ' + formatM(montant) + ' !');
    document.getElementById('montantPaiement').value = '';
    document.getElementById('descriptionPaiement').value = '';
    toggleForm('formCardP', 'btnToggleFormP');
}

function quickAddPaiement() {
    var currentM = curM();
    var prevM = getPreviousMonth(currentM);
    var prevHoraires = getH(prevM);
    var gainOriginal = prevHoraires.reduce(function(s, x) { return s + x.gain; }, 0);
    if (gainOriginal <= 0) { showToast('⚠️ Aucune heure le mois précédent'); return; }
    var inputAjuste = document.getElementById('montantPaieAjuste');
    var montantFinal = inputAjuste ? parseFloat(inputAjuste.value) : gainOriginal;
    if (isNaN(montantFinal) || montantFinal <= 0) { showToast('⚠️ Montant invalide'); return; }
    var existing = getPaiementsForMonth(currentM);
    if (existing.length > 0) {
        showConfirm('Paie déjà là', existing.length + ' paie(s) déjà. Ajouter ?', function() {
            createQuickPaie(currentM, montantFinal, prevM);
        });
    } else createQuickPaie(currentM, montantFinal, prevM);
}

function createQuickPaie(mois, montant, moisSource) {
    var paiement = {
        id: Date.now(), mois: mois, montant: montant,
        description: 'Salaire ' + formatMonthLong(moisSource),
        date: todayStr()
    };
    App.paiements.push(paiement);
    App.paiements.sort(function(a, b) { return b.mois.localeCompare(a.mois); });
    saveData();
    if (typeof cloudAddPaiement === 'function') cloudAddPaiement(paiement);
    renderAll();
    renderPaiements();
    showToast('✨ Paie de ' + formatM(montant) + ' ajoutée !');
}

function updateDiffHint() {
    var input = document.getElementById('montantPaieAjuste');
    var hint = document.getElementById('diffHint');
    if (!input || !hint) return;
    var original = parseFloat(input.dataset.original) || 0;
    var current = parseFloat(input.value) || 0;
    if (original === 0) { hint.textContent = 'Ajustez selon votre bulletin de paie'; hint.className = 'ajustement-hint'; return; }
    var diff = current - original;
    var pct = ((diff / original) * 100).toFixed(1);
    if (Math.abs(diff) < 0.01) {
        hint.textContent = '= Montant original';
        hint.className = 'ajustement-hint';
    } else if (diff > 0) {
        hint.textContent = '+ ' + formatM(diff) + ' (+' + pct + '%)';
        hint.className = 'ajustement-hint positive';
    } else {
        hint.textContent = formatM(diff) + ' (' + pct + '%)';
        hint.className = 'ajustement-hint negative';
    }
}

function addExtra() {
    var date = document.getElementById('dateExtra').value;
    var montant = parseFloat(document.getElementById('montantExtra').value);
    var source = document.getElementById('sourceExtra').value;
    var description = document.getElementById('descriptionExtra').value.trim();
    if (!date || !montant || montant <= 0) { showToast('⚠️ Remplissez date et montant'); return; }
    if (!source) { showToast('⚠️ Choisissez une source'); return; }
    var extra = { id: Date.now(), date: date, montant: montant, source: source, description: description };
    App.extras.push(extra);
    App.extras.sort(function(a, b) { return b.date.localeCompare(a.date); });
    saveData();
    if (typeof cloudAddExtra === 'function') cloudAddExtra(extra);
    renderAll();
    renderExtras();
    showToast('✅ +' + formatM(montant) + ' enregistré !');
    document.getElementById('montantExtra').value = '';
    document.getElementById('descriptionExtra').value = '';
    document.querySelectorAll('#extraGrid .cat-chip').forEach(function(c) { c.classList.remove('selected'); });
    document.getElementById('sourceExtra').value = '';
    toggleForm('formCardE', 'btnToggleFormE');
}

// ===== REPORT SOLDE =====
function getReportForMonth(monthStr) {
    return App.extras.find(function(e) {
        return e.date.startsWith(monthStr) && e.source === '📅 Report' && e.isReport === true;
    });
}

function reportSoldeToNextMonth(fromMonth) {
    var d = getD(fromMonth);
    var R = computeMonthlyRevenue(fromMonth);
    var dep = d.reduce(function(s, x) { return s + x.montant; }, 0);
    var reste = R.totalReel - dep;
    if (reste <= 0) { showToast('⚠️ Aucun solde positif à reporter'); return; }
    var nextMonth = getNextMonth(fromMonth);
    var existing = getReportForMonth(nextMonth);
    if (existing) {
        showConfirm('Report déjà fait', 'Un report existe déjà pour ' + formatMonthLong(nextMonth) + '. Le remplacer ?', function() {
            App.extras = App.extras.filter(function(e) { return e.id !== existing.id; });
            createReport(fromMonth, nextMonth, reste);
        });
    } else {
        createReport(fromMonth, nextMonth, reste);
    }
}

function createReport(fromMonth, toMonth, montant) {
    var dateReport = toMonth + '-01';
    var extra = {
        id: Date.now(),
        date: dateReport,
        montant: montant,
        source: '📅 Report',
        description: 'Reste de ' + formatMonthLong(fromMonth),
        isReport: true
    };
    App.extras.push(extra);
    App.extras.sort(function(a, b) { return b.date.localeCompare(a.date); });
    saveData();
    if (typeof cloudAddExtra === 'function') cloudAddExtra(extra);
    renderAll();
    renderResume();
    showToast('✅ ' + formatM(montant) + ' reporté à ' + formatMonthShort(toMonth) + ' !');
}

// ===== EPARGNE =====
function openEpargneForm(mode) {
    epargneMode = mode;
    var label = document.getElementById('epargneFormLabel');
    var btn = document.getElementById('btnSubmitEpargne');
    var card = document.getElementById('formCardEpargne');
    if (mode === 'deposit') {
        label.textContent = '💶 Montant à épargner (€)';
        btn.textContent = '📥 Épargner';
        btn.className = 'submit-btn green';
    } else {
        label.textContent = '💶 Montant à retirer (€)';
        btn.textContent = '📤 Retirer';
        btn.className = 'submit-btn purple';
    }
    card.classList.remove('collapsed');
    setTimeout(function() { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
}

function addEpargne() {
    var montant = parseFloat(document.getElementById('montantEpargne').value);
    var raison = document.getElementById('raisonEpargne').value.trim();
    if (!montant || montant <= 0) { showToast('⚠️ Montant invalide'); return; }
    if (epargneMode === 'withdraw' && montant > getEpargneSolde()) {
        showToast('⚠️ Solde insuffisant'); return;
    }
    var entry = {
        id: Date.now(), date: todayStr(),
        montant: montant, type: epargneMode, raison: raison
    };
    App.epargne.push(entry);
    App.epargne.sort(function(a, b) { return b.date.localeCompare(a.date); });
    saveData();
    if (typeof cloudAddEpargne === 'function') cloudAddEpargne(entry);
    renderEpargne();
    renderDashboard();
    var msg = epargneMode === 'deposit' ? '📥 ' + formatM(montant) + ' épargné !' : '📤 ' + formatM(montant) + ' retiré !';
    showToast(msg);
    document.getElementById('montantEpargne').value = '';
    document.getElementById('raisonEpargne').value = '';
    document.getElementById('formCardEpargne').classList.add('collapsed');
}

function deleteEpargne(id) {
    showConfirm('Supprimer ?', 'Supprimer ce mouvement ?', function() {
        App.epargne = App.epargne.filter(function(e) { return e.id !== id; });
        saveData();
        if (typeof cloudDeleteEpargne === 'function') cloudDeleteEpargne(id);
        renderEpargne();
        renderDashboard();
        showToast('🗑️ Supprimé');
    });
}

// ===== SHOPPING LIST =====
function selectPrio(el, val) {
    document.querySelectorAll('.prio-btn').forEach(function(b) { b.classList.remove('active'); });
    el.classList.add('active');
}

function addShopItem() {
    var nom = document.getElementById('nomShop').value.trim();
    var prix = parseFloat(document.getElementById('prixShop').value) || 0;
    var note = document.getElementById('noteShop').value.trim();
    var prioBtn = document.querySelector('.prio-btn.active');
    var prio = prioBtn ? prioBtn.dataset.prio : 'normal';
    if (!nom) { showToast('⚠️ Entrez un article'); return; }
    var item = {
        id: Date.now(), nom: nom, prix: prix,
        prio: prio, note: note, bought: false, date: todayStr()
    };
    App.shopping.push(item);
    saveData();
    if (typeof cloudAddShopItem === 'function') cloudAddShopItem(item);
    renderShopping();
    showToast('✅ ' + nom + ' ajouté !');
    document.getElementById('nomShop').value = '';
    document.getElementById('prixShop').value = '';
    document.getElementById('noteShop').value = '';
    toggleForm('formCardShop', 'btnToggleFormShop');
}

function toggleShopBought(id) {
    var item = App.shopping.find(function(s) { return s.id === id; });
    if (item) {
        item.bought = !item.bought;
        saveData();
        if (typeof cloudAddShopItem === 'function') cloudAddShopItem(item);
        renderShopping();
    }
}

function deleteShopItem(id) {
    showConfirm('Supprimer ?', 'Supprimer cet article ?', function() {
        App.shopping = App.shopping.filter(function(s) { return s.id !== id; });
        saveData();
        if (typeof cloudDeleteShopItem === 'function') cloudDeleteShopItem(id);
        renderShopping();
        showToast('🗑️ Supprimé');
    });
}

function switchBudgetTab(sub) {
    document.querySelectorAll('#tab-depenses .sub-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.subtab === sub);
    });
    document.querySelectorAll('#tab-depenses .sub-tab-content').forEach(function(c) {
        c.classList.toggle('active', c.id === 'subtab-' + sub);
    });
    if (sub === 'shopping-list') renderShopping();
}

// ===== OBJECTIFS =====
function selectEmoji(el, val) {
    document.querySelectorAll('.emoji-chip').forEach(function(c) { c.classList.remove('active'); });
    el.classList.add('active');
    document.getElementById('emojiObjectif').value = val;
}

function calculateObjectif(objectif, mensuel, deja) {
    var restant = objectif - deja;
    if (restant <= 0) return { done: true, mois: 0, date: null, percent: 100 };
    if (mensuel <= 0) return { done: false, mois: Infinity, date: null, percent: (deja/objectif)*100 };
    var mois = Math.ceil(restant / mensuel);
    var now = new Date();
    var target = new Date(now.getFullYear(), now.getMonth() + mois, 1);
    var percent = (deja/objectif) * 100;
    return { done: false, mois: mois, date: target, percent: percent };
}

function updateCalcResult() {
    var objectif = parseFloat(document.getElementById('calcObjectif').value) || 0;
    var mensuel = parseFloat(document.getElementById('calcMensuel').value) || 0;
    var deja = parseFloat(document.getElementById('calcDeja').value) || 0;
    var result = document.getElementById('calcResult');
    var text = document.getElementById('calcResultText');
    var icon = result.querySelector('.calc-result-icon');
    if (objectif <= 0 || mensuel <= 0) {
        text.textContent = 'Entrez un montant et une épargne mensuelle';
        text.className = 'calc-result-text';
        icon.textContent = '⏱️';
        return;
    }
    var calc = calculateObjectif(objectif, mensuel, deja);
    if (calc.done) {
        icon.textContent = '🎉';
        text.innerHTML = '<strong>Objectif atteint !</strong><br>Vous avez déjà ' + formatM(deja) + ' sur ' + formatM(objectif);
        text.className = 'calc-result-text done';
    } else {
        icon.textContent = '⏱️';
        var dateStr = calc.date ? ' → <strong>' + formatMonthYear(calc.date) + '</strong>' : '';
        text.innerHTML = 'Il vous faudra <strong>' + formatDuration(calc.mois) + '</strong>' + dateStr +
            '<br><small style="color:var(--text2);font-size:0.75rem">(' + Math.round(calc.percent) + '% déjà atteint)</small>';
        text.className = 'calc-result-text';
    }
}

function addObjectif() {
    var nom = document.getElementById('nomObjectif').value.trim();
    var montant = parseFloat(document.getElementById('montantObjectif').value);
    var mensuel = parseFloat(document.getElementById('mensuelObjectif').value);
    var deja = parseFloat(document.getElementById('dejaObjectif').value) || 0;
    var emoji = document.getElementById('emojiObjectif').value || '🎯';
    if (!nom || !montant || montant <= 0 || !mensuel || mensuel <= 0) {
        showToast('⚠️ Remplissez tous les champs');
        return;
    }
    var obj = {
        id: Date.now(), nom: nom, montant: montant, mensuel: mensuel,
        deja: deja, emoji: emoji, dateCreation: todayStr()
    };
    App.objectifs.push(obj);
    saveData();
    if (typeof cloudAddObjectif === 'function') cloudAddObjectif(obj);
    renderObjectifs();
    showToast('✅ Objectif créé !');
    document.getElementById('nomObjectif').value = '';
    document.getElementById('montantObjectif').value = '';
    document.getElementById('mensuelObjectif').value = '';
    document.getElementById('dejaObjectif').value = '0';
    toggleForm('formCardObj', 'btnToggleFormObj');
}

function updateObjectifDeja(id, delta) {
    var obj = App.objectifs.find(function(o) { return o.id === id; });
    if (!obj) return;
    var newDeja = Math.max(0, obj.deja + delta);
    obj.deja = newDeja;
    saveData();
    if (typeof cloudAddObjectif === 'function') cloudAddObjectif(obj);
    renderObjectifs();
    if (delta > 0) showToast('✅ +' + formatM(delta) + ' ajouté');
    else showToast('➖ ' + formatM(Math.abs(delta)) + ' retiré');
}

function addCustomAmount(id) {
    var input = document.getElementById('dejaCustom' + id);
    if (!input) return;
    var val = parseFloat(input.value);
    if (isNaN(val) || val <= 0) { showToast('⚠️ Entrez un montant valide'); return; }
    updateObjectifDeja(id, val);
    input.value = '';
}

function subCustomAmount(id) {
    var input = document.getElementById('dejaCustom' + id);
    if (!input) return;
    var val = parseFloat(input.value);
    if (isNaN(val) || val <= 0) { showToast('⚠️ Entrez un montant valide'); return; }
    updateObjectifDeja(id, -val);
    input.value = '';
}

function editObjectifDeja(id) {
    var obj = App.objectifs.find(function(o) { return o.id === id; });
    if (!obj) return;
    var newVal = prompt('Nouveau montant déjà épargné (actuellement ' + formatM(obj.deja) + ') :', obj.deja);
    if (newVal === null) return;
    var val = parseFloat(newVal);
    if (isNaN(val) || val < 0) { showToast('⚠️ Montant invalide'); return; }
    obj.deja = val;
    saveData();
    if (typeof cloudAddObjectif === 'function') cloudAddObjectif(obj);
    renderObjectifs();
    showToast('✅ Montant mis à jour');
}

function deleteObjectif(id) {
    showConfirm('Supprimer ?', 'Supprimer cet objectif ?', function() {
        App.objectifs = App.objectifs.filter(function(o) { return o.id !== id; });
        saveData();
        if (typeof cloudDeleteObjectif === 'function') cloudDeleteObjectif(id);
        renderObjectifs();
        showToast('🗑️ Supprimé');
    });
}

// ===== DELETE FUNCTIONS =====
function deleteHoraire(id) {
    showConfirm('Supprimer ?', 'Supprimer cet horaire ?', function() {
        App.horaires = App.horaires.filter(function(h) { return h.id !== id; });
        saveData();
        if (typeof cloudDeleteHoraire === 'function') cloudDeleteHoraire(id);
        renderAll(); showToast('🗑️ Supprimé');
    });
}

function deleteDepense(id) {
    showConfirm('Supprimer ?', 'Supprimer cette dépense ?', function() {
        App.depenses = App.depenses.filter(function(d) { return d.id !== id; });
        saveData();
        if (typeof cloudDeleteDepense === 'function') cloudDeleteDepense(id);
        renderAll(); showToast('🗑️ Supprimé');
    });
}

function deletePaiement(id) {
    showConfirm('Supprimer ?', 'Supprimer ce paiement ?', function() {
        App.paiements = App.paiements.filter(function(p) { return p.id !== id; });
        saveData();
        if (typeof cloudDeletePaiement === 'function') cloudDeletePaiement(id);
        renderAll();
        renderPaiements();
        showToast('🗑️ Supprimé');
    });
}

function deleteExtra(id) {
    showConfirm('Supprimer ?', 'Supprimer ce revenu ?', function() {
        App.extras = App.extras.filter(function(e) { return e.id !== id; });
        saveData();
        if (typeof cloudDeleteExtra === 'function') cloudDeleteExtra(id);
        renderAll();
        renderExtras();
        showToast('🗑️ Supprimé');
    });
}

// ===== RENDER ALL =====
function renderAll() {
    renderDashboard();
    renderHoraires();
    renderQuickStatsH();
    renderDepenses();
    renderCatSummary();
    renderQuickStatsD();
    if (typeof renderEpargne === 'function') renderEpargne();
    if (typeof renderShopping === 'function') renderShopping();
    if (typeof renderObjectifs === 'function') renderObjectifs();
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
    var m = curM();
    var h = getH(m);
    var d = getD(m);
    var mins = h.reduce(function(s, x) { return s + x.minutes; }, 0);
    var R = computeMonthlyRevenue(m);
    var rev = R.salaireEstime ? R.totalEstime : R.totalReel;
    var dep = d.reduce(function(s, x) { return s + x.montant; }, 0);
    var sol = R.totalReel - dep;
    var jrs = new Set(h.map(function(x) { return x.date; })).size;

    document.getElementById('totalRevenus').textContent = formatM(rev);
    document.getElementById('totalDepenses').textContent = formatM(dep);
    document.getElementById('totalHeures').textContent = formatDuree(mins);
    document.getElementById('totalJours').textContent = jrs;

    var soldeEl = document.getElementById('solde');
    var badge = document.getElementById('soldeBadge');
    var bar = document.getElementById('soldeBar');

    if (sol > 0) {
        soldeEl.textContent = '+' + formatM(sol);
        soldeEl.style.setProperty('color', '#00d2a0', 'important');
        badge.textContent = '✅ Positif'; badge.className = 'solde-badge positive';
        bar.style.width = (rev > 0 ? Math.min((sol/rev)*100, 100) : 0) + '%';
        bar.style.background = 'linear-gradient(90deg,#00d2a0,#55efc4)';
    } else if (sol < 0) {
        soldeEl.textContent = '−' + formatM(Math.abs(sol));
        soldeEl.style.setProperty('color', '#ff6b6b', 'important');
        badge.textContent = '⚠️ Déficit'; badge.className = 'solde-badge negative';
        bar.style.width = '100%';
        bar.style.background = 'linear-gradient(90deg,#ff6b6b,#fd79a8)';
    } else {
        soldeEl.textContent = formatM(0);
        soldeEl.style.removeProperty('color');
        badge.textContent = '⚖️ Équilibre'; badge.className = 'solde-badge neutral';
        bar.style.width = '50%';
    }

    var bd = document.getElementById('revenusBreakdown');
    var badgeR = document.getElementById('revenusBadge');
    if (bd) {
        var breakdown = '';
        if (R.paieRecue > 0) {
            breakdown += '<div class="breakdown-line">💼 Paie reçue <strong>' + formatM(R.paieRecue) + '</strong></div>';
        } else if (R.gainPrevu > 0) {
            breakdown += '<div class="breakdown-line pending">⏳ Paie à recevoir <strong>' + formatM(R.gainPrevu) + '</strong></div>';
        }
        if (R.totalExtras > 0) {
            breakdown += '<div class="breakdown-line">🎁 Extras (' + R.nbExtras + ') <strong>+' + formatM(R.totalExtras) + '</strong></div>';
        }
        bd.innerHTML = breakdown;
        if (badgeR) {
            if (R.salaireEstime) { badgeR.textContent = 'Estimé'; badgeR.className = 'card-trend down'; }
            else if (R.paieRecue > 0) { badgeR.textContent = '✓ Reçu'; badgeR.className = 'card-trend up'; }
            else { badgeR.textContent = ''; badgeR.className = 'card-trend'; }
        }
    }

    var paieMois = getPaiementsForMonth(m);
    var totalPaie = paieMois.reduce(function(s, p) { return s + p.montant; }, 0);
    var paieBadge = document.getElementById('paieBadge');
    var paieRecueEl = document.getElementById('paieRecue');
    var paieLabel = document.getElementById('paieLabel');
    if (paieBadge && paieRecueEl && paieLabel) {
        paieRecueEl.textContent = formatM(totalPaie);
        if (totalPaie > 0) {
            paieBadge.textContent = '✅ Reçu';
            paieBadge.className = 'solde-badge positive';
            paieLabel.textContent = 'Paie reçue ce mois';
        } else {
            var prevMonth = getPreviousMonth(m);
            var prevGain = getH(prevMonth).reduce(function(s, x) { return s + x.gain; }, 0);
            if (prevGain > 0) {
                paieBadge.textContent = '⏳ À recevoir';
                paieBadge.className = 'solde-badge warning';
                paieRecueEl.textContent = formatM(prevGain);
                paieLabel.textContent = 'Paie prévue (non reçue)';
            } else {
                paieBadge.textContent = '—';
                paieBadge.className = 'solde-badge neutral';
                paieLabel.textContent = 'Aucune paie ce mois';
            }
        }
    }
}

// ===== RENDER HORAIRES =====
function renderHoraires() {
    var m = document.getElementById('filtreHoraireMois').value;
    var h = getH(m);
    var c = document.getElementById('listeHoraires');
    if (!h.length) { c.innerHTML = '<p class="empty-state">😴 Aucun horaire ce mois.</p>'; return; }
    c.innerHTML = h.map(function(x) {
        return '<div class="list-item"><div class="list-item-icon">📅</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + formatDate(x.date) + ' · ' + x.debut + ' – ' + x.fin + '</div>' +
            '<div class="list-item-sub">' + formatDuree(x.minutes) + (x.pause>0 ? ' ('+x.pause+'min pause)' : '') + (x.note ? ' · '+x.note : '') + '</div></div>' +
            '<div class="list-item-right"><span class="list-item-amount amount-green">' + formatM(x.gain) + '</span>' +
            '<button class="delete-btn" onclick="deleteHoraire('+x.id+')">🗑️</button></div></div>';
    }).join('');
}

function renderQuickStatsH() {
    var m = document.getElementById('filtreHoraireMois').value;
    var h = getH(m);
    document.getElementById('qsJoursH').textContent = new Set(h.map(function(x) { return x.date; })).size;
    document.getElementById('qsHeuresH').textContent = formatDuree(h.reduce(function(s, x) { return s + x.minutes; }, 0));
    document.getElementById('qsGainH').textContent = formatM(h.reduce(function(s, x) { return s + x.gain; }, 0));
}

// ===== RENDER DEPENSES =====
function renderDepenses() {
    var m = document.getElementById('filtreDepenseMois').value;
    var d = getD(m);
    var c = document.getElementById('listeDepenses');
    if (!d.length) { c.innerHTML = '<p class="empty-state">🎉 Aucune dépense !</p>'; return; }
    c.innerHTML = d.map(function(x) {
        return '<div class="list-item"><div class="list-item-icon">' + x.categorie.split(' ')[0] + '</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + (x.description || x.categorie) + '</div>' +
            '<div class="list-item-sub">' + x.categorie + ' · ' + formatDate(x.date) + '</div></div>' +
            '<div class="list-item-right"><span class="list-item-amount amount-red">-' + formatM(x.montant) + '</span>' +
            '<button class="delete-btn" onclick="deleteDepense('+x.id+')">🗑️</button></div></div>';
    }).join('');
}

function renderQuickStatsD() {
    var m = document.getElementById('filtreDepenseMois').value;
    var d = getD(m);
    var t = d.reduce(function(s, x) { return s + x.montant; }, 0);
    document.getElementById('qsNbD').textContent = d.length;
    document.getElementById('qsMoyD').textContent = formatM(d.length ? t/d.length : 0);
    document.getElementById('qsMaxD').textContent = formatM(d.length ? Math.max.apply(null, d.map(function(x) { return x.montant; })) : 0);
}

function renderCatSummary() {
    var m = document.getElementById('filtreDepenseMois').value;
    var d = getD(m);
    var c = document.getElementById('catSummary');
    if (!d.length) { c.innerHTML = ''; return; }
    var cats = {};
    d.forEach(function(x) { cats[x.categorie] = (cats[x.categorie] || 0) + x.montant; });
    var sorted = Object.entries(cats).sort(function(a, b) { return b[1] - a[1]; });
    var max = sorted[0][1];
    c.innerHTML = sorted.map(function(entry, i) {
        var cat = entry[0], amt = entry[1];
        return '<div class="cat-row"><span class="cat-name">' + cat + '</span>' +
            '<div class="cat-track"><div class="cat-fill" style="width:' + ((amt/max)*100) + '%;background:' + CAT_COLORS[i%CAT_COLORS.length] + '"></div></div>' +
            '<span class="cat-amount">' + formatM(amt) + '</span></div>';
    }).join('');
}

// ===== RENDER PAIEMENTS =====
function renderPaiements() {
    var currentM = curM();
    var prevM = getPreviousMonth(currentM);
    var nextM = getNextMonth(currentM);
    var gainActuel = getH(currentM).reduce(function(s, x) { return s + x.gain; }, 0);
    var gainPrec = getH(prevM).reduce(function(s, x) { return s + x.gain; }, 0);

    var pa = document.getElementById('previsionActuel');
    if (!pa) return;

    pa.textContent = formatM(gainActuel);
    document.getElementById('previsionActuelSub').textContent = 'Sera reçu en ' + formatMonthShort(nextM);
    document.getElementById('previsionPrecedent').textContent = formatM(gainPrec);
    document.getElementById('previsionPrecedentSub').textContent = 'À recevoir en ' + formatMonthShort(currentM);

    var btn = document.getElementById('btnQuickPaie');
    var ajustement = document.getElementById('paieAjustement');
    var inputAjuste = document.getElementById('montantPaieAjuste');
    if (gainPrec > 0) {
        btn.style.display = 'block';
        if (ajustement) ajustement.style.display = 'block';
        if (inputAjuste && (!inputAjuste.value || parseFloat(inputAjuste.value) === 0)) {
            inputAjuste.value = gainPrec.toFixed(2);
        }
        if (inputAjuste) inputAjuste.dataset.original = gainPrec.toFixed(2);
        updateDiffHint();
        btn.textContent = '✨ Enregistrer pour ' + formatMonthShort(currentM);
    } else {
        btn.style.display = 'none';
        if (ajustement) ajustement.style.display = 'none';
    }

    var year = parseInt(document.getElementById('filtreAnneeP').value);
    var paiements = getPaiementsForYear(year);
    var total = paiements.reduce(function(s, p) { return s + p.montant; }, 0);
    document.getElementById('qsNbPaie').textContent = paiements.length;
    document.getElementById('qsTotalPaie').textContent = formatM(total);
    document.getElementById('qsMoyPaie').textContent = formatM(paiements.length ? total/paiements.length : 0);

    var c = document.getElementById('listePaiements');
    if (!paiements.length) { c.innerHTML = '<p class="empty-state">💸 Aucun paiement.</p>'; return; }
    c.innerHTML = paiements.map(function(p) {
        return '<div class="list-item"><div class="list-item-icon">💰</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + (p.description || 'Paie ' + formatMonthLong(p.mois)) + '</div>' +
            '<div class="list-item-sub">Reçu en ' + formatMonthLong(p.mois) + '</div></div>' +
            '<div class="list-item-right"><span class="list-item-amount amount-green">' + formatM(p.montant) + '</span>' +
            '<button class="delete-btn" onclick="deletePaiement('+p.id+')">🗑️</button></div></div>';
    }).join('');
}

// ===== RENDER EXTRAS =====
function renderExtras() {
    var m = document.getElementById('filtreExtraMois');
    if (!m) return;
    var monthStr = m.value;
    var extras = getExtrasForMonth(monthStr);
    var total = extras.reduce(function(s, e) { return s + e.montant; }, 0);

    document.getElementById('qsNbE').textContent = extras.length;
    document.getElementById('qsTotalE').textContent = formatM(total);
    document.getElementById('qsMoyE').textContent = formatM(extras.length ? total/extras.length : 0);

    var summary = document.getElementById('sourceSummary');
    if (extras.length > 0) {
        var sources = {};
        extras.forEach(function(e) { sources[e.source] = (sources[e.source] || 0) + e.montant; });
        var sorted = Object.entries(sources).sort(function(a, b) { return b[1] - a[1]; });
        var max = sorted[0][1];
        summary.innerHTML = sorted.map(function(entry, i) {
            var src = entry[0], amt = entry[1];
            return '<div class="cat-row"><span class="cat-name">' + src + '</span>' +
                '<div class="cat-track"><div class="cat-fill" style="width:' + ((amt/max)*100) + '%;background:' + CAT_COLORS[i%CAT_COLORS.length] + '"></div></div>' +
                '<span class="cat-amount" style="color:var(--green)">' + formatM(amt) + '</span></div>';
        }).join('');
    } else {
        summary.innerHTML = '';
    }

    var c = document.getElementById('listeExtras');
    if (!extras.length) { c.innerHTML = '<p class="empty-state">🎁 Aucun revenu ce mois.</p>'; return; }
    c.innerHTML = extras.map(function(e) {
        return '<div class="list-item"><div class="list-item-icon">' + e.source.split(' ')[0] + '</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + (e.description || e.source) + '</div>' +
            '<div class="list-item-sub">' + e.source + ' · ' + formatDate(e.date) + '</div></div>' +
            '<div class="list-item-right"><span class="list-item-amount amount-green">+' + formatM(e.montant) + '</span>' +
            '<button class="delete-btn" onclick="deleteExtra('+e.id+')">🗑️</button></div></div>';
    }).join('');
}

// ===== RENDER EPARGNE =====
function renderEpargne() {
    var solde = getEpargneSolde();
    var soldeEl = document.getElementById('epargneSolde');
    if (soldeEl) soldeEl.textContent = formatM(solde);
    var m = document.getElementById('filtreEpargneMois');
    if (!m) return;
    var mStr = m.value;
    var entries = getEpargneForMonth(mStr);
    var depots = entries.filter(function(e) { return e.type === 'deposit'; });
    var retraits = entries.filter(function(e) { return e.type === 'withdraw'; });
    var totalDepots = depots.reduce(function(s, e) { return s + e.montant; }, 0);
    var totalRetraits = retraits.reduce(function(s, e) { return s + e.montant; }, 0);
    document.getElementById('qsNbEpargne').textContent = entries.length;
    document.getElementById('qsDepotEpargne').textContent = formatM(totalDepots);
    document.getElementById('qsRetraitEpargne').textContent = formatM(totalRetraits);
    var c = document.getElementById('listeEpargne');
    if (!entries.length) { c.innerHTML = '<p class="empty-state">🏦 Aucun mouvement ce mois.</p>'; return; }
    c.innerHTML = entries.map(function(e) {
        var icon = e.type === 'deposit' ? '📥' : '📤';
        var cls = e.type === 'deposit' ? 'amount-green' : 'amount-red';
        var sign = e.type === 'deposit' ? '+' : '-';
        return '<div class="list-item"><div class="list-item-icon">' + icon + '</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + (e.raison || (e.type === 'deposit' ? 'Dépôt' : 'Retrait')) + '</div>' +
            '<div class="list-item-sub">' + formatDate(e.date) + '</div></div>' +
            '<div class="list-item-right"><span class="list-item-amount ' + cls + '">' + sign + formatM(e.montant) + '</span>' +
            '<button class="delete-btn" onclick="deleteEpargne(' + e.id + ')">🗑️</button></div></div>';
    }).join('');
}

// ===== RENDER SHOPPING =====
function renderShopping() {
    var summary = document.getElementById('shopSummary');
    var c = document.getElementById('listeShop');
    if (!summary || !c) return;
    var remaining = App.shopping.filter(function(s) { return !s.bought; });
    var bought = App.shopping.filter(function(s) { return s.bought; });
    var totalRemaining = remaining.reduce(function(s, i) { return s + i.prix; }, 0);
    if (App.shopping.length > 0) {
        summary.innerHTML = '<div><span class="shop-total-label">🛒 ' + remaining.length + ' article(s) restant(s)</span></div><span class="shop-total-amount">' + formatM(totalRemaining) + '</span>';
    } else { summary.innerHTML = ''; }
    if (!App.shopping.length) { c.innerHTML = '<p class="empty-state">🛒 Liste vide.</p>'; return; }
    var prioOrder = { urgent: 0, normal: 1, envie: 2 };
    var sorted = remaining.sort(function(a, b) { return (prioOrder[a.prio] || 1) - (prioOrder[b.prio] || 1); });
    var allItems = sorted.concat(bought);
    c.innerHTML = allItems.map(function(s) {
        var boughtClass = s.bought ? ' bought' : '';
        var checkClass = s.bought ? ' checked' : '';
        var checkIcon = s.bought ? '✓' : '';
        var prioTag = '';
        if (s.prio === 'urgent') prioTag = '<span class="prio-tag urgent">🔴 Urgent</span>';
        else if (s.prio === 'envie') prioTag = '<span class="prio-tag envie">💫 Envie</span>';
        else prioTag = '<span class="prio-tag normal">📦 Normal</span>';
        return '<div class="shop-item' + boughtClass + '">' +
            '<button class="shop-checkbox' + checkClass + '" onclick="toggleShopBought(' + s.id + ')">' + checkIcon + '</button>' +
            '<div class="shop-item-body"><div class="shop-item-name">' + s.nom + '</div>' +
            (s.note ? '<div class="shop-item-note">' + s.note + '</div>' : '') + '</div>' +
            '<div class="shop-item-right">' + (s.prix > 0 ? '<span class="shop-item-price">' + formatM(s.prix) + '</span>' : '') +
            prioTag +
            '<button class="delete-btn" onclick="deleteShopItem(' + s.id + ')">🗑️</button></div></div>';
    }).join('');
}

// ===== RENDER OBJECTIFS =====
function renderObjectifs() {
    var c = document.getElementById('listeObjectifs');
    if (!c) return;
    if (!App.objectifs.length) {
        c.innerHTML = '<p class="empty-state">🎯 Aucun objectif défini.<br><small>Créez-en un pour planifier vos économies !</small></p>';
        return;
    }
    c.innerHTML = App.objectifs.map(function(o) {
        var calc = calculateObjectif(o.montant, o.mensuel, o.deja);
        var doneClass = calc.done ? ' done' : '';
        var fillClass = calc.done ? ' done' : '';
        var percentClass = calc.done ? ' done' : '';
        var percentTxt = Math.min(100, Math.round(calc.percent));
        var dateStr = calc.date ? formatMonthYear(calc.date) : '—';
        var badge = calc.done ? '<span class="done-badge">✅ Atteint !</span>' : '';
        return '<div class="objectif-card' + doneClass + '">' +
            '<div class="objectif-header">' +
                '<div class="objectif-emoji">' + o.emoji + '</div>' +
                '<div class="objectif-info">' +
                    '<div class="objectif-nom">' + o.nom + '</div>' +
                    '<div class="objectif-cible">Objectif : ' + formatM(o.montant) + '</div>' +
                '</div>' +
                '<div class="objectif-actions">' + badge +
                    '<button class="obj-action-btn" onclick="editObjectifDeja(' + o.id + ')" title="Modifier">✏️</button>' +
                    '<button class="obj-action-btn danger" onclick="deleteObjectif(' + o.id + ')">🗑️</button>' +
                '</div>' +
            '</div>' +
            '<div class="objectif-progress">' +
                '<div class="progress-track"><div class="progress-fill' + fillClass + '" style="width:' + percentTxt + '%"></div></div>' +
                '<div class="progress-info">' +
                    '<span class="progress-percent' + percentClass + '">' + percentTxt + '%</span>' +
                    '<span class="progress-amount">' + formatM(o.deja) + ' / ' + formatM(o.montant) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="objectif-stats">' +
                '<div class="obj-stat">' +
                    '<span class="obj-stat-icon">💰</span>' +
                    '<div class="obj-stat-text"><strong>' + formatM(o.mensuel) + '</strong><small>par mois</small></div>' +
                '</div>' +
                '<div class="obj-stat">' +
                    '<span class="obj-stat-icon">🗓️</span>' +
                    '<div class="obj-stat-text"><strong>' + (calc.done ? '—' : formatDuration(calc.mois)) + '</strong><small>' + (calc.done ? 'Terminé' : dateStr) + '</small></div>' +
                '</div>' +
            '</div>' +
            (calc.done ? '' : '<div class="deja-adjust-full">' +
                '<div class="deja-quick-buttons">' +
                    '<button class="deja-quick-btn" onclick="updateObjectifDeja(' + o.id + ',10)">+10€</button>' +
                    '<button class="deja-quick-btn" onclick="updateObjectifDeja(' + o.id + ',50)">+50€</button>' +
                    '<button class="deja-quick-btn" onclick="updateObjectifDeja(' + o.id + ',100)">+100€</button>' +
                    '<button class="deja-quick-btn primary" onclick="updateObjectifDeja(' + o.id + ',' + o.mensuel + ')">+' + formatM(o.mensuel) + '</button>' +
                '</div>' +
                '<div class="deja-custom">' +
                    '<input type="number" id="dejaCustom' + o.id + '" placeholder="Montant..." step="0.01" min="0" inputmode="decimal">' +
                    '<button class="deja-add-btn" onclick="addCustomAmount(' + o.id + ')">+ Ajouter</button>' +
                    '<button class="deja-sub-btn" onclick="subCustomAmount(' + o.id + ')">− Retirer</button>' +
                '</div>' +
            '</div>') +
        '</div>';
    }).join('');
}

// ===== RENDER RESUME =====
function renderResume() {
    var m = document.getElementById('filtreResumeMois').value;
    if (!m) return;
    var h = getH(m);
    var d = getD(m);
    var R = computeMonthlyRevenue(m);
    var rev = R.salaireEstime ? R.totalEstime : R.totalReel;
    var dep = d.reduce(function(s, x) { return s + x.montant; }, 0);
    var sol = R.totalReel - dep;
    var jrs = new Set(h.map(function(x) { return x.date; })).size;
    var mins = h.reduce(function(s, x) { return s + x.minutes; }, 0);

    document.getElementById('bilanRevenus').textContent = formatM(rev);
    document.getElementById('bilanDepenses').textContent = formatM(dep);

    var rd = document.getElementById('revenusDetail');
    if (rd) {
        var html = '';
        var prevMonth = getPreviousMonth(m);
        if (R.paieRecue > 0 || R.gainPrevu > 0 || R.totalExtras > 0) {
            html += '<div class="revenus-detail-title">💰 Détail des revenus</div>';
            if (R.paieRecue > 0) {
                html += '<div class="revenus-detail-row"><span class="rd-label">💼 Salaire reçu (' + R.nbPaies + ')</span><span class="rd-amount">+' + formatM(R.paieRecue) + '</span></div>';
            } else if (R.gainPrevu > 0) {
                html += '<div class="revenus-detail-row pending"><span class="rd-label">💼 Salaire (heures ' + formatMonthShort(prevMonth) + ') <span class="rd-pending-badge">⏳ à recevoir</span></span><span class="rd-amount">+' + formatM(R.gainPrevu) + '</span></div>';
            }
            if (R.totalExtras > 0) {
                html += '<div class="revenus-detail-row"><span class="rd-label">🎁 Revenus supplémentaires (' + R.nbExtras + ')</span><span class="rd-amount">+' + formatM(R.totalExtras) + '</span></div>';
            }
            html += '<div class="revenus-detail-row"><span class="rd-label">💵 <strong>Total revenus</strong></span><span class="rd-amount">' + formatM(rev) + '</span></div>';
        }
        rd.innerHTML = html;
    }

    var tot = rev + dep;
    document.getElementById('progressGreen').style.width = (tot > 0 ? (rev/tot)*100 : 50) + '%';
    document.getElementById('progressRed').style.width = (tot > 0 ? (dep/tot)*100 : 50) + '%';
    var se = document.getElementById('bilanSolde');
    se.textContent = (sol >= 0 ? '' : '−') + formatM(Math.abs(sol));
    se.className = sol >= 0 ? 'positive' : 'negative';
    document.getElementById('bilanPercent').textContent = rev > 0 ? Math.round((dep/rev)*100) + '% dépensé' : 'Aucun revenu';
    document.getElementById('statJours').textContent = jrs;
    document.getElementById('statHeures').textContent = formatDuree(mins);
    document.getElementById('statNbDep').textContent = d.length;
    document.getElementById('statMoyDep').textContent = formatM(d.length ? dep/d.length : 0);

    var ct = document.getElementById('barChart');
    var parts = m.split('-').map(Number);
    var y = parts[0], mo = parts[1];
    var days = new Date(y, mo, 0).getDate();
    var daily = {};
    d.forEach(function(x) {
        var day = parseInt(x.date.split('-')[2]);
        daily[day] = (daily[day] || 0) + x.montant;
    });
    var dailyVals = Object.values(daily);
    var mx = dailyVals.length ? Math.max.apply(null, dailyVals) : 1;
    var htmlChart = '';
    for (var i = 1; i <= days; i++) {
        var v = daily[i] || 0;
        var ht = v > 0 ? Math.max((v/mx)*80, 4) : 0;
        htmlChart += '<div class="bar-col"><div class="bar-fill" style="height:' + ht + 'px" title="' + i + '/' + mo + ': ' + formatM(v) + '"></div><span class="bar-label">' + i + '</span></div>';
    }
    ct.innerHTML = htmlChart || '<p style="color:var(--text2);text-align:center;width:100%">Aucune dépense</p>';

    var tp = document.getElementById('topDepenses');
    if (!d.length) { tp.innerHTML = '<p style="color:var(--text2);text-align:center;padding:12px">Aucune</p>'; }
    else {
        tp.innerHTML = d.slice().sort(function(a, b) { return b.montant - a.montant; }).slice(0, 5).map(function(x) {
            return '<div class="top-dep-item"><span>' + x.categorie + (x.description ? ' · ' + x.description : '') + '</span><strong>-' + formatM(x.montant) + '</strong></div>';
        }).join('');
    }

    var btnReport = document.getElementById('btnReportSolde');
    var btnText = document.getElementById('btnReportText');
    var reportHint = document.getElementById('reportHint');
    if (btnReport && btnText && reportHint) {
        var nextM = getNextMonth(m);
        var reste = sol;
        var existingReport = getReportForMonth(nextM);
        if (existingReport) {
            btnReport.style.display = 'block';
            btnReport.disabled = false;
            btnReport.className = 'submit-btn outline';
            btnText.textContent = '🔄 Remplacer le report (' + formatM(existingReport.montant) + ')';
            reportHint.textContent = '✅ Déjà reporté à ' + formatMonthShort(nextM);
            reportHint.className = 'report-hint done';
        } else if (reste > 0) {
            btnReport.style.display = 'block';
            btnReport.disabled = false;
            btnReport.className = 'submit-btn purple';
            btnText.textContent = '📅 Reporter ' + formatM(reste) + ' à ' + formatMonthShort(nextM);
            reportHint.textContent = 'Ajoute votre reste au mois suivant';
            reportHint.className = 'report-hint';
        } else if (reste < 0) {
            btnReport.style.display = 'block';
            btnReport.disabled = true;
            btnReport.className = 'submit-btn outline';
            btnText.textContent = '⚠️ Déficit - Impossible de reporter';
            reportHint.textContent = 'Vous êtes en déficit ce mois-ci';
            reportHint.className = 'report-hint';
        } else {
            btnReport.style.display = 'block';
            btnReport.disabled = true;
            btnReport.className = 'submit-btn outline';
            btnText.textContent = '⚖️ Équilibre - Rien à reporter';
            reportHint.textContent = '';
            reportHint.className = 'report-hint';
        }
    }
}

// ===== NAVIGATION =====
function goTab(tab) {
    App.activeTab = tab;
    document.querySelectorAll('.nav-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-section').forEach(function(s) {
        s.classList.toggle('active', s.id === 'tab-' + tab);
    });
    document.getElementById('mainScroll').scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'resume' && typeof renderResume === 'function') renderResume();
    if (tab === 'depenses') {
        if (typeof renderCatSummary === 'function') renderCatSummary();
        if (typeof renderShopping === 'function') renderShopping();
    }
    if (tab === 'paiements') {
        if (typeof renderPaiements === 'function') renderPaiements();
        if (typeof renderExtras === 'function') renderExtras();
    }
    if (tab === 'epargne' && typeof renderEpargne === 'function') renderEpargne();
    if (tab === 'objectifs' && typeof renderObjectifs === 'function') renderObjectifs();
}

function switchSubTab(sub) {
    document.querySelectorAll('.sub-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.subtab === sub);
    });
    document.querySelectorAll('.sub-tab-content').forEach(function(c) {
        c.classList.toggle('active', c.id === 'subtab-' + sub);
    });
    if (sub === 'extra') renderExtras();
}

function toggleForm(cardId, btnId) {
    var card = document.getElementById(cardId);
    var btn = document.getElementById(btnId);
    var collapsed = card.classList.contains('collapsed');
    card.classList.toggle('collapsed', !collapsed);
    btn.textContent = collapsed ? '✕ Fermer' : '+ Ajouter';
    if (collapsed) setTimeout(function() { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
}

// ===== CATEGORIES BUILD =====
function buildCategoryGrid() {
    document.getElementById('catGrid').innerHTML = CATEGORIES.map(function(c) {
        return '<div class="cat-chip" onclick="selectCat(this,\'' + c.emoji + ' ' + c.label + '\')"><span class="cat-emoji">' + c.emoji + '</span>' + c.label + '</div>';
    }).join('');
    var extraGrid = document.getElementById('extraGrid');
    if (extraGrid) {
        extraGrid.innerHTML = SOURCES_EXTRA.map(function(c) {
            return '<div class="cat-chip" onclick="selectExtraSource(this,\'' + c.emoji + ' ' + c.label + '\')"><span class="cat-emoji">' + c.emoji + '</span>' + c.label + '</div>';
        }).join('');
    }
}

function selectCat(el, val) {
    document.querySelectorAll('#catGrid .cat-chip').forEach(function(c) { c.classList.remove('selected'); });
    el.classList.add('selected');
    document.getElementById('categorieDepense').value = val;
}

function selectExtraSource(el, val) {
    document.querySelectorAll('#extraGrid .cat-chip').forEach(function(c) { c.classList.remove('selected'); });
    el.classList.add('selected');
    document.getElementById('sourceExtra').value = val;
}

// ===== PREVIEW =====
function updatePreview() {
    var debut = document.getElementById('heureDebut').value;
    var fin = document.getElementById('heureFin').value;
    var pause = parseInt(document.getElementById('pauseMinutes').value) || 0;
    if (debut && fin) {
        var mins = calcMinutes(debut, fin, pause);
        document.getElementById('previewDuree').textContent = formatDuree(mins);
        document.getElementById('previewGain').textContent = formatM((mins/60) * App.settings.tauxHoraire);
    }
}

// ===== DEFAULT DATES =====
function setDefaultDates() {
    var today = todayStr();
    var month = today.substring(0, 7);
    document.getElementById('dateHoraire').value = today;
    document.getElementById('dateDepense').value = today;
    var mp = document.getElementById('moisPaiement');
    if (mp) mp.value = month;
    var de = document.getElementById('dateExtra');
    if (de) de.value = today;
    var fem = document.getElementById('filtreExtraMois');
    if (fem) fem.value = month;
    var fep = document.getElementById('filtreEpargneMois');
    if (fep) fep.value = month;
    document.getElementById('filtreHoraireMois').value = month;
    document.getElementById('filtreDepenseMois').value = month;
    document.getElementById('filtreResumeMois').value = month;
    var fa = document.getElementById('filtreAnneeP');
    if (fa) fa.value = new Date().getFullYear();
    document.getElementById('tauxHoraire').value = App.settings.tauxHoraire;
    document.querySelectorAll('.devise-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.devise === App.settings.devise);
    });
    document.querySelectorAll('.arrondi-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.arrondi === (App.settings.arrondi || 'none'));
    });
    document.querySelectorAll('.theme-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.theme === (App.settings.theme || 'purple'));
    });
}

// ===== INIT NAVIGATION =====
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { goTab(btn.dataset.tab); });
    });
}

// ===== INIT FORMS =====
function initForms() {
    document.getElementById('formHoraire').addEventListener('submit', function(e) { e.preventDefault(); addHoraire(); });
    ['heureDebut', 'heureFin', 'pauseMinutes'].forEach(function(id) {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    document.getElementById('formDepense').addEventListener('submit', function(e) { e.preventDefault(); addDepense(); });

    var fp = document.getElementById('formPaiement');
    if (fp) fp.addEventListener('submit', function(e) { e.preventDefault(); addPaiement(); });

    var qp = document.getElementById('btnQuickPaie');
    if (qp) qp.addEventListener('click', quickAddPaiement);

    var inputAjuste = document.getElementById('montantPaieAjuste');
    if (inputAjuste) inputAjuste.addEventListener('input', updateDiffHint);

    var pMinus = document.getElementById('paieMinus');
    if (pMinus) pMinus.addEventListener('click', function() {
        var i = document.getElementById('montantPaieAjuste');
        var v = parseFloat(i.value) - 10;
        if (v >= 0) i.value = v.toFixed(2);
        updateDiffHint();
    });

    var pPlus = document.getElementById('paiePlus');
    if (pPlus) pPlus.addEventListener('click', function() {
        var i = document.getElementById('montantPaieAjuste');
        i.value = (parseFloat(i.value) + 10).toFixed(2);
        updateDiffHint();
    });

    document.querySelectorAll('.quick-adjust-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var i = document.getElementById('montantPaieAjuste');
            var original = parseFloat(i.dataset.original) || 0;
            var adj = btn.dataset.adj;
            if (adj === 'reset') {
                i.value = original.toFixed(2);
            } else {
                var pct = parseFloat(adj);
                i.value = (original * (1 + pct/100)).toFixed(2);
            }
            updateDiffHint();
        });
    });

    var fe = document.getElementById('formExtra');
    if (fe) fe.addEventListener('submit', function(e) { e.preventDefault(); addExtra(); });

    var fep = document.getElementById('formEpargne');
    if (fep) fep.addEventListener('submit', function(e) { e.preventDefault(); addEpargne(); });

    var dep = document.getElementById('btnEpargneDeposit');
    if (dep) dep.addEventListener('click', function() { openEpargneForm('deposit'); });
    var wit = document.getElementById('btnEpargneWithdraw');
    if (wit) wit.addEventListener('click', function() { openEpargneForm('withdraw'); });

    var fsh = document.getElementById('formShop');
    if (fsh) fsh.addEventListener('submit', function(e) { e.preventDefault(); addShopItem(); });

    var fobj = document.getElementById('formObjectif');
    if (fobj) fobj.addEventListener('submit', function(e) { e.preventDefault(); addObjectif(); });

    ['calcObjectif', 'calcMensuel', 'calcDeja'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCalcResult);
    });
}

// ===== INIT TAB TOGGLES =====
function initTabs() {
    document.getElementById('btnToggleFormH').addEventListener('click', function() { toggleForm('formCardH', 'btnToggleFormH'); });
    document.getElementById('btnToggleFormD').addEventListener('click', function() { toggleForm('formCardD', 'btnToggleFormD'); });
    var btnP = document.getElementById('btnToggleFormP');
    if (btnP) btnP.addEventListener('click', function() { toggleForm('formCardP', 'btnToggleFormP'); });
    var btnE = document.getElementById('btnToggleFormE');
    if (btnE) btnE.addEventListener('click', function() { toggleForm('formCardE', 'btnToggleFormE'); });
    var btnShop = document.getElementById('btnToggleFormShop');
    if (btnShop) btnShop.addEventListener('click', function() { toggleForm('formCardShop', 'btnToggleFormShop'); });
    var btnObj = document.getElementById('btnToggleFormObj');
    if (btnObj) btnObj.addEventListener('click', function() { toggleForm('formCardObj', 'btnToggleFormObj'); });
}

// ===== INIT MONTH FILTERS =====
function initMonthFilters() {
    document.getElementById('filtreHoraireMois').addEventListener('change', function() {
        renderHoraires(); renderQuickStatsH();
    });
    document.getElementById('prevH').addEventListener('click', function() {
        changeMonth('filtreHoraireMois', -1, function() { renderHoraires(); renderQuickStatsH(); });
    });
    document.getElementById('nextH').addEventListener('click', function() {
        changeMonth('filtreHoraireMois', 1, function() { renderHoraires(); renderQuickStatsH(); });
    });

    document.getElementById('filtreDepenseMois').addEventListener('change', function() {
        renderDepenses(); renderCatSummary(); renderQuickStatsD();
    });
    document.getElementById('prevD').addEventListener('click', function() {
        changeMonth('filtreDepenseMois', -1, function() { renderDepenses(); renderCatSummary(); renderQuickStatsD(); });
    });
    document.getElementById('nextD').addEventListener('click', function() {
        changeMonth('filtreDepenseMois', 1, function() { renderDepenses(); renderCatSummary(); renderQuickStatsD(); });
    });

    document.getElementById('filtreResumeMois').addEventListener('change', renderResume);
    document.getElementById('prevR').addEventListener('click', function() { changeMonth('filtreResumeMois', -1, renderResume); });
    document.getElementById('nextR').addEventListener('click', function() { changeMonth('filtreResumeMois', 1, renderResume); });

    var fa = document.getElementById('filtreAnneeP');
    if (fa) {
        fa.addEventListener('change', renderPaiements);
        document.getElementById('prevYearP').addEventListener('click', function() { fa.value = parseInt(fa.value) - 1; renderPaiements(); });
        document.getElementById('nextYearP').addEventListener('click', function() { fa.value = parseInt(fa.value) + 1; renderPaiements(); });
    }

    var fem = document.getElementById('filtreExtraMois');
    if (fem) {
        fem.addEventListener('change', renderExtras);
        document.getElementById('prevE').addEventListener('click', function() { changeMonth('filtreExtraMois', -1, renderExtras); });
        document.getElementById('nextE').addEventListener('click', function() { changeMonth('filtreExtraMois', 1, renderExtras); });
    }

    var fepM = document.getElementById('filtreEpargneMois');
    if (fepM) {
        fepM.addEventListener('change', renderEpargne);
        document.getElementById('prevEpargne').addEventListener('click', function() { changeMonth('filtreEpargneMois', -1, renderEpargne); });
        document.getElementById('nextEpargne').addEventListener('click', function() { changeMonth('filtreEpargneMois', 1, renderEpargne); });
    }
}

// ===== INIT PIN =====
function initPinSettings() {
    updatePinStatus();
    document.getElementById('btnSetPin').addEventListener('click', function() { openPinModal('setup'); });
    document.getElementById('btnChangePin').addEventListener('click', function() { openPinModal('change-verify'); });
    document.getElementById('btnRemovePin').addEventListener('click', function() { openPinModal('remove'); });
}

// ===== INIT THEME =====
function initThemeSelector() {
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var theme = btn.dataset.theme;
            App.settings.theme = theme;
            applyTheme(theme);
            saveData();
            if (typeof cloudSaveSettings === 'function') cloudSaveSettings();
            var name = btn.querySelector('.theme-name').textContent;
            showToast('🎨 Thème "' + name + '" activé');
        });
    });
}

// ===== INIT SETTINGS =====
function initSettings() {
    initThemeSelector();

    var btnReport = document.getElementById('btnReportSolde');
    if (btnReport) {
        btnReport.addEventListener('click', function() {
            var m = document.getElementById('filtreResumeMois').value;
            if (m) reportSoldeToNextMonth(m);
        });
    }

    document.getElementById('tauxPlus').addEventListener('click', function() {
        var i = document.getElementById('tauxHoraire');
        i.value = (parseFloat(i.value) + 0.5).toFixed(2);
    });
    document.getElementById('tauxMinus').addEventListener('click', function() {
        var i = document.getElementById('tauxHoraire');
        var v = parseFloat(i.value) - 0.5;
        if (v >= 0) i.value = v.toFixed(2);
    });

    document.querySelectorAll('.devise-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.devise-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });

    document.querySelectorAll('.arrondi-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.arrondi-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });

    document.getElementById('btnSaveSettings').addEventListener('click', function() {
        var oldArrondi = App.settings.arrondi || 'none';
        App.settings.tauxHoraire = parseFloat(document.getElementById('tauxHoraire').value) || 0;
        var activeDevise = document.querySelector('.devise-btn.active');
        App.settings.devise = activeDevise ? activeDevise.dataset.devise : '€';
        var activeArrondi = document.querySelector('.arrondi-btn.active');
        App.settings.arrondi = activeArrondi ? activeArrondi.dataset.arrondi : 'none';

        if (oldArrondi !== App.settings.arrondi) {
            App.horaires.forEach(function(h) {
                if (h.debut && h.fin) {
                    var dh = h.debut.split(':').map(Number);
                    var fh = h.fin.split(':').map(Number);
                    var t = (fh[0]*60+fh[1]) - (dh[0]*60+dh[1]);
                    if (t < 0) t += 1440;
                    t = Math.max(0, t - (h.pause || 0));
                    h.minutes = applyArrondi(t);
                }
            });
        }

        App.horaires.forEach(function(h) {
            h.gain = (h.minutes/60) * App.settings.tauxHoraire;
        });

        saveData();
        if (typeof cloudSaveSettings === 'function') cloudSaveSettings();
        if (typeof currentUser !== 'undefined' && currentUser && !isGuestMode) {
            App.horaires.forEach(function(h) {
                if (typeof cloudAddHoraire === 'function') cloudAddHoraire(h);
            });
        }
        renderAll();
        showToast('⚙️ Sauvegardé !');
    });

    document.getElementById('btnExport').addEventListener('click', function() {
        var data = {
            horaires: App.horaires,
            depenses: App.depenses,
            paiements: App.paiements,
            extras: App.extras,
            epargne: App.epargne,
            shopping: App.shopping,
            objectifs: App.objectifs,
            settings: App.settings,
            exportDate: new Date().toISOString()
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'monbudget_' + todayStr() + '.json';
        a.click();
        showToast('📤 Exporté !');
    });

    document.getElementById('btnImport').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var data = JSON.parse(ev.target.result);
                if (data.horaires) App.horaires = data.horaires;
                if (data.depenses) App.depenses = data.depenses;
                if (data.paiements) App.paiements = data.paiements;
                if (data.extras) App.extras = data.extras;
                if (data.epargne) App.epargne = data.epargne;
                if (data.shopping) App.shopping = data.shopping;
                if (data.objectifs) App.objectifs = data.objectifs;
                if (data.settings) App.settings = Object.assign({}, App.settings, data.settings);
                saveData();
                setDefaultDates();
                renderAll();
                if (typeof currentUser !== 'undefined' && currentUser && !isGuestMode) {
                    localStorage.removeItem('mb_uploaded_' + currentUser.uid);
                    if (typeof uploadLocalDataIfNeeded === 'function') uploadLocalDataIfNeeded(currentUser.uid);
                }
                showToast('📥 Importé !');
            } catch (er) { showToast('❌ Fichier invalide'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    document.getElementById('btnReset').addEventListener('click', function() {
        showConfirm('⚠️ Tout supprimer ?', 'Données locales ET cloud effacées.', async function() {
            App.horaires = [];
            App.depenses = [];
            App.paiements = [];
            App.extras = [];
            App.epargne = [];
            App.shopping = [];
            App.objectifs = [];
            saveData();
            if (typeof cloudDeleteAll === 'function') await cloudDeleteAll();
            renderAll();
            showToast('🗑️ Tout supprimé');
        });
    });
}

// ===== MAIN INIT =====
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    applyTheme(App.settings.theme || 'purple');
    buildCategoryGrid();
    initTabs();
    initNavigation();
    initForms();
    initSettings();
    initPinSettings();
    initMonthFilters();
    setDefaultDates();
    renderAll();

    var firebaseOk = (typeof firebase !== 'undefined' && typeof auth !== 'undefined');
    if (firebaseOk) {
        try {
            auth.onAuthStateChanged(function(user) {
                if (user && !isGuestMode) {
                    hideAuthScreen();
                    checkPinAfterAuth();
                } else if (!isGuestMode) {
                    showAuthScreen();
                }
            });
        } catch (e) {
            console.error('Firebase error:', e);
            forceLocalMode();
        }
    } else {
        console.warn('Firebase not loaded');
        forceLocalMode();
    }
});
