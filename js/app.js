/* ============================================
   APP.JS - Point d'entrée principal v5 FINAL
   (Anti-clignotement + toutes corrections)
   ============================================ */

'use strict';

const App = {

    initialized: false,
    _lastActivity: Date.now(),
    _cloudRefreshTimer: null,

    /**
     * ==========================================
     * DÉMARRAGE
     * ==========================================
     */
    async init() {
        console.log('🚀 Initialisation MonBudget v5 FINAL...');

        try {
            Storage.init();
            this.applyTheme(State.settings.theme || 'purple');

            const firebaseOk = FirebaseService.init();
            if (firebaseOk) Auth.init();

            PinLock.init();
            Router.init();

            if (typeof Notifications !== 'undefined') Notifications.init();
            if (typeof Devises !== 'undefined') Devises.init();
            if (typeof RecurrentCheck !== 'undefined') RecurrentCheck.init();

            this.setupGlobalEvents();
            this.setupKeyboardShortcuts();
            this.applyModulesVisibility();

            await this.decideStartScreen(firebaseOk);

            this.initialized = true;
            console.log('✅ MonBudget v5 initialisé');

        } catch (error) {
            console.error('❌ Erreur init:', error);
            this.showFatalError(error);
        }
    },

    async decideStartScreen(firebaseAvailable) {
        if (firebaseAvailable && FirebaseService.auth) {
            await new Promise((resolve) => {
                const unsubscribe = FirebaseService.auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
                setTimeout(() => resolve(null), 3000);
            });
        }

        if (firebaseAvailable && FirebaseService.auth && FirebaseService.auth.currentUser) {
            const user = FirebaseService.auth.currentUser;
            State.user = { uid: user.uid, email: user.email };
            State.isGuestMode = false;
            localStorage.setItem('mb_last_auth_state', 'signed_in');
            console.log('✅ Session restaurée:', user.email);
            this.hideSplash();
            if (Storage.hasPin()) PinLock.checkOnStart();
            return;
        }

        const wasGuestMode = localStorage.getItem('mb_last_auth_state') === 'guest';
        if (State.isGuestMode || wasGuestMode || !firebaseAvailable) {
            State.isGuestMode = true;
            this.hideSplash();
            if (Storage.hasPin()) PinLock.checkOnStart();
            return;
        }

        this.hideSplash();
        setTimeout(() => Auth.showAuthScreen(), 300);
    },

    /**
     * ==========================================
     * THÈME
     * ==========================================
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            const colors = {
                purple: '#0f0a1e', dark: '#0a0a0a', light: '#f5f7fa',
                blue: '#0a1628', red: '#1a0a0e', green: '#0a1a12'
            };
            metaTheme.setAttribute('content', colors[theme] || colors.purple);
        }

        State.settings.theme = theme;
        Storage.saveSection('settings');

        if (State.user && !State.isGuestMode) CloudSync.saveSettings();

        document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme } }));

        const themeLabel = document.getElementById('menuThemeLabel');
        if (themeLabel) {
            const t = THEMES_DISPONIBLES.find(x => x.id === theme);
            themeLabel.textContent = t ? t.label : theme;
        }
    },

    /**
     * ==========================================
     * SPLASH
     * ==========================================
     */
    hideSplash() {
        const splash = document.getElementById('splashScreen');
        const app = document.getElementById('app');
        if (!splash || !app) return;

        app.hidden = false;
        requestAnimationFrame(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.hidden = true, 450);
        });
    },

    showFatalError(error) {
        const splash = document.getElementById('splashScreen');
        if (!splash) { alert('Erreur : ' + error.message); return; }

        splash.innerHTML = `
            <div class="splash-logo">⚠️</div>
            <div class="splash-title">Erreur</div>
            <p style="color: var(--text2); text-align:center; max-width:300px; padding:0 20px;">Impossible de lancer l'application.</p>
            <pre style="color: var(--danger); background: var(--card); padding: 12px; border-radius: 12px; max-width: 90vw; overflow:auto; font-size: 0.75rem;">${error.message}</pre>
            <button onclick="location.reload()" style="margin-top:16px; padding:12px 20px; background:var(--primary); color:white; border-radius:12px; font-weight:700;">Recharger</button>
        `;
    },

    /**
     * ==========================================
     * EVENTS GLOBAUX
     * ==========================================
     */
    setupGlobalEvents() {
        document.addEventListener('page:changed', (e) => {
            this.onPageChanged(e.detail.page, e.detail.previous);
        });

        document.addEventListener('auth:signedin', () => this.onSignedIn());
        document.addEventListener('auth:signedout', () => this.onSignedOut());
        document.addEventListener('auth:guest', () => this.onGuestMode());

        document.addEventListener('data:imported', () => this.refreshUI());

        // ✅ Cloud update : ne rafraîchir que le dashboard avec debounce
        document.addEventListener('cloud:updated', () => {
            if (State.currentPage === 'home' && typeof Dashboard !== 'undefined') {
                if (this._cloudRefreshTimer) clearTimeout(this._cloudRefreshTimer);
                this._cloudRefreshTimer = setTimeout(() => Dashboard.render(), 500);
            }
        });

        document.addEventListener('state:saved', () => this.updateSyncStatus());

        this.setupMoreMenuEvents();

        const btnSignOut = document.getElementById('btnSignOut');
        if (btnSignOut) btnSignOut.addEventListener('click', () => Auth.handleSignOut());

        const btnSyncManual = document.getElementById('btnSyncManual');
        if (btnSyncManual) btnSyncManual.addEventListener('click', () => CloudSync.manualSync());

        const btnLock = document.getElementById('btnLock');
        if (btnLock) btnLock.addEventListener('click', () => PinLock.showLockScreen());

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.onAppResume();
        });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredInstallPrompt = e;
        });

        ['click', 'touchstart', 'keydown'].forEach(evt => {
            document.addEventListener(evt, () => this._lastActivity = Date.now(), { passive: true });
        });
    },

    setupMoreMenuEvents() {
        document.querySelectorAll('.menu-item[data-more]').forEach(item => {
            item.addEventListener('click', () => this.handleMoreAction(item.dataset.more));
        });
    },

    /**
     * ==========================================
     * ACTIONS MENU PLUS
     * ==========================================
     */
    handleMoreAction(action) {
        switch (action) {
            case 'account': this.openAccountSheet(); break;
            case 'theme': this.openThemeSheet(); break;
            case 'modules': this.openModulesSheet(); break;
            case 'widgets': this.openWidgetsSheet(); break;
            case 'settings': this.openSettingsSheet(); break;
            case 'pin': this.openPinManageSheet(); break;
            case 'export-import':
                if (typeof ExportImport !== 'undefined') ExportImport.openExportSheet();
                break;
            case 'notifications':
                if (typeof Notifications !== 'undefined') Notifications.openSettingsSheet();
                break;
            case 'devises':
                if (typeof Devises !== 'undefined') Devises.openSettingsSheet();
                break;
            case 'recurrent-check':
                if (typeof RecurrentCheck !== 'undefined') RecurrentCheck.manualCheck();
                break;
            case 'reset': this.confirmReset(); break;
            case 'epargne': Epargne.renderPage(); break;
            case 'objectifs': Objectifs.renderPage(); break;
            case 'horaires': this.openHorairesPage(); break;
            case 'calendrier':
                Router.navigateTo('analyse');
                setTimeout(() => {
                    if (typeof Analyse !== 'undefined') Analyse.switchView('calendrier');
                }, 300);
                break;
            default: console.log('Action:', action);
        }
    },

    /**
     * ==========================================
     * ACTIONS MENU AJOUTER
     * ==========================================
     */
    handleAddAction(type) {
        switch (type) {
            case 'horaire': Horaires.openAddForm(); break;
            case 'depense': Depenses.openAddForm(); break;
            case 'revenu': Revenus.openAddForm(); break;
            case 'epargne': Epargne.openAddForm(); break;
            case 'objectif': Objectifs.openAddForm(); break;
            case 'shopping': Shopping.openAddForm(); break;
            case 'recurrent': Recurrent.openAddForm(); break;
            case 'budget': Budgets.openAddForm(); break;
            default: Toast.info('Action inconnue');
        }
    },

    /**
     * ==========================================
     * SHEETS
     * ==========================================
     */
    openAccountSheet() {
        let content;
        if (State.user) {
            content = `
                <div class="banner banner-success" style="margin-bottom: var(--space-md);">
                    <span class="banner-icon">☁️</span>
                    <div class="banner-body"><div class="banner-title">Connecté</div><div class="banner-text">${State.user.email}</div></div>
                </div>
                <div class="form">
                    <button class="btn btn-outline btn-block" onclick="CloudSync.manualSync()">🔄 Synchroniser</button>
                    <button class="btn btn-outline btn-block" style="color: var(--danger); border-color: rgba(255,107,107,0.3);" onclick="Auth.handleSignOut()">🚪 Se déconnecter</button>
                </div>`;
        } else if (State.isGuestMode) {
            content = `
                <div class="banner" style="margin-bottom: var(--space-md);">
                    <span class="banner-icon">👤</span>
                    <div class="banner-body"><div class="banner-title">Mode local</div><div class="banner-text">Vos données restent sur cet appareil</div></div>
                </div>
                <p style="color: var(--text2); font-size: var(--text-sm); text-align: center; margin-bottom: var(--space-md);">Créez un compte pour synchroniser entre appareils.</p>
                <button class="btn btn-primary btn-block" onclick="Router.closeSheet(); Auth.showAuthScreen();">🔗 Se connecter</button>`;
        } else {
            content = `
                <div class="banner banner-warning" style="margin-bottom: var(--space-md);">
                    <span class="banner-icon">⚠️</span>
                    <div class="banner-body"><div class="banner-title">Cloud non disponible</div><div class="banner-text">Firebase non configuré</div></div>
                </div>`;
        }
        Router.openSheet('account', 'Mon compte', content);
    },

    openThemeSheet() {
        const current = State.settings.theme || 'purple';
        let html = '<div class="theme-grid">';
        THEMES_DISPONIBLES.forEach(t => {
            html += `<button class="theme-option ${t.id === current ? 'active' : ''}" data-theme="${t.id}">
                <div class="theme-preview theme-preview-${t.id}"><span></span><span></span><span></span></div>
                <span class="theme-option-label">${t.label}</span>
            </button>`;
        });
        html += '</div>';
        Router.openSheet('theme', 'Choisir un thème', html);
        setTimeout(() => {
            document.querySelectorAll('.theme-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    this.applyTheme(opt.dataset.theme);
                    Router.closeSheet();
                    Toast.success('🎨 Thème appliqué !');
                });
            });
        }, 100);
    },

    openWidgetsSheet() {
        if (typeof Dashboard !== 'undefined') Dashboard.openWidgetsSheet();
    },

    openModulesSheet() {
        const modules = [
            { key: 'horaires', label: 'Horaires', icon: '⏰', desc: 'Suivi des heures' },
            { key: 'revenus', label: 'Revenus', icon: '💰', desc: 'Salaires et extras' },
            { key: 'depenses', label: 'Dépenses', icon: '💳', desc: 'Suivi des dépenses' },
            { key: 'epargne', label: 'Épargne', icon: '🏦', desc: 'Dépôts et retraits' },
            { key: 'objectifs', label: 'Objectifs', icon: '🎯', desc: 'Objectifs d\'épargne' },
            { key: 'shopping', label: 'Liste d\'achats', icon: '🛒', desc: 'Choses à acheter' },
            { key: 'recurrent', label: 'Récurrentes', icon: '🔁', desc: 'Loyer, abonnements...' },
            { key: 'budgets', label: 'Budgets', icon: '📊', desc: 'Limites par catégorie' },
            { key: 'calendrier', label: 'Calendrier', icon: '📅', desc: 'Vue calendrier' },
            { key: 'analyseAvancee', label: 'Analyse avancée', icon: '📈', desc: 'Graphiques 6/12 mois' },
            { key: 'suggestions', label: 'Suggestions', icon: '💡', desc: 'Conseils intelligents' },
            { key: 'tickets', label: 'Photos tickets', icon: '📸', desc: 'Joindre des photos' },
            { key: 'multiDevises', label: 'Multi-devises', icon: '🌍', desc: 'Conversion devises' }
        ];

        let html = '<div class="form" style="gap: 0;">';
        modules.forEach(m => {
            const isActive = State.modules[m.key] === true;
            html += `
                <button type="button" class="switch-row module-row-btn" data-module-row="${m.key}" style="cursor: pointer; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-light); padding: var(--space-md) 0; text-align: left; color: var(--text); -webkit-tap-highlight-color: transparent;">
                    <div class="switch-row-body">
                        <div class="switch-row-title">${m.icon} ${m.label}</div>
                        <div class="switch-row-desc">${m.desc}</div>
                    </div>
                    <div class="switch module-switch ${isActive ? 'active' : ''}" data-module="${m.key}" style="pointer-events: none;"></div>
                </button>
            `;
        });
        html += '</div>';

        Router.openSheet('modules', 'Modules actifs', html);

        setTimeout(() => {
            document.querySelectorAll('[data-module-row]').forEach(row => {
                row.addEventListener('click', function(e) {
                    e.preventDefault();

                    const name = this.dataset.moduleRow;
                    const sw = this.querySelector('.module-switch');

                    State.modules[name] = !State.modules[name];
                    if (sw) sw.classList.toggle('active', State.modules[name]);

                    if (typeof Storage !== 'undefined') Storage.save();
                    if (typeof notifyStateChange === 'function') notifyStateChange();
                    if (State.user && !State.isGuestMode && typeof CloudSync !== 'undefined') CloudSync.saveSettings();

                    if (typeof App !== 'undefined') App.applyModulesVisibility();
                    if (typeof Dashboard !== 'undefined') Dashboard.render();
                });
            });
        }, 150);
    },

    openSettingsSheet() {
        const s = State.settings;
        const html = `<div class="form">
            <div class="form-group">
                <label class="form-label">💼 Taux horaire (${s.devise}/h)</label>
                <div class="stepper">
                    <button class="stepper-btn" id="settingTauxMinus">−</button>
                    <input type="number" id="settingTaux" value="${s.tauxHoraire}" step="0.5" min="0" inputmode="decimal">
                    <button class="stepper-btn" id="settingTauxPlus">+</button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">💱 Devise</label>
                <div class="grid-4">
                    <button class="chip ${s.devise === '€' ? 'active' : ''}" data-devise="€">€</button>
                    <button class="chip ${s.devise === '$' ? 'active' : ''}" data-devise="$">$</button>
                    <button class="chip ${s.devise === '£' ? 'active' : ''}" data-devise="£">£</button>
                    <button class="chip ${s.devise === 'CHF' ? 'active' : ''}" data-devise="CHF">CHF</button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">⏱️ Arrondi</label>
                <div class="grid-4">
                    <button class="chip ${s.arrondi === 'none' ? 'active' : ''}" data-arrondi="none">Aucun</button>
                    <button class="chip ${s.arrondi === '15' ? 'active' : ''}" data-arrondi="15">¼ h</button>
                    <button class="chip ${s.arrondi === '30' ? 'active' : ''}" data-arrondi="30">½ h</button>
                    <button class="chip ${s.arrondi === '60' ? 'active' : ''}" data-arrondi="60">1 h</button>
                </div>
            </div>
            <button class="btn btn-success btn-block" id="btnSaveSettings">💾 Sauvegarder</button>
        </div>`;

        Router.openSheet('settings', 'Réglages', html);

        setTimeout(() => {
            document.getElementById('settingTauxMinus')?.addEventListener('click', () => {
                const i = document.getElementById('settingTaux');
                const v = parseFloat(i.value) - 0.5;
                if (v >= 0) i.value = v.toFixed(2);
            });
            document.getElementById('settingTauxPlus')?.addEventListener('click', () => {
                const i = document.getElementById('settingTaux');
                i.value = (parseFloat(i.value) + 0.5).toFixed(2);
            });
            document.querySelectorAll('.chip[data-devise]').forEach(c => {
                c.addEventListener('click', () => {
                    document.querySelectorAll('.chip[data-devise]').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                });
            });
            document.querySelectorAll('.chip[data-arrondi]').forEach(c => {
                c.addEventListener('click', () => {
                    document.querySelectorAll('.chip[data-arrondi]').forEach(x => x.classList.remove('active'));
                    c.classList.add('active');
                });
            });
            document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
                State.settings.tauxHoraire = parseFloat(document.getElementById('settingTaux').value) || 0;
                State.settings.devise = document.querySelector('.chip[data-devise].active')?.dataset.devise || '€';
                State.settings.arrondi = document.querySelector('.chip[data-arrondi].active')?.dataset.arrondi || 'none';
                State.data.horaires.forEach(h => {
                    if (h.debut && h.fin) {
                        h.minutes = StateHelpers.calcMinutes(h.debut, h.fin, h.pause || 0);
                        h.gain = (h.minutes / 60) * State.settings.tauxHoraire;
                        if (State.user && !State.isGuestMode) CloudSync.saveItem('horaires', h);
                    }
                });
                notifyStateChange();
                if (State.user && !State.isGuestMode) CloudSync.saveSettings();
                Router.closeSheet();
                Toast.success('⚙️ Sauvegardé');
                this.refreshUI();
            });
        }, 100);
    },

    openPinManageSheet() {
        const hasPin = Storage.hasPin();
        const html = hasPin ? `
            <div class="banner banner-success" style="margin-bottom: var(--space-md);">
                <span class="banner-icon">🔒</span>
                <div class="banner-body"><div class="banner-title">Code PIN activé</div><div class="banner-text">App protégée</div></div>
            </div>
            <div class="form">
                <button class="btn btn-primary btn-block" id="btnChangePin">🔄 Changer</button>
                <button class="btn btn-outline btn-block" style="color:var(--danger);border-color:rgba(255,107,107,0.3);" id="btnRemovePin">🗑️ Supprimer</button>
            </div>
        ` : `
            <div class="banner" style="margin-bottom: var(--space-md);">
                <span class="banner-icon">🔓</span>
                <div class="banner-body"><div class="banner-title">Aucun code</div><div class="banner-text">Non protégé</div></div>
            </div>
            <button class="btn btn-primary btn-block" id="btnSetPin">🔐 Définir un code</button>
        `;
        Router.openSheet('pin-manage', 'Code PIN', html);
        setTimeout(() => {
            document.getElementById('btnSetPin')?.addEventListener('click', () => PinLock.openPinModal('setup'));
            document.getElementById('btnChangePin')?.addEventListener('click', () => PinLock.openPinModal('change-verify'));
            document.getElementById('btnRemovePin')?.addEventListener('click', () => PinLock.openPinModal('remove'));
        }, 100);
    },

    confirmReset() {
        Router.openSheet('confirm-reset', '⚠️ Tout supprimer ?', `
            <p style="color:var(--text2);text-align:center;margin-bottom:var(--space-lg);">Toutes vos données seront effacées.<br><strong style="color:var(--danger);">Irréversible.</strong></p>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="Router.closeSheet()">Annuler</button>
                <button class="btn btn-danger" id="btnConfirmReset">Tout effacer</button>
            </div>
        `);
        setTimeout(() => {
            document.getElementById('btnConfirmReset')?.addEventListener('click', async () => {
                Storage.clearAll();
                if (State.user && !State.isGuestMode) await CloudSync.deleteAllData();
                Router.closeSheet();
                Toast.success('🗑️ Effacé');
                setTimeout(() => location.reload(), 800);
            });
        }, 100);
    },

    // EXPORT / IMPORT
    handleExport() {
        if (Storage.downloadExport()) Toast.success('📤 Exporté !');
        else Toast.error('❌ Erreur');
    },

    /**
     * ==========================================
     * AUTH EVENTS
     * ==========================================
     */
    onSignedIn() { this.updateAccountUI(); this.updateSyncStatus(); },
    onSignedOut() { this.updateAccountUI(); this.updateSyncStatus(); },
    onGuestMode() { this.updateAccountUI(); this.updateSyncStatus(); },

    updateAccountUI() {
        const label = document.getElementById('menuAccountLabel');
        const sub = document.getElementById('menuAccountSub');
        const icon = document.getElementById('menuAccountIcon');

        if (label && sub && icon) {
            if (State.user) { label.textContent = State.user.email || 'Connecté'; sub.textContent = '☁️ Synchronisé'; icon.textContent = '👤'; }
            else if (State.isGuestMode) { label.textContent = 'Mode local'; sub.textContent = 'Données sur cet appareil'; icon.textContent = '👤'; }
            else { label.textContent = 'Se connecter'; sub.textContent = 'Créer un compte'; icon.textContent = '🔗'; }
        }

        const btnSignOut = document.getElementById('btnSignOut');
        const btnSyncManual = document.getElementById('btnSyncManual');
        if (btnSignOut) btnSignOut.hidden = !State.user;
        if (btnSyncManual) btnSyncManual.hidden = !State.user;

        const pinIcon = document.getElementById('menuPinIcon');
        const pinSub = document.getElementById('menuPinSub');
        if (pinIcon && pinSub) {
            pinIcon.textContent = Storage.hasPin() ? '🔒' : '🔓';
            pinSub.textContent = Storage.hasPin() ? 'Activé' : 'Désactivé';
        }

        const btnLock = document.getElementById('btnLock');
        if (btnLock) btnLock.hidden = !Storage.hasPin();

        const notifIcon = document.getElementById('menuNotifIcon');
        const notifSub = document.getElementById('menuNotifSub');
        if (notifIcon && notifSub && typeof Notifications !== 'undefined') {
            if (Notifications.permission === 'granted' && State.settings.notificationsActives) { notifIcon.textContent = '🔔'; notifSub.textContent = 'Activées'; }
            else if (Notifications.permission === 'denied') { notifIcon.textContent = '🔕'; notifSub.textContent = 'Bloquées'; }
            else { notifIcon.textContent = '🔔'; notifSub.textContent = 'Non activées'; }
        }

        const deviseSub = document.getElementById('menuDeviseSub');
        if (deviseSub) {
            const d = State.settings.devise;
            const info = typeof Devises !== 'undefined' ? Devises.AVAILABLE.find(x => x.code === d) : null;
            deviseSub.textContent = info ? `${d} ${info.country}` : d;
        }
    },

    updateSyncStatus() {
        const status = document.getElementById('syncStatus');
        const dot = document.getElementById('syncDot');
        if (!status || !dot) return;
        if (State.user) {
            status.hidden = false;
            dot.style.background = 'var(--success)';
            dot.style.boxShadow = '0 0 8px var(--success-glow)';
        } else {
            status.hidden = true;
        }
    },

    /**
     * ==========================================
     * UI REFRESH (sans clignotement)
     * ==========================================
     */
    refreshUI() {
        this.applyTheme(State.settings.theme || 'purple');
        this.applyModulesVisibility();
        this.updateAccountUI();

        // ✅ Rafraîchir seulement le dashboard
        if (typeof Dashboard !== 'undefined') Dashboard.render();
    },

    refreshCurrentPage() {
        // ✅ Ne rafraîchir que le dashboard (pas les autres pages)
        if (State.currentPage === 'home' && typeof Dashboard !== 'undefined') {
            Dashboard.render();
        }
    },

    applyModulesVisibility() {
        const map = {
            horaires: ['[data-add="horaire"]', '[data-more="horaires"]'],
            revenus: ['[data-add="revenu"]'],
            depenses: ['[data-add="depense"]'],
            epargne: ['[data-add="epargne"]', '[data-more="epargne"]'],
            objectifs: ['[data-add="objectif"]', '[data-more="objectifs"]'],
            shopping: ['[data-add="shopping"]'],
            recurrent: ['[data-add="recurrent"]', '[data-more="recurrent-check"]'],
            budgets: ['[data-add="budget"]'],
            calendrier: ['[data-more="calendrier"]'],
            multiDevises: ['[data-more="devises"]']
        };

        Object.entries(map).forEach(([module, selectors]) => {
            const active = State.modules[module] === true;
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => { el.hidden = !active; });
            });
        });
    },

    /**
     * ==========================================
     * PAGE CHANGED (anti-clignotement)
     * ==========================================
     */
    onPageChanged(page, previous) {
        console.log(`📄 Page: ${previous || 'none'} → ${page}`);

        // ✅ Si même page + déjà initialisé → ne rien faire
        if (page === previous && this.initialized) return;

        // ✅ Retirer les classes de transition après l'animation
        setTimeout(() => {
            document.querySelectorAll('.page').forEach(p => {
                p.classList.remove('page-transition-forward', 'page-transition-backward');
            });
        }, 500);

        switch (page) {
            case 'home':
                if (typeof Dashboard !== 'undefined') Dashboard.render();
                break;
            case 'add':
                this.applyModulesVisibility();
                this.attachAddMenuEvents();
                break;
            case 'budget':
                if (previous !== 'budget') {
                    this.renderBudgetPage();
                    this.attachBudgetSegments();
                }
                break;
            case 'analyse':
                if (previous !== 'analyse') {
                    this.renderAnalysePage();
                    this.attachAnalyseSegments();
                }
                break;
            case 'more':
                this.updateAccountUI();
                this.applyModulesVisibility();
                break;
        }
    },

    // ✅ Attache les événements sans cloner (pas de clignotement)
    attachAddMenuEvents() {
        document.querySelectorAll('.add-menu-item[data-add]').forEach(item => {
            if (item.dataset.eventsAttached === 'true') return;
            item.dataset.eventsAttached = 'true';
            item.addEventListener('click', () => this.handleAddAction(item.dataset.add));
        });
    },

    /**
     * ==========================================
     * BUDGET
     * ==========================================
     */
    _currentBudgetSegment: 'depenses',

    attachBudgetSegments() {
        document.querySelectorAll('#budgetSegments .segment').forEach(seg => {
            if (seg.dataset.eventsAttached === 'true') return;
            seg.dataset.eventsAttached = 'true';
            seg.addEventListener('click', () => {
                document.querySelectorAll('#budgetSegments .segment').forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                this._currentBudgetSegment = seg.dataset.segment;
                this.renderBudgetPage();
            });
        });
    },

    renderBudgetPage() {
        const segment = this._currentBudgetSegment || 'depenses';
        const content = document.getElementById('budgetContent');
        if (!content) return;

        switch (segment) {
            case 'depenses':
                content.innerHTML = `<button class="btn btn-danger btn-block" onclick="Depenses.openAddForm()" style="margin-bottom:var(--space-md);">➕ Nouvelle dépense</button>${Depenses.renderPage()}`;
                setTimeout(() => Depenses.init(content), 50);
                break;
            case 'shopping':
                content.innerHTML = `<button class="btn btn-primary btn-block" onclick="Shopping.openAddForm()" style="margin-bottom:var(--space-md);">➕ Nouvel achat</button>${Shopping.renderPage()}`;
                setTimeout(() => Shopping.refresh(), 50);
                break;
            case 'recurrent':
                content.innerHTML = `<button class="btn btn-primary btn-block" onclick="Recurrent.openAddForm()" style="margin-bottom:var(--space-md);">➕ Nouvelle récurrente</button><button class="btn btn-outline btn-block" onclick="RecurrentCheck.manualCheck()" style="margin-bottom:var(--space-md);">🔍 Vérifier échéances</button>${Recurrent.renderPage()}`;
                setTimeout(() => Recurrent.refresh(), 50);
                break;
            case 'budgets':
                content.innerHTML = `<button class="btn btn-primary btn-block" onclick="Budgets.openAddForm()" style="margin-bottom:var(--space-md);">➕ Nouveau budget</button>${Budgets.renderPage()}`;
                setTimeout(() => Budgets.refresh(), 50);
                break;
        }
    },

    /**
     * ==========================================
     * ANALYSE
     * ==========================================
     */
    _currentAnalyseView: 'resume',

    attachAnalyseSegments() {
        document.querySelectorAll('#analyseSegments .segment').forEach(seg => {
            if (seg.dataset.eventsAttached === 'true') return;
            seg.dataset.eventsAttached = 'true';
            seg.addEventListener('click', () => {
                document.querySelectorAll('#analyseSegments .segment').forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                this._currentAnalyseView = seg.dataset.analyseView;
                this.renderAnalysePage();
            });
        });
    },

    renderAnalysePage() {
        if (typeof Analyse !== 'undefined') {
            Analyse.render(this._currentAnalyseView);
        }
    },

    /**
     * ==========================================
     * HORAIRES
     * ==========================================
     */
    openHorairesPage() {
        Router.openSheet('horaires-page', '⏰ Historique horaires',
            `<button class="btn btn-primary btn-block" onclick="Horaires.openAddForm()" style="margin-bottom:var(--space-md);">➕ Nouvel horaire</button>${Horaires.renderPage()}`
        );
        setTimeout(() => Horaires.init(document.getElementById('sheetContent')), 100);
    },

    /**
     * ==========================================
     * RACCOURCIS
     * ==========================================
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement.tagName.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag)) return;
            if (e.key >= '1' && e.key <= '5') {
                const page = Router.pages[parseInt(e.key) - 1];
                if (page) Router.navigateTo(page);
            }
            if (e.key.toLowerCase() === 'a') Router.navigateTo('add');
            if (e.key === 'Escape') Router.closeSheet();
        });
    },

    onAppResume() {
        if (Storage.hasPin() && this.initialized) {
            if (Date.now() - this._lastActivity > 5 * 60 * 1000) {
                PinLock.showLockScreen();
            }
        }
        this._lastActivity = Date.now();
        if (typeof RecurrentCheck !== 'undefined') {
            setTimeout(() => RecurrentCheck.checkPending(), 1000);
        }
    },

    /**
     * ==========================================
     * DATA HELPERS
     * ==========================================
     */
    addData(collection, item) {
        if (!State.data[collection]) return false;
        item.id = item.id || StateHelpers.generateId();
        State.data[collection].push(item);
        notifyStateChange();
        if (State.user && !State.isGuestMode) CloudSync.saveItem(collection, item);
        document.dispatchEvent(new CustomEvent('data:added', { detail: { collection, item } }));
        return true;
    },

    removeData(collection, id) {
        if (!State.data[collection]) return false;
        State.data[collection] = State.data[collection].filter(item => item.id !== id);
        notifyStateChange();
        if (State.user && !State.isGuestMode) CloudSync.deleteItem(collection, id);
        document.dispatchEvent(new CustomEvent('data:removed', { detail: { collection, id } }));
        return true;
    },

    updateData(collection, id, patch) {
        if (!State.data[collection]) return false;
        const item = State.data[collection].find(item => item.id === id);
        if (!item) return false;
        Object.assign(item, patch);
        notifyStateChange();
        if (State.user && !State.isGuestMode) CloudSync.saveItem(collection, item);
        document.dispatchEvent(new CustomEvent('data:updated', { detail: { collection, id, patch } }));
        return true;
    }
};

