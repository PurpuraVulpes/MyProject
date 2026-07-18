/* ============================================
   HORAIRES.JS - Gestion des horaires de travail
   ============================================ */

'use strict';

const Horaires = {

    /**
     * Ouvre le formulaire d'ajout d'horaire
     */
    openAddForm() {
        const html = `
            <div class="form">
                <div class="form-group">
                    <label class="form-label">📅 Date</label>
                    <input type="date" id="addHoraireDate" value="${FormHelpers.todayForInput()}" required>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">🕐 Début</label>
                        <input type="time" id="addHoraireDebut" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🕔 Fin</label>
                        <input type="time" id="addHoraireFin" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">☕ Pause (min)</label>
                        <input type="number" id="addHorairePause" value="0" min="0" max="480" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label class="form-label">📝 Note</label>
                        <input type="text" id="addHoraireNote" placeholder="Optionnel...">
                    </div>
                </div>

                <div class="preview-box" id="horairePreview">
                    <div class="preview-item">
                        <span class="preview-item-label">Durée</span>
                        <span class="preview-item-value" id="previewDuree">--</span>
                    </div>
                    <div class="preview-separator"></div>
                    <div class="preview-item">
                        <span class="preview-item-label">Gain</span>
                        <span class="preview-item-value" id="previewGain">--</span>
                    </div>
                </div>

                <button class="btn btn-success btn-block" id="btnSaveHoraire">
                    ✅ Enregistrer
                </button>
            </div>
        `;

        Router.openSheet('add-horaire', '⏰ Nouvel horaire', html);

        setTimeout(() => {
            // Preview en temps réel
            ['addHoraireDebut', 'addHoraireFin', 'addHorairePause'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => this.updatePreview());
            });

            // Bouton sauvegarder
            const btn = document.getElementById('btnSaveHoraire');
            if (btn) btn.addEventListener('click', () => this.save());
        }, 100);
    },

    /**
     * Met à jour le preview durée/gain
     */
    updatePreview() {
        const debut = FormHelpers.getText('addHoraireDebut');
        const fin = FormHelpers.getText('addHoraireFin');
        const pause = FormHelpers.getNumber('addHorairePause', 0);

        const dureeEl = document.getElementById('previewDuree');
        const gainEl = document.getElementById('previewGain');

        if (debut && fin && dureeEl && gainEl) {
            const minutes = StateHelpers.calcMinutes(debut, fin, pause);
            const gain = (minutes / 60) * State.settings.tauxHoraire;
            dureeEl.textContent = Format.duration(minutes);
            gainEl.textContent = Format.money(gain);
        }
    },

    /**
     * Sauvegarde l'horaire
     */
    save() {
        const date = FormHelpers.getText('addHoraireDate');
        const debut = FormHelpers.getText('addHoraireDebut');
        const fin = FormHelpers.getText('addHoraireFin');
        const pause = FormHelpers.getNumber('addHorairePause', 0);
        const note = FormHelpers.getText('addHoraireNote');

        if (!date || !debut || !fin) {
            Toast.warning('⚠️ Remplissez date, début et fin');
            return;
        }

        const minutes = StateHelpers.calcMinutes(debut, fin, pause);
        if (minutes <= 0) {
            Toast.warning('⚠️ Durée invalide');
            return;
        }

        const horaire = {
            id: StateHelpers.generateId(),
            date: date,
            debut: debut,
            fin: fin,
            pause: pause,
            minutes: minutes,
            note: note,
            gain: (minutes / 60) * State.settings.tauxHoraire
        };

        App.addData('horaires', horaire);
        State.data.horaires.sort((a, b) => b.date.localeCompare(a.date));

        Router.closeSheet();
        Toast.success('✅ ' + Format.duration(minutes) + ' ajouté !');

        // Rafraîchir si on est sur la bonne page
        if (State.currentPage === 'home') Dashboard.render();
    },

    /**
     * ==========================================
     * AFFICHAGE DE LA LISTE
     * ==========================================
     */

    /**
     * Rendu complet de l'historique des horaires
     */
    renderPage() {
        const currentMonth = StateHelpers.currentMonth();

        let html = '';

        // Filtre de mois
        html += FormHelpers.renderMonthFilter('filtreHoraireMois', currentMonth);

        // Stats rapides
        html += '<div id="horaireStats"></div>';

        // Liste
        html += '<div class="list" id="horaireList"></div>';

        return html;
    },

    /**
     * Rafraîchit le contenu selon le mois filtré
     */
    refresh(monthStr) {
        const month = monthStr || FormHelpers.getText('filtreHoraireMois') || StateHelpers.currentMonth();
        const horaires = StateHelpers.getHorairesForMonth(month);

        // Stats
        const statsContainer = document.getElementById('horaireStats');
        if (statsContainer) {
            const totalMinutes = horaires.reduce((s, h) => s + h.minutes, 0);
            const totalGain = horaires.reduce((s, h) => s + h.gain, 0);
            const nbJours = new Set(horaires.map(h => h.date)).size;

            statsContainer.innerHTML = FormHelpers.renderQuickStats([
                { value: nbJours, label: 'Jours' },
                { value: Format.duration(totalMinutes), label: 'Heures' },
                { value: Format.money(totalGain), label: 'Revenus' }
            ]);
        }

        // Liste
        const listContainer = document.getElementById('horaireList');
        if (listContainer) {
            if (horaires.length === 0) {
                listContainer.innerHTML = FormHelpers.renderEmptyState(
                    '😴', 'Aucun horaire ce mois',
                    'Appuyez sur ➕ pour ajouter un horaire'
                );
                return;
            }

            listContainer.innerHTML = horaires.map(h => {
                return FormHelpers.renderListItem({
                    icon: '📅',
                    title: `${Format.date(h.date)} · ${h.debut} – ${h.fin}`,
                    subtitle: Format.duration(h.minutes) +
                        (h.pause > 0 ? ` (${h.pause}min pause)` : '') +
                        (h.note ? ` · ${h.note}` : ''),
                    amount: Format.money(h.gain),
                    amountClass: 'positive',
                    id: h.id,
                    collection: 'horaires'
                });
            }).join('');

            // Événements suppression
            FormHelpers.attachDeleteEvents(listContainer, (id, collection) => {
                FormHelpers.confirm(
                    'Supprimer ?',
                    'Supprimer cet horaire ?',
                    () => {
                        App.removeData(collection, id);
                        this.refresh(month);
                        Toast.success('🗑️ Supprimé');
                    },
                    { danger: true, confirmLabel: 'Supprimer' }
                );
            });
        }
    },

    /**
     * Initialise les événements quand la page s'affiche
     */
    init(container) {
        FormHelpers.attachMonthFilterEvents(container, (newMonth) => {
            this.refresh(newMonth);
        });

        this.refresh();
    }
};

// Alias global
window.Horaires = Horaires;
