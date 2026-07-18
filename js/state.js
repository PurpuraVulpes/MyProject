/* ============================================
   STATE.JS - État global de l'application v5
   ============================================ */

'use strict';

/**
 * État global de l'application
 * Toutes les données sont ici, structurées et versionnées
 */
const State = {
    // Version des données (pour les migrations futures)
    version: 5,

    // Utilisateur connecté (Firebase)
    user: null,
    isGuestMode: false,

    // Page actuelle
    currentPage: 'home',

    // ========== SETTINGS ==========
    settings: {
        // Général
        tauxHoraire: 12.00,
        devise: '€',
        arrondi: 'none', // 'none', '15', '30', '60'
        theme: 'purple', // 'purple', 'dark', 'light', 'blue', 'red', 'green'

        // Multi-devises (Lot 5)
        deviseSecondaire: null,
        tauxChange: 1,

        // Notifications
        notificationsActives: false,

        // Widgets du dashboard (personnalisation)
        widgets: {
            solde: true,
            revenus: true,
            depenses: true,
            epargne: true,
            objectifs: true,
            recurrent: true,
            budgets: false,
            suggestions: true
        }
    },

    // ========== MODULES ACTIFS ==========
    modules: {
        horaires: true,
        revenus: true,
        depenses: true,
        epargne: true,
        objectifs: true,
        shopping: true,
        recurrent: true,
        budgets: true,
        calendrier: true,
        analyseAvancee: true,
        suggestions: true,
        tickets: false,       // Photos de tickets (Lot 5)
        multiDevises: false   // Multi-devises (Lot 5)
    },

    // ========== DATA ==========
    data: {
        horaires: [],      // [{id, date, debut, fin, pause, minutes, note, gain}]
        depenses: [],      // [{id, date, montant, categorie, description, ticketId}]
        paiements: [],     // [{id, mois, montant, description, date}]
        extras: [],        // [{id, date, montant, source, description, isReport}]
        epargne: [],       // [{id, date, montant, type, raison}] type: 'deposit'/'withdraw'
        objectifs: [],     // [{id, nom, montant, mensuel, deja, emoji, dateCreation}]
        shopping: [],      // [{id, nom, prix, prio, note, bought, date}]
        recurrent: [],     // [{id, nom, montant, categorie, jour, actif, prochaine}]
        budgets: [],       // [{id, categorie, max, alerte}] alerte: 0-100 (%)
        tickets: []        // [{id, depenseId, photo, date}] (Lot 5)
    }
};

/**
 * Constantes globales
 */
const CATEGORIES_DEPENSES = [
    { emoji: '🍔', label: 'Alimentation' },
    { emoji: '🏠', label: 'Loyer' },
    { emoji: '🚗', label: 'Transport' },
    { emoji: '📱', label: 'Téléphone' },
    { emoji: '⚡', label: 'Énergie' },
    { emoji: '🎮', label: 'Loisirs' },
    { emoji: '👕', label: 'Vêtements' },
    { emoji: '💊', label: 'Santé' },
    { emoji: '🛒', label: 'Courses' },
    { emoji: '📦', label: 'Abonnements' },
    { emoji: '🎓', label: 'Éducation' },
    { emoji: '🔧', label: 'Autre' }
];

const SOURCES_REVENUS = [
    { emoji: '👨‍👩‍👧', label: 'Famille' },
    { emoji: '🎁', label: 'Cadeau' },
    { emoji: '💸', label: 'Remboursement' },
    { emoji: '🏷️', label: 'Vente' },
    { emoji: '🤝', label: 'Aide' },
    { emoji: '💼', label: 'Freelance' },
    { emoji: '🎰', label: 'Gain' },
    { emoji: '🏦', label: 'Prêt' },
    { emoji: '🔄', label: 'Retour' },
    { emoji: '💰', label: 'Autre' }
];

const EMOJIS_OBJECTIFS = [
    '🎯', '🏖️', '🚗', '🏠', '💻', '📱',
    '🎮', '👕', '💍', '🎓', '✈️', '🎁',
    '📷', '🎸', '🚲', '⌚', '💼', '🏋️'
];

const PALETTE_COULEURS = [
    '#9b59b6', '#00d2a0', '#e17055', '#fdcb6e',
    '#e84393', '#a29bfe', '#fd79a8', '#74b9ff',
    '#ff9f43', '#55efc4', '#c39bd3', '#b2bec3'
];

const THEMES_DISPONIBLES = [
    { id: 'purple', label: '💜 Violet' },
    { id: 'dark', label: '🌙 Sombre' },
    { id: 'light', label: '☀️ Clair' },
    { id: 'blue', label: '💙 Bleu' },
    { id: 'red', label: '❤️ Rouge' },
    { id: 'green', label: '💚 Vert' }
];

/**
 * ==========================================
 * HELPERS - Accès aux données
 * ==========================================
 */
