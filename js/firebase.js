/* ============================================
   FIREBASE.JS - Configuration et service Firebase
   ============================================ */

'use strict';

/**
 * ⚠️ IMPORTANT
 * Remplacez ces valeurs par VOS clés Firebase
 * Firebase Console → Paramètres du projet → Vos applications
 */
const FIREBASE_CONFIG = {
    apiKey: "VOTRE_API_KEY_ICI",
    authDomain: "VOTRE_PROJET.firebaseapp.com",
    projectId: "VOTRE_PROJET",
    storageBucket: "VOTRE_PROJET.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};

/**
 * Service Firebase
 */
const FirebaseService = {

    initialized: false,
    available: false,
    auth: null,
    db: null,

    /**
     * Initialise Firebase
     */
    init() {
        try {
            // Vérifier que Firebase est chargé
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase non chargé - mode local uniquement');
                this.available = false;
                return false;
            }

            // Vérifier la config
            if (FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY_ICI') {
                console.warn('⚠️ Firebase non configuré - mode local uniquement');
                this.available = false;
                return false;
            }

            // Initialiser
            firebase.initializeApp(FIREBASE_CONFIG);
            this.auth = firebase.auth();
            this.db = firebase.firestore();

            // Activer la persistance offline
            this.db.enablePersistence({ synchronizeTabs: true })
                .catch(err => console.warn('Firestore persistence:', err.code));

            this.initialized = true;
            this.available = true;

            console.log('🔥 Firebase initialisé');
            return true;

        } catch (error) {
            console.error('❌ Erreur Firebase:', error);
            this.available = false;
            return false;
        }
    },

    /**
     * Vérifie si Firebase est disponible
     */
    isAvailable() {
        return this.available && this.initialized;
    },

    /**
     * Renvoie une référence à la collection de l'utilisateur
     */
    userRef(uid) {
        if (!this.isAvailable()) return null;
        return this.db.collection('users').doc(uid);
    },

    /**
     * Renvoie une référence à une sous-collection de l'utilisateur
     */
    userCollection(uid, collectionName) {
        const userRef = this.userRef(uid);
        if (!userRef) return null;
        return userRef.collection(collectionName);
    }
};

/**
 * Service de synchronisation cloud
 */
