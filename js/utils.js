(function () {
    "use strict";

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $$(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function escapeHTML(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function uid(prefix) {
        return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    }

    function encodeBase64(text) {
        var bytes = new TextEncoder().encode(String(text));
        var binary = "";
        bytes.forEach(function (byte) {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function decodeBase64(text) {
        var binary = atob(String(text || ""));
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }

    function parseJSON(raw) {
        if (!raw) {
            return null;
        }
        if (typeof raw === "object") {
            return raw;
        }

        var text = String(raw).trim()
            .replace(/^```json/i, "")
            .replace(/^```/i, "")
            .replace(/```$/i, "")
            .trim();

        try {
            return JSON.parse(text);
        } catch (firstError) {
            var start = text.indexOf("{");
            var end = text.lastIndexOf("}");
            if (start >= 0 && end > start) {
                try {
                    return JSON.parse(text.slice(start, end + 1));
                } catch (secondError) {
                    return null;
                }
            }
        }

        return null;
    }

    function extractPluginJSON(data) {
        if (!data) {
            return null;
        }
        if (data.data) {
            var parsedData = parseJSON(data.data);
            if (parsedData) {
                return parsedData;
            }
        }
        if (data.message) {
            var parsedMessage = parseJSON(data.message);
            if (parsedMessage) {
                return parsedMessage;
            }
        }
        return parseJSON(data);
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat("es-ES", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }).format(new Date(value));
        } catch (error) {
            return "Ahora";
        }
    }

    function shortText(text, max) {
        var clean = String(text || "").replace(/\s+/g, " ").trim();
        if (clean.length <= max) {
            return clean;
        }
        return clean.slice(0, Math.max(0, max - 1)).trim() + "…";
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function showToast(message, timeout) {
        var toast = $("#toast");
        if (!toast) {
            return;
        }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(function () {
            toast.hidden = true;
        }, timeout || 1600);
    }

    function fileToDataURL(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function normalizeSpeech(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    var OracleAudio = (function () {
        var ctx = null;
        var unlocked = false;
        var ambientOsc = null;
        var ambientGain = null;

        function ensureContext() {
            if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (ctx && ctx.state === "suspended") {
                ctx.resume();
            }
            unlocked = true;
            return ctx;
        }

        function tone(freq, duration, type, gainValue) {
            var audio = ensureContext();
            if (!audio) {
                return;
            }
            var osc = audio.createOscillator();
            var gain = audio.createGain();
            osc.type = type || "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(gainValue || 0.025, audio.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start();
            osc.stop(audio.currentTime + duration + 0.02);
        }

        function playFlip() {
            tone(330, 0.09, "triangle", 0.035);
            setTimeout(function () {
                tone(520, 0.07, "sine", 0.018);
            }, 55);
        }

        function playShuffle() {
            tone(170, 0.08, "sawtooth", 0.018);
            setTimeout(function () {
                tone(210, 0.08, "sawtooth", 0.014);
            }, 90);
        }

        function ambient(on) {
            var audio = ensureContext();
            if (!audio) {
                return;
            }
            if (on && !ambientOsc) {
                ambientOsc = audio.createOscillator();
                ambientGain = audio.createGain();
                ambientOsc.type = "sine";
                ambientOsc.frequency.value = 92;
                ambientGain.gain.value = 0.006;
                ambientOsc.connect(ambientGain);
                ambientGain.connect(audio.destination);
                ambientOsc.start();
            } else if (!on && ambientOsc) {
                ambientGain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2);
                ambientOsc.stop(audio.currentTime + 0.22);
                ambientOsc = null;
                ambientGain = null;
            }
        }

        return {
            ambient: ambient,
            playFlip: playFlip,
            playShuffle: playShuffle,
            unlock: ensureContext,
            get unlocked() {
                return unlocked;
            }
        };
    }());

    window.OracleUtils = {
        $: $,
        $$: $$,
        audio: OracleAudio,
        clamp: clamp,
        decodeBase64: decodeBase64,
        encodeBase64: encodeBase64,
        escapeHTML: escapeHTML,
        extractPluginJSON: extractPluginJSON,
        fileToDataURL: fileToDataURL,
        formatDate: formatDate,
        normalizeSpeech: normalizeSpeech,
        parseJSON: parseJSON,
        shortText: shortText,
        showToast: showToast,
        uid: uid
    };
}());
