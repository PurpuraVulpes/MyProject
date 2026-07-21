/* ============================================
   DEPENSES.JS - Gestion des dépenses
   ✅ CORRIGÉ : Anti-doublons + protection init multiple
   ============================================ */

'use strict';

const Depenses = {

    // ✅ Flag pour empêcher les sauvegardes multiples
    _isSaving: false,

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
            FormHelpers.attachCategoryEvents(document.getElementById('sheetContent'));

            const btn = document.getElementById('btnSaveDepense');
            if (btn) {
                // ✅ Utiliser un flag pour empêcher les doubles clics
                btn.addEventListener('click', () => {
                    if (this._isSaving) return;
                    this.save();
                });
            }
        }, 100);
    },

    /**
     * Sauvegarde la dépense
     * ✅ Protection contre les doubles enregistrements
     */
    save() {
        // ✅ Bloquer les appels multiples
        if (this._isSaving) {
            console.warn('⚠️ Sauvegarde déjà en cours, ignoré');
            return;
        }

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

        // ✅ Activer le flag
        this._isSaving = true;

        // ✅ Désactiver visuellement le bouton
        const btn = document.getElementById('btnSaveDepense');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Enregistrement...';
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

        // ✅ Réactiver après un délai
        setTimeout(() => {
            this._isSaving = false;
        }, 1000);
    },

    /**
     * ==========================================
     * AFFICHAGE
     * ==========================================
     */

    renderPage() {
        let html = '';
        html += FormHelpers.renderMonthFilter('filtreDepenseMois');
        html += '<div id="depenseStats"></div>';
        html += '<div id="depenseCatSummary"></div>';
        html += '<div class="list" id="depenseList"></div>';
        return html;
    },

    /**
     * Rafraîchit le contenu
     * ✅ CORRIGÉ : Déduplique les dépenses par ID
     */
    refresh(monthStr) {
        const month = monthStr || FormHelpers.getText('filtreDepenseMois') || StateHelpers.currentMonth();
        
        // ✅ Dédupliquer les dépenses par ID (sécurité)
        const allDepenses = StateHelpers.getDepensesForMonth(month);
        const seen = new Set();
        const depenses = allDepenses.filter(d => {
            const key = String(d.id);
            if (seen.has(key)) {
                console.warn('⚠️ Doublon détecté et ignoré:', d);
                return false;
            }
            seen.add(key);
            return true;
        });

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
     * ✅ CORRIGÉ : Empêche l'attachement multiple de listeners
     */
    init(container) {
        if (!container) return;

        // ✅ Marquer le container pour éviter les init multiples
        if (container.dataset.depensesInit === 'true') {
            this.refresh();
            return;
        }
        container.dataset.depensesInit = 'true';

        FormHelpers.attachMonthFilterEvents(container, (newMonth) => {
            this.refresh(newMonth);
        });

        this.refresh();
    }
};

// Alias global
window.Depenses = Depenses;