const CloudSync = {

    // Listeners actifs
    unsubscribers: {},

    // État de la sync
    isSyncing: false,
    lastSync: null,

    /**
     * Démarre la synchronisation temps réel pour un utilisateur
     */
    startRealtimeSync(uid) {
        if (!FirebaseService.isAvailable()) return;

        console.log('🔄 Démarrage sync temps réel');

        // Écouter les settings
        this.unsubscribers.settings = FirebaseService.userRef(uid)
            .collection('data').doc('settings')
            .onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.settings) {
                        State.settings = { ...State.settings, ...data.settings };
                    }
                    if (data.modules) {
                        State.modules = { ...State.modules, ...data.modules };
                    }
                    Storage.saveSilent();
                    if (typeof App !== 'undefined') {
                        App.applyTheme(State.settings.theme || 'purple');
                    }
                }
            }, err => console.error('Sync settings:', err));

        // Écouter chaque collection de données
        this.watchCollection(uid, 'horaires', 'date');
        this.watchCollection(uid, 'depenses', 'date');
        this.watchCollection(uid, 'paiements', 'mois');
        this.watchCollection(uid, 'extras', 'date');
        this.watchCollection(uid, 'epargne', 'date');
        this.watchCollection(uid, 'objectifs', null);
        this.watchCollection(uid, 'shopping', null);
        this.watchCollection(uid, 'recurrent', null);
        this.watchCollection(uid, 'budgets', null);
    },

    /**
     * Écoute une collection en temps réel
     */
    watchCollection(uid, collectionName, sortField) {
        const collection = FirebaseService.userCollection(uid, collectionName);
        if (!collection) return;

        this.unsubscribers[collectionName] = collection.onSnapshot(snapshot => {
            const items = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                delete data.updatedAt;
                items.push(data);
            });

            // Trier si nécessaire
            if (sortField && items.length > 0) {
                items.sort((a, b) => {
                    const va = String(a[sortField] || '');
                    const vb = String(b[sortField] || '');
                    return vb.localeCompare(va);
                });
            }

            State.data[collectionName] = items;
            Storage.saveSilent();

            // Notifier l'UI qu'il faut se rafraîchir
            document.dispatchEvent(new CustomEvent('cloud:updated', {
                detail: { collection: collectionName, count: items.length }
            }));
        }, err => console.error(`Sync ${collectionName}:`, err));
    },

    /**
     * Stoppe la synchronisation
     */
    stopSync() {
        Object.values(this.unsubscribers).forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.unsubscribers = {};
        console.log('⏹️ Sync arrêtée');
    },

    /**
     * Upload initial des données locales vers le cloud
     * (à la première connexion)
     */
    async uploadLocalData(uid) {
        if (!FirebaseService.isAvailable()) return false;

        const uploadedKey = Storage.KEYS.UPLOADED + uid;
        if (localStorage.getItem(uploadedKey)) {
            console.log('☁️ Données déjà uploadées');
            return true;
        }

        console.log('☁️ Upload des données locales...');
        this.isSyncing = true;

        try {
            const userRef = FirebaseService.userRef(uid);

            // Uploader les settings et modules
            await userRef.collection('data').doc('settings').set({
                settings: State.settings,
                modules: State.modules,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Uploader chaque collection
            const collections = ['horaires', 'depenses', 'paiements', 'extras',
                               'epargne', 'objectifs', 'shopping', 'recurrent', 'budgets'];

            for (const collectionName of collections) {
                const items = State.data[collectionName];
                if (!items || items.length === 0) continue;

                // Batch de 500 max
                const chunks = [];
                for (let i = 0; i < items.length; i += 500) {
                    chunks.push(items.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = FirebaseService.db.batch();
                    chunk.forEach(item => {
                        const ref = userRef.collection(collectionName).doc(String(item.id));
                        batch.set(ref, {
                            ...item,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                }
            }

            localStorage.setItem(uploadedKey, '1');
            localStorage.setItem(Storage.KEYS.LAST_SYNC + uid, new Date().toISOString());
            this.lastSync = new Date();
            this.isSyncing = false;

            console.log('✅ Upload terminé');
            return true;

        } catch (error) {
            console.error('❌ Erreur upload:', error);
            this.isSyncing = false;
            return false;
        }
    },

    /**
     * Sauvegarde une entrée dans le cloud
     */
    async saveItem(collectionName, item) {
        if (!FirebaseService.isAvailable() || !State.user) return false;

        try {
            const ref = FirebaseService.userCollection(State.user.uid, collectionName)
                .doc(String(item.id));

            await ref.set({
                ...item,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error(`❌ Sauvegarde ${collectionName}:`, error);
            return false;
        }
    },

    /**
     * Supprime une entrée du cloud
     */
    async deleteItem(collectionName, id) {
        if (!FirebaseService.isAvailable() || !State.user) return false;

        try {
            await FirebaseService.userCollection(State.user.uid, collectionName)
                .doc(String(id)).delete();
            return true;
        } catch (error) {
            console.error(`❌ Suppression ${collectionName}:`, error);
            return false;
        }
    },

    /**
     * Sauvegarde les settings dans le cloud
     */
    async saveSettings() {
        if (!FirebaseService.isAvailable() || !State.user) return false;

        try {
            await FirebaseService.userRef(State.user.uid)
                .collection('data').doc('settings').set({
                    settings: State.settings,
                    modules: State.modules,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return true;
        } catch (error) {
            console.error('❌ Sauvegarde settings:', error);
            return false;
        }
    },

    /**
     * Supprime toutes les données cloud
     */
    async deleteAllData() {
        if (!FirebaseService.isAvailable() || !State.user) return false;

        const uid = State.user.uid;
        const userRef = FirebaseService.userRef(uid);

        try {
            const collections = ['horaires', 'depenses', 'paiements', 'extras',
                               'epargne', 'objectifs', 'shopping', 'recurrent', 'budgets'];

            for (const collectionName of collections) {
                const snapshot = await userRef.collection(collectionName).get();
                const batch = FirebaseService.db.batch();
                snapshot.forEach(doc => batch.delete(doc.ref));
                if (snapshot.size > 0) await batch.commit();
            }

            await userRef.collection('data').doc('settings').delete();

            // Reset la clé "uploaded"
            localStorage.removeItem(Storage.KEYS.UPLOADED + uid);

            return true;
        } catch (error) {
            console.error('❌ Suppression cloud:', error);
            return false;
        }
    },

    /**
     * Sync manuelle
     */
    async manualSync() {
        if (!State.user) {
            Toast.warning('Connectez-vous pour synchroniser');
            return false;
        }

        this.isSyncing = true;
        Toast.info('🔄 Synchronisation...');

        try {
            // Reset l'état "uploaded" et refait un upload complet
            const uploadedKey = Storage.KEYS.UPLOADED + State.user.uid;
            localStorage.removeItem(uploadedKey);
            await this.uploadLocalData(State.user.uid);

            Toast.success('✅ Synchronisé !');
            return true;
        } catch (error) {
            Toast.error('❌ Erreur sync');
            return false;
        } finally {
            this.isSyncing = false;
        }
    }
};

// Alias globaux
window.FirebaseService = FirebaseService;
window.CloudSync = CloudSync;
