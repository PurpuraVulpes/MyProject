'use strict';

const App = {
    horaires: [],
    depenses: [],
    paiements: [],
    settings: { tauxHoraire: 12.00, devise: '€' },
    activeTab: 'horaires'
};

let pinInput = '';
let modalPinInput = '';
let modalPinMode = '';
let modalPinTemp = '';

const CATEGORIES = [
    {emoji:'🍔',label:'Alimentation'},{emoji:'🏠',label:'Loyer'},{emoji:'🚗',label:'Transport'},
    {emoji:'📱',label:'Téléphone'},{emoji:'⚡',label:'Énergie'},{emoji:'🎮',label:'Loisirs'},
    {emoji:'👕',label:'Vêtements'},{emoji:'💊',label:'Santé'},{emoji:'🛒',label:'Courses'},
    {emoji:'📦',label:'Abonnements'},{emoji:'🎓',label:'Éducation'},{emoji:'🔧',label:'Autre'}
];

const CAT_COLORS = ['#9b59b6','#00d2a0','#e17055','#fdcb6e','#e84393','#a29bfe','#fd79a8','#74b9ff','#ff9f43','#55efc4','#c39bd3','#b2bec3'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    buildCategoryGrid();
    initTabs();
    initNavigation();
    initForms();
    initSettings();
    initPinSettings();
    initMonthFilters();
    setDefaultDates();
    renderAll();
    updateMonthLabel();

    // Check if user is already logged in via Firebase
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(user => {
            if (user && !isGuestMode) {
                hideAuthScreen();
                checkPinAfterAuth();
            } else if (!isGuestMode) {
                showAuthScreen();
            }
        });
    } else {
        // Firebase not loaded — local mode
        isGuestMode = true;
        hideAuthScreen();
        checkPinAfterAuth();
    }
});

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
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function showAuthFromApp() {
    showAuthScreen();
    showLogin();
}

// ===== AUTH HANDLERS =====
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    const spinner = document.getElementById('loginSpinner');
    const btnText = document.getElementById('loginBtnText');

    if (!email || !password) { errEl.textContent = 'Remplissez tous les champs'; return; }

    spinner.classList.add('show');
    btnText.textContent = 'Connexion...';
    errEl.textContent = '';

    try {
        isGuestMode = false;
        await loginWithEmail(email, password);
        hideAuthScreen();
        checkPinAfterAuth();
        showToast('✅ Connecté !');
    } catch (e) {
        errEl.textContent = getAuthError(e.code);
    } finally {
        spinner.classList.remove('show');
        btnText.textContent = 'Se connecter';
    }
}

async function handleRegister() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;
    const errEl = document.getElementById('regError');
    const spinner = document.getElementById('regSpinner');
    const btnText = document.getElementById('regBtnText');

    if (!email || !password || !confirm) { errEl.textContent = 'Remplissez tous les champs'; return; }
    if (password.length < 6) { errEl.textContent = 'Le mot de passe doit faire 6 caractères minimum'; return; }
    if (password !== confirm) { errEl.textContent = 'Les mots de passe ne correspondent pas'; return; }

    spinner.classList.add('show');
    btnText.textContent = 'Création...';
    errEl.textContent = '';

    try {
        isGuestMode = false;
        await registerWithEmail(email, password);
        hideAuthScreen();
        checkPinAfterAuth();
        showToast('🎉 Compte créé et connecté !');
    } catch (e) {
        errEl.textContent = getAuthError(e.code);
    } finally {
        spinner.classList.remove('show');
        btnText.textContent = 'Créer mon compte';
    }
}

async function handleResetPassword() {
    const email = document.getElementById('resetEmail').value.trim();
    const errEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    const spinner = document.getElementById('resetSpinner');
    const btnText = document.getElementById('resetBtnText');

    if (!email) { errEl.textContent = 'Entrez votre email'; return; }

    spinner.classList.add('show');
    btnText.textContent = 'Envoi...';
    errEl.textContent = '';
    successEl.textContent = '';

    try {
        await resetPassword(email);
        successEl.textContent = '📧 Email envoyé ! Vérifiez votre boîte de réception.';
    } catch (e) {
        errEl.textContent = getAuthError(e.code);
    } finally {
        spinner.classList.remove('show');
        btnText.textContent = 'Envoyer le lien';
    }
}

function handleGuestMode() {
    isGuestMode = true;
    hideAuthScreen();
    updateSyncUI('offline');
    checkPinAfterAuth();
}

async function handleLogout() {
    showConfirm('🚪 Se déconnecter ?', 'Vos données locales seront conservées.', async () => {
        try {
            await logout();
            updateSyncUI('offline');
            showAuthScreen();
            showLogin();
            showToast('👋 Déconnecté');
        } catch (e) {
            showToast('❌ Erreur de déconnexion');
        }
    });
}

