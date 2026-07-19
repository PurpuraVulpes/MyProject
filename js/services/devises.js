/* ============================================
   DEVISES.JS - Multi-devises et conversion
   ============================================ */

'use strict';

const Devises = {

    // Devises disponibles
    AVAILABLE: [
        { code: '€', name: 'Euro', country: 'EUR' },
        { code: '$', name: 'Dollar US', country: 'USD' },
        { code: '£', name: 'Livre', country: 'GBP' },
        { code: 'CHF', name: 'Franc CH', country: 'CHF' },
        { code: '¥', name: 'Yen', country: 'JPY' },
        { code: 'C$', name: 'Dollar CA', country: 'CAD' },
        { code: 'A$', name: 'Dollar AU', country: 'AUD' },
        { code: 'kr', name: 'Cour. NOR', country: 'NOK' }
    ],

    // Taux de change de fallback (par rapport à l'EUR)
    // Utilisés si l'API n'est pas disponible
    FALLBACK_RATES: {
        'EUR': 1,
        'USD': 1.08,
        'GBP': 0.86,
        'CHF': 0.95,
        'JPY': 163.5,
        'CAD': 1.47,
        'AUD': 1.65,
        'NOK': 11.5
    },

    // Cache des taux (avec date)
    _rateCache: null,
    _cacheDate: null,

    /**
     * ==========================================
     * INITIALISATION
     * ==========================================
     */
    init() {
        // Charger les taux depuis le cache
        try {
            const cached = localStorage.getItem('mb_rates_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                this._rateCache = parsed.rates;
                this._cacheDate = new Date(parsed.date);
            }
        } catch (e) {
            console.warn('Erreur cache devises:', e);
        }

        // Rafraîchir les taux si cache trop vieux (> 24h)
        if (!this._cacheDate || this.isStale()) {
            this.refreshRates();
        }
    },

    /**
     * Vérifie si le cache est trop vieux
     */
    isStale() {
        if (!this._cacheDate) return true;
        const now = new Date();
        const diff = now - this._cacheDate;
        return diff > 24 * 60 * 60 * 1000; // 24h
    },

    /**
     * ==========================================
     * RÉCUPÉRATION DES TAUX (API gratuite)
     * ==========================================
     */

    /**
     * Récupère les taux depuis l'API
     */
    async refreshRates() {
        try {
            // API gratuite (frankfurter.app, pas besoin de clé)
            const response = await fetch('https://api.frankfurter.app/latest?from=EUR');

            if (!response.ok) throw new Error('API HS');

            const data = await response.json();

            if (data && data.rates) {
                // Ajouter EUR = 1
                data.rates.EUR = 1;
                this._rateCache = data.rates;
                this._cacheDate = new Date();

                // Sauvegarder en cache
                localStorage.setItem('mb_rates_cache', JSON.stringify({
                    rates: this._rateCache,
                    date: this._cacheDate.toISOString()
                }));

                console.log('💱 Taux mis à jour:', new Date().toLocaleString());
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Impossible de récupérer les taux, utilisation du fallback');
            this._rateCache = this.FALLBACK_RATES;
            this._cacheDate = new Date();
            return false;
        }
    },

    /**
     * ==========================================
     * CONVERSION
     * ==========================================
     */

    /**
     * Récupère le code ISO d'une devise depuis son symbole
     */
    getCode(symbol) {
        const devise = this.AVAILABLE.find(d => d.code === symbol);
        return devise ? devise.country : 'EUR';
    },

    /**
     * Récupère le taux d'une devise par rapport à l'EUR
     */
    getRate(code) {
        if (!this._rateCache) return this.FALLBACK_RATES[code] || 1;
        return this._rateCache[code] || this.FALLBACK_RATES[code] || 1;
    },

    /**
     * Convertit un montant d'une devise à une autre
     * @param {number} amount - Montant à convertir
     * @param {string} fromSymbol - Devise source (symbole)
     * @param {string} toSymbol - Devise cible (symbole)
     */
    convert(amount, fromSymbol, toSymbol) {
        if (!amount || amount === 0) return 0;
        if (fromSymbol === toSymbol) return amount;

        const fromCode = this.getCode(fromSymbol);
        const toCode = this.getCode(toSymbol);

        // Convertir : from → EUR → to
        const fromRate = this.getRate(fromCode);
        const toRate = this.getRate(toCode);

        // amount / fromRate = valeur en EUR
        // (valeur en EUR) * toRate = valeur dans la devise cible
        return (amount / fromRate) * toRate;
    },

    /**
     * Formate avec conversion optionnelle
     */
    formatWithConversion(amount, sourceSymbol) {
        const targetSymbol = State.settings.devise;

        if (sourceSymbol === targetSymbol) {
            return Format.money(amount);
        }

        const converted = this.convert(amount, sourceSymbol, targetSymbol);
        const oldDevise = State.settings.devise;

        // Formater dans la devise source
        State.settings.devise = sourceSymbol;
        const sourceFormatted = Format.money(amount);
        State.settings.devise = oldDevise;

        // Formater dans la devise cible
        const targetFormatted = Format.money(converted);

        return `${sourceFormatted} <span class="conversion-line">≈ <strong>${targetFormatted}</strong></span>`;
    },

    /**
     * ==========================================
     * CHANGEMENT DE DEVISE PRINCIPALE
     * ==========================================
     */

    /**
     * Change la devise principale (avec option de conversion automatique)
     */
    async changePrimaryDevise(newSymbol, convertData = false) {
        const oldSymbol = State.settings.devise;

        if (newSymbol === oldSymbol) return;

        // Convertir toutes les données existantes si demandé
        if (convertData) {
            const conversions = [
                { collection: 'depenses', field: 'montant' },
                { collection: 'paiements', field: 'montant' },
                { collection: 'extras', field: 'montant' },
                { collection: 'epargne', field: 'montant' },
                { collection: 'objectifs', field: 'montant' },
                { collection: 'objectifs', field: 'mensuel' },
                { collection: 'objectifs', field: 'deja' },
                { collection: 'recurrent', field: 'montant' },
                { collection: 'budgets', field: 'max' },
                { collection: 'shopping', field: 'prix' }
            ];

            conversions.forEach(({ collection, field }) => {
                State.data[collection].forEach(item => {
                    if (typeof item[field] === 'number') {
                        item[field] = this.convert(item[field], oldSymbol, newSymbol);
                    }
                });
            });

            // Convertir aussi le taux horaire
            State.settings.tauxHoraire = this.convert(
                State.settings.tauxHoraire,
                oldSymbol,
                newSymbol
            );

            // Recalculer les gains des horaires
            State.data.horaires.forEach(h => {
                h.gain = (h.minutes / 60) * State.settings.tauxHoraire;
            });
        }

        // Changer la devise principale
        State.settings.devise = newSymbol;
        notifyStateChange();

        if (State.user && !State.isGuestMode) {
            CloudSync.saveSettings();
            // Re-sync toutes les données modifiées
            if (convertData) {
                setTimeout(() => CloudSync.manualSync(), 500);
            }
        }

        Toast.success(`💱 Devise changée : ${oldSymbol} → ${newSymbol}`);

        // Rafraîchir l'UI
        if (typeof App !== 'undefined') App.refreshUI();
    },

    /**
     * ==========================================
     * UI - SHEET DE CONFIGURATION
     * ==========================================
     */

    openSettingsSheet() {
        const currentDevise = State.settings.devise;
        const lastUpdate = this._cacheDate
            ? this._cacheDate.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
            : 'jamais';

        let html = `
            <div class="banner banner-info" style="margin-bottom: var(--space-md);">
                <span class="banner-icon">💡</span>
                <div class="banner-body">
                    <div class="banner-title">Devise principale</div>
                    <div class="banner-text">
                        Tous vos montants seront affichés dans cette devise.
                    </div>
                </div>
            </div>

            <label class="form-label">Choisir une devise</label>
            <div class="devise-selector">
        `;

        this.AVAILABLE.forEach(d => {
            const isActive = d.code === currentDevise;
            html += `
                <button class="devise-option ${isActive ? 'active' : ''}" data-devise-symbol="${d.code}">
                    <span class="devise-symbol">${d.code}</span>
                    <span class="devise-name">${d.name}</span>
                </button>
            `;
        });

        html += `
            </div>

            <div class="devise-rate-info">
                <div>📊 Taux mis à jour : <strong>${lastUpdate}</strong></div>
                <button class="btn btn-secondary btn-sm" style="margin-top: var(--space-sm);" id="btnRefreshRates">
                    🔄 Actualiser les taux
                </button>
            </div>

            <div style="padding: var(--space-md); background: var(--bg3); border-radius: var(--radius-md); margin-top: var(--space-md);">
                <div style="font-size: var(--text-xs); color: var(--text2); margin-bottom: var(--space-sm); text-transform: uppercase; font-weight: var(--font-bold); letter-spacing: 0.3px;">
                    Exemples de conversion
                </div>
                <div id="conversionExamples" style="font-size: var(--text-sm); line-height: 1.6;"></div>
            </div>
        `;

        Router.openSheet('devises', 'Multi-devises', html);

        setTimeout(() => {
            this.attachEvents();
            this.updateExamples();
        }, 100);
    },

    /**
     * Attache les événements
     */
    attachEvents() {
        // Sélection d'une devise
        document.querySelectorAll('.devise-option[data-devise-symbol]').forEach(btn => {
            btn.addEventListener('click', () => {
                const newSymbol = btn.dataset.deviseSymbol;
                const currentSymbol = State.settings.devise;

                if (newSymbol === currentSymbol) return;

                this.confirmChangeDevise(newSymbol, currentSymbol);
            });
        });

        // Rafraîchir les taux
        document.getElementById('btnRefreshRates')?.addEventListener('click', async () => {
            const btn = document.getElementById('btnRefreshRates');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Chargement...';

            const success = await this.refreshRates();

            if (success) {
                Toast.success('✅ Taux mis à jour !');
                this.openSettingsSheet(); // Rouvrir avec les nouveaux taux
            } else {
                Toast.warning('⚠️ Taux non disponibles, valeurs par défaut');
                btn.disabled = false;
                btn.innerHTML = '🔄 Actualiser les taux';
            }
        });
    },

    /**
     * Met à jour les exemples de conversion
     */
    updateExamples() {
        const container = document.getElementById('conversionExamples');
        if (!container) return;

        const currentDevise = State.settings.devise;
        const otherDevises = this.AVAILABLE.filter(d => d.code !== currentDevise).slice(0, 3);

        let html = '';

        // 100 unités de la devise actuelle → autres devises
        otherDevises.forEach(d => {
            const converted = this.convert(100, currentDevise, d.code);
            html += `
                <div>
                    <strong>100 ${currentDevise}</strong> = ${converted.toFixed(2).replace('.', ',')} ${d.code}
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /**
     * Demande confirmation avant changement de devise
     */
    confirmChangeDevise(newSymbol, currentSymbol) {
        const converted100 = this.convert(100, currentSymbol, newSymbol);

        const html = `
            <div class="banner banner-warning" style="margin-bottom: var(--space-md);">
                <span class="banner-icon">⚠️</span>
                <div class="banner-body">
                    <div class="banner-title">Changer de devise</div>
                    <div class="banner-text">
                        Vous passez de <strong>${currentSymbol}</strong> à <strong>${newSymbol}</strong>
                    </div>
                </div>
            </div>

            <div style="padding: var(--space-md); background: var(--bg3); border-radius: var(--radius-md); margin-bottom: var(--space-md);">
                <div style="text-align: center; font-size: var(--text-sm);">
                    Taux actuel : <strong style="color: var(--primary-light);">
                        100 ${currentSymbol} = ${converted100.toFixed(2).replace('.', ',')} ${newSymbol}
                    </strong>
                </div>
            </div>

            <p style="font-size: var(--text-sm); color: var(--text2); text-align: center; margin-bottom: var(--space-md);">
                Souhaitez-vous convertir automatiquement tous vos montants existants dans la nouvelle devise ?
            </p>

            <div class="form">
                <button class="btn btn-primary btn-block" id="btnDeviseConvert">
                    ✅ Oui, convertir tous les montants
                </button>
                <button class="btn btn-outline btn-block" id="btnDeviseKeep">
                    Non, garder les montants tels quels
                </button>
                <button class="btn btn-secondary btn-block" onclick="Router.closeSheet()">
                    Annuler
                </button>
            </div>
        `;

        Router.openSheet('devise-confirm', 'Changer de devise', html);

        setTimeout(() => {
            document.getElementById('btnDeviseConvert')?.addEventListener('click', () => {
                this.changePrimaryDevise(newSymbol, true);
                Router.closeSheet();
            });

            document.getElementById('btnDeviseKeep')?.addEventListener('click', () => {
                this.changePrimaryDevise(newSymbol, false);
                Router.closeSheet();
            });
        }, 100);
    },

    /**
     * ==========================================
     * WIDGET DASHBOARD (optionnel)
     * ==========================================
     */

    /**
     * Renvoie un mini-widget avec les taux principaux
     */
    renderMiniWidget() {
        if (!this._rateCache) return '';

        const current = State.settings.devise;
        const others = this.AVAILABLE.filter(d => d.code !== current).slice(0, 3);

        let html = `
            <div class="widget widget-full">
                <div class="widget-header">
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span class="widget-emoji">💱</span>
                        <span style="font-weight: var(--font-bold);">Taux du jour</span>
                    </div>
                    <span class="widget-badge badge-info">1 ${current}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm); margin-top: var(--space-sm);">
        `;

        others.forEach(d => {
            const rate = this.convert(1, current, d.code);
            html += `
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg3); border-radius: var(--radius-sm);">
                    <div style="font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--primary-light);">
                        ${rate.toFixed(2).replace('.', ',')}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--text2); margin-top: 2px;">
                        ${d.code}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    }
};

// Alias global
window.Devises = Devises;
