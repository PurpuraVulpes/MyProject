/* ============================================
   FIREBASE.JS - Configuration et service Firebase
   ============================================ */

'use strict';

/**
 * ⚠️ REMPLACE PAR TES CLÉS FIREBASE
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDK7eRyDOCgITy_rMiTu-kOvWlPWuwze7E",
  authDomain: "budget-5372e.firebaseapp.com",
  databaseURL: "https://budget-5372e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "budget-5372e",
  storageBucket: "budget-5372e.firebasestorage.app",
  messagingSenderId: "871085643686",
  appId: "1:871085643686:web:9a4dd73501ddb6657b2167"
};

const FirebaseService = {

    initialized: false,
    available: false,
    auth: null,
    db: null,

    init() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase non chargé');
                this.available = false;
                return false;
            }

            if (FIREBASE_CONFIG.apiKey === 'TA_CLÉ_API_ICI') {
                console.warn('⚠️ Firebase non configuré');
                this.available = false;
                return false;
            }

            firebase.initializeApp(FIREBASE_CONFIG);
            this.auth = firebase.auth();
            this.db = firebase.firestore();

            // Persistance session (rester connecté)
            this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => console.log('✅ Session persistante activée'))
                .catch(err => console.warn('⚠️ Persistance session:', err));

            // Persistance offline
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

    isAvailable() {
        return this.available && this.initialized;
    },

    userRef(uid) {
        if (!this.isAvailable()) return null;
        return this.db.collection('users').doc(uid);
    },

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

    unsubscribers: {},
    isSyncing: false,
    lastSync: null,

    // Liste des collections à synchroniser
    COLLECTIONS: ['horaires', 'depenses', 'paiements', 'extras', 'epargne', 'objectifs', 'shopping', 'recurrent', 'budgets'],

    /**
     * Démarre la synchronisation temps réel
     */
    startRealtimeSync(uid) {
        if (!FirebaseService.isAvailable()) return;

        console.log('🔄 Démarrage sync temps réel pour', uid);

        // Arrêter toute sync existante
        this.stopSync();

        // Écouter les settings
        this.unsubscribers.settings = FirebaseService.userRef(uid)
            .collection('data').doc('settings')
            .onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    console.log('☁️ Settings reçus du cloud');
                    if (data.settings) {
                        State.settings = { ...State.settings, ...data.settings };
                    }
                    if (data.modules) {
                        State.modules = { ...State.modules, ...data.modules };
                    }
                    Storage.saveSilent();
                    if (typeof App !== 'undefined') {
                        App.applyTheme(State.settings.theme || 'purple');
                        App.refreshCurrentPage();
                    }
                }
            }, err => {
                console.error('❌ Sync settings:', err);
                if (err.code === 'permission-denied') {
                    Toast.error('❌ Permissions Firestore refusées');
                }
            });

        // Écouter chaque collection
        this.COLLECTIONS.forEach(name => {
            let sortField = null;
            if (['horaires', 'depenses', 'extras', 'epargne'].includes(name)) {
                sortField = 'date';
            } else if (name === 'paiements') {
                sortField = 'mois';
            }
            this.watchCollection(uid, name, sortField);
        });
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

            if (sortField && items.length > 0) {
                items.sort((a, b) => {
                    const va = String(a[sortField] || '');
                    const vb = String(b[sortField] || '');
                    return vb.localeCompare(va);
                });
            }

            const oldCount = State.data[collectionName] ? State.data[collectionName].length : 0;
            State.data[collectionName] = items;
            Storage.saveSilent();

            console.log(`☁️ ${collectionName}: ${oldCount} → ${items.length}`);

            document.dispatchEvent(new CustomEvent('cloud:updated', {
                detail: { collection: collectionName, count: items.length }
            }));

            // ✅ Rafraîchir la page courante avec debounce (évite les clignotements)
            if (typeof App !== 'undefined' && App.refreshCurrentPage) {
                if (this._refreshTimer) clearTimeout(this._refreshTimer);
                this._refreshTimer = setTimeout(() => {
                    App.refreshCurrentPage();
                }, 500);
            }
        }, err => {
            console.error(`❌ Sync ${collectionName}:`, err);
            if (err.code === 'permission-denied') {
                Toast.error('❌ Permissions Firestore refusées pour ' + collectionName);
            }
        });
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
     */
    async uploadLocalData(uid) {
        if (!FirebaseService.isAvailable()) return false;

        const uploadedKey = Storage.KEYS.UPLOADED + uid;

        // Vérifier s'il y a des données locales à uploader
        let hasLocalData = false;
        this.COLLECTIONS.forEach(col => {
            if (State.data[col] && State.data[col].length > 0) {
                hasLocalData = true;
            }
        });

        // Si déjà uploadé ET pas de nouvelles données locales, skip
        if (localStorage.getItem(uploadedKey) && !hasLocalData) {
            console.log('☁️ Sync déjà en place');
            return true;
        }

        console.log('☁️ Upload des données locales...');
        this.isSyncing = true;

        try {
            const userRef = FirebaseService.userRef(uid);

            // Upload settings
            await userRef.collection('data').doc('settings').set({
                settings: State.settings,
                modules: State.modules,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log('✅ Settings uploadés');

            // Upload chaque collection
            for (const collectionName of this.COLLECTIONS) {
                const items = State.data[collectionName];
                if (!items || items.length === 0) continue;

                console.log(`⏫ Upload ${collectionName}: ${items.length} items`);

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
                        }, { merge: true });
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
            }, { merge: true });

            console.log(`⏫ ${collectionName} sauvegardé:`, item.id);
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
            console.log(`🗑️ ${collectionName} supprimé:`, id);
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
                }, { merge: true });
            console.log('⏫ Settings sauvegardés');
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
            for (const collectionName of this.COLLECTIONS) {
                const snapshot = await userRef.collection(collectionName).get();
                const batch = FirebaseService.db.batch();
                snapshot.forEach(doc => batch.delete(doc.ref));
                if (snapshot.size > 0) await batch.commit();
            }

            await userRef.collection('data').doc('settings').delete();
            localStorage.removeItem(Storage.KEYS.UPLOADED + uid);

            return true;
        } catch (error) {
            console.error('❌ Suppression cloud:', error);
            return false;
        }
    },

    /**
     * Sync manuelle forcée
     */
    async manualSync() {
        if (!State.user) {
            Toast.warning('Connectez-vous pour synchroniser');
            return false;
        }

        this.isSyncing = true;
        Toast.info('🔄 Synchronisation forcée...');

        try {
            // Forcer un ré-upload complet
            const uploadedKey = Storage.KEYS.UPLOADED + State.user.uid;
            localStorage.removeItem(uploadedKey);

            // Uploader les données locales
            await this.uploadLocalData(State.user.uid);

            // Redémarrer l'écoute
            this.startRealtimeSync(State.user.uid);

            Toast.success('✅ Synchronisé !');
            return true;
        } catch (error) {
            console.error('❌ Erreur sync manuelle:', error);
            Toast.error('❌ Erreur sync');
            return false;
        } finally {
            this.isSyncing = false;
        }
    }
};

window.FirebaseService = FirebaseService;
window.CloudSync = CloudSync;