async function manualSync() {
    if (!currentUser || isGuestMode) {
        showToast('⚠️ Connectez-vous d\'abord');
        return;
    }

    updateSyncUI('syncing');

    try {
        localStorage.removeItem('mb_uploaded_' + currentUser.uid);
        await uploadLocalDataIfNeeded(currentUser.uid);
        showToast('🔄 Synchronisé !');
    } catch (e) {
        showToast('❌ Erreur de synchronisation');
    }

    updateSyncUI('online', currentUser.email);
}

function getAuthError(code) {
    const errors = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé',
        'auth/invalid-email': 'Email invalide',
        'auth/user-not-found': 'Aucun compte avec cet email',
        'auth/wrong-password': 'Mot de passe incorrect',
        'auth/weak-password': 'Mot de passe trop faible (min 6 car.)',
        'auth/too-many-requests': 'Trop de tentatives, réessayez plus tard',
        'auth/network-request-failed': 'Erreur réseau, vérifiez votre connexion',
        'auth/invalid-credential': 'Email ou mot de passe incorrect'
    };
    return errors[code] || 'Erreur : ' + code;
}

// ===== PIN AFTER AUTH =====
function checkPinAfterAuth() {
    const pin = getStoredPin();
    if (pin) {
        showLockScreen();
    } else {
        unlockApp();
    }
}

// ===== PIN SYSTEM =====
function getStoredPin() { return localStorage.getItem('mb_pin'); }
function setStoredPin(pin) { localStorage.setItem('mb_pin', pin); }
function removeStoredPin() { localStorage.removeItem('mb_pin'); }

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
        setTimeout(() => { pinInput = ''; updateDots('pinDots', ''); }, 500);
    }
}

function forgotPin() {
    const s = prompt('⚠️ Tapez RESET pour supprimer le code PIN\n(Données conservées)');
    if (s && s.toUpperCase() === 'RESET') { removeStoredPin(); unlockApp(); showToast('🔓 Code supprimé'); }
}

function updateDots(id, val) {
    document.querySelectorAll(`#${id} .dot`).forEach((d, i) => {
        d.classList.remove('filled', 'error', 'success');
        if (i < val.length) d.classList.add('filled');
    });
}

function setDotsState(id, state) {
    document.querySelectorAll(`#${id} .dot`).forEach(d => {
        d.classList.remove('filled', 'error', 'success');
        d.classList.add(state);
    });
}

// ===== PIN SETTINGS =====
function initPinSettings() {
    updatePinStatus();
    document.getElementById('btnSetPin').addEventListener('click', () => openPinModal('setup'));
    document.getElementById('btnChangePin').addEventListener('click', () => openPinModal('change-verify'));
    document.getElementById('btnRemovePin').addEventListener('click', () => openPinModal('remove'));
}

function updatePinStatus() {
    const pin = getStoredPin();
    const icon = document.getElementById('pinStatusIcon');
    const text = document.getElementById('pinStatusText');
    const sub = document.getElementById('pinStatusSub');
    const wrap = document.getElementById('pinStatusWrap');

    if (pin) {
        icon.textContent = '🔒'; text.textContent = 'Code PIN activé';
        sub.textContent = 'App protégée'; wrap.classList.add('active-pin');
        document.getElementById('btnSetPin').style.display = 'none';
        document.getElementById('btnChangePin').style.display = 'block';
        document.getElementById('btnRemovePin').style.display = 'block';
    } else {
        icon.textContent = '🔓'; text.textContent = 'Aucun code défini';
        sub.textContent = 'App non protégée'; wrap.classList.remove('active-pin');
        document.getElementById('btnSetPin').style.display = 'block';
        document.getElementById('btnChangePin').style.display = 'none';
        document.getElementById('btnRemovePin').style.display = 'none';
    }
}

