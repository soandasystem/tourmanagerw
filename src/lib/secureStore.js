// src/lib/secureStore.js
const SECRET_KEY = 'HgghgdsaLawtavrtxzc'; // En producción, esto debería venir de una variable de entorno

// Función simple de ofuscación (puedes usar librerías como crypto-js para algo más robusto)
export const encrypt = (data) => {
    const stringData = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(stringData + SECRET_KEY)));
};

export const decrypt = (cipher) => {
    try {
        const decoded = decodeURIComponent(escape(atob(cipher)));
        return JSON.parse(decoded.replace(SECRET_KEY, ''));
    } catch (e) {
        return null;
    }
};

export const secureStorage = {
    setItem: (key, value) => {
        localStorage.setItem(key, encrypt(value));
    },
    getItem: (key) => {
        const data = localStorage.getItem(key);
        return data ? decrypt(data) : null;
    },
    removeItem: (key) => localStorage.removeItem(key)
};


