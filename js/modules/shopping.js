/* ============================================
   SHOPPING.JS - Liste d'achats à prévoir
   ============================================ */

'use strict';

const Shopping = {

    /**
     * ==========================================
     * FORMULAIRE D'AJOUT
     * ==========================================
     */

    openAddForm() {
        const html = `
            <div class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">🛒 Article</label>
                        <input type="text" id="addShopNom" placeholder="Ex: Chaussures Nike" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">💶 Prix estimé (${State.settings.devise})</label>
                        <input type="number" id="addShopPrix" step="0.01" min="0"
                               placeholder="0,00" inputmode="decimal">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">🏷️ Priorité</label>
                    ${FormHelpers.renderPrioritySelector('addShopPrio', 'normal')}
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Note</label>
                    <input type="text" id="addShopNote" placeholder="Optionnel...">
                </div>

                <button class="btn btn-primary btn-block" id="btnSaveShop">
                    ✅ Ajouter à la liste
                </button>
            </div>
        `;

        Router.openSheet('add-shopping', '🛒 Nouvel achat', html);

        setTimeout(() => {
            FormHelpers.attachPriorityEvents(document.getElementById('sheetContent'));
            document.getElementById('btnSaveShop')?.addEventListener('click', () => this.save());
        }, 100);
    },

    /**
     * Sauvegarde un article
     */
    save() {
        const nom = FormHelpers.getText('addShopNom');
        const prix = FormHelpers.getNumber('addShopPrix');
        const prio = FormHelpers.getText('addShopPrio') || 'normal';
        const note = FormHelpers.getText('addShopNote');

        if (!nom) {
            Toast.warning('⚠️ Entrez un article');
            return;
        }

        const item = {
            id: StateHelpers.generateId(),
            nom: nom,
            prix: prix,
            prio: prio,
            note: note,
            bought: false,
            date: StateHelpers.today()
        };

        App.addData('shopping', item);

        Router.closeSheet();
        Toast.success('✅ ' + nom + ' ajouté !');

        if (State.currentPage === 'budget') this.refresh();
    },

    /**
     * ==========================================
     * AFFICHAGE DE LA LISTE
     * ==========================================
     */

    renderPage() {
        return `
            <div id="shopSummary"></div>
            <div class="list" id="shopList"></div>
        `;
    },

    /**
     * Rafraîchit la liste
     */
    refresh() {
        const items = State.data.shopping || [];

        // Résumé
        const summaryContainer = document.getElementById('shopSummary');
        if (summaryContainer) {
            const remaining = items.filter(s => !s.bought);
            const totalRemaining = remaining.reduce((sum, i) => sum + (i.prix || 0), 0);

            if (items.length > 0) {
                summaryContainer.innerHTML = `
                    <div class="shop-summary">
                        <span class="shop-summary-label">
                            🛒 ${remaining.length} article${remaining.length > 1 ? 's' : ''} restant${remaining.length > 1 ? 's' : ''}
                        </span>
                        <span class="shop-summary-amount">${Format.money(totalRemaining)}</span>
                    </div>
                `;
            } else {
                summaryContainer.innerHTML = '';
            }
        }

        // Liste
        const listContainer = document.getElementById('shopList');
        if (!listContainer) return;

        if (items.length === 0) {
            listContainer.innerHTML = FormHelpers.renderEmptyState(
                '🛒', 'Liste vide',
                'Ajoutez ce que vous souhaitez acheter'
            );
            return;
        }

        // Ordre : non achetés (par priorité) puis achetés
        const prioOrder = { urgent: 0, normal: 1, envie: 2 };
        const remaining = items.filter(s => !s.bought)
            .sort((a, b) => (prioOrder[a.prio] || 1) - (prioOrder[b.prio] || 1));
        const bought = items.filter(s => s.bought);
        const allItems = remaining.concat(bought);

        listContainer.innerHTML = allItems.map(s => this.renderShopItem(s)).join('');

        this.attachShopEvents(listContainer);
    },

    /**
     * Rendu d'un item shopping
     */
    renderShopItem(s) {
        const boughtClass = s.bought ? ' bought' : '';
        const checkClass = s.bought ? ' checked' : '';
        const checkIcon = s.bought ? '✓' : '';

        let prioTag;
        switch (s.prio) {
            case 'urgent':
                prioTag = '<span class="prio-tag urgent">🔴 Urgent</span>';
                break;
            case 'envie':
                prioTag = '<span class="prio-tag envie">💫 Envie</span>';
                break;
            default:
                prioTag = '<span class="prio-tag normal">📦 Normal</span>';
        }

        return `
            <div class="shop-item${boughtClass}">
                <button class="shop-checkbox${checkClass}" data-shop-toggle="${s.id}" title="${s.bought ? 'Marquer non acheté' : 'Marquer acheté'}">
                    ${checkIcon}
                </button>
                <div class="shop-item-body">
                    <div class="shop-item-name">${s.nom}</div>
                    ${s.note ? `<div class="shop-item-note">${s.note}</div>` : ''}
                </div>
                <div class="shop-item-right">
                    ${s.prix > 0 ? `<span class="shop-item-price">${Format.money(s.prix)}</span>` : ''}
                    ${prioTag}
                    <button class="list-item-action" data-shop-delete="${s.id}" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    /**
     * Attache les événements aux items shopping
     */
    attachShopEvents(container) {
        // Toggle acheté
        container.querySelectorAll('[data-shop-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.shopToggle);
                this.toggleBought(id);
            });
        });

        // Suppression
        container.querySelectorAll('[data-shop-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.shopDelete);
                this.deleteItem(id);
            });
        });
    },

    /**
     * Toggle acheté/non acheté
     */
    toggleBought(id) {
        const item = State.data.shopping.find(s => s.id === id);
        if (!item) return;

        const newBought = !item.bought;
        App.updateData('shopping', id, { bought: newBought });

        this.refresh();

        if (newBought) {
            Toast.success('✅ Marqué comme acheté');
        }
    },

    /**
     * Supprime un item
     */
    deleteItem(id) {
        const item = State.data.shopping.find(s => s.id === id);
        if (!item) return;

        FormHelpers.confirm(
            'Supprimer ?',
            `Supprimer "${item.nom}" ?`,
            () => {
                App.removeData('shopping', id);
                this.refresh();
                Toast.success('🗑️ Supprimé');
            },
            { danger: true, confirmLabel: 'Supprimer' }
        );
    }
};

// Alias global
window.Shopping = Shopping;