function openPinModal(mode) {
    modalPinMode = mode; modalPinInput = ''; modalPinTemp = '';
    document.getElementById('modalPinError').textContent = '';
    updateDots('modalPinDots', '');
    const t = document.getElementById('pinModalTitle');
    const m = document.getElementById('pinModalMsg');
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
    const t = document.getElementById('pinModalTitle');
    const m = document.getElementById('pinModalMsg');
    const err = document.getElementById('modalPinError');

    switch (modalPinMode) {
        case 'setup':
            modalPinTemp = modalPinInput; modalPinInput = ''; modalPinMode = 'confirm';
            t.textContent = '🔐 Confirmer'; m.textContent = 'Même code une 2ème fois';
            updateDots('modalPinDots', ''); break;
        case 'confirm':
            if (modalPinInput === modalPinTemp) {
                setDotsState('modalPinDots', 'success'); setStoredPin(modalPinTemp);
                setTimeout(() => { closePinModal(); updatePinStatus(); showToast('🔒 Code activé !'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Codes différents';
                setTimeout(() => { modalPinInput = ''; modalPinMode = 'setup'; modalPinTemp = '';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); err.textContent = ''; }, 800);
            } break;
        case 'change-verify':
            if (modalPinInput === getStoredPin()) {
                setDotsState('modalPinDots', 'success');
                setTimeout(() => { modalPinInput = ''; modalPinMode = 'change-new';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); }, 400);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Code incorrect';
                setTimeout(() => { modalPinInput = ''; updateDots('modalPinDots', ''); }, 500);
            } break;
        case 'change-new':
            modalPinTemp = modalPinInput; modalPinInput = ''; modalPinMode = 'change-confirm';
            t.textContent = '🔐 Confirmer'; m.textContent = 'Même code une 2ème fois';
            updateDots('modalPinDots', ''); break;
        case 'change-confirm':
            if (modalPinInput === modalPinTemp) {
                setDotsState('modalPinDots', 'success'); setStoredPin(modalPinTemp);
                setTimeout(() => { closePinModal(); updatePinStatus(); showToast('🔒 Code modifié !'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Codes différents';
                setTimeout(() => { modalPinInput = ''; modalPinMode = 'change-new'; modalPinTemp = '';
                    t.textContent = '🔐 Nouveau code'; m.textContent = 'Entrez 6 chiffres';
                    updateDots('modalPinDots', ''); err.textContent = ''; }, 800);
            } break;
        case 'remove':
            if (modalPinInput === getStoredPin()) {
                setDotsState('modalPinDots', 'success'); removeStoredPin();
                setTimeout(() => { closePinModal(); updatePinStatus(); showToast('🔓 Code supprimé'); }, 500);
            } else {
                setDotsState('modalPinDots', 'error'); err.textContent = 'Code incorrect';
                setTimeout(() => { modalPinInput = ''; updateDots('modalPinDots', ''); }, 500);
            } break;
    }
}

// ===== STORAGE =====
function loadData() {
    try {
        const h = localStorage.getItem('mb_horaires');
        const d = localStorage.getItem('mb_depenses');
        const p = localStorage.getItem('mb_paiements');
        const s = localStorage.getItem('mb_settings');
        if (h) App.horaires = JSON.parse(h);
        if (d) App.depenses = JSON.parse(d);
        if (p) App.paiements = JSON.parse(p);
        if (s) App.settings = { ...App.settings, ...JSON.parse(s) };
    } catch (e) { console.error(e); }
}

function saveData() {
    localStorage.setItem('mb_horaires', JSON.stringify(App.horaires));
    localStorage.setItem('mb_depenses', JSON.stringify(App.depenses));
    localStorage.setItem('mb_paiements', JSON.stringify(App.paiements));
    localStorage.setItem('mb_settings', JSON.stringify(App.settings));
}

// ===== NAVIGATION =====
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => goTab(btn.dataset.tab));
    });
}

function goTab(tab) {
    App.activeTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
    document.getElementById('mainScroll').scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'resume') renderResume();
    if (tab === 'depenses') renderCatSummary();
    if (tab === 'paiements') renderPaiements();
}

function initTabs() {
    document.getElementById('btnToggleFormH').addEventListener('click', () => toggleForm('formCardH', 'btnToggleFormH'));
    document.getElementById('btnToggleFormD').addEventListener('click', () => toggleForm('formCardD', 'btnToggleFormD'));
    document.getElementById('btnToggleFormP').addEventListener('click', () => toggleForm('formCardP', 'btnToggleFormP'));
}

function toggleForm(cardId, btnId) {
    const card = document.getElementById(cardId);
    const btn = document.getElementById(btnId);
    const collapsed = card.classList.contains('collapsed');
    card.classList.toggle('collapsed', !collapsed);
    btn.textContent = collapsed ? '✕ Fermer' : '+ Ajouter';
    if (collapsed) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function buildCategoryGrid() {
    document.getElementById('catGrid').innerHTML = CATEGORIES.map(c =>
        `<div class="cat-chip" onclick="selectCat(this,'${c.emoji} ${c.label}')"><span class="cat-emoji">${c.emoji}</span>${c.label}</div>`
    ).join('');
}

function selectCat(el, val) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('categorieDepense').value = val;
}

