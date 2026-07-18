/* ============================================
   DEPENSES.JS - Gestion des dépenses
   ============================================ */

'use strict';

const Depenses = {

    /**
     * Ouvre le formulaire d'ajout de dépense
     */
    openAddForm() {
        const html = `
            <div class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">📅 Date</label>
                        <input type="date" id="addDepenseDate" value="${FormHelpers.todayForInput()}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">💶 Montant (${State.settings.devise})</label>
                        <input type="number" id="addDepenseMontant" step="0.01" min="0.01"
                               placeholder="0,00" inputmode="decimal" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">🏷️ Catégorie</label>
                    ${FormHelpers.renderCategoryGrid(CATEGORIES_DEPENSES, 'addDepenseCategorie')}
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Description</label>
                    <input type="text" id="addDepenseDescription" placeholder="Ex: Courses Carrefour">
                </div>

                <button class="btn btn-danger btn-block" id="btnSaveDepense">
                    ✅ Enregistrer
                </button>
            </div>
        `;

        Router.openSheet('add-depense', '💳 Nouvelle dépense', html);

        setTimeout(() => {
            // Catégories
            FormHelpers.attachCategoryEvents(document.getElementById('sheetContent'));

            // Bouton sauvegarder
            const btn = document.getElementById('btnSaveDepense');
            if (btn) btn.addEventListener('click', () => this.save());
        }, 100);
    },

    /**
     * Sauvegarde la dépense
     */
    save() {
        const date = FormHelpers.getText('addDepenseDate');
        const montant = FormHelpers.getNumber('addDepenseMontant');
        const categorie = FormHelpers.getText('addDepenseCategorie');
        const description = FormHelpers.getText('addDepenseDescription');

        if (!date || montant <= 0) {
            Toast.warning('⚠️ Remplissez date et montant');
            return;
        }

        if (!categorie) {
            Toast.warning('⚠️ Choisissez une catégorie');
            return;
        }

        const depense = {
            id: StateHelpers.generateId(),
            date: date,
            montant: montant,
            categorie: categorie,
            description: description
        };

        App.addData('depenses', depense);
        State.data.depenses.sort((a, b) => b.date.localeCompare(a.date));

        Router.closeSheet();
        Toast.success('✅ ' + Format.money(montant) + ' ajouté !');

        if (State.currentPage === 'home') Dashboard.render();
        if (State.currentPage === 'budget') this.refresh();
    },

    /**
     * ==========================================
     * AFFICHAGE
     * ==========================================
     */

    /**
     * Rendu de l'onglet dépenses
     */
    renderPage() {
        let html = '';

        // Filtre de mois
        html += FormHelpers.renderMonthFilter('filtreDepenseMois');

        // Stats
        html += '<div id="depenseStats"></div>';

        // Résumé catégories
        html += '<div id="depenseCatSummary"></div>';

        // Liste
        html += '<div class="list" id="depenseList"></div>';

        return html;
    },

    /**
     * Rafraîchit le contenu
     */
    refresh(monthStr) {
        const month = monthStr || FormHelpers.getText('filtreDepenseMois') || StateHelpers.currentMonth();
        const depenses = StateHelpers.getDepensesForMonth(month);

        // Stats rapides
        const statsContainer = document.getElementById('depenseStats');
        if (statsContainer) {
            const total = depenses.reduce((s, d) => s + d.montant, 0);
            const moy = depenses.length > 0 ? total / depenses.length : 0;
            const max = depenses.length > 0 ? Math.max(...depenses.map(d => d.montant)) : 0;

            statsContainer.innerHTML = FormHelpers.renderQuickStats([
                { value: depenses.length, label: 'Dépenses' },
                { value: Format.money(moy), label: 'Moyenne' },
                { value: Format.money(max), label: 'Max' }
            ]);
        }

        // Résumé par catégorie
        this.renderCategorySummary(depenses);

        // Liste
        const listContainer = document.getElementById('depenseList');
        if (listContainer) {
            if (depenses.length === 0) {
                listContainer.innerHTML = FormHelpers.renderEmptyState(
                    '🎉', 'Aucune dépense ce mois',
                    'Ajoutez une dépense avec le bouton ➕'
                );
                return;
            }

            listContainer.innerHTML = depenses.map(d => {
                const emoji = d.categorie.split(' ')[0];
                return FormHelpers.renderListItem({
                    icon: emoji,
                    title: d.description || d.categorie,
                    subtitle: `${d.categorie} · ${Format.date(d.date)}`,
                    amount: '-' + Format.money(d.montant),
                    amountClass: 'negative',
                    id: d.id,
                    collection: 'depenses'
                });
            }).join('');

            FormHelpers.attachDeleteEvents(listContainer, (id, collection) => {
                FormHelpers.confirm(
                    'Supprimer ?',
                    'Supprimer cette dépense ?',
                    () => {
                        App.removeData(collection, id);
                        this.refresh(month);
                        if (State.currentPage === 'home') Dashboard.render();
                        Toast.success('🗑️ Supprimé');
                    },
                    { danger: true, confirmLabel: 'Supprimer' }
                );
            });
        }
    },

    /**
     * Rendu du résumé par catégorie
     */
    renderCategorySummary(depenses) {
        const container = document.getElementById('depenseCatSummary');
        if (!container) return;

        if (depenses.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Regrouper par catégorie
        const cats = {};
        depenses.forEach(d => {
            cats[d.categorie] = (cats[d.categorie] || 0) + d.montant;
        });

        const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        const max = sorted[0][1];

        let html = '<div class="cat-summary"><div class="cat-summary-title">📊 Par catégorie</div>';

        sorted.forEach((entry, i) => {
            const cat = entry[0];
            const amt = entry[1];
            const percent = (amt / max) * 100;
            const color = PALETTE_COULEURS[i % PALETTE_COULEURS.length];

            html += `
                <div class="cat-row">
                    <span class="cat-row-name">${cat}</span>
                    <div class="cat-row-track">
                        <div class="cat-row-fill" style="width: ${percent}%; background: ${color};"></div>
                    </div>
                    <span class="cat-row-amount">${Format.money(amt)}</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Initialise les événements
     */
    init(container) {
        FormHelpers.attachMonthFilterEvents(container, (newMonth) => {
            this.refresh(newMonth);
        });

        this.refresh();
    }
};

// Alias global
window.Depenses = Depenses;
