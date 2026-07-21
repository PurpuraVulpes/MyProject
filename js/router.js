/* ============================================
   ROUTER.JS - Navigation et transitions
   ============================================ */

'use strict';

const Router = {

    pages: ['home', 'add', 'budget', 'analyse', 'more'],

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
    navigateTo(pageName, animate) {
        if (animate === undefined) animate = true;

        if (!this.pages.includes(pageName)) {
            console.warn('Page inconnue:', pageName);
            return;
        }

        if (pageName === this._currentPage && animate) return;

        this._previousPage = this._currentPage;
        this._currentPage = pageName;
        State.currentPage = pageName;

        document.querySelectorAll('.page').forEach(function(page) {
            page.hidden = true;
            page.classList.remove('page-transition-forward', 'page-transition-backward');
        });

        var targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.hidden = false;

            if (animate && this._previousPage) {
                var prevIndex = this.pages.indexOf(this._previousPage);
                var newIndex = this.pages.indexOf(pageName);
                var direction = newIndex > prevIndex ? 'forward' : 'backward';
                targetPage.classList.add('page-transition-' + direction);
            }
        }

        this.updateHeader(pageName);
        this.updateNav(pageName);

        var main = document.getElementById('appMain');
        if (main) main.scrollTop = 0;

        document.dispatchEvent(new CustomEvent('page:changed', {
            detail: {
                page: pageName,
                previous: this._previousPage
            }
        }));
    },

    updateHeader(pageName) {
        var config = this.pageConfig[pageName];
        if (!config) return;

        var titleEl = document.getElementById('pageTitle');
        var subtitleEl = document.getElementById('pageSubtitle');
        var actionBtn = document.getElementById('btnHeaderAction');

        if (titleEl) titleEl.textContent = config.title;

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

    updateNav(pageName) {
        document.querySelectorAll('.nav-tab').forEach(function(tab) {
            var isActive = tab.dataset.nav === pageName;
            tab.classList.toggle('active', isActive);
        });
    },

    /**
     * ==========================================
     * EVENT LISTENERS
     * ==========================================
     */
    setupNavigation() {
        var self = this;

        document.querySelectorAll('.nav-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var pageName = this.dataset.nav;
                if (pageName) {
                    self.navigateTo(pageName);
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            });
        });

        document.querySelectorAll('.menu-item[data-more]').forEach(function(item) {
            item.addEventListener('click', function() {
                var action = this.dataset.more;
                if (typeof App !== 'undefined' && App.handleMoreAction) {
                    App.handleMoreAction(action);
                }
            });
        });

        document.querySelectorAll('.add-menu-item[data-add]').forEach(function(item) {
            item.addEventListener('click', function() {
                var type = this.dataset.add;
                if (typeof App !== 'undefined' && App.handleAddAction) {
                    App.handleAddAction(type);
                }
            });
        });
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

        var threshold = 80;
        var maxVertical = 50;

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
                    self.navigateTo(self.pages[currentIndex + 1]);
                } else if (dx > 0 && currentIndex > 0) {
                    self.navigateTo(self.pages[currentIndex - 1]);
                }
            }

            self._isSwiping = false;
        }, { passive: true });
    },

    /**
     * ==========================================
     * SEGMENTS
     * ==========================================
     */
    setupSegments() {
        document.querySelectorAll('.segment-control').forEach(function(control) {
            control.querySelectorAll('.segment').forEach(function(seg) {
                seg.addEventListener('click', function() {
                    control.querySelectorAll('.segment').forEach(function(s) {
                        s.classList.remove('active');
                    });
                    seg.classList.add('active');

                    document.dispatchEvent(new CustomEvent('segment:changed', {
                        detail: { segment: seg.dataset.segment }
                    }));
                });
            });
        });
    },

    /**
     * ==========================================
     * SHEET (Modal du bas)
     * ==========================================
     */
    setupSheet() {
        var self = this;

        var closeBtn = document.getElementById('sheetClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.closeSheet();
            });
        }

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
     * ✅ CORRIGÉ : remplace le contenu si déjà ouverte
     */
    openSheet(id, title, htmlContent) {
        var overlay = document.getElementById('sheetOverlay');
        var titleEl = document.getElementById('sheetTitle');
        var content = document.getElementById('sheetContent');

        if (!overlay || !titleEl || !content) return;

        var wasOpen = this._sheetOpen;

        titleEl.textContent = title;
        content.innerHTML = htmlContent;
        content.scrollTop = 0;

        this._sheetOpen = true;

        if (!wasOpen) {
            overlay.hidden = false;
            requestAnimationFrame(function() {
                overlay.classList.add('show');
            });
        }

        this.attachSheetEvents(id);
    },

    /**
     * Ferme la sheet actuelle
     */
    closeSheet() {
        var overlay = document.getElementById('sheetOverlay');
        if (!overlay) return;

        overlay.classList.remove('show');
        this._sheetOpen = false;

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
                        if (typeof notifyStateChange === 'function') notifyStateChange();
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
                        if (typeof notifyStateChange === 'function') notifyStateChange();
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
     * Exécute une action de confirmation
     */
    executeConfirmAction(action) {
        switch (action) {
            case 'reset':
                Storage.clearAll();
                this.closeSheet();
                Toast.success('🗑️ Tout a été effacé');
                setTimeout(function() {
                    location.reload();
                }, 800);
                break;
        }
    }
};

window.Router = Router;