function setDefaultDates() {
    const today = todayStr(), month = today.substring(0, 7);
    document.getElementById('dateHoraire').value = today;
    document.getElementById('dateDepense').value = today;
    document.getElementById('moisPaiement').value = month;
    document.getElementById('filtreHoraireMois').value = month;
    document.getElementById('filtreDepenseMois').value = month;
    document.getElementById('filtreResumeMois').value = month;
    document.getElementById('filtreAnneeP').value = new Date().getFullYear();
    document.getElementById('tauxHoraire').value = App.settings.tauxHoraire;
    document.querySelectorAll('.devise-btn').forEach(b => b.classList.toggle('active', b.dataset.devise === App.settings.devise));
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

function updateMonthLabel() {
    const now = new Date();
    const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    document.getElementById('currentMonthLabel') && (document.getElementById('currentMonthLabel').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`);
}

// ===== FORMS =====
function initForms() {
    document.getElementById('formHoraire').addEventListener('submit', e => { e.preventDefault(); addHoraire(); });
    ['heureDebut', 'heureFin', 'pauseMinutes'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    document.getElementById('formDepense').addEventListener('submit', e => { e.preventDefault(); addDepense(); });
    document.getElementById('formPaiement').addEventListener('submit', e => { e.preventDefault(); addPaiement(); });
    document.getElementById('btnQuickPaie').addEventListener('click', quickAddPaiement);
}

function updatePreview() {
    const debut = document.getElementById('heureDebut').value;
    const fin = document.getElementById('heureFin').value;
    const pause = parseInt(document.getElementById('pauseMinutes').value) || 0;
    if (debut && fin) {
        const mins = calcMinutes(debut, fin, pause);
        document.getElementById('previewDuree').textContent = formatDuree(mins);
        document.getElementById('previewGain').textContent = formatM((mins / 60) * App.settings.tauxHoraire);
    }
}

function addHoraire() {
    const date = document.getElementById('dateHoraire').value;
    const debut = document.getElementById('heureDebut').value;
    const fin = document.getElementById('heureFin').value;
    const pause = parseInt(document.getElementById('pauseMinutes').value) || 0;
    const note = document.getElementById('noteHoraire').value.trim();

    if (!date || !debut || !fin) { showToast('⚠️ Remplissez les champs'); return; }
    const minutes = calcMinutes(debut, fin, pause);
    if (minutes <= 0) { showToast('⚠️ Durée invalide'); return; }

    const horaire = { id: Date.now(), date, debut, fin, pause, minutes, note, gain: (minutes / 60) * App.settings.tauxHoraire };

    App.horaires.push(horaire);
    App.horaires.sort((a, b) => b.date.localeCompare(a.date));
    saveData();
    cloudAddHoraire(horaire);
    renderAll();
    showToast(`✅ ${formatDuree(minutes)} ajouté !`);

    document.getElementById('heureDebut').value = '';
    document.getElementById('heureFin').value = '';
    document.getElementById('pauseMinutes').value = '0';
    document.getElementById('noteHoraire').value = '';
    document.getElementById('previewDuree').textContent = '--';
    document.getElementById('previewGain').textContent = '--';
    toggleForm('formCardH', 'btnToggleFormH');
}

function addDepense() {
    const date = document.getElementById('dateDepense').value;
    const montant = parseFloat(document.getElementById('montantDepense').value);
    const categorie = document.getElementById('categorieDepense').value;
    const description = document.getElementById('descriptionDepense').value.trim();

    if (!date || !montant || montant <= 0) { showToast('⚠️ Remplissez date et montant'); return; }
    if (!categorie) { showToast('⚠️ Choisissez une catégorie'); return; }

    const depense = { id: Date.now(), date, montant, categorie, description };

    App.depenses.push(depense);
    App.depenses.sort((a, b) => b.date.localeCompare(a.date));
    saveData();
    cloudAddDepense(depense);
    renderAll();
    showToast(`✅ ${formatM(montant)} ajouté !`);

    document.getElementById('montantDepense').value = '';
    document.getElementById('descriptionDepense').value = '';
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('categorieDepense').value = '';
    toggleForm('formCardD', 'btnToggleFormD');
}

function deleteHoraire(id) {
    showConfirm('Supprimer ?', 'Supprimer cet horaire ?', () => {
        App.horaires = App.horaires.filter(h => h.id !== id);
        saveData(); cloudDeleteHoraire(id); renderAll(); showToast('🗑️ Supprimé');
    });
}

function deleteDepense(id) {
    showConfirm('Supprimer ?', 'Supprimer cette dépense ?', () => {
        App.depenses = App.depenses.filter(d => d.id !== id);
        saveData(); cloudDeleteDepense(id); renderAll(); showToast('🗑️ Supprimé');
    });
}

// ===== MONTH FILTERS =====
function initMonthFilters() {
    document.getElementById('filtreHoraireMois').addEventListener('change', () => { renderHoraires(); renderQuickStatsH(); });
    document.getElementById('prevH').addEventListener('click', () => changeMonth('filtreHoraireMois', -1, () => { renderHoraires(); renderQuickStatsH(); }));
    document.getElementById('nextH').addEventListener('click', () => changeMonth('filtreHoraireMois', 1, () => { renderHoraires(); renderQuickStatsH(); }));
    document.getElementById('filtreDepenseMois').addEventListener('change', () => { renderDepenses(); renderCatSummary(); renderQuickStatsD(); });
    document.getElementById('prevD').addEventListener('click', () => changeMonth('filtreDepenseMois', -1, () => { renderDepenses(); renderCatSummary(); renderQuickStatsD(); }));
    document.getElementById('nextD').addEventListener('click', () => changeMonth('filtreDepenseMois', 1, () => { renderDepenses(); renderCatSummary(); renderQuickStatsD(); }));
    document.getElementById('filtreResumeMois').addEventListener('change', renderResume);
    document.getElementById('prevR').addEventListener('click', () => changeMonth('filtreResumeMois', -1, renderResume));
       document.getElementById('nextR').addEventListener('click', () => changeMonth('filtreResumeMois', 1, renderResume));

    document.getElementById('filtreAnneeP').addEventListener('change', renderPaiements);
    document.getElementById('prevYearP').addEventListener('click', () => { const i = document.getElementById('filtreAnneeP'); i.value = parseInt(i.value) - 1; renderPaiements(); });
    document.getElementById('nextYearP').addEventListener('click', () => { const i = document.getElementById('filtreAnneeP'); i.value = parseInt(i.value) + 1; renderPaiements(); });
}

function changeMonth(id, delta, cb) {
    const input = document.getElementById(id);
    if (!input.value) return;
    const [y, m] = input.value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    input.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    cb();
}

function getH(m) { return App.horaires.filter(h => h.date.startsWith(m)); }
function getD(m) { return App.depenses.filter(d => d.date.startsWith(m)); }
function curM() { return todayStr().substring(0, 7); }

// ===== RENDERS =====
function renderAll() { renderDashboard(); renderHoraires(); renderQuickStatsH(); renderDepenses(); renderCatSummary(); renderQuickStatsD(); }

function renderDashboard() {
    const m = curM(), h = getH(m), d = getD(m);
    const mins = h.reduce((s, x) => s + x.minutes, 0);
    const rev = h.reduce((s, x) => s + x.gain, 0);
    const dep = d.reduce((s, x) => s + x.montant, 0);
    const sol = rev - dep;
    const jrs = new Set(h.map(x => x.date)).size;

    document.getElementById('totalRevenus').textContent = formatM(rev);
    document.getElementById('totalDepenses').textContent = formatM(dep);
    document.getElementById('totalHeures').textContent = formatDuree(mins);
    document.getElementById('totalJours').textContent = jrs;
    document.getElementById('solde').textContent = formatM(Math.abs(sol));

    const badge = document.getElementById('soldeBadge');
    const bar = document.getElementById('soldeBar');
    if (sol > 0) { badge.textContent = '✅ Positif'; badge.className = 'solde-badge positive'; bar.style.width = (rev > 0 ? Math.min((sol/rev)*100,100) : 0) + '%'; bar.style.background = 'linear-gradient(90deg,#00d2a0,#55efc4)'; }
    else if (sol < 0) { badge.textContent = '⚠️ Déficit'; badge.className = 'solde-badge negative'; bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg,#ff6b6b,#fd79a8)'; }
      else { badge.textContent = '⚖️ Équilibre'; badge.className = 'solde-badge neutral'; bar.style.width = '50%'; }

    // Carte "Paie reçue ce mois"
    const paieMois = getPaiementsForMonth(m);
    const totalPaie = paieMois.reduce((s, p) => s + p.montant, 0);
    const paieBadge = document.getElementById('paieBadge');
    document.getElementById('paieRecue').textContent = formatM(totalPaie);

    if (totalPaie > 0) {
        paieBadge.textContent = '✅ Reçu';
        paieBadge.className = 'solde-badge positive';
        document.getElementById('paieLabel').textContent = 'Paie reçue ce mois';
    } else {
        // Voir la prévision (heures du mois précédent)
        const prevMonth = getPreviousMonth(m);
        const prevHoraires = getH(prevMonth);
        const prevGain = prevHoraires.reduce((s, x) => s + x.gain, 0);
        if (prevGain > 0) {
            paieBadge.textContent = '⏳ À recevoir';
            paieBadge.className = 'solde-badge warning';
            document.getElementById('paieRecue').textContent = formatM(prevGain);
            document.getElementById('paieLabel').textContent = 'Paie prévue (non reçue)';
        } else {
            paieBadge.textContent = '—';
            paieBadge.className = 'solde-badge neutral';
            document.getElementById('paieLabel').textContent = 'Aucune paie ce mois';
        }
    }
}

function renderHoraires() {
    const m = document.getElementById('filtreHoraireMois').value, h = getH(m), c = document.getElementById('listeHoraires');
    if (!h.length) { c.innerHTML = '<p class="empty-state">😴 Aucun horaire ce mois.</p>'; return; }
    c.innerHTML = h.map(x => `<div class="list-item"><div class="list-item-icon">📅</div><div class="list-item-body"><div class="list-item-title">${formatDate(x.date)} · ${x.debut} – ${x.fin}</div><div class="list-item-sub">${formatDuree(x.minutes)}${x.pause>0?' ('+x.pause+'min pause)':''}${x.note?' · '+x.note:''}</div></div><div class="list-item-right"><span class="list-item-amount amount-green">${formatM(x.gain)}</span><button class="delete-btn" onclick="deleteHoraire(${x.id})">🗑️</button></div></div>`).join('');
}

function renderQuickStatsH() {
    const m = document.getElementById('filtreHoraireMois').value, h = getH(m);
    document.getElementById('qsJoursH').textContent = new Set(h.map(x => x.date)).size;
    document.getElementById('qsHeuresH').textContent = formatDuree(h.reduce((s, x) => s + x.minutes, 0));
    document.getElementById('qsGainH').textContent = formatM(h.reduce((s, x) => s + x.gain, 0));
}

function renderDepenses() {
    const m = document.getElementById('filtreDepenseMois').value, d = getD(m), c = document.getElementById('listeDepenses');
    if (!d.length) { c.innerHTML = '<p class="empty-state">🎉 Aucune dépense !</p>'; return; }
    c.innerHTML = d.map(x => `<div class="list-item"><div class="list-item-icon">${x.categorie.split(' ')[0]}</div><div class="list-item-body"><div class="list-item-title">${x.description||x.categorie}</div><div class="list-item-sub">${x.categorie} · ${formatDate(x.date)}</div></div><div class="list-item-right"><span class="list-item-amount amount-red">-${formatM(x.montant)}</span><button class="delete-btn" onclick="deleteDepense(${x.id})">🗑️</button></div></div>`).join('');
}

function renderQuickStatsD() {
    const m = document.getElementById('filtreDepenseMois').value, d = getD(m);
    const t = d.reduce((s, x) => s + x.montant, 0);
    document.getElementById('qsNbD').textContent = d.length;
    document.getElementById('qsMoyD').textContent = formatM(d.length ? t/d.length : 0);
    document.getElementById('qsMaxD').textContent = formatM(d.length ? Math.max(...d.map(x => x.montant)) : 0);
}

function renderCatSummary() {
    const m = document.getElementById('filtreDepenseMois').value, d = getD(m), c = document.getElementById('catSummary');
    if (!d.length) { c.innerHTML = ''; return; }
    const cats = {};
    d.forEach(x => { cats[x.categorie] = (cats[x.categorie]||0)+x.montant; });
    const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
    const max = sorted[0][1];
    c.innerHTML = sorted.map(([cat,amt],i) => `<div class="cat-row"><span class="cat-name">${cat}</span><div class="cat-track"><div class="cat-fill" style="width:${(amt/max)*100}%;background:${CAT_COLORS[i%CAT_COLORS.length]}"></div></div><span class="cat-amount">${formatM(amt)}</span></div>`).join('');
}

function renderResume() {
    const m = document.getElementById('filtreResumeMois').value;
    if (!m) return;
       const h = getH(m), d = getD(m);
    const paieMois = getPaiementsForMonth(m);
    const paieRecue = paieMois.reduce((s, p) => s + p.montant, 0);
    // Utiliser la paie reçue si disponible, sinon les gains estimés
    const rev = paieRecue > 0 ? paieRecue : h.reduce((s,x) => s+x.gain,0);
    const dep = d.reduce((s,x) => s+x.montant,0), sol = rev-dep;

    document.getElementById('bilanRevenus').textContent = formatM(rev);
    document.getElementById('bilanDepenses').textContent = formatM(dep);
    const tot = rev+dep;
    document.getElementById('progressGreen').style.width = (tot>0?(rev/tot)*100:50)+'%';
    document.getElementById('progressRed').style.width = (tot>0?(dep/tot)*100:50)+'%';
    const se = document.getElementById('bilanSolde');
    se.textContent = (sol>=0?'':'-')+formatM(Math.abs(sol));
    se.className = sol>=0?'positive':'negative';
    document.getElementById('bilanPercent').textContent = rev>0?`${Math.round((dep/rev)*100)}% dépensé`:'Aucun revenu';
    document.getElementById('statJours').textContent = jrs;
    document.getElementById('statHeures').textContent = formatDuree(mins);
    document.getElementById('statNbDep').textContent = d.length;
    document.getElementById('statMoyDep').textContent = formatM(d.length?dep/d.length:0);

    // Chart
    const ct = document.getElementById('barChart');
    const [y,mo] = m.split('-').map(Number);
    const days = new Date(y,mo,0).getDate();
    const daily = {};
    d.forEach(x => { const day = parseInt(x.date.split('-')[2]); daily[day]=(daily[day]||0)+x.montant; });
    const mx = Object.values(daily).length?Math.max(...Object.values(daily)):1;
    let html = '';
    for (let i=1;i<=days;i++){const v=daily[i]||0;const ht=v>0?Math.max((v/mx)*80,4):0;html+=`<div class="bar-col"><div class="bar-fill" style="height:${ht}px" title="${i}/${mo}: ${formatM(v)}"></div><span class="bar-label">${i}</span></div>`;}
    ct.innerHTML = html||'<p style="color:var(--text2);text-align:center;width:100%">Aucune dépense</p>';

    // Top
    const tp = document.getElementById('topDepenses');
    if (!d.length) { tp.innerHTML = '<p style="color:var(--text2);text-align:center;padding:12px">Aucune</p>'; return; }
    tp.innerHTML = [...d].sort((a,b)=>b.montant-a.montant).slice(0,5).map(x => `<div class="top-dep-item"><span>${x.categorie}${x.description?' · '+x.description:''}</span><strong>-${formatM(x.montant)}</strong></div>`).join('');
}

// ===== SETTINGS =====
function initSettings() {
    document.getElementById('tauxPlus').addEventListener('click', () => { const i = document.getElementById('tauxHoraire'); i.value = (parseFloat(i.value)+0.5).toFixed(2); });
    document.getElementById('tauxMinus').addEventListener('click', () => { const i = document.getElementById('tauxHoraire'); const v = parseFloat(i.value)-0.5; if(v>=0)i.value=v.toFixed(2); });
    document.querySelectorAll('.devise-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.devise-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }); });

    document.getElementById('btnSaveSettings').addEventListener('click', () => {
        App.settings.tauxHoraire = parseFloat(document.getElementById('tauxHoraire').value) || 0;
        App.settings.devise = document.querySelector('.devise-btn.active')?.dataset.devise || '€';
        App.horaires.forEach(h => { h.gain = (h.minutes/60)*App.settings.tauxHoraire; });
        saveData(); cloudSaveSettings();
        // Re-upload horaires with new gains
        if (currentUser && !isGuestMode) {
            App.horaires.forEach(h => cloudAddHoraire(h));
        }
        renderAll(); showToast('⚙️ Sauvegardé !');
    });

    document.getElementById('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ horaires: App.horaires, depenses: App.depenses, paiements: App.paiements, settings: App.settings, exportDate: new Date().toISOString() }, null, 2)], { type: 'application/json' });

    document.getElementById('btnImport').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
               if (data.horaires) App.horaires = data.horaires;
                if (data.depenses) App.depenses = data.depenses;
                if (data.paiements) App.paiements = data.paiements;
                if (data.settings) App.settings = { ...App.settings, ...data.settings };
                saveData(); setDefaultDates(); renderAll();
                // Upload to cloud
                if (currentUser && !isGuestMode) {
                    localStorage.removeItem('mb_uploaded_' + currentUser.uid);
                    uploadLocalDataIfNeeded(currentUser.uid);
                }
                showToast('📥 Importé !');
            } catch { showToast('❌ Fichier invalide'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

   document.getElementById('btnReset').addEventListener('click', () => {
    showConfirm('⚠️ Tout supprimer ?', 'Données locales ET cloud effacées.', async () => {
        App.horaires = []; App.depenses = []; App.paiements = [];
        saveData(); await cloudDeleteAll(); renderAll(); showToast('🗑️ Tout supprimé');
    });
});
}

// ===== MODAL =====
function showConfirm(title, msg, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = msg;
    const o = document.getElementById('modalOverlay');
    o.classList.add('show');
    const close = () => o.classList.remove('show');
    document.getElementById('modalConfirm').onclick = () => { close(); onConfirm(); };
    document.getElementById('modalCancel').onclick = close;
    o.onclick = e => { if(e.target===o) close(); };
}

// ===== TOAST =====
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'toast'; }, 2800);
}

// ===== UTILS =====
function calcMinutes(d, f, p=0) { const [dh,dm]=d.split(':').map(Number); const [fh,fm]=f.split(':').map(Number); let t=(fh*60+fm)-(dh*60+dm); if(t<0)t+=1440; return Math.max(0,t-p); }
function formatDuree(m) { return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}`; }
function formatM(a) { return a.toFixed(2).replace('.',',')+' '+App.settings.devise; }
function formatDate(d) { const [y,m,j]=d.split('-'); return `${j}/${m}/${y}`; }

// ===== PAIEMENTS =====
function getPaiementsForMonth(monthStr) {
    return App.paiements.filter(p => p.mois === monthStr);
}

function getPaiementsForYear(year) {
    return App.paiements.filter(p => p.mois.startsWith(String(year)));
}

function getPreviousMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getNextMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function addPaiement() {
    const mois = document.getElementById('moisPaiement').value;
    const montant = parseFloat(document.getElementById('montantPaiement').value);
    const description = document.getElementById('descriptionPaiement').value.trim();

    if (!mois || !montant || montant <= 0) { showToast('⚠️ Remplissez mois et montant'); return; }

    const paiement = { id: Date.now(), mois, montant, description, date: todayStr() };
    App.paiements.push(paiement);
    App.paiements.sort((a, b) => b.mois.localeCompare(a.mois));
    saveData();
    if (typeof cloudAddPaiement === 'function') cloudAddPaiement(paiement);
    renderAll();
    renderPaiements();
    showToast(`✅ Paie de ${formatM(montant)} enregistrée !`);

    document.getElementById('montantPaiement').value = '';
    document.getElementById('descriptionPaiement').value = '';
    toggleForm('formCardP', 'btnToggleFormP');
}

function quickAddPaiement() {
    // Ajoute rapidement la paie prévue (heures du mois précédent) pour le mois en cours
    const currentM = curM();
    const prevM = getPreviousMonth(currentM);
    const prevHoraires = getH(prevM);
    const gain = prevHoraires.reduce((s, x) => s + x.gain, 0);

    if (gain <= 0) { showToast('⚠️ Aucune heure le mois précédent'); return; }

    // Vérifier s'il n'y a pas déjà une paie ce mois
    const existing = getPaiementsForMonth(currentM);
    if (existing.length > 0) {
        showConfirm('Paie déjà enregistrée', `Vous avez déjà ${existing.length} paie(s) ce mois. En ajouter une nouvelle ?`, () => {
            createQuickPaie(currentM, gain, prevM);
        });
    } else {
        createQuickPaie(currentM, gain, prevM);
    }
}

function createQuickPaie(mois, montant, moisSource) {
    const paiement = {
        id: Date.now(),
        mois,
        montant,
        description: `Salaire ${formatMonthLong(moisSource)}`,
        date: todayStr()
    };
    App.paiements.push(paiement);
    App.paiements.sort((a, b) => b.mois.localeCompare(a.mois));
    saveData();
    if (typeof cloudAddPaiement === 'function') cloudAddPaiement(paiement);
    renderAll();
    renderPaiements();
    showToast(`✨ Paie de ${formatM(montant)} ajoutée !`);
}

function deletePaiement(id) {
    showConfirm('Supprimer ?', 'Supprimer ce paiement ?', () => {
        App.paiements = App.paiements.filter(p => p.id !== id);
        saveData();
        if (typeof cloudDeletePaiement === 'function') cloudDeletePaiement(id);
        renderAll();
        renderPaiements();
        showToast('🗑️ Supprimé');
    });
}

function renderPaiements() {
    const currentM = curM();
    const prevM = getPreviousMonth(currentM);
    const nextM = getNextMonth(currentM);

    // Prévisions
    const horairesActuel = getH(currentM);
    const horairesPrec = getH(prevM);
    const gainActuel = horairesActuel.reduce((s, x) => s + x.gain, 0);
    const gainPrec = horairesPrec.reduce((s, x) => s + x.gain, 0);

    document.getElementById('previsionActuel').textContent = formatM(gainActuel);
    document.getElementById('previsionActuelSub').textContent = `Sera reçu en ${formatMonthShort(nextM)}`;
    document.getElementById('previsionPrecedent').textContent = formatM(gainPrec);
    document.getElementById('previsionPrecedentSub').textContent = `À recevoir en ${formatMonthShort(currentM)}`;

    // Bouton quick
    const btn = document.getElementById('btnQuickPaie');
    if (gainPrec > 0) {
        btn.style.display = 'block';
        btn.textContent = `✨ Enregistrer ${formatM(gainPrec)} pour ${formatMonthShort(currentM)}`;
    } else {
        btn.style.display = 'none';
    }

    // Liste des paiements de l'année filtrée
    const year = parseInt(document.getElementById('filtreAnneeP').value);
    const paiements = getPaiementsForYear(year);
    const total = paiements.reduce((s, p) => s + p.montant, 0);

    document.getElementById('qsNbPaie').textContent = paiements.length;
    document.getElementById('qsTotalPaie').textContent = formatM(total);
    document.getElementById('qsMoyPaie').textContent = formatM(paiements.length ? total / paiements.length : 0);

    const c = document.getElementById('listePaiements');
    if (!paiements.length) {
        c.innerHTML = '<p class="empty-state">💸 Aucun paiement cette année.</p>';
        return;
    }
    c.innerHTML = paiements.map(p => `
        <div class="list-item">
            <div class="list-item-icon">💰</div>
            <div class="list-item-body">
                <div class="list-item-title">${p.description || 'Paie ' + formatMonthLong(p.mois)}</div>
                <div class="list-item-sub">Reçu en ${formatMonthLong(p.mois)}</div>
            </div>
            <div class="list-item-right">
                <span class="list-item-amount amount-green">${formatM(p.montant)}</span>
                <button class="delete-btn" onclick="deletePaiement(${p.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function formatMonthShort(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    return `${months[m-1]} ${y}`;
}

function formatMonthLong(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${months[m-1]} ${y}`;
}
