/* ============================================
   APP.JS - Point d'entrée principal v5
   ============================================ */

'use strict';

/**
 * Application principale
 */
const App = {

    initialized: false,

    /**
     * Démarrage de l'application
     */
    async init() {
        console.log('🚀 Initialisation MonBudget v5...');

        try {
            // 1. Charger les données locales + migration éventuelle
            Storage.init();

            // 2. Appliquer le thème
            this.applyTheme(State.settings.theme || 'purple');

            // 3. Initialiser le router / navigation
            Router.init();

            // 4. Initialiser les événements globaux
            this.setupGlobalEvents();

            // 5. Initialiser les raccourcis clavier utiles sur desktop
            this.setupKeyboardShortcuts();

            // 6. Mettre à jour l’interface selon les modules actifs
            this.applyModulesVisibility();

            // 7. Cacher le splash screen
            this.hideSplash();

            this.initialized = true;

            console.log('✅ MonBudget v5 initialisé');

            Toast.success('Bienvenue sur MonBudget v5');

        } catch (error) {
            console.error('❌ Erreur initialisation app:', error);
            this.showFatalError(error);
        }
    },

    /**
     * Applique le thème choisi
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            const colors = {
                purple: '#0f0a1e',
                dark: '#0a0a0a',
                light: '#f5f7fa',
                blue: '#0a1628',
                red: '#1a0a0e',
                green: '#0a1a12'
            };

            metaTheme.setAttribute('content', colors[theme] || colors.purple);
        }

        State.settings.theme = theme;
        Storage.saveSection('settings');

        document.dispatchEvent(new CustomEvent('theme:changed', {
            detail: { theme }
        }));
    },

    /**
     * Cache l'écran de chargement
     */
    hideSplash() {
        const splash = document.getElementById('splashScreen');
        const app = document.getElementById('app');

        if (!splash || !app) return;

        app.hidden = false;

        requestAnimationFrame(() => {
            splash.classList.add('fade-out');

            setTimeout(() => {
                splash.hidden = true;
            }, 450);
        });
    },

    /**
     * Affiche une erreur critique
     */
    showFatalError(error) {
        const splash = document.getElementById('splashScreen');

        if (!splash) {
            alert('Erreur au lancement : ' + error.message);
            return;
        }

        splash.innerHTML = `
            <div class="splash-logo">⚠️</div>
            <div class="splash-title">Erreur</div>
            <p style="color: var(--text2); text-align:center; max-width:300px; padding:0 20px;">
                Impossible de lancer l'application.
            </p>
            <pre style="
                color: var(--danger);
                background: var(--card);
                padding: 12px;
                border-radius: 12px;
                max-width: 90vw;
                overflow:auto;
                font-size: 0.75rem;
            ">${error.message}</pre>
            <button onclick="location.reload()" style="
                margin-top:16px;
                padding:12px 20px;
                background:var(--primary);
                color:white;
                border-radius:12px;
                font-weight:700;
            ">Recharger</button>
        `;
    },

    /**
     * Événements globaux
     */
    setupGlobalEvents() {
        // Quand une page change
        document.addEventListener('page:changed', (e) => {
            this.onPageChanged(e.detail.page, e.detail.previous);
        });

        // Quand les données sont importées
        document.addEventListener('data:imported', () => {
            this.refreshUI();
        });

        // Quand le thème change
        document.addEventListener('theme:changed', (e) => {
            console.log('🎨 Thème changé:', e.detail.theme);
        });

        // Quand l’état est sauvegardé
        document.addEventListener('state:saved', (e) => {
            console.log('💾 État sauvegardé:', e.detail.size + ' octets');
        });

        // Gestion du retour navigateur
        window.addEventListener('popstate', () => {
            // Pour l’instant, on garde simple
            // Plus tard : historique réel des pages
        });

        // PWA install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredInstallPrompt = e;
            console.log('📲 Installation PWA disponible');
        });

        // Quand l'app revient au premier plan
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.onAppResume();
            }
        });
    },

    /**
     * Événements clavier desktop
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Éviter les raccourcis quand on tape dans un input
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            // Navigation avec touches 1-5
            if (e.key >= '1' && e.key <= '5') {
                const index = parseInt(e.key) - 1;
                const page = Router.pages[index];
                if (page) Router.navigateTo(page);
            }

            // A pour Ajouter
            if (e.key.toLowerCase() === 'a') {
                Router.navigateTo('add');
            }

            // Échap ferme une sheet
            if (e.key === 'Escape') {
                Router.closeSheet();
            }
        });
    },

    /**
     * Quand on change de page
     */
    onPageChanged(page, previous) {
        console.log(`📄 Page: ${previous || 'none'} → ${page}`);

        // Rafraîchir selon la page
        switch (page) {
            case 'home':
                this.renderHomePlaceholder();
                break;

            case 'add':
                this.refreshAddMenu();
                break;

            case 'budget':
                this.refreshBudgetPlaceholder();
                break;

            case 'analyse':
                this.refreshAnalysePlaceholder();
                break;

            case 'more':
                this.refreshMorePage();
                break;
        }
    },

    /**
     * Quand l'app revient au premier plan
     */
    onAppResume() {
        console.log('🔄 App reprise');

        // Plus tard : vérifier sync Firebase, notifications, dépenses récurrentes...
    },

    /**
     * Rafraîchissement global UI
     */
    refreshUI() {
        this.applyTheme(State.settings.theme || 'purple');
        this.applyModulesVisibility();

        const current = State.currentPage || 'home';
        Router.navigateTo(current, false);
    },

    /**
     * Applique l’affichage selon les modules activés/désactivés
     */
    applyModulesVisibility() {
        // Pour le Lot 1, on masque uniquement les entrées des menus.
        // Les vrais modules seront connectés dans les lots suivants.

        const moduleMap = {
            horaires: ['[data-add="horaire"]', '[data-more="horaires"]'],
            revenus: ['[data-add="revenu"]'],
            depenses: ['[data-add="depense"]'],
            epargne: ['[data-add="epargne"]', '[data-more="epargne"]'],
            objectifs: ['[data-add="objectif"]', '[data-more="objectifs"]', '[data-nav="objectifs"]'],
            shopping: ['[data-add="shopping"]'],
            recurrent: ['[data-add="recurrent"]'],
            calendrier: ['[data-more="calendrier"]']
        };

        Object.entries(moduleMap).forEach(([module, selectors]) => {
            const active = State.modules[module] === true;

            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.hidden = !active;
                });
            });
        });
    },

    /**
     * Placeholder Accueil
     */
    renderHomePlaceholder() {
        const page = document.querySelector('#page-home .page-content');
        if (!page) return;

        // Pour le Lot 1, on garde un dashboard simplifié.
        // Les vraies cartes seront branchées au Lot 3.
        page.innerHTML = `
            <div class="card card-glow animate-slide-up">
                <div class="card-header">
                    <div>
                        <div class="card-title">Bienvenue 👋</div>
                        <div class="card-subtitle">Nouvelle version ergonomique v5</div>
                    </div>
                    <span style="font-size:2rem">💰</span>
                </div>
                <p class="text-secondary text-sm">
                    L'application a été restructurée pour être plus claire, plus rapide et plus facile à améliorer.
                </p>
            </div>

            <div class="stat-grid animate-slide-up">
                <div class="stat-card">
                    <span class="stat-icon">⏰</span>
                    <span class="stat-value">${State.data.horaires.length}</span>
                    <span class="stat-label">Horaires</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">💳</span>
                    <span class="stat-value">${State.data.depenses.length}</span>
                    <span class="stat-label">Dépenses</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">🏦</span>
                    <span class="stat-value">${Format.money(StateHelpers.getEpargneSolde())}</span>
                    <span class="stat-label">Épargne</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">🎯</span>
                    <span class="stat-value">${State.data.objectifs.length}</span>
                    <span class="stat-label">Objectifs</span>
                </div>
            </div>

            <div class="banner banner-info animate-slide-up">
                <span class="banner-icon">🚧</span>
                <div class="banner-body">
                    <div class="banner-title">Lot 1 installé</div>
                    <div class="banner-text">
                        Navigation, thèmes, stockage et structure propre sont prêts.
                        Les vrais modules arrivent dans les prochains lots.
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Menu Ajouter
     */
    refreshAddMenu() {
        // Rien de spécial pour Lot 1
        this.applyModulesVisibility();
    },

    /**
     * Placeholder Budget
     */
    refreshBudgetPlaceholder() {
        // Rien de spécial pour Lot 1
    },

    /**
     * Placeholder Analyse
     */
    refreshAnalysePlaceholder() {
        // Rien de spécial pour Lot 1
    },

    /**
     * Rafraîchit la page Plus
     */
    refreshMorePage() {
        const accountLabel = document.getElementById('menuAccountLabel');
        if (accountLabel) {
            accountLabel.textContent = State.user ? (State.user.email || 'Connecté') : 'Mode local';
        }

        this.applyModulesVisibility();
    },

    /**
     * Utilitaire pour ajouter une donnée
     */
    addData(collection, item) {
        if (!State.data[collection]) {
            console.error('Collection inconnue:', collection);
            return false;
        }

        item.id = item.id || StateHelpers.generateId();
        State.data[collection].push(item);

        notifyStateChange();

        document.dispatchEvent(new CustomEvent('data:added', {
            detail: { collection, item }
        }));

        return true;
    },

    /**
     * Utilitaire pour supprimer une donnée
     */
    removeData(collection, id) {
        if (!State.data[collection]) {
            console.error('Collection inconnue:', collection);
            return false;
        }

        State.data[collection] = State.data[collection].filter(item => item.id !== id);

        notifyStateChange();

        document.dispatchEvent(new CustomEvent('data:removed', {
            detail: { collection, id }
        }));

        return true;
    },

    /**
     * Utilitaire pour mettre à jour une donnée
     */
    updateData(collection, id, patch) {
        if (!State.data[collection]) {
            console.error('Collection inconnue:', collection);
            return false;
        }

        const item = State.data[collection].find(item => item.id === id);
        if (!item) return false;

        Object.assign(item, patch);

        notifyStateChange();

        document.dispatchEvent(new CustomEvent('data:updated', {
            detail: { collection, id, patch }
        }));

        return true;
    }
};

/**
 * ==========================================
 * Toast notifications
 * ==========================================
 */
const Toast = {

    show(message, type = 'default') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log('Toast:', message);
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'toast';

        if (type === 'success') toast.classList.add('toast-success');
        if (type === 'error') toast.classList.add('toast-error');
        if (type === 'warning') toast.classList.add('toast-warning');

        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    },

    success(message) {
        this.show(message, 'success');
    },

    error(message) {
        this.show(message, 'error');
    },

    warning(message) {
        this.show(message, 'warning');
    },

    info(message) {
        this.show(message, 'default');
    }
};

/**
 * ==========================================
 * Helpers globaux temporaires
 * Ces helpers permettront de garder une API simple
 * pendant qu'on découpe progressivement l'application.
 * ==========================================
 */

// Alias temporaire pour compatibilité future
window.App = App;
window.State = State;
window.StateHelpers = StateHelpers;
window.Format = Format;
window.Storage = Storage;
window.Router = Router;
window.Toast = Toast;

/**
 * Démarrage réel quand le DOM est prêt
 */
document.addEventListener('DOMContentLoaded', function () {
    App.init();
});
