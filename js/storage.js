(function () {
    "use strict";

    var U = window.OracleUtils;
    var HISTORY_KEY = "ai_oracle_readings_v1";
    var MAX_READINGS = 30;

    // El SDK exige Base64 para persistir datos; localStorage solo se usa al probar en navegador.
    function plainStorage() {
        return window.creationStorage && window.creationStorage.plain ? window.creationStorage.plain : null;
    }

    async function getEncoded(key) {
        var sdkStorage = plainStorage();
        if (sdkStorage) {
            return sdkStorage.getItem(key);
        }
        return localStorage.getItem(key);
    }

    async function setEncoded(key, value) {
        var sdkStorage = plainStorage();
        if (sdkStorage) {
            await sdkStorage.setItem(key, value);
            return;
        }
        localStorage.setItem(key, value);
    }

    async function removeEncoded(key) {
        var sdkStorage = plainStorage();
        if (sdkStorage) {
            await sdkStorage.removeItem(key);
            return;
        }
        localStorage.removeItem(key);
    }

    async function getObject(key, fallback) {
        var encoded = await getEncoded(key);
        if (!encoded) {
            return fallback;
        }

        try {
            return JSON.parse(U.decodeBase64(encoded));
        } catch (error) {
            return fallback;
        }
    }

    async function setObject(key, value) {
        await setEncoded(key, U.encodeBase64(JSON.stringify(value)));
    }

    async function getReadings() {
        var readings = await getObject(HISTORY_KEY, []);
        return Array.isArray(readings) ? readings : [];
    }

    async function saveReadings(readings) {
        await setObject(HISTORY_KEY, readings.slice(0, MAX_READINGS));
    }

    async function addReading(reading) {
        var readings = await getReadings();
        var stored = Object.assign({}, reading, {
            savedAt: new Date().toISOString()
        });
        readings.unshift(stored);
        await saveReadings(readings);
        return stored;
    }

    async function clearReadings() {
        await removeEncoded(HISTORY_KEY);
    }

    window.OracleStorage = {
        addReading: addReading,
        clearReadings: clearReadings,
        getReadings: getReadings,
        saveReadings: saveReadings
    };
}());
