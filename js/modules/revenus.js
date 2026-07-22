/* ============================================
   REVENUS.JS - Salaires et revenus supplémentaires
   ✅ CORRIGÉ : Protection anti-double-clic
   ============================================ */

'use strict';

const Revenus = {

    // ✅ Flags anti-double-clic
    _isSavingPaie: false,
    _isSavingExtra: false,
    _isReporting: false,

    /**
     * Ouvre le menu de choix (salaire / extra)
     */
    openAddForm() {
        const html = `
            <p style="color: var(--text2); font-size: var(--text-sm); text-align: center; margin-bottom: var(--space-md);">
                Que souhaitez-vous ajouter ?
            </p>

            <div class="add-menu">
                <button class="add-menu-item" id="btnAddSalaire">
                    <span class="add-menu-icon">💼</span>
                    <div class="add-menu-text">
                        <strong>Salaire reçu</strong>
                        <small>Paie mensuelle (avec prévision)</small>
                    </div>
                    <span class="add-menu-arrow">›</span>
                </button>

                <button class="add-menu-item" id="btnAddExtra">
                    <span class="add-menu-icon">🎁</span>
                    <div class="add-menu-text">
                        <strong>Revenu supplémentaire</strong>
                        <small>Cadeau, remboursement, vente...</small>
                    </div>
                    <span class="add-menu-arrow">›</span>
                </button>
            </div>
        `;

        Router.openSheet('add-revenu-choice', '💰 Nouveau revenu', html);

        setTimeout(() => {
            document.getElementById('btnAddSalaire')?.addEventListener('click', () => {
                this.openSalaireForm();
            });

            document.getElementById('btnAddExtra')?.addEventListener('click', () => {
                this.openExtraForm();
            });
        }, 100);
    },

    /**
     * ==========================================
     * FORMULAIRE SALAIRE (avec prévision)
     * ==========================================
     */
    openSalaireForm() {
        const currentM = StateHelpers.currentMonth();
        const prevM = StateHelpers.getPreviousMonth(currentM);
        const nextM = StateHelpers.getNextMonth(currentM);

        const horairesActuel = StateHelpers.getHorairesForMonth(currentM);
        const horairesPrec = StateHelpers.getHorairesForMonth(prevM);
        const gainActuel = horairesActuel.reduce((s, x) => s + x.gain, 0);
        const gainPrec = horairesPrec.reduce((s, x) => s + x.gain, 0);

        let html = `
            <div class="banner banner-info" style="margin-bottom: var(--space-md);">
                <span class="banner-icon">💡</span>
                <div class="banner-body">
                    <div class="banner-title">Salaire décalé</div>
                    <div class="banner-text">
                        Les heures faites ce mois seront payées le mois suivant.
                    </div>
                </div>
            </div>
        `;

        if (gainPrec > 0 || gainActuel > 0) {
            html += `
                <div class="prevision-card">
                    <div class="prevision-header">
                        <span class="prevision-icon">🔮</span>
                        <div class="prevision-header-text">
                            <strong>Prévision de paie</strong>
                            <small>Basé sur vos heures</small>
                        </div>
                    </div>

                    <div class="prevision-row">
                        <div class="prevision-item">
                            <span class="prevision-item-label">Ce mois-ci</span>
                            <span class="prevision-item-value">${Format.money(gainActuel)}</span>
                            <span class="prevision-item-hint">Sera reçu en ${Format.monthShort(nextM)}</span>
                        </div>
                        <div class="prevision-separator"></div>
                        <div class="prevision-item">
                            <span class="prevision-item-label">Mois précédent</span>
                            <span class="prevision-item-value">${Format.money(gainPrec)}</span>
                            <span class="prevision-item-hint">À recevoir en ${Format.monthShort(currentM)}</span>
                        </div>
                    </div>
            `;

            if (gainPrec > 0) {
                html += `
                    <div class="paie-adjust">
                        <label class="paie-adjust-label">💶 Montant réel à enregistrer</label>
                        <div class="stepper">
                            <button type="button" class="stepper-btn" id="paieMinus">−</button>
                            <input type="number" id="paieMontantAjuste" value="${gainPrec.toFixed(2)}"
                                   step="0.01" min="0" inputmode="decimal">
                            <button type="button" class="stepper-btn" id="paiePlus">+</button>
                        </div>
                        <div class="paie-adjust-hint" id="paieAdjustHint">= Montant original</div>
                        <div class="paie-adjust-quick">
                            <button type="button" class="chip" data-paie-adj="reset">🔄</button>
                            <button type="button" class="chip" data-paie-adj="-5">-5%</button>
                            <button type="button" class="chip" data-paie-adj="-10">-10%</button>
                            <button type="button" class="chip" data-paie-adj="-15">-15%</button>
                            <button type="button" class="chip" data-paie-adj="-20">-20%</button>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" id="btnEnregistrerPaie">
                        ✨ Enregistrer pour ${Format.monthShort(currentM)}
                    </button>
                `;
            } else {
                html += `
                    <div class="banner banner-warning" style="margin-top: var(--space-md);">
                        <span class="banner-icon">ℹ️</span>
                        <div class="banner-body">
                            <div class="banner-title">Aucune heure le mois précédent</div>
                            <div class="banner-text">
                                Utilisez le formulaire manuel ci-dessous pour saisir une paie.
                            </div>
                        </div>
                    </div>
                `;
            }

            html += '</div>';
        }

        html += `
            <div class="divider-text">
                <span>OU SAISIE MANUELLE</span>
            </div>

            <div class="form">
                <div class="form-group">
                    <label class="form-label">📅 Mois de réception</label>
                    <input type="month" id="paieMoisManuel" value="${currentM}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">💶 Montant reçu (${State.settings.devise})</label>
                    <input type="number" id="paieMontantManuel" step="0.01" min="0.01"
                           placeholder="0,00" inputmode="decimal" required>
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Description</label>
                    <input type="text" id="paieDescriptionManuel" placeholder="Ex: Salaire janvier">
                </div>

                <button class="btn btn-success btn-block" id="btnEnregistrerManuel">
                    ✅ Enregistrer manuellement
                </button>
            </div>
        `;

        Router.openSheet('add-salaire', '💼 Nouveau salaire', html);

        setTimeout(() => {
            this.attachSalaireEvents(gainPrec, currentM, prevM);
        }, 100);
    },

    attachSalaireEvents(gainOriginal, currentM, prevM) {
        const input = document.getElementById('paieMontantAjuste');

        if (input) {
            const minus = document.getElementById('paieMinus');
            const plus = document.getElementById('paiePlus');

            if (minus) minus.addEventListener('click', () => {
                const val = parseFloat(input.value) - 10;
                if (val >= 0) input.value = val.toFixed(2);
                this.updateAdjustHint(gainOriginal);
            });

            if (plus) plus.addEventListener('click', () => {
                input.value = (parseFloat(input.value) + 10).toFixed(2);
                this.updateAdjustHint(gainOriginal);
            });

            input.addEventListener('input', () => this.updateAdjustHint(gainOriginal));

            document.querySelectorAll('.chip[data-paie-adj]').forEach(chip => {
                chip.addEventListener('click', () => {
                    const adj = chip.dataset.paieAdj;
                    if (adj === 'reset') {
                        input.value = gainOriginal.toFixed(2);
                    } else {
                        const pct = parseFloat(adj);
                        input.value = (gainOriginal * (1 + pct / 100)).toFixed(2);
                    }
                    this.updateAdjustHint(gainOriginal);
                });
            });
        }

        // ✅ Bouton "Enregistrer paie prévue" avec protection
        const btnPrevue = document.getElementById('btnEnregistrerPaie');
        if (btnPrevue) {
            btnPrevue.addEventListener('click', () => {
                if (this._isSavingPaie) return;

                const montant = parseFloat(document.getElementById('paieMontantAjuste').value);
                if (!montant || montant <= 0) {
                    Toast.warning('⚠️ Montant invalide');
                    return;
                }
                this.savePaie(currentM, montant, `Salaire ${Format.monthLong(prevM)}`);
            });
        }

        // ✅ Bouton manuel avec protection
        const btnManuel = document.getElementById('btnEnregistrerManuel');
        if (btnManuel) {
            btnManuel.addEventListener('click', () => {
                if (this._isSavingPaie) return;
                this.saveManualPaie();
            });
        }
    },

    updateAdjustHint(original) {
        const input = document.getElementById('paieMontantAjuste');
        const hint = document.getElementById('paieAdjustHint');

        if (!input || !hint) return;

        const current = parseFloat(input.value) || 0;
        const diff = current - original;
        const pct = original > 0 ? ((diff / original) * 100).toFixed(1) : 0;

        if (Math.abs(diff) < 0.01) {
            hint.textContent = '= Montant original';
            hint.className = 'paie-adjust-hint';
        } else if (diff > 0) {
            hint.textContent = `+ ${Format.money(diff)} (+${pct}%)`;
            hint.className = 'paie-adjust-hint positive';
        } else {
            hint.textContent = `${Format.money(diff)} (${pct}%)`;
            hint.className = 'paie-adjust-hint negative';
        }
    },

    /**
     * ✅ CORRIGÉ : Sauvegarde de la paie avec protection anti-double-clic
     */
    savePaie(mois, montant, description = '') {
        // ✅ Bloquer les appels multiples
        if (this._isSavingPaie) {
            console.warn('⚠️ Sauvegarde paie déjà en cours');
            return;
        }
        this._isSavingPaie = true;

        // ✅ Désactiver les boutons
        const btnPrevue = document.getElementById('btnEnregistrerPaie');
        const btnManuel = document.getElementById('btnEnregistrerManuel');
        if (btnPrevue) {
            btnPrevue.disabled = true;
            btnPrevue.textContent = '⏳ Enregistrement...';
        }
        if (btnManuel) {
            btnManuel.disabled = true;
            btnManuel.textContent = '⏳ Enregistrement...';
        }

        const paiement = {
            id: StateHelpers.generateId(),
            mois: mois,
            montant: montant,
            description: description,
            date: StateHelpers.today()
        };

        App.addData('paiements', paiement);
        State.data.paiements.sort((a, b) => b.mois.localeCompare(a.mois));

        Router.closeSheet();
        Toast.success('✨ Paie de ' + Format.money(montant) + ' enregistrée !');

        if (State.currentPage === 'home') Dashboard.render();

        // ✅ Réactiver après délai
        setTimeout(() => {
            this._isSavingPaie = false;
        }, 1000);
    },

    saveManualPaie() {
        const mois = FormHelpers.getText('paieMoisManuel');
        const montant = FormHelpers.getNumber('paieMontantManuel');
        const description = FormHelpers.getText('paieDescriptionManuel');

        if (!mois || montant <= 0) {
            Toast.warning('⚠️ Remplissez mois et montant');
            return;
        }

        this.savePaie(mois, montant, description);
    },

    /**
     * ==========================================
     * FORMULAIRE EXTRA (revenu supplémentaire)
     * ==========================================
     */
    openExtraForm() {
        const html = `
            <div class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">📅 Date</label>
                        <input type="date" id="addExtraDate" value="${FormHelpers.todayForInput()}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">💶 Montant (${State.settings.devise})</label>
                        <input type="number" id="addExtraMontant" step="0.01" min="0.01"
                               placeholder="0,00" inputmode="decimal" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">🏷️ Source</label>
                    ${FormHelpers.renderCategoryGrid(SOURCES_REVENUS, 'addExtraSource')}
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Description</label>
                    <input type="text" id="addExtraDescription" placeholder="Ex: Cadeau de maman">
                </div>

                <button class="btn btn-success btn-block" id="btnSaveExtra">
                    ✅ Enregistrer
                </button>
            </div>
        `;

        Router.openSheet('add-extra', '🎁 Revenu supplémentaire', html);

        setTimeout(() => {
            FormHelpers.attachCategoryEvents(document.getElementById('sheetContent'));

            const btn = document.getElementById('btnSaveExtra');
            if (btn) {
                // ✅ Protection anti-double-clic
                btn.addEventListener('click', () => {
                    if (this._isSavingExtra) return;
                    this.saveExtra();
                });
            }
        }, 100);
    },

    /**
     * ✅ CORRIGÉ : Sauvegarde extra avec protection anti-double-clic
     */
    saveExtra() {
        // ✅ Bloquer les appels multiples
        if (this._isSavingExtra) {
            console.warn('⚠️ Sauvegarde extra déjà en cours');
            return;
        }

        const date = FormHelpers.getText('addExtraDate');
        const montant = FormHelpers.getNumber('addExtraMontant');
        const source = FormHelpers.getText('addExtraSource');
        const description = FormHelpers.getText('addExtraDescription');

        if (!date || montant <= 0) {
            Toast.warning('⚠️ Remplissez date et montant');
            return;
        }

        if (!source) {
            Toast.warning('⚠️ Choisissez une source');
            return;
        }

        this._isSavingExtra = true;

        // ✅ Désactiver le bouton
        const btn = document.getElementById('btnSaveExtra');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Enregistrement...';
        }

        const extra = {
            id: StateHelpers.generateId(),
            date: date,
            montant: montant,
            source: source,
            description: description
        };

        App.addData('extras', extra);
        State.data.extras.sort((a, b) => b.date.localeCompare(a.date));

        Router.closeSheet();
        Toast.success('✅ +' + Format.money(montant) + ' enregistré !');

        if (State.currentPage === 'home') Dashboard.render();

        // ✅ Réactiver après délai
        setTimeout(() => {
            this._isSavingExtra = false;
        }, 1000);
    },

    /**
     * ==========================================
     * REPORT DE SOLDE
     * ✅ CORRIGÉ : Protection anti-double-clic
     * ==========================================
     */
    reportSolde(fromMonth) {
        // ✅ Bloquer les appels multiples
        if (this._isReporting) {
            console.warn('⚠️ Report déjà en cours');
            return;
        }

        const solde = StateHelpers.computeMonthlyBalance(fromMonth);

        if (solde <= 0) {
            Toast.warning('⚠️ Aucun solde positif à reporter');
            return;
        }

        const nextMonth = StateHelpers.getNextMonth(fromMonth);

        const existing = State.data.extras.find(e =>
            e.date.startsWith(nextMonth) &&
            e.source === '📅 Report' &&
            e.isReport === true
        );

        const doReport = () => {
            this._isReporting = true;

            if (existing) {
                App.removeData('extras', existing.id);
            }

            const extra = {
                id: StateHelpers.generateId(),
                date: nextMonth + '-01',
                montant: solde,
                source: '📅 Report',
                description: `Reste de ${Format.monthLong(fromMonth)}`,
                isReport: true
            };

            App.addData('extras', extra);
            State.data.extras.sort((a, b) => b.date.localeCompare(a.date));

            Toast.success('✅ ' + Format.money(solde) + ' reporté à ' + Format.monthShort(nextMonth));

            if (State.currentPage === 'home') Dashboard.render();

            // ✅ Réactiver après délai
            setTimeout(() => {
                this._isReporting = false;
            }, 1000);
        };

        if (existing) {
            FormHelpers.confirm(
                'Report déjà fait',
                `Un report existe déjà pour ${Format.monthLong(nextMonth)}. Le remplacer ?`,
                doReport,
                { confirmLabel: 'Remplacer' }
            );
        } else {
            doReport();
        }
    }
};

window.Revenus = Revenus;
