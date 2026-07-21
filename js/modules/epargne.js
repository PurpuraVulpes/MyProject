/* ============================================
   EPARGNE.JS - Gestion de l'épargne
   ============================================ */

'use strict';

const Epargne = {

    _currentMode: 'deposit',

    /**
     * Ouvre le menu de choix (dépôt / retrait)
     */
    openAddForm() {
        const solde = StateHelpers.getEpargneSolde();

        const html = `
            <div class="epargne-solde-card" style="padding: var(--space-lg); margin-bottom: var(--space-md);">
                <div class="epargne-solde-header">
                    <span class="epargne-solde-icon">🏦</span>
                    <div>
                        <div class="epargne-solde-title">Solde actuel</div>
                        <div class="epargne-solde-subtitle">Total épargné</div>
                    </div>
                </div>
                <div class="epargne-solde-amount">${Format.money(solde)}</div>
            </div>

            <p style="color: var(--text2); font-size: var(--text-sm); text-align: center; margin-bottom: var(--space-md);">
                Que souhaitez-vous faire ?
            </p>

            <div class="epargne-actions">
                <button class="epargne-action-btn deposit" id="btnEpargneDeposit">
                    <span class="epargne-action-icon">📥</span>
                    <span class="epargne-action-text">Épargner</span>
                </button>
                <button class="epargne-action-btn withdraw" id="btnEpargneWithdraw" ${solde <= 0 ? 'disabled style="opacity:0.5"' : ''}>
                    <span class="epargne-action-icon">📤</span>
                    <span class="epargne-action-text">Retirer</span>
                </button>
            </div>
        `;

        Router.openSheet('add-epargne', '🏦 Épargne', html);

        setTimeout(() => {
            document.getElementById('btnEpargneDeposit')?.addEventListener('click', () => {
                this.openMouvementForm('deposit');
            });

            document.getElementById('btnEpargneWithdraw')?.addEventListener('click', () => {
                if (solde <= 0) return;
                this.openMouvementForm('withdraw');
            });
        }, 100);
    },

    /**
     * Ouvre le formulaire de mouvement (dépôt ou retrait)
     */
    openMouvementForm(mode) {
        this._currentMode = mode;
        const isDeposit = mode === 'deposit';
        const solde = StateHelpers.getEpargneSolde();

        const html = `
            ${!isDeposit ? `
                <div class="banner" style="margin-bottom: var(--space-md);">
                    <span class="banner-icon">💰</span>
                    <div class="banner-body">
                        <div class="banner-title">Solde disponible</div>
                        <div class="banner-text">${Format.money(solde)}</div>
                    </div>
                </div>
            ` : ''}

            <div class="form">
                <div class="form-group">
                    <label class="form-label">💶 Montant à ${isDeposit ? 'épargner' : 'retirer'} (${State.settings.devise})</label>
                    <input type="number" id="epargneMontant" step="0.01" min="0.01"
                           placeholder="0,00" inputmode="decimal" required>
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Raison</label>
                    <input type="text" id="epargneRaison"
                           placeholder="${isDeposit ? 'Ex: Vacances, sécurité...' : 'Ex: Réparation, achat...'}">
                </div>

                <button class="btn ${isDeposit ? 'btn-success' : 'btn-warning'} btn-block" id="btnSaveEpargne">
                    ${isDeposit ? '📥 Épargner' : '📤 Retirer'}
                </button>
            </div>
        `;

        Router.openSheet('mouvement-epargne', isDeposit ? '📥 Épargner' : '📤 Retirer', html);

        setTimeout(() => {
            document.getElementById('btnSaveEpargne')?.addEventListener('click', () => this.save());
        }, 100);
    },

    /**
     * Sauvegarde un mouvement d'épargne
     */
    save() {
        const montant = FormHelpers.getNumber('epargneMontant');
        const raison = FormHelpers.getText('epargneRaison');
        const isDeposit = this._currentMode === 'deposit';

        if (montant <= 0) {
            Toast.warning('⚠️ Montant invalide');
            return;
        }

        if (!isDeposit && montant > StateHelpers.getEpargneSolde()) {
            Toast.warning('⚠️ Solde insuffisant');
            return;
        }

        const entry = {
            id: StateHelpers.generateId(),
            date: StateHelpers.today(),
            montant: montant,
            type: this._currentMode,
            raison: raison
        };

        App.addData('epargne', entry);
        State.data.epargne.sort((a, b) => b.date.localeCompare(a.date));

        Router.closeSheet();
        Toast.success(
            (isDeposit ? '📥 ' : '📤 ') +
            Format.money(montant) +
            (isDeposit ? ' épargné !' : ' retiré !')
        );

        if (State.currentPage === 'home') Dashboard.render();
    },

    /**
     * ==========================================
     * PAGE D'HISTORIQUE
     * ==========================================
     */
    renderPage() {
        const solde = StateHelpers.getEpargneSolde();

        let html = `
            <div class="epargne-solde-card">
                <div class="epargne-solde-header">
                    <span class="epargne-solde-icon">🏦</span>
                    <div>
                        <div class="epargne-solde-title">Solde épargne</div>
                        <div class="epargne-solde-subtitle">Total mis de côté</div>
                    </div>
                </div>
                <div class="epargne-solde-amount">${Format.money(solde)}</div>
            </div>

            <div class="epargne-actions">
                <button class="epargne-action-btn deposit" onclick="Epargne.openMouvementForm('deposit')">
                    <span class="epargne-action-icon">📥</span>
                    <span class="epargne-action-text">Épargner</span>
                </button>
                <button class="epargne-action-btn withdraw" onclick="Epargne.openMouvementForm('withdraw')" ${solde <= 0 ? 'disabled style="opacity:0.5"' : ''}>
                    <span class="epargne-action-icon">📤</span>
                    <span class="epargne-action-text">Retirer</span>
                </button>
            </div>

            ${FormHelpers.renderMonthFilter('filtreEpargneMois')}

            <div id="epargneStats"></div>
            <div class="list" id="epargneList"></div>
        `;

        Router.openSheet('epargne-page', '🏦 Mon Épargne', html);

        setTimeout(() => {
            const container = document.getElementById('sheetContent');
            FormHelpers.attachMonthFilterEvents(container, (newMonth) => {
                this.refreshList(newMonth);
            });
            this.refreshList();
        }, 100);
    },

    /**
     * Rafraîchit la liste des mouvements
     */
    refreshList(monthStr) {
        const month = monthStr || FormHelpers.getText('filtreEpargneMois') || StateHelpers.currentMonth();
        const mouvements = StateHelpers.getEpargneForMonth(month);

        const statsContainer = document.getElementById('epargneStats');
        if (statsContainer) {
            const depots = mouvements.filter(e => e.type === 'deposit');
            const retraits = mouvements.filter(e => e.type === 'withdraw');
            const totalDepots = depots.reduce((s, e) => s + e.montant, 0);
            const totalRetraits = retraits.reduce((s, e) => s + e.montant, 0);

            statsContainer.innerHTML = FormHelpers.renderQuickStats([
                { value: mouvements.length, label: 'Mouvements' },
                { value: Format.money(totalDepots), label: 'Déposé' },
                { value: Format.money(totalRetraits), label: 'Retiré' }
            ]);
        }

        const listContainer = document.getElementById('epargneList');
        if (listContainer) {
            if (mouvements.length === 0) {
                listContainer.innerHTML = FormHelpers.renderEmptyState(
                    '🏦', 'Aucun mouvement ce mois',
                    'Utilisez les boutons ci-dessus pour ajouter'
                );
                return;
            }

            listContainer.innerHTML = mouvements.map(e => {
                const icon = e.type === 'deposit' ? '📥' : '📤';
                const amountClass = e.type === 'deposit' ? 'positive' : 'negative';
                const sign = e.type === 'deposit' ? '+' : '-';

                return FormHelpers.renderListItem({
                    icon: icon,
                    title: e.raison || (e.type === 'deposit' ? 'Dépôt' : 'Retrait'),
                    subtitle: Format.date(e.date),
                    amount: sign + Format.money(e.montant),
                    amountClass: amountClass,
                    id: e.id,
                    collection: 'epargne'
                });
            }).join('');

            FormHelpers.attachDeleteEvents(listContainer, (id, collection) => {
                FormHelpers.confirm(
                    'Supprimer ?',
                    'Supprimer ce mouvement ?',
                    () => {
                        App.removeData(collection, id);
                        this.refreshList(month);
                        if (State.currentPage === 'home') Dashboard.render();
                        Toast.success('🗑️ Supprimé');
                    },
                    { danger: true, confirmLabel: 'Supprimer' }
                );
            });
        }
    }
};

window.Epargne = Epargne;
