/* ============================================
   ROUTER.JS - Navigation et transitions
   ============================================ */

'use strict';

/**
 * Système de navigation entre les pages
 * Supporte : onglets, swipe, historique, sheets
 */
const Router = {

    // Pages principales (dans l'ordre pour le swipe)
    pages: ['home', 'add', 'budget', 'analyse', 'more'],

    // Titres et sous-titres de chaque page
    pageConfig: {
        home: {
            title: '💰 MonBudget',
            subtitle: '',
            headerAction: null
        },
        add: {
            title: 'Ajouter',
            subtitle: 'Que souhaitez-vous enregistrer ?',
            headerAction: null
        },
        budget: {
            title: 'Budget',
            subtitle: 'Dépenses et achats prévus',
            headerAction: null
        },
        analyse: {
            title: 'Analyse',
            subtitle: 'Statistiques et graphiques',
            headerAction: null
        },
        more: {
            title: 'Plus',
            subtitle: 'Paramètres et options',
            headerAction: null
        }
    },

    // État interne
    _currentPage: 'home',
    _previousPage: null,
    _swipeStartX: 0,
    _swipeStartY: 0,
    _isSwiping: false,
    _sheetOpen: false,

    /**
     * ==========================================
     * INITIALISATION
     * ==========================================
     */
    init() {
        this._currentPage = State.currentPage || 'home';
        this.setupNavigation();
        this.setupSwipe();
        this.setupSheet();
        this.setupSegments();
        this.navigateTo(this._currentPage, false);
    },

    /**
     * ==========================================
     * NAVIGATION PRINCIPALE
     * ==========================================
     */

    /**
     * Navigue vers une page
     * @param {string} pageName - Nom de la page ('home', 'add', etc.)
     * @param {boolean} animate - Animation de transition
     */
    navigateTo(pageName, animate = true) {
        if (!this.pages.includes(pageName)) {
            console.warn('Page inconnue:', pageName);
            return;
        }

        // Même page → pas de transition
        if (pageName === this._currentPage && animate) return;

        this._previousPage = this._currentPage;
        this._currentPage = pageName;
        State.currentPage = pageName;

        // Cacher toutes les pages
        document.querySelectorAll('.page').forEach(function(page) {
            page.hidden = true;
            page.classList.remove('page-transition-forward', 'page-transition-backward');
        });

        // Afficher la nouvelle page
        var targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.hidden = false;

            // Animation selon la direction
            if (animate && this._previousPage) {
                var prevIndex = this.pages.indexOf(this._previousPage);
                var newIndex = this.pages.indexOf(pageName);
                var direction = newIndex > prevIndex ? 'forward' : 'backward';
                targetPage.classList.add('page-transition-' + direction);
            }
        }

        // Mettre à jour le header
        this.updateHeader(pageName);

        // Mettre à jour la nav
        this.updateNav(pageName);

        // Scroll en haut
        var main = document.getElementById('appMain');
        if (main) main.scrollTop = 0;

        // Événement personnalisé
        document.dispatchEvent(new CustomEvent('page:changed', {
            detail: {
                page: pageName,
                previous: this._previousPage
            }
        }));
    },

    /**
     * Met à jour le header en fonction de la page
     */
    updateHeader(pageName) {
        var config = this.pageConfig[pageName];
        if (!config) return;

        var titleEl = document.getElementById('pageTitle');
        var subtitleEl = document.getElementById('pageSubtitle');
        var actionBtn = document.getElementById('btnHeaderAction');

        if (titleEl) {
            titleEl.textContent = config.title;
        }

        if (subtitleEl) {
            if (config.subtitle) {
                subtitleEl.textContent = config.subtitle;
                subtitleEl.hidden = false;
            } else {
                subtitleEl.hidden = true;
            }
        }

        if (actionBtn) {
            if (config.headerAction) {
                actionBtn.textContent = config.headerAction.icon || '➕';
                actionBtn.hidden = false;
                actionBtn.onclick = config.headerAction.handler || null;
            } else {
                actionBtn.hidden = true;
            }
        }
    },

    /**
     * Met à jour la barre de navigation du bas
     */
    updateNav(pageName) {
        document.querySelectorAll('.nav-tab').forEach(function(tab) {
            var isActive = tab.dataset.nav === pageName;
            tab.classList.toggle('active', isActive);
        });
    },

    /**
     * ==========================================
     * EVENT LISTENERS - Navigation
     * ==========================================
     */
    setupNavigation() {
        var self = this;

        // Boutons de la nav du bas
        document.querySelectorAll('.nav-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var pageName = this.dataset.nav;
                if (pageName) {
                    self.navigateTo(pageName);
                    // Vibration haptique (si supportée)
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            });
        });

        // Boutons du menu "Plus"
        document.querySelectorAll('.menu-item[data-more]').forEach(function(item) {
            item.addEventListener('click', function() {
                var action = this.dataset.more;
                self.handleMoreAction(action);
            });
        });

        // Boutons du menu "Ajouter"
        document.querySelectorAll('.add-menu-item[data-add]').forEach(function(item) {
            item.addEventListener('click', function() {
                var type = this.dataset.add;
                self.handleAddAction(type);
            });
        });
    },

    /**
     * Gère les actions du menu "Plus"
     */
    handleMoreAction(action) {
        switch (action) {
            case 'theme':
                this.openSheet('theme', 'Choisir un thème', this.renderThemeSheet());
                break;
            case 'modules':
                this.openSheet('modules', 'Modules actifs', this.renderModulesSheet());
                break;
            case 'pin':
                this.openSheet('pin', 'Code PIN', this.renderPinSheet());
                break;
            case 'export':
                if (Storage.downloadExport()) {
                    Toast.success('📤 Données exportées !');
                } else {
                    Toast.error('❌ Erreur export');
                }
                break;
            case 'import':
                this.triggerImport();
                break;
            case 'reset':
                this.confirmReset();
                break;
            case 'account':
                this.openSheet('account', 'Mon compte', this.renderAccountSheet());
                break;
            case 'epargne':
            case 'objectifs':
            case 'horaires':
            case 'calendrier':
                Toast.info('🚧 Disponible dans le Lot 3');
                break;
            default:
                console.log('Action:', action);
        }
    },

    /**
     * Gère les actions du menu "Ajouter"
     */
    handleAddAction(type) {
        // Sera complété dans le Lot 3
        Toast.info('🚧 Formulaire "' + type + '" bientôt disponible (Lot 3)');
    },

    /**
     * ==========================================
     * SWIPE NAVIGATION
     * ==========================================
     */
    setupSwipe() {
        var self = this;
        var main = document.getElementById('appMain');
        if (!main) return;

        var threshold = 80;     // Distance min pour déclencher
        var maxVertical = 50;   // Distance max verticale tolérée

        main.addEventListener('touchstart', function(e) {
            if (self._sheetOpen) return;
            self._swipeStartX = e.touches[0].clientX;
            self._swipeStartY = e.touches[0].clientY;
            self._isSwiping = false;
        }, { passive: true });

        main.addEventListener('touchmove', function(e) {
            if (self._sheetOpen) return;
            var dx = e.touches[0].clientX - self._swipeStartX;
            var dy = Math.abs(e.touches[0].clientY - self._swipeStartY);

            // Ne pas swiper si le mouvement est surtout vertical
            if (dy > maxVertical) return;

            if (Math.abs(dx) > 20) {
                self._isSwiping = true;
            }
        }, { passive: true });

        main.addEventListener('touchend', function(e) {
            if (self._sheetOpen || !self._isSwiping) return;

            var dx = e.changedTouches[0].clientX - self._swipeStartX;
            var dy = Math.abs(e.changedTouches[0].clientY - self._swipeStartY);

            if (dy > maxVertical) return;

            if (Math.abs(dx) >= threshold) {
                var currentIndex = self.pages.indexOf(self._currentPage);

                if (dx < 0 && currentIndex < self.pages.length - 1) {
                    // Swipe gauche → page suivante
                    self.navigateTo(self.pages[currentIndex + 1]);
                } else if (dx > 0 && currentIndex > 0) {
                    // Swipe droite → page précédente
                    self.navigateTo(self.pages[currentIndex - 1]);
                }
            }

            self._isSwiping = false;
        }, { passive: true });
    },

    /**
     * ==========================================
     * SEGMENTS (sous-onglets)
     * ==========================================
     */
    setupSegments() {
        document.querySelectorAll('.segment-control').forEach(function(control) {
            control.querySelectorAll('.segment').forEach(function(seg) {
                seg.addEventListener('click', function() {
                    // Désactiver tous les segments du même contrôle
                    control.querySelectorAll('.segment').forEach(function(s) {
                        s.classList.remove('active');
                    });
                    // Activer le segment cliqué
                    seg.classList.add('active');

                    // Événement
                    document.dispatchEvent(new CustomEvent('segment:changed', {
                        detail: { segment: seg.dataset.segment }
                    }));
                });
            });
        });
    },

    /**
     * ==========================================
     * SHEET (Modal du bas style iOS)
     * ==========================================
     */
    setupSheet() {
        var self = this;

        // Bouton fermer
        var closeBtn = document.getElementById('sheetClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.closeSheet();
            });
        }

        // Clic sur l'overlay
        var overlay = document.getElementById('sheetOverlay');
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    self.closeSheet();
                }
            });
        }
    },

    /**
     * Ouvre une sheet avec un contenu
     * @param {string} id - Identifiant de la sheet
     * @param {string} title - Titre affiché
     * @param {string} htmlContent - Contenu HTML
     */
    openSheet(id, title, htmlContent) {
        var overlay = document.getElementById('sheetOverlay');
        var titleEl = document.getElementById('sheetTitle');
        var content = document.getElementById('sheetContent');

        if (!overlay || !titleEl || !content) return;

        titleEl.textContent = title;
        content.innerHTML = htmlContent;
        overlay.hidden = false;
        this._sheetOpen = true;

        // Attacher les événements du contenu
        this.attachSheetEvents(id);

        // Animer l'ouverture
        requestAnimationFrame(function() {
            overlay.classList.add('show');
        });
    },

    /**
     * Ferme la sheet actuelle
     */
    closeSheet() {
        var overlay = document.getElementById('sheetOverlay');
        if (!overlay) return;

        overlay.classList.remove('show');
        this._sheetOpen = false;

        // Attendre la fin de l'animation
        setTimeout(function() {
            overlay.hidden = true;
        }, 300);
    },

    /**
     * Attache les événements spécifiques au contenu de la sheet
     */
    attachSheetEvents(sheetId) {
        var self = this;

        switch (sheetId) {
            case 'theme':
                document.querySelectorAll('.theme-option').forEach(function(opt) {
                    opt.addEventListener('click', function() {
                        var theme = this.dataset.theme;
                        State.settings.theme = theme;
                        App.applyTheme(theme);
                        notifyStateChange();
                        self.closeSheet();
                        Toast.success('🎨 Thème appliqué !');
                    });
                });
                break;

            case 'modules':
                document.querySelectorAll('.module-switch').forEach(function(sw) {
                    sw.addEventListener('click', function() {
                        var moduleName = this.dataset.module;
                        State.modules[moduleName] = !State.modules[moduleName];
                        this.classList.toggle('active', State.modules[moduleName]);
                        notifyStateChange();
                    });
                });
                break;

            case 'confirm':
                var confirmBtn = document.getElementById('sheetConfirmBtn');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        var action = this.dataset.action;
                        self.executeConfirmAction(action);
                    });
                }
                var cancelBtn = document.getElementById('sheetCancelBtn');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', function() {
                        self.closeSheet();
                    });
                }
                break;
        }
    },

    /**
     * ==========================================
     * RENDERERS pour les sheets
     * ==========================================
     */

    /**
     * Rendu du sélecteur de thème
     */
    renderThemeSheet() {
        var currentTheme = State.settings.theme || 'purple';
        var html = '<div class="theme-grid">';

        THEMES_DISPONIBLES.forEach(function(t) {
            var activeClass = t.id === currentTheme ? ' active' : '';
            html += '<button class="theme-option' + activeClass + '" data-theme="' + t.id + '">' +
                '<div class="theme-preview theme-preview-' + t.id + '">' +
                '<span></span><span></span><span></span>' +
                '</div>' +
                '<span class="theme-option-label">' + t.label + '</span>' +
                '</button>';
        });

        html += '</div>';
        return html;
    },

    /**
     * Rendu des modules activables
     */
    renderModulesSheet() {
        var modules = [
            { key: 'horaires', label: 'Horaires', icon: '⏰', desc: 'Suivi des heures de travail' },
            { key: 'revenus', label: 'Revenus', icon: '💰', desc: 'Salaires et revenus supplémentaires' },
            { key: 'depenses', label: 'Dépenses', icon: '💳', desc: 'Suivi des dépenses' },
            { key: 'epargne', label: 'Épargne', icon: '🏦', desc: 'Dépôts et retraits' },
            { key: 'objectifs', label: 'Objectifs', icon: '🎯', desc: 'Objectifs d\'épargne' },
            { key: 'shopping', label: 'Liste d\'achats', icon: '🛒', desc: 'Choses à acheter' },
            { key: 'recurrent', label: 'Dépenses récurrentes', icon: '🔁', desc: 'Loyer, abonnements...' },
            { key: 'budgets', label: 'Budgets par catégorie', icon: '📊', desc: 'Limites par catégorie' },
            { key: 'calendrier', label: 'Calendrier', icon: '📅', desc: 'Vue calendrier' },
            { key: 'analyseAvancee', label: 'Analyse avancée', icon: '📈', desc: 'Graphiques sur 6/12 mois' },
            { key: 'suggestions', label: 'Suggestions', icon: '💡', desc: 'Conseils intelligents' },
            { key: 'tickets', label: 'Photos de tickets', icon: '📸', desc: 'Joindre des photos' },
            { key: 'multiDevises', label: 'Multi-devises', icon: '🌍', desc: 'Conversion de devises' }
        ];

        var html = '<div class="form" style="gap:0">';

        modules.forEach(function(m) {
            var isActive = State.modules[m.key] === true;
            var activeClass = isActive ? ' active' : '';
            html += '<div class="switch-row">' +
                '<div class="switch-row-body">' +
                '<div class="switch-row-title">' + m.icon + ' ' + m.label + '</div>' +
                '<div class="switch-row-desc">' + m.desc + '</div>' +
                '</div>' +
                '<div class="switch module-switch' + activeClass + '" data-module="' + m.key + '"></div>' +
                '</div>';
        });

        html += '</div>';
        return html;
    },

    /**
     * Rendu de la sheet PIN
     */
    renderPinSheet() {
        var hasPin = Storage.hasPin();
        var html = '';

        if (hasPin) {
            html = '<div class="banner banner-success" style="margin-bottom:16px">' +
                '<span class="banner-icon">🔒</span>' +
                '<div class="banner-body"><div class="banner-title">Code PIN activé</div>' +
                '<div class="banner-text">Votre app est protégée</div></div></div>' +
                '<p style="color:var(--text2);font-size:var(--text-sm);text-align:center;margin-bottom:16px">' +
                'Pour modifier ou supprimer le PIN, utilisez les boutons ci-dessous.</p>' +
                '<p style="color:var(--text3);font-size:var(--text-xs);text-align:center">' +
                '🚧 Gestion avancée du PIN dans le Lot 3</p>';
        } else {
            html = '<div class="banner" style="margin-bottom:16px">' +
                '<span class="banner-icon">🔓</span>' +
                '<div class="banner-body"><div class="banner-title">Aucun code PIN</div>' +
                '<div class="banner-text">Votre app n\'est pas protégée</div></div></div>' +
                '<p style="color:var(--text3);font-size:var(--text-xs);text-align:center">' +
                '🚧 Configuration du PIN dans le Lot 3</p>';
        }

        return html;
    },

    /**
     * Rendu de la sheet Compte
     */
    renderAccountSheet() {
        var isLoggedIn = State.user !== null;

        if (isLoggedIn) {
            return '<div class="banner banner-success" style="margin-bottom:16px">' +
                '<span class="banner-icon">☁️</span>' +
                '<div class="banner-body"><div class="banner-title">Connecté</div>' +
                '<div class="banner-text">' + (State.user.email || '') + '</div></div></div>' +
                '<p style="color:var(--text3);font-size:var(--text-xs);text-align:center">' +
                '🚧 Gestion du compte dans le Lot 2</p>';
        }

        return '<div class="banner" style="margin-bottom:16px">' +
            '<span class="banner-icon">👤</span>' +
            '<div class="banner-body"><div class="banner-title">Mode local</div>' +
            '<div class="banner-text">Vos données sont uniquement sur cet appareil</div></div></div>' +
            '<p style="color:var(--text3);font-size:var(--text-xs);text-align:center">' +
            '🚧 Connexion Firebase dans le Lot 2</p>';
    },

    /**
     * ==========================================
     * ACTIONS
     * ==========================================
     */

    /**
     * Déclenche l'import de fichier
     */
    triggerImport() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';

        input.addEventListener('change', function() {
            if (input.files.length > 0) {
                Storage.importFromFile(input.files[0])
                    .then(function(success) {
                        if (success) {
                            Toast.success('📥 Données importées !');
                            // Recharger l'affichage
                            document.dispatchEvent(new CustomEvent('data:imported'));
                        } else {
                            Toast.error('❌ Erreur import');
                        }
                    })
                    .catch(function(err) {
                        Toast.error('❌ ' + err.message);
                    });
            }
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    },

    /**
     * Demande confirmation avant de tout effacer
     */
    confirmReset() {
        var self = this;
        this.openSheet('confirm', '⚠️ Tout supprimer ?',
            '<p style="color:var(--text2);text-align:center;margin-bottom:20px">' +
            'Toutes vos données seront définitivement effacées. Cette action est irréversible.</p>' +
            '<div class="modal-actions">' +
            '<button class="btn btn-secondary" id="sheetCancelBtn">Annuler</button>' +
            '<button class="btn btn-danger" id="sheetConfirmBtn" data-action="reset">Tout effacer</button>' +
            '</div>'
        );
    },

    /**
     * Exécute une action de confirmation
     */
    executeConfirmAction(action) {
        switch (action) {
            case 'reset':
                Storage.clearAll();
                this.closeSheet();
                Toast.success('🗑️ Tout a été effacé');
                // Recharger l'app
                setTimeout(function() {
                    location.reload();
                }, 800);
                break;
        }
    }
};
