/* ============================================
   FIREBASE.JS - Configuration et service Firebase
   ✅ CORRIGÉ : Anti-doublons + déduplication
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

            // Persistance session
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
 * ==========================================
 * SERVICE DE SYNCHRONISATION CLOUD
 * ✅ Anti-doublons intégré
 * ==========================================
 */
const CloudSync = {

    unsubscribers: {},
    isSyncing: false,
    lastSync: null,
    _refreshTimer: null,
    _settingsFromCloud: false,

    // ✅ Tracker les IDs récemment sauvegardés localement
    // pour ignorer les échos Firebase
    _recentlySaved: new Map(), // Map<collection, Set<id>>

    COLLECTIONS: ['horaires', 'depenses', 'paiements', 'extras', 'epargne', 'objectifs', 'shopping', 'recurrent', 'budgets'],

    /**
     * Démarre la synchronisation temps réel
     */
    startRealtimeSync(uid) {
        if (!FirebaseService.isAvailable()) return;

        console.log('🔄 Démarrage sync temps réel pour', uid);

        this.stopSync();

        // Écouter les settings
        this._settingsFromCloud = false;

        this.unsubscribers.settings = FirebaseService.userRef(uid)
            .collection('data').doc('settings')
            .onSnapshot(doc => {
                if (doc.exists) {
                    var data = doc.data();

                    if (this._settingsFromCloud) return;

                    console.log('☁️ Settings reçus du cloud');

                    if (data.settings) {
                        State.settings = { ...State.settings, ...data.settings };
                    }
                    if (data.modules) {
                        State.modules = { ...State.modules, ...data.modules };
                    }

                    Storage.saveSilent();

                    if (typeof App !== 'undefined') {
                        var theme = State.settings.theme || 'purple';
                        document.documentElement.setAttribute('data-theme', theme);
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
     * ✅ CORRIGÉ : Écoute une collection avec DÉDUPLICATION stricte
     */
    watchCollection(uid, collectionName, sortField) {
        const collection = FirebaseService.userCollection(uid, collectionName);
        if (!collection) return;

        this.unsubscribers[collectionName] = collection.onSnapshot(snapshot => {
            // ✅ Utiliser une Map pour éliminer automatiquement les doublons
            const itemsMap = new Map();

            snapshot.forEach(doc => {
                const data = doc.data();
                delete data.updatedAt;

                // ✅ TOUJOURS utiliser le doc.id comme clé unique
                // C'est LA garantie qu'il n'y aura JAMAIS de doublons
                const docId = doc.id;
                
                // Forcer l'ID à correspondre au doc ID Firestore
                data.id = data.id || docId;

                // Si un item avec le même ID existe déjà, on garde le plus récent
                itemsMap.set(String(data.id), data);
            });

            // Convertir en tableau
            const items = Array.from(itemsMap.values());

            // Tri
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

            console.log(`☁️ ${collectionName}: ${oldCount} → ${items.length} (dédupliqué)`);

            document.dispatchEvent(new CustomEvent('cloud:updated', {
                detail: { collection: collectionName, count: items.length }
            }));

            // ✅ Rafraîchir avec debounce
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
     * ✅ CORRIGÉ : Upload avec IDs cohérents
     */
    async uploadLocalData(uid) {
        if (!FirebaseService.isAvailable()) return false;

        const uploadedKey = Storage.KEYS.UPLOADED + uid;

        let hasLocalData = false;
        this.COLLECTIONS.forEach(col => {
            if (State.data[col] && State.data[col].length > 0) {
                hasLocalData = true;
            }
        });

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

                // ✅ Dédupliquer AVANT d'uploader
                const uniqueItems = [];
                const seenIds = new Set();
                items.forEach(item => {
                    const id = String(item.id);
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        uniqueItems.push(item);
                    }
                });

                console.log(`⏫ Upload ${collectionName}: ${uniqueItems.length} items uniques (sur ${items.length})`);

                const chunks = [];
                for (let i = 0; i < uniqueItems.length; i += 500) {
                    chunks.push(uniqueItems.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = FirebaseService.db.batch();
                    chunk.forEach(item => {
                        // ✅ Toujours utiliser String(item.id) comme doc ID
                        const ref = userRef.collection(collectionName).doc(String(item.id));
                        batch.set(ref, {
                            ...item,
                            id: item.id, // ✅ Garantir la présence de l'ID
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
     * ✅ CORRIGÉ : Sauvegarde une entrée avec ID string garanti
     */
    async saveItem(collectionName, item) {
        if (!FirebaseService.isAvailable() || !State.user) return false;

        try {
            // ✅ Garantir que l'ID est une string cohérente
            const itemId = String(item.id);

            const ref = FirebaseService.userCollection(State.user.uid, collectionName)
                .doc(itemId);

            await ref.set({
                ...item,
                id: item.id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`⏫ ${collectionName} sauvegardé:`, itemId);
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
            this._settingsFromCloud = true;

            await FirebaseService.userRef(State.user.uid)
                .collection('data').doc('settings').set({
                    settings: State.settings,
                    modules: State.modules,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            console.log('⏫ Settings sauvegardés');

            setTimeout(() => {
                this._settingsFromCloud = false;
            }, 2000);

            return true;
        } catch (error) {
            console.error('❌ Sauvegarde settings:', error);
            this._settingsFromCloud = false;
            return false;
        }
    },

    /**
     * ✅ NOUVEAU : Nettoie les doublons dans Firestore
     * À appeler manuellement pour corriger les données existantes
     */
    async cleanDuplicates() {
        if (!FirebaseService.isAvailable() || !State.user) {
            Toast.warning('Connectez-vous pour nettoyer');
            return false;
        }

        const uid = State.user.uid;
        const userRef = FirebaseService.userRef(uid);
        let totalRemoved = 0;

        Toast.info('🧹 Nettoyage en cours...');

        try {
            for (const collectionName of this.COLLECTIONS) {
                const snapshot = await userRef.collection(collectionName).get();
                
                // Regrouper par "signature" (contenu identique)
                const groups = new Map();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    delete data.updatedAt;
                    
                    // Créer une signature basée sur le contenu
                    const signature = JSON.stringify({
                        date: data.date,
                        montant: data.montant,
                        categorie: data.categorie,
                        description: data.description,
                        nom: data.nom
                    });
                    
                    if (!groups.has(signature)) {
                        groups.set(signature, []);
                    }
                    groups.get(signature).push(doc);
                });

                // Supprimer les doublons (garder le premier de chaque groupe)
                const batch = FirebaseService.db.batch();
                let removed = 0;
                
                groups.forEach(docs => {
                    if (docs.length > 1) {
                        // Garder le premier, supprimer les autres
                        for (let i = 1; i < docs.length; i++) {
                            batch.delete(docs[i].ref);
                            removed++;
                        }
                    }
                });

                if (removed > 0) {
                    await batch.commit();
                    console.log(`🧹 ${collectionName}: ${removed} doublons supprimés`);
                    totalRemoved += removed;
                }
            }

            Toast.success(`✅ ${totalRemoved} doublons supprimés`);
            return true;

        } catch (error) {
            console.error('❌ Erreur nettoyage:', error);
            Toast.error('❌ Erreur nettoyage');
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
            const uploadedKey = Storage.KEYS.UPLOADED + State.user.uid;
            localStorage.removeItem(uploadedKey);

            await this.uploadLocalData(State.user.uid);
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
