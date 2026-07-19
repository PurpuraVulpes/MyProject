/* ============================================
   CALENDRIER.JS - Vue calendrier mensuelle
   ============================================ */

'use strict';

const Calendrier = {

    // Mois affiché : { year, month }
    _currentDate: null,

    /**
     * ==========================================
     * RENDU PRINCIPAL
     * ==========================================
     */
    render() {
        if (!this._currentDate) {
            const now = new Date();
            this._currentDate = {
                year: now.getFullYear(),
                month: now.getMonth()
            };
        }

        const container = document.getElementById('calendrierWrapper');
        if (!container) return;

        container.innerHTML = this.renderCalendar();
        this.attachEvents();
    },

    /**
     * Rendu du HTML du calendrier
     */
    renderCalendar() {
        const { year, month } = this._currentDate;
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Récupérer toutes les données du mois
        const horaires = StateHelpers.getHorairesForMonth(monthStr);
        const depenses = StateHelpers.getDepensesForMonth(monthStr);
        const extras = StateHelpers.getExtrasForMonth(monthStr);

        // Regrouper par jour
        const dayData = this.buildDayData(year, month, horaires, depenses, extras);

        // Header du calendrier
        const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric'
        });

        let html = `
            <div class="calendar-container">
                <div class="calendar-header">
                    <div class="calendar-title">${monthName}</div>
                    <div class="calendar-nav">
                        <button class="calendar-nav-btn" data-cal-nav="prev">‹</button>
                        <button class="calendar-nav-btn" data-cal-nav="today">•</button>
                        <button class="calendar-nav-btn" data-cal-nav="next">›</button>
                    </div>
                </div>

                <div class="calendar-weekdays">
                    <div class="calendar-weekday">L</div>
                    <div class="calendar-weekday">M</div>
                    <div class="calendar-weekday">M</div>
                    <div class="calendar-weekday">J</div>
                    <div class="calendar-weekday">V</div>
                    <div class="calendar-weekday">S</div>
                    <div class="calendar-weekday">D</div>
                </div>

                <div class="calendar-grid" id="calendarGrid">
                    ${this.renderDays(year, month, dayData)}
                </div>

                <div class="calendar-legend">
                    <div class="calendar-legend-item">
                        <span class="calendar-dot income"></span> Revenus
                    </div>
                    <div class="calendar-legend-item">
                        <span class="calendar-dot expense"></span> Dépenses
                    </div>
                    <div class="calendar-legend-item">
                        <span class="calendar-dot work"></span> Travail
                    </div>
                    <div class="calendar-legend-item">
                        <span class="calendar-dot recurrent"></span> Récurrentes
                    </div>
                </div>
            </div>

            <div id="calendarSummary"></div>
        `;

        // Résumé du mois
        html += this.renderMonthSummary(horaires, depenses, extras);

        return html;
    },

    /**
     * Regroupe les données par jour
     */
    buildDayData(year, month, horaires, depenses, extras) {
        const data = {};

        // Horaires
        horaires.forEach(h => {
            const day = parseInt(h.date.split('-')[2]);
            if (!data[day]) data[day] = { work: [], expense: [], income: [], recurrent: [], totalIncome: 0, totalExpense: 0 };
            data[day].work.push(h);
        });

        // Dépenses
        depenses.forEach(d => {
            const day = parseInt(d.date.split('-')[2]);
            if (!data[day]) data[day] = { work: [], expense: [], income: [], recurrent: [], totalIncome: 0, totalExpense: 0 };
            data[day].expense.push(d);
            data[day].totalExpense += d.montant;
        });

        // Extras (revenus)
        extras.forEach(e => {
            const day = parseInt(e.date.split('-')[2]);
            if (!data[day]) data[day] = { work: [], expense: [], income: [], recurrent: [], totalIncome: 0, totalExpense: 0 };
            data[day].income.push(e);
            data[day].totalIncome += e.montant;
        });

        // Dépenses récurrentes actives
        const recurrent = (State.data.recurrent || []).filter(r => r.actif !== false);
        recurrent.forEach(r => {
            const day = r.jour;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            if (day >= 1 && day <= daysInMonth) {
                if (!data[day]) data[day] = { work: [], expense: [], income: [], recurrent: [], totalIncome: 0, totalExpense: 0 };
                data[day].recurrent.push(r);
            }
        });

        return data;
    },

    /**
     * Rendu des jours du calendrier
     */
    renderDays(year, month, dayData) {
        // Premier jour du mois (0 = dimanche, 1 = lundi...)
        let firstDay = new Date(year, month, 1).getDay();
        // Décalage pour lundi = 0
        firstDay = firstDay === 0 ? 6 : firstDay - 1;

        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Aujourd'hui
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        const todayDay = isCurrentMonth ? today.getDate() : -1;

        let html = '';

        // Cases vides au début
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Jours du mois
        for (let day = 1; day <= daysInMonth; day++) {
            const data = dayData[day];
            const hasEvents = data && (
                data.work.length > 0 ||
                data.expense.length > 0 ||
                data.income.length > 0 ||
                data.recurrent.length > 0
            );

            let classes = 'calendar-day';
            if (day === todayDay) classes += ' today';
            if (hasEvents) classes += ' has-events';

            let dotsHtml = '';
            let valueHtml = '';

            if (hasEvents) {
                dotsHtml = '<div class="calendar-day-dots">';
                if (data.income.length > 0) dotsHtml += '<span class="calendar-dot income"></span>';
                if (data.expense.length > 0) dotsHtml += '<span class="calendar-dot expense"></span>';
                if (data.work.length > 0) dotsHtml += '<span class="calendar-dot work"></span>';
                if (data.recurrent.length > 0) dotsHtml += '<span class="calendar-dot recurrent"></span>';
                dotsHtml += '</div>';

                // Afficher le solde du jour
                const soldeJour = data.totalIncome - data.totalExpense;
                if (soldeJour !== 0) {
                    const valueClass = soldeJour > 0 ? 'positive' : 'negative';
                    const sign = soldeJour > 0 ? '+' : '';
                    valueHtml = `<div class="calendar-day-value ${valueClass}">${sign}${Format.money(Math.abs(soldeJour)).replace(' ' + State.settings.devise, '')}</div>`;
                }
            }

            html += `
                <button class="${classes}" data-cal-day="${day}">
                    <span class="calendar-day-number">${day}</span>
                    ${dotsHtml}
                    ${valueHtml}
                </button>
            `;
        }

        return html;
    },

    /**
     * Résumé du mois
     */
    renderMonthSummary(horaires, depenses, extras) {
        const totalHeures = horaires.reduce((s, h) => s + h.minutes, 0);
        const totalDep = depenses.reduce((s, d) => s + d.montant, 0);
        const totalExtras = extras.reduce((s, e) => s + e.montant, 0);
        const nbJours = new Set(horaires.map(h => h.date)).size;
        const recurrent = (State.data.recurrent || []).filter(r => r.actif !== false);
        const totalRec = recurrent.reduce((s, r) => s + r.montant, 0);

        return `
            <div class="analyse-stats-grid" style="margin-top: var(--space-md);">
                <div class="stat-card">
                    <span class="stat-icon">⏰</span>
                    <span class="stat-value">${Format.duration(totalHeures)}</span>
                    <span class="stat-label">Heures (${nbJours}j)</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">🎁</span>
                    <span class="stat-value" style="color: var(--success);">+${Format.money(totalExtras)}</span>
                    <span class="stat-label">Extras (${extras.length})</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">💳</span>
                    <span class="stat-value" style="color: var(--danger);">-${Format.money(totalDep)}</span>
                    <span class="stat-label">Dépenses (${depenses.length})</span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon">🔁</span>
                    <span class="stat-value" style="color: var(--info);">${Format.money(totalRec)}</span>
                    <span class="stat-label">Récurrent (${recurrent.length})</span>
                </div>
            </div>
        `;
    },

    /**
     * ==========================================
     * ÉVÉNEMENTS
     * ==========================================
     */
    attachEvents() {
        // Navigation mois
        document.querySelectorAll('[data-cal-nav]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.calNav;
                this.navigate(action);
            });
        });

        // Clic sur un jour
        document.querySelectorAll('[data-cal-day]').forEach(day => {
            day.addEventListener('click', () => {
                const dayNum = parseInt(day.dataset.calDay);
                this.showDayDetail(dayNum);
            });
        });
    },

    /**
     * Navigation entre les mois
     */
    navigate(action) {
        switch (action) {
            case 'prev':
                if (this._currentDate.month === 0) {
                    this._currentDate.month = 11;
                    this._currentDate.year--;
                } else {
                    this._currentDate.month--;
                }
                break;
            case 'next':
                if (this._currentDate.month === 11) {
                    this._currentDate.month = 0;
                    this._currentDate.year++;
                } else {
                    this._currentDate.month++;
                }
                break;
            case 'today':
                const now = new Date();
                this._currentDate = {
                    year: now.getFullYear(),
                    month: now.getMonth()
                };
                break;
        }

        this.render();
    },

    /**
     * ==========================================
     * DÉTAIL D'UN JOUR
     * ==========================================
     */
    showDayDetail(dayNum) {
        const { year, month } = this._currentDate;
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;

        // Récupérer toutes les données du jour
        const horaires = State.data.horaires.filter(h => h.date === dateStr);
        const depenses = State.data.depenses.filter(d => d.date === dateStr);
        const extras = State.data.extras.filter(e => e.date === dateStr);

        // Récurrentes de ce jour
        const recurrent = (State.data.recurrent || []).filter(r =>
            r.actif !== false && r.jour === dayNum
        );

        // Formater la date
        const dateObj = new Date(year, month, dayNum);
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
        const fullDate = dateObj.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let html = `
            <div class="day-detail-header">
                <div class="day-detail-date">${fullDate}</div>
                <div class="day-detail-day">${dayName}</div>
            </div>
        `;

        // Aucune activité
        if (horaires.length === 0 && depenses.length === 0 &&
            extras.length === 0 && recurrent.length === 0) {
            html += `
                <div class="empty-page" style="min-height: 150px;">
                    <div class="empty-icon">📅</div>
                    <p style="color: var(--text2); font-size: var(--text-sm);">Aucune activité ce jour</p>
                </div>

                <div class="form" style="margin-top: var(--space-md);">
                    <button class="btn btn-primary btn-block" onclick="Router.closeSheet(); setTimeout(() => Router.navigateTo('add'), 200);">
                        ➕ Ajouter quelque chose
                    </button>
                </div>
            `;
        } else {
            // Résumé rapide
            const totalIncome = extras.reduce((s, e) => s + e.montant, 0);
            const totalExpense = depenses.reduce((s, d) => s + d.montant, 0);
            const totalRec = recurrent.reduce((s, r) => s + r.montant, 0);
            const solde = totalIncome - totalExpense;

            if (totalIncome > 0 || totalExpense > 0 || totalRec > 0) {
                html += `
                    <div class="stat-grid stat-grid-3" style="margin-bottom: var(--space-md);">
                        ${totalIncome > 0 ? `
                        <div class="stat-card">
                            <span class="stat-value" style="color: var(--success);">+${Format.money(totalIncome)}</span>
                            <span class="stat-label">Revenus</span>
                        </div>` : ''}
                        ${totalExpense > 0 ? `
                        <div class="stat-card">
                            <span class="stat-value" style="color: var(--danger);">-${Format.money(totalExpense)}</span>
                            <span class="stat-label">Dépenses</span>
                        </div>` : ''}
                        ${totalRec > 0 ? `
                        <div class="stat-card">
                            <span class="stat-value" style="color: var(--info);">${Format.money(totalRec)}</span>
                            <span class="stat-label">Récurrent</span>
                        </div>` : ''}
                    </div>
                `;
            }

            // Horaires
            if (horaires.length > 0) {
                html += `
                    <div class="day-detail-section">
                        <div class="day-detail-section-title">⏰ Horaires</div>
                        <div class="list">
                `;
                horaires.forEach(h => {
                    html += FormHelpers.renderListItem({
                        icon: '📅',
                        title: `${h.debut} – ${h.fin}`,
                        subtitle: Format.duration(h.minutes) +
                            (h.pause > 0 ? ` (${h.pause}min pause)` : '') +
                            (h.note ? ` · ${h.note}` : ''),
                        amount: Format.money(h.gain),
                        amountClass: 'positive',
                        id: h.id,
                        collection: 'horaires'
                    });
                });
                html += '</div></div>';
            }

            // Revenus
            if (extras.length > 0) {
                html += `
                    <div class="day-detail-section">
                        <div class="day-detail-section-title">🎁 Revenus</div>
                        <div class="list">
                `;
                extras.forEach(e => {
                    const emoji = e.source ? e.source.split(' ')[0] : '💰';
                    html += FormHelpers.renderListItem({
                        icon: emoji,
                        title: e.description || e.source,
                        subtitle: e.source,
                        amount: '+' + Format.money(e.montant),
                        amountClass: 'positive',
                        id: e.id,
                        collection: 'extras'
                    });
                });
                html += '</div></div>';
            }

            // Dépenses
            if (depenses.length > 0) {
                html += `
                    <div class="day-detail-section">
                        <div class="day-detail-section-title">💳 Dépenses</div>
                        <div class="list">
                `;
                depenses.forEach(d => {
                    const emoji = d.categorie ? d.categorie.split(' ')[0] : '💳';
                    html += FormHelpers.renderListItem({
                        icon: emoji,
                        title: d.description || d.categorie,
                        subtitle: d.categorie,
                        amount: '-' + Format.money(d.montant),
                        amountClass: 'negative',
                        id: d.id,
                        collection: 'depenses'
                    });
                });
                html += '</div></div>';
            }

            // Récurrentes
            if (recurrent.length > 0) {
                html += `
                    <div class="day-detail-section">
                        <div class="day-detail-section-title">🔁 Dépenses récurrentes prévues</div>
                        <div class="list">
                `;
                recurrent.forEach(r => {
                    const emoji = r.categorie ? r.categorie.split(' ')[0] : '🔁';
                    html += `
                        <div class="list-item">
                            <div class="list-item-icon">${emoji}</div>
                            <div class="list-item-body">
                                <div class="list-item-title">${r.nom}</div>
                                <div class="list-item-subtitle">${r.categorie} · Le ${r.jour} du mois</div>
                            </div>
                            <div class="list-item-right">
                                <span class="list-item-amount negative">-${Format.money(r.montant)}</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div></div>';
            }
        }

        Router.openSheet('day-detail', fullDate, html);

        // Attacher les événements de suppression
        setTimeout(() => {
            const container = document.getElementById('sheetContent');
            FormHelpers.attachDeleteEvents(container, (id, collection) => {
                FormHelpers.confirm(
                    'Supprimer ?',
                    'Supprimer cet élément ?',
                    () => {
                        App.removeData(collection, id);
                        Toast.success('🗑️ Supprimé');
                        Router.closeSheet();
                        setTimeout(() => {
                            this.render();
                            if (State.currentPage === 'home') Dashboard.render();
                        }, 300);
                    },
                    { danger: true, confirmLabel: 'Supprimer' }
                );
            });
        }, 100);
    }
};

// Alias global
window.Calendrier = Calendrier;