const StateHelpers = {

    /**
     * Génère un ID unique (timestamp + random)
     */
    generateId() {
        return Date.now() + Math.floor(Math.random() * 1000);
    },

    /**
     * Renvoie la date d'aujourd'hui au format YYYY-MM-DD
     */
    today() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Renvoie le mois actuel au format YYYY-MM
     */
    currentMonth() {
        return this.today().substring(0, 7);
    },

    /**
     * Renvoie le mois précédent au format YYYY-MM
     */
    getPreviousMonth(monthStr) {
        const [y, m] = monthStr.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Renvoie le mois suivant au format YYYY-MM
     */
    getNextMonth(monthStr) {
        const [y, m] = monthStr.split('-').map(Number);
        const d = new Date(y, m, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Filtre les horaires d'un mois
     */
    getHorairesForMonth(monthStr) {
        return State.data.horaires.filter(h => h.date.startsWith(monthStr));
    },

    /**
     * Filtre les dépenses d'un mois
     */
    getDepensesForMonth(monthStr) {
        return State.data.depenses.filter(d => d.date.startsWith(monthStr));
    },

    /**
     * Filtre les paiements d'un mois
     */
    getPaiementsForMonth(monthStr) {
        return State.data.paiements.filter(p => p.mois === monthStr);
    },

    /**
     * Filtre les paiements d'une année
     */
    getPaiementsForYear(year) {
        return State.data.paiements.filter(p => p.mois.startsWith(String(year)));
    },

    /**
     * Filtre les extras (revenus supp.) d'un mois
     */
    getExtrasForMonth(monthStr) {
        return State.data.extras.filter(e => e.date.startsWith(monthStr));
    },

    /**
     * Filtre les mouvements d'épargne d'un mois
     */
    getEpargneForMonth(monthStr) {
        return State.data.epargne.filter(e => e.date.startsWith(monthStr));
    },

    /**
     * Renvoie le solde total de l'épargne
     */
    getEpargneSolde() {
        return State.data.epargne.reduce((total, e) => {
            return total + (e.type === 'deposit' ? e.montant : -e.montant);
        }, 0);
    },

    /**
     * Calcule le revenu total d'un mois (avec logique paie décalée)
     * @returns {Object} { paieRecue, gainPrevu, extras, totalReel, totalEstime }
     */
    computeMonthlyRevenue(monthStr) {
        const paieMois = this.getPaiementsForMonth(monthStr);
        const paieRecue = paieMois.reduce((s, p) => s + p.montant, 0);

        const extras = this.getExtrasForMonth(monthStr);
        const totalExtras = extras.reduce((s, e) => s + e.montant, 0);

        // Prévision : heures du mois précédent
        const prevMonth = this.getPreviousMonth(monthStr);
        const horairesPrec = this.getHorairesForMonth(prevMonth);
        const gainPrevu = horairesPrec.reduce((s, x) => s + x.gain, 0);

        const salaireEstime = paieRecue === 0 && gainPrevu > 0;

        return {
            paieRecue,
            gainPrevu,
            salaireEstime,
            totalExtras,
            nbPaies: paieMois.length,
            nbExtras: extras.length,
            totalReel: paieRecue + totalExtras,
            totalEstime: gainPrevu + totalExtras
        };
    },

    /**
     * Calcule les dépenses totales d'un mois
     */
    computeMonthlyExpenses(monthStr) {
        const depenses = this.getDepensesForMonth(monthStr);
        return depenses.reduce((s, d) => s + d.montant, 0);
    },

    /**
     * Calcule le solde d'un mois (revenus RÉELS - dépenses)
     */
    computeMonthlyBalance(monthStr) {
        const revenue = this.computeMonthlyRevenue(monthStr);
        const expenses = this.computeMonthlyExpenses(monthStr);
        return revenue.totalReel - expenses;
    },

    /**
     * Applique l'arrondi selon les settings
     */
    applyArrondi(minutes) {
        const arrondi = State.settings.arrondi || 'none';
        if (arrondi === 'none' || minutes <= 0) return minutes;
        const step = parseInt(arrondi);
        if (isNaN(step) || step <= 0) return minutes;
        return Math.ceil(minutes / step) * step;
    },

    /**
     * Calcule les minutes entre deux horaires
     */
    calcMinutes(debut, fin, pause = 0) {
        const [dh, dm] = debut.split(':').map(Number);
        const [fh, fm] = fin.split(':').map(Number);
        let t = (fh * 60 + fm) - (dh * 60 + dm);
        if (t < 0) t += 1440; // Passage minuit
        t = Math.max(0, t - pause);
        return this.applyArrondi(t);
    },

    /**
     * Vérifie si un module est actif
     */
    isModuleActive(moduleName) {
        return State.modules[moduleName] === true;
    },

    /**
     * Vérifie si un widget est activé sur le dashboard
     */
    isWidgetActive(widgetName) {
        return State.settings.widgets[widgetName] === true;
    }
};

/**
 * ==========================================
 * FORMATTERS - Formatage des valeurs
 * ==========================================
 */
const Format = {

    /**
     * Formate un montant : 1234.56 -> "1 234,56 €"
     */
    money(amount, showSign = false) {
        const abs = Math.abs(amount);
        const formatted = abs.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const sign = amount < 0 ? '−' : (showSign && amount > 0 ? '+' : '');
        return `${sign}${formatted} ${State.settings.devise}`;
    },

    /**
     * Formate une durée en minutes : 90 -> "1h 30"
     */
    duration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${String(m).padStart(2, '0')}`;
    },

    /**
     * Formate une date : "2026-01-15" -> "15/01/2026"
     */
    date(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    },

    /**
     * Formate un mois court : "2026-01" -> "Jan 2026"
     */
    monthShort(monthStr) {
        const [y, mo] = monthStr.split('-').map(Number);
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                       'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${months[mo - 1]} ${y}`;
    },

    /**
     * Formate un mois long : "2026-01" -> "janvier 2026"
     */
    monthLong(monthStr) {
        const [y, mo] = monthStr.split('-').map(Number);
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `${months[mo - 1]} ${y}`;
    },

    /**
     * Formate une durée d'objectif : 15 mois -> "1 an et 3 mois"
     */
    monthsToDuration(months) {
        if (months === Infinity) return 'Jamais';
        if (months === 0) return 'Atteint !';
        if (months < 12) return `${months} mois`;
        const y = Math.floor(months / 12);
        const m = months % 12;
        if (m === 0) return `${y} an${y > 1 ? 's' : ''}`;
        return `${y} an${y > 1 ? 's' : ''} et ${m} mois`;
    },

    /**
     * Formate un pourcentage : 0.15 -> "15%"
     */
    percent(value, decimals = 0) {
        return `${(value * 100).toFixed(decimals)}%`;
    },

    /**
     * Formate un mois-année depuis un Date : Date -> "Jan 2026"
     */
    dateToMonthYear(date) {
        if (!date) return '';
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                       'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
};

/**
 * ==========================================
 * MIGRATION - Ancienne version -> v5
 * ==========================================
 */
const Migration = {

    /**
     * Vérifie si une migration est nécessaire
     */
    needsMigration() {
        // Si on trouve les vieilles clés localStorage
        const hasOldData = localStorage.getItem('mb_horaires') !== null ||
                          localStorage.getItem('mb_depenses') !== null ||
                          localStorage.getItem('mb_settings') !== null;

        // Si on n'a pas encore la nouvelle structure
        const hasNewData = localStorage.getItem('mb_state_v5') !== null;

        return hasOldData && !hasNewData;
    },

    /**
     * Migre les anciennes données vers la structure v5
     */
    migrate() {
        console.log('🔄 Migration des données v4 → v5...');

        try {
            // Lire toutes les anciennes clés
            const oldKeys = {
                horaires: 'mb_horaires',
                depenses: 'mb_depenses',
                paiements: 'mb_paiements',
                extras: 'mb_extras',
                epargne: 'mb_epargne',
                shopping: 'mb_shopping',
                objectifs: 'mb_objectifs',
                settings: 'mb_settings'
            };

            let migrated = 0;

            // Migrer les tableaux de data
            Object.entries(oldKeys).forEach(([key, oldKey]) => {
                if (key === 'settings') return; // traité à part
                const raw = localStorage.getItem(oldKey);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            State.data[key] = parsed;
                            migrated += parsed.length;
                        }
                    } catch (e) {
                        console.warn(`Erreur migration ${key}:`, e);
                    }
                }
            });

            // Migrer les settings
            const oldSettings = localStorage.getItem('mb_settings');
            if (oldSettings) {
                try {
                    const parsed = JSON.parse(oldSettings);
                    State.settings = { ...State.settings, ...parsed };
                } catch (e) {
                    console.warn('Erreur migration settings:', e);
                }
            }

            // Migrer le PIN
            const oldPin = localStorage.getItem('mb_pin');
            if (oldPin) {
                localStorage.setItem('mb_pin_v5', oldPin);
            }

            console.log(`✅ Migration terminée : ${migrated} entrées migrées`);
            return true;

        } catch (e) {
            console.error('❌ Erreur migration:', e);
            return false;
        }
    },

    /**
     * Nettoie les anciennes clés après migration réussie
     * (À appeler seulement après confirmation que tout fonctionne)
     */
    cleanOldKeys() {
        const oldKeys = [
            'mb_horaires', 'mb_depenses', 'mb_paiements', 'mb_extras',
            'mb_epargne', 'mb_shopping', 'mb_objectifs', 'mb_settings',
            'mb_pin'
        ];
        oldKeys.forEach(key => localStorage.removeItem(key));
        console.log('🧹 Anciennes clés nettoyées');
    }
};
