/* ============================================
   DASHBOARD.JS - Widgets personnalisables
   ============================================ */

'use strict';

const Dashboard = {

    /**
     * Configuration de tous les widgets disponibles
     */
    availableWidgets: {
        solde: {
            id: 'solde',
            label: 'Solde du mois',
            icon: '📊',
            desc: 'Ce qu\'il vous reste réellement',
            render: 'renderSoldeWidget',
            fullWidth: true
        },
        revenus: {
            id: 'revenus',
            label: 'Revenus',
            icon: '💵',
            desc: 'Revenus reçus + à venir',
            render: 'renderRevenusWidget',
            fullWidth: false
        },
        depenses: {
            id: 'depenses',
            label: 'Dépenses',
            icon: '💳',
            desc: 'Total dépensé ce mois',
            render: 'renderDepensesWidget',
            fullWidth: false
        },
        epargne: {
            id: 'epargne',
            label: 'Épargne',
            icon: '🏦',
            desc: 'Solde total de l\'épargne',
            render: 'renderEpargneWidget',
            fullWidth: false
        },
        heures: {
            id: 'heures',
            label: 'Heures travaillées',
            icon: '⏰',
            desc: 'Heures du mois en cours',
            render: 'renderHeuresWidget',
            fullWidth: false
        },
        objectifs: {
            id: 'objectifs',
            label: 'Objectifs',
            icon: '🎯',
            desc: 'Progression de vos objectifs',
            render: 'renderObjectifsWidget',
            fullWidth: true
        },
        recurrent: {
            id: 'recurrent',
            label: 'Prochaines échéances',
            icon: '🔁',
            desc: 'Dépenses récurrentes à venir',
            render: 'renderRecurrentWidget',
            fullWidth: true
        },
        budgets: {
            id: 'budgets',
            label: 'Alertes budgets',
            icon: '⚠️',
            desc: 'Budgets proches du dépassement',
            render: 'renderBudgetsWidget',
            fullWidth: true
        },
        suggestions: {
            id: 'suggestions',
            label: 'Suggestions',
            icon: '💡',
            desc: 'Conseils intelligents',
            render: 'renderSuggestionsWidget',
            fullWidth: true
        }
    },

    /**
     * ==========================================
     * RENDU PRINCIPAL DU DASHBOARD
     * ==========================================
     */
    render() {
        const container = document.getElementById('homeContent');
        if (!container) return;

        let html = this.renderHeader();
        const activeWidgets = this.getActiveWidgets();

        if (activeWidgets.length === 0) {
            html += this.renderNoWidgets();
        } else {
            html += '<div class="dashboard-grid">';
            activeWidgets.forEach(widgetKey => {
                const widget = this.availableWidgets[widgetKey];
                if (widget && typeof this[widget.render] === 'function') {
                    html += this[widget.render]();
                }
            });
            html += '</div>';
        }

        html += this.renderHint();
        container.innerHTML = html;
        this.attachEvents();
    },

    getActiveWidgets() {
        const widgetOrder = ['solde', 'revenus', 'depenses', 'epargne', 'heures',
                             'objectifs', 'recurrent', 'budgets', 'suggestions'];

        return widgetOrder.filter(key => {
            return State.settings.widgets && State.settings.widgets[key] === true;
        });
    },

    /**
     * ==========================================
     * HEADER
     * ==========================================
     */
    renderHeader() {
        const now = new Date();
        const hour = now.getHours();
        let greeting = '👋 Bienvenue';

        if (hour < 12) greeting = '☀️ Bonjour';
        else if (hour < 18) greeting = '🌤️ Bon après-midi';
        else greeting = '🌙 Bonsoir';

        const monthLabel = Format.monthLong(StateHelpers.currentMonth());

        return `
            <div class="card" style="text-align: center; padding: var(--space-md);">
                <div style="font-size: var(--text-lg); font-weight: var(--font-bold); margin-bottom: 4px;">
                    ${greeting}
                </div>
                <div style="font-size: var(--text-xs); color: var(--text2); text-transform: capitalize;">
                    ${monthLabel}
                </div>
            </div>
        `;
    },

    renderNoWidgets() {
        return `
            <div class="empty-page">
                <div class="empty-icon">🧩</div>
                <h2>Aucun widget</h2>
                <p>Activez des widgets depuis <strong>Plus → Widgets du dashboard</strong></p>
                <button class="btn btn-primary" style="margin-top: var(--space-lg);" onclick="Router.navigateTo('more'); setTimeout(() => App.openWidgetsSheet(), 300);">
                    🧩 Configurer les widgets
                </button>
            </div>
        `;
    },

    renderHint() {
        return `
            <div class="banner banner-info" style="margin-top: var(--space-md);">
                <span class="banner-icon">💡</span>
                <div class="banner-body">
                    <div class="banner-title">Astuce</div>
                    <div class="banner-text">
                        Personnalisez vos widgets depuis Plus → Widgets du dashboard.
                        Vous pouvez aussi swiper entre les pages !
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : SOLDE (Ce qu'il reste)
     * ==========================================
     */
    renderSoldeWidget() {
        const currentM = StateHelpers.currentMonth();
        const revenue = StateHelpers.computeMonthlyRevenue(currentM);
        const expenses = StateHelpers.computeMonthlyExpenses(currentM);
        const solde = revenue.totalReel - expenses;

        let badgeText, badgeClass, valueColor, barColor, barWidth;

        if (solde > 0) {
            badgeText = '✅ Positif';
            badgeClass = 'badge-success';
            valueColor = 'var(--success)';
            barColor = 'linear-gradient(90deg, var(--success), #55efc4)';
            barWidth = revenue.totalReel > 0 ? Math.min((solde / revenue.totalReel) * 100, 100) : 0;
        } else if (solde < 0) {
            badgeText = '⚠️ Déficit';
            badgeClass = 'badge-danger';
            valueColor = 'var(--danger)';
            barColor = 'linear-gradient(90deg, var(--danger), #fd79a8)';
            barWidth = 100;
        } else {
            badgeText = '⚖️ Équilibre';
            badgeClass = 'badge-primary';
            valueColor = 'var(--text)';
            barColor = 'var(--gradient-primary)';
            barWidth = 50;
        }

        const displayValue = solde > 0
            ? Format.money(solde, true)
            : (solde < 0 ? Format.money(solde) : Format.money(0));

        return `
            <div class="widget widget-full" data-widget-nav="analyse">
                <div class="widget-header">
                    <span class="widget-emoji">📊</span>
                    <span class="widget-badge ${badgeClass}">${badgeText}</span>
                </div>
                <span class="widget-value" style="color: ${valueColor};">${displayValue}</span>
                <span class="widget-label">Il me reste</span>
                <div class="widget-progress">
                    <div class="widget-progress-bar" style="width: ${barWidth}%; background: ${barColor};"></div>
                </div>
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : REVENUS
     * ==========================================
     */
    renderRevenusWidget() {
        const currentM = StateHelpers.currentMonth();
        const revenue = StateHelpers.computeMonthlyRevenue(currentM);
        const displayValue = revenue.salaireEstime ? revenue.totalEstime : revenue.totalReel;

        let detailHtml = '';

        if (revenue.paieRecue > 0) {
            detailHtml += `<div class="widget-detail-line">💼 Paie reçue <strong>${Format.money(revenue.paieRecue)}</strong></div>`;
        } else if (revenue.gainPrevu > 0) {
            detailHtml += `<div class="widget-detail-line pending">⏳ Paie à recevoir <strong>${Format.money(revenue.gainPrevu)}</strong></div>`;
        }

        if (revenue.totalExtras > 0) {
            detailHtml += `<div class="widget-detail-line">🎁 Extras (${revenue.nbExtras}) <strong>+${Format.money(revenue.totalExtras)}</strong></div>`;
        }

        let badgeText = '';
        let badgeClass = '';

        if (revenue.salaireEstime) {
            badgeText = 'Estimé';
            badgeClass = 'badge-warning';
        } else if (revenue.paieRecue > 0) {
            badgeText = '✓ Reçu';
            badgeClass = 'badge-success';
        }

        return `
            <div class="widget widget-success" data-widget-nav="paiements">
                <div class="widget-header">
                    <span class="widget-emoji">💵</span>
                    ${badgeText ? `<span class="widget-badge ${badgeClass}">${badgeText}</span>` : ''}
                </div>
                <span class="widget-value">${Format.money(displayValue)}</span>
                <span class="widget-label">Revenus</span>
                ${detailHtml ? `<div class="widget-detail">${detailHtml}</div>` : ''}
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : DÉPENSES
     * ==========================================
     */
    renderDepensesWidget() {
        const currentM = StateHelpers.currentMonth();
        const expenses = StateHelpers.computeMonthlyExpenses(currentM);
        const nbDepenses = StateHelpers.getDepensesForMonth(currentM).length;

        return `
            <div class="widget widget-danger" data-widget-nav="budget">
                <div class="widget-header">
                    <span class="widget-emoji">💳</span>
                    <span class="widget-badge" style="background: var(--bg3); color: var(--text2);">
                        ${nbDepenses} ${nbDepenses > 1 ? 'entrées' : 'entrée'}
                    </span>
                </div>
                <span class="widget-value">${Format.money(expenses)}</span>
                <span class="widget-label">Dépenses</span>
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : ÉPARGNE
     * ==========================================
     */
    renderEpargneWidget() {
        const solde = StateHelpers.getEpargneSolde();
        const currentM = StateHelpers.currentMonth();
        const mvts = StateHelpers.getEpargneForMonth(currentM);

        return `
            <div class="widget widget-primary" data-widget-more="epargne">
                <div class="widget-header">
                    <span class="widget-emoji">🏦</span>
                    ${mvts.length > 0 ? `<span class="widget-badge badge-primary">${mvts.length} ce mois</span>` : ''}
                </div>
                <span class="widget-value">${Format.money(solde)}</span>
                <span class="widget-label">Épargne totale</span>
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : HEURES
     * ==========================================
     */
    renderHeuresWidget() {
        const currentM = StateHelpers.currentMonth();
        const horaires = StateHelpers.getHorairesForMonth(currentM);
        const totalMinutes = horaires.reduce((s, h) => s + h.minutes, 0);
        const nbJours = new Set(horaires.map(h => h.date)).size;

        return `
            <div class="widget widget-warning" data-widget-more="horaires">
                <div class="widget-header">
                    <span class="widget-emoji">⏰</span>
                    ${nbJours > 0 ? `<span class="widget-badge badge-warning">${nbJours}j</span>` : ''}
                </div>
                <span class="widget-value">${Format.duration(totalMinutes)}</span>
                <span class="widget-label">Heures travaillées</span>
            </div>
        `;
    },

    /**
     * ==========================================
     * WIDGET : OBJECTIFS
     * ==========================================
     */
    renderObjectifsWidget() {
        const objectifs = State.data.objectifs || [];

        if (objectifs.length === 0) {
            return `
                <div class="widget widget-full" data-widget-nav="more" style="text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: var(--space-sm);">🎯</div>
                    <div style="font-weight: var(--font-bold); margin-bottom: 4px;">Aucun objectif</div>
                    <div style="font-size: var(--text-xs); color: var(--text2);">
                        Créez votre premier objectif d'épargne !
                    </div>
                </div>
            `;
        }

        const notDone = objectifs.filter(o => o.deja < o.montant).slice(0, 3);
        const done = objectifs.filter(o => o.deja >= o.montant);

        let html = `
            <div class="widget widget-full" data-widget-more="objectifs">
                <div class="widget-header">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="widget-emoji">🎯</span>
                        <span style="font-weight: var(--font-bold);">Mes objectifs</span>
                    </div>
                    ${done.length > 0 ? `<span class="widget-badge badge-success">${done.length} atteint${done.length > 1 ? 's' : ''}</span>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--space-md); margin-top: var(--space-sm);">
        `;

        notDone.forEach(o => {
            const percent = Math.min(100, Math.round((o.deja / o.montant) * 100));
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: var(--text-sm); font-weight: var(--font-semibold);">
                            ${o.emoji} ${o.nom}
                        </span>
                        <span style="font-size: var(--text-xs); color: var(--text2);">
                            ${Format.money(o.deja)} / ${Format.money(o.montant)}
                        </span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    /**
     * ==========================================
     * WIDGET : DÉPENSES RÉCURRENTES
     * ==========================================
     */
    renderRecurrentWidget() {
        const recurrent = State.data.recurrent || [];
        const actifs = recurrent.filter(r => r.actif !== false);

        if (actifs.length === 0) {
            return `
                <div class="widget widget-full" style="text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: var(--space-sm);">🔁</div>
                    <div style="font-weight: var(--font-bold); margin-bottom: 4px;">Aucune récurrente</div>
                    <div style="font-size: var(--text-xs); color: var(--text2);">
                        Ajoutez vos abonnements et paiements réguliers
                    </div>
                </div>
            `;
        }

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const withDates = actifs.map(r => {
            let nextDate;
            if (r.jour >= currentDay) {
                nextDate = new Date(currentYear, currentMonth, r.jour);
            } else {
                nextDate = new Date(currentYear, currentMonth + 1, r.jour);
            }
            const daysLeft = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
            return { ...r, nextDate, daysLeft };
        });

        withDates.sort((a, b) => a.daysLeft - b.daysLeft);
        const totalMensuel = actifs.reduce((s, r) => s + r.montant, 0);
        const next3 = withDates.slice(0, 3);

        let html = `
            <div class="widget widget-full" data-widget-nav="budget">
                <div class="widget-header">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="widget-emoji">🔁</span>
                        <span style="font-weight: var(--font-bold);">Prochaines échéances</span>
                    </div>
                    <span class="widget-badge badge-danger">${Format.money(totalMensuel)}/mois</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-sm);">
        `;

        next3.forEach(r => {
            let dateLabel;
            if (r.daysLeft === 0) dateLabel = 'Aujourd\'hui';
            else if (r.daysLeft === 1) dateLabel = 'Demain';
            else if (r.daysLeft < 7) dateLabel = `Dans ${r.daysLeft} jours`;
            else dateLabel = `${r.daysLeft} jours`;

            const isUrgent = r.daysLeft <= 3;

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm); background: var(--bg3); border-radius: var(--radius-sm);">
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-size: var(--text-sm); font-weight: var(--font-semibold);" class="truncate">${r.nom}</div>
                        <div style="font-size: var(--text-xs); color: ${isUrgent ? 'var(--warning)' : 'var(--text2)'}; font-weight: ${isUrgent ? 'var(--font-semibold)' : 'normal'};">
                            ${dateLabel}
                        </div>
                    </div>
                    <div style="font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--danger); flex-shrink: 0;">
                        -${Format.money(r.montant)}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    /**
     * ==========================================
     * WIDGET : ALERTES BUDGETS
     * ==========================================
     */
    renderBudgetsWidget() {
        const budgets = State.data.budgets || [];
        if (budgets.length === 0) return '';

        const currentM = StateHelpers.currentMonth();
        const depenses = StateHelpers.getDepensesForMonth(currentM);

        const catTotals = {};
        depenses.forEach(d => {
            catTotals[d.categorie] = (catTotals[d.categorie] || 0) + d.montant;
        });

        const alerts = budgets.map(b => {
            const spent = catTotals[b.categorie] || 0;
            const percent = b.max > 0 ? (spent / b.max) * 100 : 0;
            return { ...b, spent, percent };
        }).filter(b => b.percent >= (b.alerte || 80));

        if (alerts.length === 0) return '';

        alerts.sort((a, b) => b.percent - a.percent);

        let html = `
            <div class="widget widget-full widget-warning" data-widget-nav="budget">
                <div class="widget-header">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="widget-emoji">⚠️</span>
                        <span style="font-weight: var(--font-bold);">Alertes budgets</span>
                    </div>
                    <span class="widget-badge badge-warning">${alerts.length}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-sm);">
        `;

        alerts.slice(0, 3).forEach(b => {
            const isOver = b.percent >= 100;
            const barColor = isOver ? 'var(--danger)' : (b.percent >= 90 ? 'var(--warning)' : 'var(--success)');

            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: var(--text-sm); font-weight: var(--font-semibold);" class="truncate">
                            ${b.categorie}
                        </span>
                        <span style="font-size: var(--text-xs); color: ${isOver ? 'var(--danger)' : 'var(--text2)'}; font-weight: var(--font-bold);">
                            ${Format.money(b.spent)} / ${Format.money(b.max)}
                        </span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${Math.min(100, b.percent)}%; background: ${barColor};"></div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    /**
     * ==========================================
     * WIDGET : SUGGESTIONS
     * ==========================================
     */
    renderSuggestionsWidget() {
        const suggestions = this.generateSuggestions();
        if (suggestions.length === 0) return '';

        let html = `
            <div class="widget widget-full widget-info">
                <div class="widget-header">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="widget-emoji">💡</span>
                        <span style="font-weight: var(--font-bold);">Suggestions</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-sm);">
        `;

        suggestions.slice(0, 3).forEach(sug => {
            html += `
                <div style="display: flex; gap: var(--space-sm); padding: var(--space-sm); background: var(--bg3); border-radius: var(--radius-sm);">
                    <span style="font-size: 1.2rem; flex-shrink: 0;">${sug.icon}</span>
                    <div style="font-size: var(--text-sm); color: var(--text); line-height: 1.4;">
                        ${sug.text}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    /**
     * Génère des suggestions intelligentes
     */
    generateSuggestions() {
        const suggestions = [];
        const currentM = StateHelpers.currentMonth();
        const prevM = StateHelpers.getPreviousMonth(currentM);

        const currentDep = StateHelpers.computeMonthlyExpenses(currentM);
        const prevDep = StateHelpers.computeMonthlyExpenses(prevM);

        if (prevDep > 0 && currentDep > 0) {
            const diff = ((currentDep - prevDep) / prevDep) * 100;
            if (Math.abs(diff) > 15) {
                if (diff > 0) {
                    suggestions.push({
                        icon: '📈',
                        text: `Vos dépenses ont augmenté de <strong>${Math.round(diff)}%</strong> par rapport au mois dernier.`
                    });
                } else {
                    suggestions.push({
                        icon: '📉',
                        text: `Bravo ! Vos dépenses ont baissé de <strong>${Math.round(Math.abs(diff))}%</strong> par rapport au mois dernier.`
                    });
                }
            }
        }

        const objectifs = State.data.objectifs || [];
        objectifs.forEach(o => {
            const percent = (o.deja / o.montant) * 100;
            if (percent >= 90 && percent < 100) {
                suggestions.push({
                    icon: '🎯',
                    text: `Votre objectif <strong>${o.nom}</strong> est presque atteint (${Math.round(percent)}%) !`
                });
            }
        });

        const epargneSolde = StateHelpers.getEpargneSolde();
        const revenue = StateHelpers.computeMonthlyRevenue(currentM);

        if (revenue.totalReel > 0 && epargneSolde > 0) {
            const ratio = (epargneSolde / revenue.totalReel) * 100;
            if (ratio > 300) {
                suggestions.push({
                    icon: '🏦',
                    text: `Votre épargne représente <strong>${Math.round(ratio / 100)} mois</strong> de revenus. Excellent !`
                });
            }
        }

        return suggestions;
    },

    /**
     * ==========================================
     * ÉVÉNEMENTS
     * ==========================================
     */
    attachEvents() {
        document.querySelectorAll('[data-widget-nav]').forEach(w => {
            w.addEventListener('click', () => {
                Router.navigateTo(w.dataset.widgetNav);
            });
        });

        document.querySelectorAll('[data-widget-more]').forEach(w => {
            w.addEventListener('click', () => {
                Router.navigateTo('more');
                setTimeout(() => {
                    App.handleMoreAction(w.dataset.widgetMore);
                }, 300);
            });
        });
    },

    /**
     * ==========================================
     * SHEET DE CONFIGURATION DES WIDGETS
     * ==========================================
     */
      openWidgetsSheet() {
        let html = `
            <p style="color: var(--text2); font-size: var(--text-sm); text-align: center; margin-bottom: var(--space-md);">
                Choisissez les widgets à afficher sur votre dashboard
            </p>
            <div class="form" style="gap: 0;">
        `;

        Object.values(this.availableWidgets).forEach(widget => {
            const isActive = State.settings.widgets && State.settings.widgets[widget.id] === true;
            html += `
                <button type="button" class="switch-row widget-row-btn" data-widget-row="${widget.id}" style="cursor: pointer; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-light); padding: var(--space-md) 0; text-align: left; color: var(--text); -webkit-tap-highlight-color: transparent;">
                    <div class="switch-row-body">
                        <div class="switch-row-title">${widget.icon} ${widget.label}</div>
                        <div class="switch-row-desc">${widget.desc}</div>
                    </div>
                    <div class="switch widget-toggle ${isActive ? 'active' : ''}" data-widget-key="${widget.id}" style="pointer-events: none;"></div>
                </button>
            `;
        });

        html += `</div>
            <button class="btn btn-primary btn-block" style="margin-top: var(--space-md);" onclick="Router.closeSheet(); setTimeout(() => { Router.navigateTo('home'); Dashboard.render(); }, 300);">
                ✅ Voir mon dashboard
            </button>
        `;

        Router.openSheet('widgets', 'Widgets du dashboard', html);

        const self = this;
        setTimeout(() => {
            document.querySelectorAll('[data-widget-row]').forEach(row => {
                row.addEventListener('click', function(e) {
                    e.preventDefault();

                    const key = this.dataset.widgetRow;
                    const sw = this.querySelector('.widget-toggle');

                    if (!State.settings.widgets) State.settings.widgets = {};
                    State.settings.widgets[key] = !State.settings.widgets[key];

                    if (sw) sw.classList.toggle('active', State.settings.widgets[key]);

                    if (typeof Storage !== 'undefined') Storage.save();
                    if (typeof notifyStateChange === 'function') notifyStateChange();
                    if (State.user && !State.isGuestMode && typeof CloudSync !== 'undefined') CloudSync.saveSettings();

                    self.render();
                });
            });
        }, 150);
    };

window.Dashboard = Dashboard;
