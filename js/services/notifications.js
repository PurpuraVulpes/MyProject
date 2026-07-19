/* ============================================
   NOTIFICATIONS.JS - Notifications PWA
   ============================================ */

'use strict';

const Notifications = {

    // État
    permission: 'default', // 'default', 'granted', 'denied'
    isSupported: false,

    // Timers actifs (pour les rappels)
    _timers: {},

    /**
     * ==========================================
     * INITIALISATION
     * ==========================================
     */
    init() {
        // Vérifier le support
        this.isSupported = 'Notification' in window;

        if (!this.isSupported) {
            console.log('⚠️ Notifications non supportées');
            return;
        }

        this.permission = Notification.permission;
        console.log('🔔 Notifications:', this.permission);

        // Programmer les rappels si autorisés
        if (this.permission === 'granted' && State.settings.notificationsActives) {
            this.scheduleAll();
        }
    },

    /**
     * Demande l'autorisation
     */
    async requestPermission() {
        if (!this.isSupported) {
            Toast.warning('⚠️ Notifications non supportées sur ce navigateur');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            this.permission = result;

            if (result === 'granted') {
                State.settings.notificationsActives = true;
                Storage.saveSection('settings');
                if (State.user && !State.isGuestMode) CloudSync.saveSettings();

                // Notification de bienvenue
                this.show('🎉 Notifications activées !', {
                    body: 'Vous serez alerté pour vos échéances et budgets.',
                    icon: '💰'
                });

                this.scheduleAll();
                return true;
            } else if (result === 'denied') {
                Toast.warning('❌ Notifications refusées');
                return false;
            }

            return false;
        } catch (error) {
            console.error('Erreur permission:', error);
            return false;
        }
    },

    /**
     * Désactive les notifications
     */
    disable() {
        State.settings.notificationsActives = false;
        Storage.saveSection('settings');
        if (State.user && !State.isGuestMode) CloudSync.saveSettings();

        this.clearAllTimers();
        Toast.info('🔕 Notifications désactivées');
    },

    /**
     * ==========================================
     * AFFICHAGE DE NOTIFICATIONS
     * ==========================================
     */

    /**
     * Affiche une notification
     */
    show(title, options = {}) {
        if (!this.isSupported || this.permission !== 'granted') {
            // Fallback : Toast
            Toast.info(title);
            return;
        }

        try {
            const defaultOptions = {
                body: '',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'monbudget-' + Date.now(),
                requireInteraction: false
            };

            const finalOptions = { ...defaultOptions, ...options };

            // Utiliser le service worker si disponible pour PWA
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, finalOptions);
                });
            } else {
                new Notification(title, finalOptions);
            }
        } catch (error) {
            console.error('Erreur notification:', error);
            Toast.info(title);
        }
    },

    /**
     * ==========================================
     * PLANIFICATION DES RAPPELS
     * ==========================================
     */

    /**
     * Planifie tous les rappels
     */
    scheduleAll() {
        this.clearAllTimers();

        if (!State.settings.notificationsActives || this.permission !== 'granted') return;

        console.log('🔔 Planification des rappels...');

        this.scheduleRecurrentReminders();
        this.scheduleBudgetChecks();
        this.scheduleObjectifsCheck();
        this.scheduleDailyRecap();
    },

    /**
     * Rappels pour les dépenses récurrentes
     */
    scheduleRecurrentReminders() {
        const recurrent = (State.data.recurrent || []).filter(r => r.actif !== false);

        recurrent.forEach(r => {
            const today = new Date();
            const currentDay = today.getDate();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            // Prochaine échéance
            let nextDate;
            if (r.jour >= currentDay) {
                nextDate = new Date(currentYear, currentMonth, r.jour, 9, 0, 0); // 9h du matin
            } else {
                nextDate = new Date(currentYear, currentMonth + 1, r.jour, 9, 0, 0);
            }

            // Rappel 2 jours avant
            const reminderDate = new Date(nextDate);
            reminderDate.setDate(reminderDate.getDate() - 2);

            const now = new Date();
            const delay = reminderDate.getTime() - now.getTime();

            if (delay > 0 && delay < 30 * 24 * 60 * 60 * 1000) { // Max 30 jours
                this._timers[`rec-${r.id}`] = setTimeout(() => {
                    this.show(`🔔 Rappel : ${r.nom}`, {
                        body: `${Format.money(r.montant)} prévu dans 2 jours (le ${r.jour})`,
                        tag: `recurrent-${r.id}`
                    });
                }, delay);

                console.log(`⏰ Rappel "${r.nom}" prévu dans ${Math.round(delay / (1000 * 60 * 60))} h`);
            }
        });
    },

    /**
     * Vérification quotidienne des budgets
     */
    scheduleBudgetChecks() {
        const budgets = State.data.budgets || [];
        if (budgets.length === 0) return;

        // Programmer une vérification quotidienne à 19h
        const now = new Date();
        const check = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);

        // Si 19h est déjà passé, programmer pour demain
        if (check < now) {
            check.setDate(check.getDate() + 1);
        }

        const delay = check.getTime() - now.getTime();

        this._timers['budget-check'] = setTimeout(() => {
            this.checkBudgets();

            // Reprogrammer pour le lendemain (24h)
            setInterval(() => this.checkBudgets(), 24 * 60 * 60 * 1000);
        }, delay);
    },

    /**
     * Vérifie les budgets et notifie si dépassement
     */
    checkBudgets() {
        const budgets = State.data.budgets || [];
        const currentM = StateHelpers.currentMonth();
        const depenses = StateHelpers.getDepensesForMonth(currentM);

        const catTotals = {};
        depenses.forEach(d => {
            catTotals[d.categorie] = (catTotals[d.categorie] || 0) + d.montant;
        });

        budgets.forEach(b => {
            const spent = catTotals[b.categorie] || 0;
            const percent = b.max > 0 ? (spent / b.max) * 100 : 0;

            if (percent >= 100) {
                this.show(`🚨 Budget dépassé !`, {
                    body: `${b.categorie} : ${Format.money(spent)} / ${Format.money(b.max)}`,
                    tag: `budget-${b.id}`,
                    requireInteraction: true
                });
            } else if (percent >= 90) {
                this.show(`⚠️ Budget presque atteint`, {
                    body: `${b.categorie} : ${Math.round(percent)}% (${Format.money(spent)} / ${Format.money(b.max)})`,
                    tag: `budget-${b.id}`
                });
            }
        });
    },

    /**
     * Vérification des objectifs (progression)
     */
    scheduleObjectifsCheck() {
        // Une vérification par semaine
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        this._timers['objectifs-check'] = setInterval(() => {
            this.checkObjectifs();
        }, oneWeek);
    },

    checkObjectifs() {
        const objectifs = State.data.objectifs || [];

        objectifs.forEach(o => {
            const percent = (o.deja / o.montant) * 100;

            // Objectif atteint
            if (percent >= 100 && !o._notifiedComplete) {
                this.show(`🏆 Objectif atteint !`, {
                    body: `Bravo ! Vous avez atteint "${o.nom}"`,
                    tag: `objectif-${o.id}`,
                    requireInteraction: true
                });
                o._notifiedComplete = true;
                notifyStateChange();
            }
            // Presque atteint
            else if (percent >= 90 && percent < 100 && !o._notifiedNear) {
                this.show(`🎯 Objectif proche !`, {
                    body: `"${o.nom}" à ${Math.round(percent)}% (${Format.money(o.montant - o.deja)} restant)`,
                    tag: `objectif-${o.id}`
                });
                o._notifiedNear = true;
                notifyStateChange();
            }
        });
    },

    /**
     * Récap quotidien (le soir)
     */
    scheduleDailyRecap() {
        const now = new Date();
        const recap = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0);

        if (recap < now) {
            recap.setDate(recap.getDate() + 1);
        }

        const delay = recap.getTime() - now.getTime();

        this._timers['daily-recap'] = setTimeout(() => {
            this.sendDailyRecap();

            // Reprogrammer chaque jour
            setInterval(() => this.sendDailyRecap(), 24 * 60 * 60 * 1000);
        }, delay);
    },

    sendDailyRecap() {
        const currentM = StateHelpers.currentMonth();
        const revenue = StateHelpers.computeMonthlyRevenue(currentM);
        const expenses = StateHelpers.computeMonthlyExpenses(currentM);
        const solde = revenue.totalReel - expenses;

        // Ne notifier que si le solde est négatif
        if (solde < 0) {
            this.show(`📊 Récap du jour`, {
                body: `Ce mois : -${Format.money(Math.abs(solde))} (Revenus ${Format.money(revenue.totalReel)}, Dépenses ${Format.money(expenses)})`,
                tag: 'daily-recap'
            });
        }
    },

    /**
     * ==========================================
     * UTILS
     * ==========================================
     */

    clearAllTimers() {
        Object.values(this._timers).forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this._timers = {};
    },

    /**
     * ==========================================
     * UI - SHEET DE CONFIGURATION
     * ==========================================
     */

    openSettingsSheet() {
        const canRequest = this.isSupported && this.permission === 'default';
        const isActive = this.permission === 'granted' && State.settings.notificationsActives;

        let html = '';

        if (!this.isSupported) {
            html = `
                <div class="banner banner-warning">
                    <span class="banner-icon">⚠️</span>
                    <div class="banner-body">
                        <div class="banner-title">Non supporté</div>
                        <div class="banner-text">
                            Ce navigateur ne supporte pas les notifications.
                            Sur iPhone, installez d'abord l'app sur votre écran d'accueil.
                        </div>
                    </div>
                </div>
            `;
        } else if (this.permission === 'denied') {
            html = `
                <div class="banner banner-danger">
                    <span class="banner-icon">🔕</span>
                    <div class="banner-body">
                        <div class="banner-title">Notifications bloquées</div>
                        <div class="banner-text">
                            Vous avez refusé les notifications. Pour les réactiver, allez dans les paramètres de votre navigateur.
                        </div>
                    </div>
                </div>
            `;
        } else if (isActive) {
            html = `
                <div class="banner banner-success" style="margin-bottom: var(--space-md);">
                    <span class="banner-icon">🔔</span>
                    <div class="banner-body">
                        <div class="banner-title">Notifications activées</div>
                        <div class="banner-text">Vous serez alerté pour vos échéances et budgets</div>
                    </div>
                </div>

                <div class="notif-list">
                    <div class="notif-item">
                        <div class="notif-item-icon">🔁</div>
                        <div class="notif-item-body">
                            <div class="notif-item-title">Dépenses récurrentes</div>
                            <div class="notif-item-desc">Rappel 2 jours avant chaque échéance</div>
                        </div>
                    </div>

                    <div class="notif-item">
                        <div class="notif-item-icon">📊</div>
                        <div class="notif-item-body">
                            <div class="notif-item-title">Alertes budgets</div>
                            <div class="notif-item-desc">Vérification quotidienne à 19h</div>
                        </div>
                    </div>

                    <div class="notif-item">
                        <div class="notif-item-icon">🎯</div>
                        <div class="notif-item-body">
                            <div class="notif-item-title">Objectifs</div>
                            <div class="notif-item-desc">Notification quand atteint ou proche</div>
                        </div>
                    </div>

                    <div class="notif-item">
                        <div class="notif-item-icon">📈</div>
                        <div class="notif-item-body">
                            <div class="notif-item-title">Récap quotidien</div>
                            <div class="notif-item-desc">Chaque soir à 20h30 si déficit</div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-outline btn-block" style="margin-top: var(--space-md); color: var(--danger); border-color: rgba(255,107,107,0.3);" id="btnDisableNotifs">
                    🔕 Désactiver les notifications
                </button>

                <button class="btn btn-secondary btn-block" style="margin-top: var(--space-sm);" id="btnTestNotif">
                    🧪 Tester une notification
                </button>
            `;
        } else if (canRequest) {
            html = `
                <div class="notif-request-banner">
                    <span class="notif-request-icon">🔔</span>
                    <div class="notif-request-body">
                        <div class="notif-request-title">Activer les notifications</div>
                        <div class="notif-request-text">
                            Recevez des rappels pour vos dépenses récurrentes, alertes budgets et progression des objectifs.
                        </div>
                    </div>
                </div>

                <div style="margin-top: var(--space-md);">
                    <p style="font-size: var(--text-sm); color: var(--text2); margin-bottom: var(--space-md);">
                        Les notifications vous permettent de :
                    </p>
                    <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm);">
                        <li style="display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-sm);">
                            <span>🔔</span> Ne jamais oublier une échéance
                        </li>
                        <li style="display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-sm);">
                            <span>🚨</span> Être alerté avant de dépasser un budget
                        </li>
                        <li style="display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-sm);">
                            <span>🎯</span> Célébrer vos objectifs atteints
                        </li>
                        <li style="display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-sm);">
                            <span>📊</span> Récap quotidien de vos finances
                        </li>
                    </ul>
                </div>

                <button class="btn btn-primary btn-block" style="margin-top: var(--space-lg);" id="btnEnableNotifs">
                    🔔 Activer les notifications
                </button>
            `;
        }

        Router.openSheet('notifications', 'Notifications', html);

        setTimeout(() => {
            document.getElementById('btnEnableNotifs')?.addEventListener('click', async () => {
                const success = await this.requestPermission();
                if (success) {
                    Router.closeSheet();
                }
            });

            document.getElementById('btnDisableNotifs')?.addEventListener('click', () => {
                this.disable();
                Router.closeSheet();
            });

            document.getElementById('btnTestNotif')?.addEventListener('click', () => {
                this.show('🧪 Test réussi !', {
                    body: 'Les notifications fonctionnent correctement.'
                });
            });
        }, 100);
    }
};

// Alias global
window.Notifications = Notifications;
