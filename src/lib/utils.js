/**
 * Utilidades generales del proyecto
 */

/**
 * RUT UTILS
 */

import { secureStorage } from "./secureStore";
import dayjs from "dayjs";

export function cleanRut(rut) {
    return typeof rut === 'string'
        ? rut.replace(/[^0-9kK]/g, '').toUpperCase()
        : '';
}

export function validateRut(rut) {
    if (!rut || typeof rut !== 'string') return false;
    const clean = cleanRut(rut);
    if (clean.length < 2) return false;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1).toUpperCase();

    if (!/^[0-9]+$/.test(body)) return false;

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDv = 11 - (sum % 11);
    let dvChar;
    if (expectedDv === 11) dvChar = '0';
    else if (expectedDv === 10) dvChar = 'K';
    else dvChar = expectedDv.toString();

    return dv === dvChar;
}

export function formatRut(rut) {
    const clean = cleanRut(rut);
    if (!clean) return '';
    if (clean.length <= 1) return clean;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1).toUpperCase();

    let result = '';
    for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
            result = '.' + result;
        }
        result = body[i] + result;
    }

    return result + '-' + dv;
}

/**
 * PHONE UTILS
 */
export function formatPhone(val) {
    if (!val) return '+56 ';
    if (!val.startsWith('+')) val = '+' + val;

    let numbers = val.substring(1).replace(/[^0-9]/g, '');

    if (!numbers.startsWith('56') && numbers.length > 0) {
        numbers = '56' + numbers;
    }

    numbers = numbers.substring(0, 11);

    if (numbers.length > 2) {
        return '+56 ' + numbers.substring(2);
    }

    return '+56 ';
}

export function validatePhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/\s+/g, '');
    return /^\+56\d{9}$/.test(clean);
}

/**
 * AUTH / PERMISSIONS UTILS
 */
export function hasPermission(user, menuKey) {
    const userData = secureStorage.getItem("_us_");

    if (!userData || !user) return false;
    // Usar los permisos guardados en el login
    if (userData.permissions) {
        return userData.permissions?.[menuKey]?.includes('VIEW') || false;
    }
    return false;
}

export function hasPermissionPrograms(user, menuKey, permissionsUser) {
    const userData = secureStorage.getItem("_us_");

    if (!userData || !user) return false;
    // Usar los permisos guardados en el login
    if (userData.permissions) {
        return userData.permissions?.[menuKey]?.includes(permissionsUser) || false;
    }
    return false;
}

export const formatCurrency = (value) => {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export const formatDate = (value) => {
    return dayjs(value).format("DD/MM/YYYY")
};


export const formatDateTime = (value) => {
    return dayjs(value).format("DD/MM/YYYY H:mm")
};

export const formatDateSave = (value) => {
    return dayjs(value).format("YYYY/MM/DD")
};

export const formatDateTimeSave = (value) => {
    return dayjs(value).format("YYYY/MM/DD HH:mm")
};
