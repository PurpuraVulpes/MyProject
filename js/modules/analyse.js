/* ============================================
   ANALYSE.JS - Page d'analyse et statistiques
   ============================================ */

'use strict';

const Analyse = {

    // Mois actuellement affiché
    _currentMonth: null,
    // Vue actuelle : 'resume', 'graphiques', 'calendrier'
    _currentView: 'resume',

    /**
     * ==========================================
     * ENTRY POINT
     * ==========================================
     */

    /**
     * Rendu de la page analyse selon la vue
     */
    render(view) {
        this._currentView = view || this._currentView || 'resume';

        const content = document.getElementById('analyseContent');
        if (!content) return;

        switch (this._currentView) {
            case 'resume':
                content.innerHTML = this.renderResume();
                setTimeout(() => this.attachResumeEvents(), 50);
                break;

            case 'graphiques':
                content.innerHTML = this.renderGraphiques();
                setTimeout(() => this.attachGraphiquesEvents(), 50);
                break;

            case 'calendrier':
                content.innerHTML = '<div id="calendrierWrapper"></div>';
                setTimeout(() => {
                    if (typeof Calendrier !== 'undefined') {
                        Calendrier.render();
                    }
                }, 50);
                break;
        }
    },

    /**
     * ==========================================
     * VUE : RÉSUMÉ
     * ==========================================
     */
    renderResume() {
        const month = this._currentMonth || StateHelpers.currentMonth();

        let html = '';

        // Filtre de mois
        html += FormHelpers.renderMonthFilter('filtreAnalyseMois', month);

        // Placeholder pour le contenu (rempli après avec les données)
        html += '<div id="analyseResumeContent"></div>';

        return html;
    },

    /**
     * Attache les événements de la vue résumé
     */
    attachResumeEvents() {
        const container = document.getElementById('analyseContent');
        if (!container) return;

        FormHelpers.attachMonthFilterEvents(container, (newMonth) => {
            this._currentMonth = newMonth;
            this.refreshResumeContent(newMonth);
        });

        this.refreshResumeContent(this._currentMonth || StateHelpers.currentMonth());
    },

    /**
     * Rafraîchit le contenu du résumé pour un mois donné
     */
    refreshResumeContent(month) {
        const container = document.getElementById('analyseResumeContent');
        if (!container) return;

        const revenue = StateHelpers.computeMonthlyRevenue(month);
        const expenses = StateHelpers.computeMonthlyExpenses(month);
        const depenses = StateHelpers.getDepensesForMonth(month);
        const horaires = StateHelpers.getHorairesForMonth(month);
        const soldeReel = revenue.totalReel - expenses;
        const revDisplay = revenue.salaireEstime ? revenue.totalEstime : revenue.totalReel;

        let html = '';

        // 1. Bilan principal
        html += this.renderBilanCard(month, revenue, expenses, soldeReel, revDisplay);

        // 2. Détail des revenus
        html += this.renderRevenusDetail(month, revenue, revDisplay);

        // 3. Stats grid
        html += this.renderStatsGrid(month, horaires, depenses);

        // 4. Répartition par catégorie (pie chart)
        if (depenses.length > 0) {
            html += this.renderCategoriesPie(depenses);
        }

        // 5. Dépenses journalières (bar chart vertical)
        if (depenses.length > 0) {
            html += this.renderDailyBar(month, depenses);
        }

        // 6. Top dépenses
        if (depenses.length > 0) {
            html += this.renderTopDepenses(depenses);
        }

        // 7. Comparaison avec mois précédent
        html += this.renderComparaison(month);

        // 8. Suggestions
        if (typeof Suggestions !== 'undefined') {
            const suggestions = Suggestions.generate(month);
            if (suggestions.length > 0) {
                html += this.renderSuggestions(suggestions);
            }
        }

        container.innerHTML = html;

        // Attacher les événements du bouton report
        this.attachReportButton(month, soldeReel);
    },

    /**
     * BILAN CARD (Revenus vs Dépenses)
     */
    renderBilanCard(month, revenue, expenses, soldeReel, revDisplay) {
        const total = revDisplay + expenses;
        const percentRev = total > 0 ? (revDisplay / total) * 100 : 50;
        const percentDep = total > 0 ? (expenses / total) * 100 : 50;
        const percentDepense = revDisplay > 0 ? Math.round((expenses / revDisplay) * 100) : 0;

        let soldeClass, soldeSign;
        if (soldeReel > 0) {
            soldeClass = 'positive';
            soldeSign = '+';
        } else if (soldeReel < 0) {
            soldeClass = 'negative';
            soldeSign = '−';
        } else {
            soldeClass = 'neutral';
            soldeSign = '';
        }

        return `
            <div class="bilan-card">
                <div class="bilan-row">
                    <div class="bilan-col success">
                        <span class="bilan-col-icon">💵</span>
                        <span class="bilan-col-amount">${Format.money(revDisplay)}</span>
                        <span class="bilan-col-label">Revenus</span>
                    </div>
                    <div class="bilan-vs">VS</div>
                    <div class="bilan-col danger">
                        <span class="bilan-col-icon">🛒</span>
                        <span class="bilan-col-amount">${Format.money(expenses)}</span>
                        <span class="bilan-col-label">Dépenses</span>
                    </div>
                </div>

                <div class="bilan-progress">
                    <div class="bilan-progress-success" style="width: ${percentRev}%;"></div>
                    <div class="bilan-progress-danger" style="width: ${percentDep}%;"></div>
                </div>

                <div class="bilan-solde">
                    <span>Il vous reste</span>
                    <strong class="bilan-solde-value ${soldeClass}">
                        ${soldeSign}${Format.money(Math.abs(soldeReel))}
                    </strong>
                </div>

                <p class="bilan-percent">
                    ${revDisplay > 0 ? `${percentDepense}% de vos revenus dépensés` : 'Aucun revenu ce mois'}
                </p>

                <div class="report-section">
                    <button class="btn btn-primary btn-block" id="btnReportSolde" style="display: none;">
                        <span id="btnReportText">📅 Reporter au mois suivant</span>
                    </button>
                    <p class="report-hint" id="reportHint"></p>
                </div>
            </div>
        `;
    },

    /**
     * DÉTAIL DES REVENUS
     */
    renderRevenusDetail(month, revenue, revDisplay) {
        if (revenue.paieRecue === 0 && revenue.gainPrevu === 0 && revenue.totalExtras === 0) {
            return '';
        }

        const prevMonth = StateHelpers.getPreviousMonth(month);

        let html = '<div class="revenus-detail">';
        html += '<div class="revenus-detail-title">💰 Détail des revenus</div>';

        if (revenue.paieRecue > 0) {
            html += `
                <div class="revenus-detail-row">
                    <span class="revenus-detail-label">💼 Salaire reçu (${revenue.nbPaies})</span>
                    <span class="revenus-detail-amount">+${Format.money(revenue.paieRecue)}</span>
                </div>
            `;
        } else if (revenue.gainPrevu > 0) {
            html += `
                <div class="revenus-detail-row pending">
                    <span class="revenus-detail-label">
                        💼 Salaire (heures ${Format.monthShort(prevMonth)})
                        <span class="pending-badge">⏳ à recevoir</span>
                    </span>
                    <span class="revenus-detail-amount">+${Format.money(revenue.gainPrevu)}</span>
                </div>
            `;
        }

        if (revenue.totalExtras > 0) {
            html += `
                <div class="revenus-detail-row">
                    <span class="revenus-detail-label">🎁 Revenus supplémentaires (${revenue.nbExtras})</span>
                    <span class="revenus-detail-amount">+${Format.money(revenue.totalExtras)}</span>
                </div>
            `;
        }

        html += `
            <div class="revenus-detail-row">
                <span class="revenus-detail-label">💵 <strong>Total revenus</strong></span>
                <span class="revenus-detail-amount">${Format.money(revDisplay)}</span>
            </div>
        `;

        html += '</div>';
        return html;
    },

    /**
     * STATS GRID
     */
    renderStatsGrid(month, horaires, depenses) {
        const jours = new Set(horaires.map(h => h.date)).size;
        const mins = horaires.reduce((s, h) => s + h.minutes, 0);
        const totalDep = depenses.reduce((s, d) => s + d.montant, 0);
        const moyDep = depenses.length > 0 ? totalDep / depenses.length : 0;

        return `
            <div class="analyse-stats-grid">
                <div class="stat-card">
                    <span class="stat-icon">📅</span>
                    <span class="stat-value">${jours}</span>
                    <span class="stat-label">Jours travaillés</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-value">${Format.duration(mins)}</span>
                    <span class="stat-label">Heures totales</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">💳</span>
                    <span class="stat-value">${depenses.length}</span>
                    <span class="stat-label">Nb dépenses</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">📉</span>
                    <span class="stat-value">${Format.money(moyDep)}</span>
                    <span class="stat-label">Dépense moy.</span>
                </div>
            </div>
        `;
    },

    /**
     * PIE CHART CATÉGORIES
     */
    renderCategoriesPie(depenses) {
        const data = Graphiques.dataFromDepensesByCategory(depenses);

        return `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">🥧 Répartition</span>
                </div>
                ${Graphiques.renderPieChart(data)}
            </div>
        `;
    },

    /**
     * BAR CHART JOURNALIER
     */
    renderDailyBar(month, depenses) {
        const data = Graphiques.dataFromDepensesByDay(depenses, month);
        const totalMonth = depenses.reduce((s, d) => s + d.montant, 0);

        return `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">📊 Dépenses journalières</span>
                    <span class="chart-total">${Format.money(totalMonth)}</span>
                </div>
                ${Graphiques.renderBarChartVertical(data, { colorType: 'danger' })}
            </div>
        `;
    },

    /**
     * TOP DÉPENSES
     */
    renderTopDepenses(depenses) {
        const topData = depenses.map(d => ({
            label: d.description || d.categorie,
            value: d.montant
        }));

        return `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">🔝 Top dépenses</span>
                </div>
                ${Graphiques.renderTopItems(topData, { limit: 5 })}
            </div>
        `;
    },

    /**
     * COMPARAISON AVEC MOIS PRÉCÉDENT
     */
    renderComparaison(month) {
        const prevMonth = StateHelpers.getPreviousMonth(month);

        const currentRev = StateHelpers.computeMonthlyRevenue(month);
        const prevRev = StateHelpers.computeMonthlyRevenue(prevMonth);
        const currentDep = StateHelpers.computeMonthlyExpenses(month);
        const prevDep = StateHelpers.computeMonthlyExpenses(prevMonth);
        const currentSolde = currentRev.totalReel - currentDep;
        const prevSolde = prevRev.totalReel - prevDep;

        // Ne pas afficher si aucune donnée sur les 2 mois
        if (currentRev.totalReel === 0 && prevRev.totalReel === 0 &&
            currentDep === 0 && prevDep === 0) {
            return '';
        }

        const items = [
            {
                label: '💵 Revenus',
                current: currentRev.totalReel,
                previous: prevRev.totalReel,
                reverseColors: false
            },
            {
                label: '💳 Dépenses',
                current: currentDep,
                previous: prevDep,
                reverseColors: true // Rouge quand ça augmente
            },
            {
                label: '📊 Solde',
                current: currentSolde,
                previous: prevSolde,
                reverseColors: false
            }
        ];

        return Graphiques.renderCompare(items, {
            title: `📊 vs ${Format.monthLong(prevMonth)}`
        });
    },

    /**
     * SUGGESTIONS
     */
    renderSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) return '';

        let html = `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">💡 Suggestions</span>
                </div>
                <div class="suggestions-list">
        `;

        suggestions.forEach(sug => {
            html += `
                <div class="suggestion-item ${sug.type || ''}">
                    <span class="suggestion-icon">${sug.icon}</span>
                    <div class="suggestion-body">${sug.text}</div>
                </div>
            `;
        });

        html += '</div></div>';

        return html;
    },

    /**
     * BOUTON REPORT SOLDE
     */
    attachReportButton(month, soldeReel) {
        const btn = document.getElementById('btnReportSolde');
        const btnText = document.getElementById('btnReportText');
        const hint = document.getElementById('reportHint');

        if (!btn || !btnText || !hint) return;

        const nextMonth = StateHelpers.getNextMonth(month);

        // Vérifier si un report existe déjà
        const existingReport = State.data.extras.find(e =>
            e.date.startsWith(nextMonth) &&
            e.source === '📅 Report' &&
            e.isReport === true
        );

        if (existingReport) {
            btn.style.display = 'block';
            btn.disabled = false;
            btn.className = 'btn btn-outline btn-block';
            btnText.textContent = `🔄 Remplacer le report (${Format.money(existingReport.montant)})`;
            hint.textContent = `✅ Déjà reporté à ${Format.monthShort(nextMonth)}`;
            hint.className = 'report-hint done';
        } else if (soldeReel > 0) {
            btn.style.display = 'block';
            btn.disabled = false;
            btn.className = 'btn btn-primary btn-block';
            btnText.textContent = `📅 Reporter ${Format.money(soldeReel)} à ${Format.monthShort(nextMonth)}`;
            hint.textContent = 'Ajoute votre reste au mois suivant';
            hint.className = 'report-hint';
        } else if (soldeReel < 0) {
            btn.style.display = 'block';
            btn.disabled = true;
            btn.className = 'btn btn-outline btn-block';
            btnText.textContent = '⚠️ Déficit - Impossible de reporter';
            hint.textContent = 'Vous êtes en déficit ce mois-ci';
            hint.className = 'report-hint';
        } else {
            btn.style.display = 'block';
            btn.disabled = true;
            btn.className = 'btn btn-outline btn-block';
            btnText.textContent = '⚖️ Équilibre - Rien à reporter';
            hint.textContent = '';
            hint.className = 'report-hint';
        }

        // Événement clic
        btn.onclick = () => {
            if (typeof Revenus !== 'undefined') {
                Revenus.reportSolde(month);
                // Rafraîchir après un délai
                setTimeout(() => this.refreshResumeContent(month), 500);
            }
        };
    },

    /**
     * ==========================================
     * VUE : GRAPHIQUES (évolution 6/12 mois)
     * ==========================================
     */
    renderGraphiques() {
        let html = '';

        // Sélecteur de période
        html += `
            <div class="segment-control" id="periodeSegments" style="margin-bottom: var(--space-md);">
                <button class="segment active" data-periode="6">6 mois</button>
                <button class="segment" data-periode="12">12 mois</button>
            </div>
        `;

        html += '<div id="graphiquesContent"></div>';

        return html;
    },

    /**
     * Attache les événements de la vue graphiques
     */
    attachGraphiquesEvents() {
        const segments = document.querySelectorAll('#periodeSegments .segment');

        segments.forEach(seg => {
            seg.addEventListener('click', () => {
                segments.forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                const nbMonths = parseInt(seg.dataset.periode);
                this.refreshGraphiques(nbMonths);
            });
        });

        this.refreshGraphiques(6);
    },

    /**
     * Rafraîchit les graphiques
     */
    refreshGraphiques(nbMonths) {
        const container = document.getElementById('graphiquesContent');
        if (!container) return;

        // Données
        const revenusData = Graphiques.dataMonthlyEvolution(nbMonths, 'revenus');
        const depensesData = Graphiques.dataMonthlyEvolution(nbMonths, 'depenses');
        const soldeData = Graphiques.dataMonthlyEvolution(nbMonths, 'solde');
        const epargneData = Graphiques.dataMonthlyEvolution(nbMonths, 'epargne');

        const xLabels = revenusData.map(d => d.label);

        let html = '';

        // 1. Évolution revenus vs dépenses
        html += `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">📈 Revenus vs Dépenses</span>
                </div>
                ${Graphiques.renderLineChart([
                    {
                        label: 'Revenus',
                        color: 'var(--success)',
                        points: revenusData.map((d, i) => ({ x: i, y: d.y }))
                    },
                    {
                        label: 'Dépenses',
                        color: 'var(--danger)',
                        points: depensesData.map((d, i) => ({ x: i, y: d.y }))
                    }
                ], { xLabels, showArea: true })}
            </div>
        `;

        // 2. Évolution du solde
        html += `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">💰 Évolution du solde</span>
                </div>
                ${Graphiques.renderBarChartVertical(
                    soldeData.map(d => ({
                        label: d.label,
                        shortLabel: d.label,
                        value: d.y
                    })),
                    { colorType: 'success' }
                )}
            </div>
        `;

        // 3. Évolution de l'épargne (cumulée)
        html += `
            <div class="chart-card">
                <div class="chart-header">
                    <span class="chart-title">🏦 Évolution de l'épargne</span>
                </div>
                ${Graphiques.renderLineChart([
                    {
                        label: 'Épargne cumulée',
                        color: 'var(--primary)',
                        points: epargneData.map((d, i) => ({ x: i, y: d.y }))
                    }
                ], { xLabels, showArea: true })}
            </div>
        `;

        // 4. Moyennes
        const totalRevenus = revenusData.reduce((s, d) => s + d.y, 0);
        const totalDepenses = depensesData.reduce((s, d) => s + d.y, 0);
        const moyRevenus = totalRevenus / nbMonths;
        const moyDepenses = totalDepenses / nbMonths;
        const moySolde = moyRevenus - moyDepenses;

        html += `
            <div class="analyse-stats-grid">
                <div class="stat-card">
                    <span class="stat-icon">💵</span>
                    <span class="stat-value" style="color: var(--success);">${Format.money(moyRevenus)}</span>
                    <span class="stat-label">Revenu moyen</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">💳</span>
                    <span class="stat-value" style="color: var(--danger);">${Format.money(moyDepenses)}</span>
                    <span class="stat-label">Dépense moyenne</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">📊</span>
                    <span class="stat-value" style="color: ${moySolde >= 0 ? 'var(--success)' : 'var(--danger)'};">${Format.money(moySolde)}</span>
                    <span class="stat-label">Solde moyen</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">💰</span>
                    <span class="stat-value" style="color: var(--primary-light);">${Format.money(epargneData[epargneData.length - 1]?.y || 0)}</span>
                    <span class="stat-label">Épargne actuelle</span>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * ==========================================
     * VUE : CALENDRIER (délégué à Calendrier.js)
     * ==========================================
     */
    switchView(view) {
        this._currentView = view;
        this.render();
    }
};

// Alias global
window.Analyse = Analyse;
