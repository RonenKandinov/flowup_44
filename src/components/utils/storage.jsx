import { encryptData, decryptData } from './encryption';

const DB_NAME = 'FlowUpDB';
const DB_VERSION = 1;
const STORE_KEYS = 'keys';
const STORE_DATA = 'data';
const KEY_ID = 'device-key';
const DATA_ID = 'user-data';

// Helper to open DB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_KEYS)) {
                db.createObjectStore(STORE_KEYS);
            }
            if (!db.objectStoreNames.contains(STORE_DATA)) {
                db.createObjectStore(STORE_DATA);
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get or Generate Hardware-Bound Key
async function getOrGenerateKey() {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_KEYS], 'readwrite');
        const store = tx.objectStore(STORE_KEYS);
        const request = store.get(KEY_ID);
        
        request.onsuccess = async () => {
            if (request.result) {
                resolve(request.result);
            } else {
                // Generate new non-extractable key
                const key = await window.crypto.subtle.generateKey(
                    {
                        name: "AES-GCM",
                        length: 256
                    },
                    false, // non-extractable
                    ["encrypt", "decrypt"]
                );
                
                store.put(key, KEY_ID);
                resolve(key);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export const Storage = {
    // Save data encrypted with hardware key
    async save(data) {
        try {
            const key = await getOrGenerateKey();
            const jsonStr = JSON.stringify(data);
            const enc = new TextEncoder();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const ciphertext = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                enc.encode(jsonStr)
            );
            
            const db = await openDB();
            const tx = db.transaction([STORE_DATA], 'readwrite');
            tx.objectStore(STORE_DATA).put({
                ciphertext,
                iv
            }, DATA_ID);
            
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.error('Storage save error:', err);
            throw err;
        }
    },

    // Load and decrypt data
    async load() {
        try {
            const db = await openDB();
            
            // Check if we have a key first
            const keyTx = db.transaction([STORE_KEYS], 'readonly');
            const keyReq = keyTx.objectStore(STORE_KEYS).get(KEY_ID);
            
            const key = await new Promise((resolve, reject) => {
                keyReq.onsuccess = () => resolve(keyReq.result);
                keyReq.onerror = () => reject(keyReq.error);
            });
            
            if (!key) return null; // No key = no data

            // Get data
            const dataTx = db.transaction([STORE_DATA], 'readonly');
            const dataReq = dataTx.objectStore(STORE_DATA).get(DATA_ID);
            
            const record = await new Promise((resolve, reject) => {
                dataReq.onsuccess = () => resolve(dataReq.result);
                dataReq.onerror = () => reject(dataReq.error);
            });
            
            if (!record) return null;

            // Decrypt
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: record.iv
                },
                key,
                record.ciphertext
            );
            
            const dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted));
        } catch (err) {
            console.error('Storage load error:', err);
            return null;
        }
    },

    // Clear all data and keys
    async clear() {
        const db = await openDB();
        const tx = db.transaction([STORE_KEYS, STORE_DATA], 'readwrite');
        tx.objectStore(STORE_KEYS).clear();
        tx.objectStore(STORE_DATA).clear();
        
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    }
};