/**
 * TOAST
 */
const Toast = {
    show(message, type = 'default') {
        const container = document.getElementById('toastContainer');
        if (!container) { console.log('Toast:', message); return; }
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'success') toast.classList.add('toast-success');
        if (type === 'error') toast.classList.add('toast-error');
        if (type === 'warning') toast.classList.add('toast-warning');
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'default'); }
};

// Aliases globaux
window.App = App;
window.State = State;
window.StateHelpers = StateHelpers;
window.Format = Format;
window.Storage = Storage;
window.Router = Router;
window.Toast = Toast;
window.Auth = Auth;
window.PinLock = PinLock;
window.CloudSync = CloudSync;
window.FirebaseService = FirebaseService;
window.Dashboard = Dashboard;
window.Horaires = Horaires;
window.Depenses = Depenses;
window.Revenus = Revenus;
window.Epargne = Epargne;
window.Objectifs = Objectifs;
window.Shopping = Shopping;
window.Recurrent = Recurrent;
window.Budgets = Budgets;

if (typeof Graphiques !== 'undefined') window.Graphiques = Graphiques;
if (typeof Analyse !== 'undefined') window.Analyse = Analyse;
if (typeof Calendrier !== 'undefined') window.Calendrier = Calendrier;
if (typeof Suggestions !== 'undefined') window.Suggestions = Suggestions;
if (typeof Notifications !== 'undefined') window.Notifications = Notifications;
if (typeof Devises !== 'undefined') window.Devises = Devises;
if (typeof Tags !== 'undefined') window.Tags = Tags;
if (typeof Tickets !== 'undefined') window.Tickets = Tickets;
if (typeof ExportImport !== 'undefined') window.ExportImport = ExportImport;
if (typeof RecurrentCheck !== 'undefined') window.RecurrentCheck = RecurrentCheck;

document.addEventListener('DOMContentLoaded', () => App.init());
