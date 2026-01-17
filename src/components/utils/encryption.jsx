// Zero-Knowledge Encryption Utility using Web Crypto API
// This runs entirely in the browser. Keys are never sent to the server.

const SALT_length = 16;
const IV_length = 12; // Recommended for GCM

/**
 * Derives a strong encryption key from a user's password using PBKDF2
 * @param {string} password - User's secret password
 * @param {Uint8Array} salt - Random salt (must be stored with data to decrypt)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true, // extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts text data using AES-GCM
 * @param {string} text - Data to encrypt
 * @param {string} password - User's password
 * @returns {Promise<{cipherText: string, salt: string, iv: string}>} - Base64 encoded strings
 */
export async function encryptData(text, password) {
    try {
        const salt = window.crypto.getRandomValues(new Uint8Array(SALT_length));
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_length));
        const key = await deriveKey(password, salt);
        const enc = new TextEncoder();
        
        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            enc.encode(text)
        );

        // Convert buffers to Base64 for storage
        return {
            cipherText: arrayBufferToBase64(encryptedContent),
            salt: arrayBufferToBase64(salt),
            iv: arrayBufferToBase64(iv)
        };
    } catch (e) {
        console.error("Encryption failed:", e);
        throw new Error("Failed to encrypt data");
    }
}

/**
 * Decrypts data using AES-GCM
 * @param {string} cipherText - Base64 encoded ciphertext
 * @param {string} password - User's password
 * @param {string} saltB64 - Base64 encoded salt
 * @param {string} ivB64 - Base64 encoded IV
 * @returns {Promise<string>} - Decrypted text
 */
export async function decryptData(cipherText, password, saltB64, ivB64) {
    try {
        const salt = base64ToArrayBuffer(saltB64);
        const iv = base64ToArrayBuffer(ivB64);
        const key = await deriveKey(password, salt);
        const encryptedData = base64ToArrayBuffer(cipherText);

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            encryptedData
        );

        const dec = new TextDecoder();
        return dec.decode(decryptedContent);
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Incorrect password or corrupted data");
    }
}

// Helpers
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}