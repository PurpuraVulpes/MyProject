/* ============================================
   AUTH.JS - Authentification utilisateur
   ============================================ */

'use strict';

/**
 * Service d'authentification
 */
const Auth = {

    // État
    isAuthenticated: false,
    currentUser: null,

    /**
     * ==========================================
     * INITIALISATION
     * ==========================================
     */
    init() {
        if (!FirebaseService.isAvailable()) {
            console.warn('⚠️ Firebase indisponible - mode local uniquement');
            State.isGuestMode = true;
            return;
        }

        // Écouter les changements d'état de connexion
        FirebaseService.auth.onAuthStateChanged(user => {
            if (user && !State.isGuestMode) {
                this.onUserSignedIn(user);
            } else if (!State.isGuestMode) {
                this.onUserSignedOut();
            }
        });
    },

    /**
     * Utilisateur connecté avec succès
     */
        /**
     * Utilisateur connecté avec succès
     */
    async onUserSignedIn(user) {
        console.log('👤 Connecté:', user.email);

        this.currentUser = user;
        this.isAuthenticated = true;

        State.user = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        };

        // ✅ Mémoriser l'état
        localStorage.setItem('mb_last_auth_state', 'signed_in');

        // Démarrer la sync temps réel
        CloudSync.startRealtimeSync(user.uid);

        // Upload initial si première connexion
        await CloudSync.uploadLocalData(user.uid);

        // Notifier l'app
        document.dispatchEvent(new CustomEvent('auth:signedin', {
            detail: { user: State.user }
        }));

        // Rafraîchir l'UI
        this.updateAccountUI();
    },

    /**
     * Utilisateur déconnecté
     */
        /**
     * Utilisateur déconnecté
     */
    onUserSignedOut() {
        console.log('👋 Déconnecté');

        this.currentUser = null;
        this.isAuthenticated = false;
        State.user = null;

        // ✅ Nettoyer l'état
        localStorage.removeItem('mb_last_auth_state');

        // Arrêter la sync
        CloudSync.stopSync();

        // Notifier
        document.dispatchEvent(new CustomEvent('auth:signedout'));

        // Rafraîchir l'UI
        this.updateAccountUI();
    },

    /**
     * ==========================================
     * ACTIONS D'AUTHENTIFICATION
     * ==========================================
     */

    /**
     * Connexion avec email/mot de passe
     */
    async signIn(email, password) {
        if (!FirebaseService.isAvailable()) {
            throw new Error('Firebase indisponible');
        }

        try {
            State.isGuestMode = false;
            const cred = await FirebaseService.auth.signInWithEmailAndPassword(email, password);
            return cred.user;
        } catch (error) {
            throw this.formatError(error);
        }
    },

    /**
     * Inscription avec email/mot de passe
     */
    async signUp(email, password) {
        if (!FirebaseService.isAvailable()) {
            throw new Error('Firebase indisponible');
        }

        try {
            State.isGuestMode = false;
            const cred = await FirebaseService.auth.createUserWithEmailAndPassword(email, password);
            return cred.user;
        } catch (error) {
            throw this.formatError(error);
        }
    },

    /**
     * Réinitialisation du mot de passe
     */
    async resetPassword(email) {
        if (!FirebaseService.isAvailable()) {
            throw new Error('Firebase indisponible');
        }

        try {
            await FirebaseService.auth.sendPasswordResetEmail(email);
            return true;
        } catch (error) {
            throw this.formatError(error);
        }
    },

    /**
     * Déconnexion
     */
    async signOut() {
        if (!FirebaseService.isAvailable()) return;

        try {
            CloudSync.stopSync();
            await FirebaseService.auth.signOut();
            return true;
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            return false;
        }
    },

    /**
     * Mode invité (sans compte)
     */
        /**
     * Mode invité (sans compte)
     */
    guestMode() {
        State.isGuestMode = true;
        State.user = null;
        this.isAuthenticated = false;
        this.currentUser = null;

        // ✅ Mémoriser le choix
        localStorage.setItem('mb_last_auth_state', 'guest');

        console.log('👤 Mode invité activé');
        document.dispatchEvent(new CustomEvent('auth:guest'));
    },

    /**
     * ==========================================
     * ERREURS
     * ==========================================
     */

    /**
     * Traduit les codes d'erreur Firebase en messages FR
     */
    formatError(error) {
        const messages = {
            'auth/email-already-in-use': 'Cet email est déjà utilisé',
            'auth/invalid-email': 'Email invalide',
            'auth/user-not-found': 'Aucun compte avec cet email',
            'auth/wrong-password': 'Mot de passe incorrect',
            'auth/weak-password': 'Mot de passe trop faible (min 6 caractères)',
            'auth/too-many-requests': 'Trop de tentatives, réessayez plus tard',
            'auth/network-request-failed': 'Erreur réseau',
            'auth/invalid-credential': 'Email ou mot de passe incorrect',
            'auth/user-disabled': 'Ce compte a été désactivé',
            'auth/operation-not-allowed': 'Opération non autorisée'
        };

        const message = messages[error.code] || error.message || 'Erreur inconnue';
        const err = new Error(message);
        err.code = error.code;
        return err;
    },

    /**
     * ==========================================
     * UI - Écrans d'authentification
     * ==========================================
     */

    /**
     * Affiche l'écran de connexion
     */
    showAuthScreen() {
        // Créer l'écran s'il n'existe pas
        let authScreen = document.getElementById('authScreen');

        if (!authScreen) {
            authScreen = document.createElement('div');
            authScreen.id = 'authScreen';
            authScreen.className = 'auth-screen';
            document.body.appendChild(authScreen);
        }

        authScreen.innerHTML = this.renderAuthScreen();
        authScreen.hidden = false;

        // Cacher l'app principale
        const app = document.getElementById('app');
        if (app) app.hidden = true;

        // Attacher les événements
        this.attachAuthEvents();
    },

    /**
     * Cache l'écran de connexion et affiche l'app
     */
    hideAuthScreen() {
        const authScreen = document.getElementById('authScreen');
        if (authScreen) {
            authScreen.hidden = true;
        }

        const app = document.getElementById('app');
        if (app) app.hidden = false;
    },

    /**
     * Rendu de l'écran de connexion
     */
    renderAuthScreen() {
        return `
            <div class="auth-container">
                <div class="auth-logo">💰</div>
                <h1 class="auth-title">MonBudget</h1>
                <p class="auth-subtitle">Gérez vos finances simplement</p>

                <!-- Form Login -->
                <div class="auth-form" id="authFormLogin">
                    <div class="form-group">
                        <label class="form-label">📧 Email</label>
                        <input type="email" id="loginEmail" placeholder="votre@email.com"
                               autocomplete="email">
                    </div>

                    <div class="form-group">
                        <label class="form-label">🔑 Mot de passe</label>
                        <div class="password-wrap">
                            <input type="password" id="loginPassword" placeholder="••••••••"
                                   autocomplete="current-password">
                            <button type="button" class="password-toggle" data-target="loginPassword">👁️</button>
                        </div>
                    </div>

                    <div class="form-error" id="loginError"></div>

                    <button class="btn btn-primary btn-block" id="btnSignIn">
                        Se connecter
                    </button>

                    <button class="btn btn-outline btn-block" id="btnGuest">
                        Continuer sans compte
                    </button>

                    <div class="auth-links">
                        <button class="auth-link" data-form="register">Créer un compte</button>
                        <button class="auth-link" data-form="reset">Mot de passe oublié ?</button>
                    </div>
                </div>

                <!-- Form Register -->
                <div class="auth-form hidden" id="authFormRegister">
                    <div class="form-group">
                        <label class="form-label">📧 Email</label>
                        <input type="email" id="regEmail" placeholder="votre@email.com"
                               autocomplete="email">
                    </div>

                    <div class="form-group">
                        <label class="form-label">🔑 Mot de passe</label>
                        <div class="password-wrap">
                            <input type="password" id="regPassword" placeholder="Min. 6 caractères"
                                   autocomplete="new-password">
                            <button type="button" class="password-toggle" data-target="regPassword">👁️</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">🔑 Confirmer</label>
                        <div class="password-wrap">
                            <input type="password" id="regPasswordConfirm" placeholder="Même mot de passe"
                                   autocomplete="new-password">
                            <button type="button" class="password-toggle" data-target="regPasswordConfirm">👁️</button>
                        </div>
                    </div>

                    <div class="form-error" id="regError"></div>

                    <button class="btn btn-primary btn-block" id="btnSignUp">
                        Créer mon compte
                    </button>

                    <div class="auth-links">
                        <button class="auth-link" data-form="login">Déjà un compte ? Se connecter</button>
                    </div>
                </div>

                <!-- Form Reset -->
                <div class="auth-form hidden" id="authFormReset">
                    <p style="color: var(--text2); font-size: var(--text-sm); text-align: center; margin-bottom: var(--space-md);">
                        Entrez votre email pour recevoir un lien de réinitialisation.
                    </p>

                    <div class="form-group">
                        <label class="form-label">📧 Email</label>
                        <input type="email" id="resetEmail" placeholder="votre@email.com">
                    </div>

                    <div class="form-error" id="resetError"></div>
                    <div id="resetSuccess" style="color: var(--success); font-size: var(--text-sm); text-align: center; min-height: 20px;"></div>

                    <button class="btn btn-primary btn-block" id="btnResetPassword">
                        Envoyer le lien
                    </button>

                    <div class="auth-links">
                        <button class="auth-link" data-form="login">Retour à la connexion</button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Attache les événements de l'écran d'auth
     */
    attachAuthEvents() {
        // Toggle password visibility
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                    btn.textContent = input.type === 'password' ? '👁️' : '🙈';
                }
            });
        });

        // Switch entre les formulaires
        document.querySelectorAll('[data-form]').forEach(link => {
            link.addEventListener('click', () => {
                this.showForm(link.dataset.form);
            });
        });

        // Boutons d'action
        const btnSignIn = document.getElementById('btnSignIn');
        if (btnSignIn) btnSignIn.addEventListener('click', () => this.handleSignIn());

        const btnSignUp = document.getElementById('btnSignUp');
        if (btnSignUp) btnSignUp.addEventListener('click', () => this.handleSignUp());

        const btnResetPassword = document.getElementById('btnResetPassword');
        if (btnResetPassword) btnResetPassword.addEventListener('click', () => this.handleReset());

        const btnGuest = document.getElementById('btnGuest');
        if (btnGuest) btnGuest.addEventListener('click', () => this.handleGuest());

        // Enter pour valider
        ['loginPassword', 'regPasswordConfirm', 'resetEmail'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('keypress', e => {
                    if (e.key === 'Enter') {
                        if (id === 'loginPassword') this.handleSignIn();
                        else if (id === 'regPasswordConfirm') this.handleSignUp();
                        else if (id === 'resetEmail') this.handleReset();
                    }
                });
            }
        });
    },

    /**
     * Affiche un formulaire (login, register, reset)
     */
    showForm(formName) {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
        const form = document.getElementById('authForm' + this.capitalize(formName));
        if (form) form.classList.remove('hidden');

        // Reset les erreurs
        document.querySelectorAll('.form-error').forEach(err => err.textContent = '');
        const successEl = document.getElementById('resetSuccess');
        if (successEl) successEl.textContent = '';
    },

    /**
     * Gère la connexion
     */
    async handleSignIn() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errEl = document.getElementById('loginError');
        const btn = document.getElementById('btnSignIn');

        if (!email || !password) {
            errEl.textContent = 'Remplissez tous les champs';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Connexion...';
        errEl.textContent = '';

        try {
            await this.signIn(email, password);
            this.hideAuthScreen();
            Toast.success('✅ Connecté !');

            // Vérifier PIN si actif
            if (typeof PinLock !== 'undefined') {
                PinLock.checkOnStart();
            }
        } catch (error) {
            errEl.textContent = error.message;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Se connecter';
        }
    },

    /**
     * Gère l'inscription
     */
    async handleSignUp() {
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regPasswordConfirm').value;
        const errEl = document.getElementById('regError');
        const btn = document.getElementById('btnSignUp');

        if (!email || !password || !confirm) {
            errEl.textContent = 'Remplissez tous les champs';
            return;
        }

        if (password.length < 6) {
            errEl.textContent = 'Mot de passe trop court (min 6)';
            return;
        }

        if (password !== confirm) {
            errEl.textContent = 'Les mots de passe diffèrent';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Création...';
        errEl.textContent = '';

        try {
            await this.signUp(email, password);
            this.hideAuthScreen();
            Toast.success('🎉 Compte créé !');
        } catch (error) {
            errEl.textContent = error.message;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Créer mon compte';
        }
    },

    /**
     * Gère le mot de passe oublié
     */
    async handleReset() {
        const email = document.getElementById('resetEmail').value.trim();
        const errEl = document.getElementById('resetError');
        const successEl = document.getElementById('resetSuccess');
        const btn = document.getElementById('btnResetPassword');

        if (!email) {
            errEl.textContent = 'Entrez votre email';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Envoi...';
        errEl.textContent = '';
        successEl.textContent = '';

        try {
            await this.resetPassword(email);
            successEl.textContent = '📧 Email envoyé ! Vérifiez votre boîte.';
        } catch (error) {
            errEl.textContent = error.message;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Envoyer le lien';
        }
    },

    /**
     * Continue en mode local
     */
    handleGuest() {
        this.guestMode();
        this.hideAuthScreen();
        Toast.info('👤 Mode local activé');

        // Vérifier PIN
        if (typeof PinLock !== 'undefined') {
            PinLock.checkOnStart();
        }
    },

    /**
     * Déconnexion depuis l'app
     */
    async handleSignOut() {
        const confirmed = confirm('Se déconnecter ? Vos données locales seront conservées.');
        if (!confirmed) return;

        try {
            await this.signOut();
            Toast.success('👋 Déconnecté');
            this.showAuthScreen();
        } catch (error) {
            Toast.error('❌ Erreur');
        }
    },

    /**
     * ==========================================
     * UI - Mise à jour du compte dans "Plus"
     * ==========================================
     */

    updateAccountUI() {
        const accountLabel = document.getElementById('menuAccountLabel');
        if (accountLabel) {
            if (State.user) {
                accountLabel.textContent = State.user.email || 'Connecté';
            } else if (State.isGuestMode) {
                accountLabel.textContent = 'Mode local';
            } else {
                accountLabel.textContent = 'Se connecter';
            }
        }
    },

    /**
     * ==========================================
     * UTILS
     * ==========================================
     */

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};

// Alias global
window.Auth = Auth;
