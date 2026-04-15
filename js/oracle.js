(function () {
    "use strict";

    var U = window.OracleUtils;
    var Cards = window.OracleCards;
    var LLM = window.OracleLLM;
    var Store = window.OracleStorage;

    var content = null;
    var cameraInput = null;
    var recognition = null;
    var hardwareReady = false;

    // Tiradas optimizadas para 240x282: si/no, una carta, tres cartas y Cruz Celta compacta.
    var spreads = {
        yesno: {
            count: 1,
            label: "Sí o No",
            mode: "yesno",
            positions: ["Respuesta"]
        },
        single: {
            count: 1,
            label: "Una Carta",
            mode: "reading",
            positions: ["Mensaje central"]
        },
        three: {
            count: 3,
            label: "Tirada de 3 Cartas",
            mode: "reading",
            positions: ["Raíz", "Presente", "Camino"]
        },
        celtic: {
            count: 10,
            label: "Cruz Celta",
            mode: "reading",
            positions: ["Corazón", "Cruce", "Base", "Pasado", "Corona", "Futuro", "Tú", "Entorno", "Esperanza", "Resultado"]
        }
    };

    var state = {
        currentPage: "home",
        deckType: "tarot",
        history: [],
        isSaved: false,
        pending: null,
        question: "",
        reading: null,
        selectedCard: 0,
        spreadKey: "single"
    };

    async function init() {
        content = U.$("#content");
        cameraInput = U.$("#physicalCardInput");
        state.history = await Store.getReadings();
        bindCamera();
        registerHardwareHooks();
        startAccelerometer();
        showPage("home");
    }

    function setTitle(title) {
        var screenTitle = U.$("#screenTitle");
        if (screenTitle) {
            screenTitle.textContent = title;
        }
    }

    function render(html) {
        content.innerHTML = html;
    }

    function setPage(page) {
        state.currentPage = page;
        if (window.AppNavigation && window.AppNavigation.setActive) {
            window.AppNavigation.setActive(page);
        }
    }

    function showPage(page) {
        if (page === "consult") {
            showConsult();
        } else if (page === "history") {
            showHistory();
        } else if (page === "how") {
            showHow();
        } else {
            showHome();
        }
    }

    function showHome() {
        setPage("home");
        setTitle("AI ORACLE");
        state.pending = null;
        render([
            "<section class=\"page home-page\">",
            "<div class=\"home-title\">AI ORACLE</div>",
            "<p class=\"oracle-line\">Pregunta. Baraja. Escucha la voz del destino.</p>",
            "<button id=\"consultOracle\" class=\"primary-action\">Consultar al Oráculo</button>",
            "<div class=\"option-grid\">",
            "<button class=\"choice-button\" data-quick-spread=\"yesno\">Sí o No</button>",
            "<button class=\"choice-button\" data-quick-spread=\"single\">Una Carta</button>",
            "<button class=\"choice-button\" data-quick-spread=\"three\">3 Cartas</button>",
            "<button class=\"choice-button\" data-quick-spread=\"celtic\">Cruz Celta</button>",
            "<button class=\"choice-button\" data-page-target=\"history\">Mi Historial</button>",
            "<button class=\"choice-button\" data-page-target=\"how\">Cómo funciona</button>",
            "</div>",
            "</section>"
        ].join(""));

        U.$("#consultOracle").addEventListener("click", function () {
            U.audio.unlock();
            U.audio.ambient(true);
            showConsult();
        });

        U.$$(".choice-button[data-quick-spread]").forEach(function (button) {
            button.addEventListener("click", function () {
                U.audio.unlock();
                U.audio.ambient(true);
                state.spreadKey = button.dataset.quickSpread;
                showConsult();
            });
        });

        U.$$(".choice-button[data-page-target]").forEach(function (button) {
            button.addEventListener("click", function () {
                showPage(button.dataset.pageTarget);
            });
        });
    }

    function showConsult() {
        setPage("consult");
        setTitle("Consultar");
        render([
            "<section class=\"page consult-card\">",
            "<textarea id=\"questionInput\" class=\"question-input\" maxlength=\"180\" placeholder=\"¿Qué me depara el amor esta semana?\">" + U.escapeHTML(state.question) + "</textarea>",
            "<div class=\"spread-row\">",
            spreadButton("yesno", "Sí/No"),
            spreadButton("single", "Una"),
            spreadButton("three", "Tres"),
            spreadButton("celtic", "Celta"),
            "</div>",
            "<div class=\"deck-row\">",
            deckButton("tarot", "Tarot 78"),
            deckButton("oracle", "Oráculo"),
            "</div>",
            "<div class=\"action-row\">",
            "<button id=\"askOracle\" class=\"gold-button\">Invocar</button>",
            "<button id=\"voiceOracle\" class=\"ghost-button\">Voz</button>",
            "</div>",
            "<button id=\"scanPhysical\" class=\"ghost-button\">Escanear carta física</button>",
            "<p id=\"consultStatus\" class=\"tiny-status\">Lateral confirma. Mantén: voz.</p>",
            "</section>"
        ].join(""));

        U.$$(".spread-button").forEach(function (button) {
            button.addEventListener("click", function () {
                state.spreadKey = button.dataset.spread;
                showConsult();
            });
        });

        U.$$(".deck-row .choice-button").forEach(function (button) {
            button.addEventListener("click", function () {
                state.deckType = button.dataset.deck;
                showConsult();
            });
        });

        U.$("#askOracle").addEventListener("click", confirmReading);
        U.$("#voiceOracle").addEventListener("click", beginVoiceInput);
        U.$("#scanPhysical").addEventListener("click", triggerPhysicalScan);
        U.$("#questionInput").addEventListener("input", function (event) {
            state.question = event.target.value;
        });
    }

    function spreadButton(key, label) {
        return "<button class=\"spread-button " + (state.spreadKey === key ? "is-active" : "") + "\" data-spread=\"" + key + "\">" + label + "</button>";
    }

    function deckButton(key, label) {
        return "<button class=\"choice-button " + (state.deckType === key ? "is-active" : "") + "\" data-deck=\"" + key + "\">" + label + "</button>";
    }

    function confirmReading() {
        U.audio.ambient(true);
        var input = U.$("#questionInput");
        state.question = input ? input.value.trim() : state.question.trim();
        if (!state.question) {
            state.question = "Dime lo que necesito escuchar hoy.";
        }
        startReading(state.spreadKey, state.question);
    }

    function startReading(spreadKey, question) {
        var spread = spreads[spreadKey] || spreads.single;
        var deckType = state.deckType === "oracle" ? "oracle" : "tarot";
        var count = deckType === "oracle" ? Math.min(spread.count, 3) : spread.count;
        var draft = {
            cards: Cards.drawCards(count, deckType, spread.positions),
            createdAt: new Date().toISOString(),
            deckType: deckType,
            id: U.uid("oracle"),
            question: question,
            spread: Object.assign({}, spread, { count: count })
        };

        state.isSaved = false;
        state.pending = {
            draft: draft,
            requestId: null,
            type: "reading"
        };
        state.selectedCard = 0;
        showShuffle("Las cartas susurran...");
        U.audio.playShuffle();

        setTimeout(function () {
            if (!state.pending || state.pending.draft !== draft) {
                return;
            }
            var request = LLM.requestReading(draft);
            state.pending.requestId = request.requestId;
            if (!request.sent) {
                setTimeout(function () {
                    completeReading(LLM.fallbackReading(draft), draft);
                }, 720);
            } else {
                setTimeout(function () {
                    if (state.pending && state.pending.requestId === request.requestId) {
                        completeReading(LLM.fallbackReading(draft), draft);
                        U.showToast("Lectura local por demora del LLM");
                    }
                }, 22000);
            }
        }, 880);
    }

    function showShuffle(message) {
        setPage("loading");
        setTitle("Barajando");
        render([
            "<section class=\"page loading-page\">",
            "<div id=\"shuffleStage\" class=\"shuffle-stage\" aria-hidden=\"true\"></div>",
            "<p class=\"oracle-line\">" + U.escapeHTML(message) + "</p>",
            "<p class=\"tiny-status\">Inclina el R1 para avivar la energía.</p>",
            "</section>"
        ].join(""));
        Cards.animateShuffle(U.$("#shuffleStage"));
    }

    function completeReading(response, draft) {
        if (!state.pending || state.pending.type !== "reading") {
            return;
        }

        var normalized = normalizeReading(response, draft);
        state.reading = Object.assign({}, draft, {
            interpretation: normalized
        });
        state.pending = null;
        showResult(state.reading, false);
        LLM.speak(state.reading.interpretation.spoken);
        U.audio.playFlip();
    }

    function normalizeReading(response, draft) {
        var fallback = LLM.fallbackReading(draft);
        var data = response || fallback;
        var interpretedCards = Array.isArray(data.cards) ? data.cards : [];

        return {
            cards: draft.cards.map(function (card, index) {
                var detail = interpretedCards[index] || {};
                return {
                    advice: detail.advice || fallback.cards[index].advice,
                    id: card.id,
                    meaning: detail.meaning || fallback.cards[index].meaning,
                    name: card.name,
                    orientation: card.orientation,
                    position: card.position
                };
            }),
            overall: data.overall || fallback.overall,
            ritual: data.ritual || fallback.ritual,
            spoken: data.spoken || fallback.spoken,
            summary: data.summary || fallback.summary,
            yesNo: draft.spread.mode === "yesno" ? (data.yesNo || fallback.yesNo || null) : null
        };
    }

    function showResult(reading, alreadySaved) {
        setPage("result");
        setTitle(reading.spread.label);
        state.reading = reading;
        state.isSaved = !!alreadySaved;
        state.selectedCard = U.clamp(state.selectedCard, 0, reading.cards.length - 1);

        var selected = reading.cards[state.selectedCard];
        var detail = reading.interpretation.cards[state.selectedCard];
        var verdict = reading.interpretation.yesNo
            ? "<div class=\"yesno-verdict\">" + U.escapeHTML(reading.interpretation.yesNo.answer) + "<br><span>" + U.escapeHTML(reading.interpretation.yesNo.reason || "") + "</span></div>"
            : "";
        var size = reading.cards.length === 1 ? "large" : (reading.cards.length > 3 ? "mini" : "medium");
        var cardMarkup = reading.cards.length > 3
            ? "<div class=\"card-grid\">" + reading.cards.map(function (card, index) {
                return Cards.renderCard(card, index, "mini", index === state.selectedCard);
            }).join("") + "</div>"
            : reading.cards.map(function (card, index) {
                return Cards.renderCard(card, index, size, index === state.selectedCard);
            }).join("");

        render([
            "<section class=\"page result-page\">",
            "<div class=\"card-stage\">" + cardMarkup + "</div>",
            "<div class=\"detail-panel\">",
            verdict,
            "<h2>" + U.escapeHTML(selected.position) + ": " + U.escapeHTML(selected.name) + "</h2>",
            "<p class=\"muted\">" + U.escapeHTML(selected.orientation) + " · " + U.escapeHTML(selected.keywords || "") + "</p>",
            "<p>" + U.escapeHTML(detail.meaning) + "</p>",
            "<p><strong>Consejo:</strong> " + U.escapeHTML(detail.advice) + "</p>",
            "<p class=\"muted\">" + U.escapeHTML(reading.interpretation.ritual) + "</p>",
            "</div>",
            "<div class=\"result-actions\">",
            "<button id=\"saveReading\" class=\"gold-button\">" + (state.isSaved ? "Guardada" : "Guardar lectura") + "</button>",
            "<button id=\"newReading\" class=\"ghost-button\">Nueva consulta</button>",
            "</div>",
            "</section>"
        ].join(""));

        U.$$(".tarot-card").forEach(function (button) {
            button.addEventListener("click", function () {
                state.selectedCard = Number(button.dataset.cardIndex || 0);
                U.audio.playFlip();
                showResult(state.reading, state.isSaved);
            });
        });

        U.$("#saveReading").addEventListener("click", saveCurrentReading);
        U.$("#newReading").addEventListener("click", function () {
            state.question = "";
            showConsult();
        });
    }

    async function saveCurrentReading() {
        if (!state.reading || state.isSaved) {
            U.showToast("La lectura ya descansa en tu historial");
            return;
        }

        var record = {
            cards: state.reading.cards,
            createdAt: state.reading.createdAt,
            deckType: state.reading.deckType,
            id: state.reading.id,
            interpretation: state.reading.interpretation,
            question: state.reading.question,
            spread: state.reading.spread,
            summary: state.reading.interpretation.summary
        };

        await Store.addReading(record);
        state.history = await Store.getReadings();
        state.isSaved = true;
        U.showToast("Lectura guardada");
        showResult(state.reading, true);
    }

    async function showHistory() {
        setPage("history");
        setTitle("Historial");
        state.history = await Store.getReadings();

        if (!state.history.length) {
            render([
                "<section class=\"page\">",
                "<p class=\"oracle-line\">Aún no hay lecturas guardadas.</p>",
                "<button id=\"historyNew\" class=\"primary-action\">Consultar al Oráculo</button>",
                "</section>"
            ].join(""));
            U.$("#historyNew").addEventListener("click", showConsult);
            return;
        }

        render([
            "<section class=\"page\">",
            "<div class=\"history-list\">",
            state.history.map(function (item, index) {
                return [
                    "<button class=\"history-item\" data-history-index=\"" + index + "\">",
                    "<strong>" + U.escapeHTML(U.formatDate(item.createdAt || item.savedAt)) + " · " + U.escapeHTML(item.spread.label) + "</strong>",
                    "<span>" + U.escapeHTML(U.shortText(item.question, 56)) + "</span>",
                    "<span class=\"muted\">" + U.escapeHTML(U.shortText(item.summary, 72)) + "</span>",
                    "</button>"
                ].join("");
            }).join(""),
            "</div>",
            "<button id=\"clearHistory\" class=\"ghost-button\">Borrar historial</button>",
            "</section>"
        ].join(""));

        U.$$(".history-item").forEach(function (button) {
            button.addEventListener("click", function () {
                var item = state.history[Number(button.dataset.historyIndex)];
                state.selectedCard = 0;
                showResult(item, true);
            });
        });

        U.$("#clearHistory").addEventListener("click", async function () {
            await Store.clearReadings();
            state.history = [];
            U.showToast("Historial borrado");
            showHistory();
        });
    }

    function showHow() {
        setPage("how");
        setTitle("Guía");
        render([
            "<section class=\"page\">",
            "<div class=\"how-list\">",
            "<p>Pregunta por voz o texto. Sí o No entrega un veredicto claro.</p>",
            "<p>Elige una carta, tres cartas o Cruz Celta. El botón lateral confirma la tirada.</p>",
            "<p>Inclina el dispositivo para mover la energía. Escanea una carta física con Rabbit Eye.</p>",
            "<p>Guarda tus lecturas para ver fecha, pregunta y resumen en Mi Historial.</p>",
            "</div>",
            "<button id=\"howStart\" class=\"primary-action\">Comenzar</button>",
            "</section>"
        ].join(""));
        U.$("#howStart").addEventListener("click", showConsult);
    }

    function bindCamera() {
        if (!cameraInput) {
            return;
        }
        cameraInput.addEventListener("change", async function (event) {
            var file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            var imageData = await U.fileToDataURL(file);
            scanPhysicalCard(imageData);
            cameraInput.value = "";
        });
    }

    function triggerPhysicalScan() {
        U.audio.unlock();
        U.audio.ambient(true);
        if (!cameraInput) {
            U.showToast("Cámara no disponible");
            return;
        }
        cameraInput.click();
    }

    function scanPhysicalCard(imageData) {
        showShuffle("Rabbit Eye contempla la carta...");
        var request = LLM.requestPhysicalScan(imageData);
        state.pending = {
            requestId: request.requestId,
            type: "scan"
        };

        if (!request.sent) {
            setTimeout(function () {
                completeScan(LLM.fallbackScan());
            }, 850);
        } else {
            setTimeout(function () {
                if (state.pending && state.pending.requestId === request.requestId) {
                    completeScan(LLM.fallbackScan());
                }
            }, 22000);
        }
    }

    function completeScan(response) {
        if (!state.pending || state.pending.type !== "scan") {
            return;
        }

        var data = response || LLM.fallbackScan();
        var found = Cards.findCardByName(data.identifiedCard || "");
        var card = Object.assign(found || {
            arcana: "Física",
            id: "physical-card",
            keywords: "visión, símbolo, presencia",
            mark: "R",
            name: data.identifiedCard && data.identifiedCard !== "desconocida" ? data.identifiedCard : "Carta física",
            suit: "Rabbit Eye"
        }, {
            orientation: data.orientation || "desconocida",
            position: "Carta escaneada"
        });

        var reading = {
            cards: [card],
            createdAt: new Date().toISOString(),
            deckType: "scan",
            id: U.uid("scan-reading"),
            interpretation: {
                cards: [{
                    advice: data.ritual || "Vuelve a mirar la carta con calma.",
                    id: card.id,
                    meaning: data.overall || LLM.fallbackScan().overall,
                    name: card.name,
                    orientation: card.orientation,
                    position: card.position
                }],
                overall: data.overall || "",
                ritual: data.ritual || "",
                spoken: data.spoken || data.overall || "",
                summary: data.summary || "Carta física escaneada."
            },
            question: "Escaneo de carta física",
            spread: {
                count: 1,
                label: "Rabbit Eye",
                positions: ["Carta escaneada"]
            }
        };

        state.pending = null;
        state.selectedCard = 0;
        showResult(reading, false);
        LLM.speak(reading.interpretation.spoken);
    }

    function beginVoiceInput() {
        U.audio.unlock();
        U.audio.ambient(true);
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        var status = U.$("#consultStatus");

        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = "es-ES";
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.onstart = function () {
                if (status) {
                    status.textContent = "Te escucho...";
                }
                U.showToast("Te escucho...");
            };
            recognition.onerror = function () {
                U.showToast("La voz no cruzó el velo");
            };
            recognition.onresult = function (event) {
                var transcript = event.results[0][0].transcript;
                consumeVoiceText(transcript);
            };
            recognition.start();
            return;
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
                stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                U.showToast("Micrófono listo: dicta al R1");
            }).catch(function () {
                U.showToast("Permiso de micrófono denegado");
            });
        } else {
            U.showToast("Micrófono no disponible aquí");
        }
    }

    function consumeVoiceText(text) {
        var normalized = U.normalizeSpeech(text);
        if (!normalized) {
            return;
        }

        if (normalized.indexOf("historial") >= 0) {
            showHistory();
            return;
        }
        if (normalized.indexOf("como funciona") >= 0 || normalized.indexOf("guia") >= 0) {
            showHow();
            return;
        }
        if (normalized.indexOf("cruz celta") >= 0) {
            state.spreadKey = "celtic";
        } else if (normalized.indexOf("si o no") >= 0 || normalized.indexOf("si/no") >= 0) {
            state.spreadKey = "yesno";
        } else if (normalized.indexOf("tres cartas") >= 0 || normalized.indexOf("3 cartas") >= 0) {
            state.spreadKey = "three";
        } else if (normalized.indexOf("una carta") >= 0 || normalized.indexOf("dame una carta") >= 0) {
            state.spreadKey = "single";
        }

        if (normalized.indexOf("consulta") >= 0 && normalized.indexOf("oraculo") >= 0 && normalized.length < 28) {
            showConsult();
            return;
        }

        state.question = text;
        startReading(state.spreadKey, state.question);
    }

    function handlePluginMessage(data) {
        var parsed = LLM.normalizeResponse(data);
        var possibleVoice = data && (data.transcript || data.text || data.command);

        if (possibleVoice && !state.pending) {
            consumeVoiceText(possibleVoice);
            return;
        }

        if (!state.pending) {
            return;
        }

        if (state.pending.type === "scan") {
            completeScan(parsed);
        } else if (state.pending.type === "reading") {
            completeReading(parsed, state.pending.draft);
        }
    }

    function registerHardwareHooks() {
        if (hardwareReady) {
            return;
        }
        hardwareReady = true;

        window.addEventListener("sideClick", function () {
            if (state.currentPage === "home") {
                showConsult();
            } else if (state.currentPage === "consult") {
                confirmReading();
            } else if (state.currentPage === "result") {
                saveCurrentReading();
            }
        });

        window.addEventListener("longPressStart", beginVoiceInput);

        window.addEventListener("scrollUp", function () {
            if (state.currentPage === "result") {
                state.selectedCard = Math.max(0, state.selectedCard - 1);
                showResult(state.reading, state.isSaved);
            } else if (state.currentPage === "consult") {
                cycleSpread(-1);
            }
        });

        window.addEventListener("scrollDown", function () {
            if (state.currentPage === "result") {
                state.selectedCard = Math.min(state.reading.cards.length - 1, state.selectedCard + 1);
                showResult(state.reading, state.isSaved);
            } else if (state.currentPage === "consult") {
                cycleSpread(1);
            }
        });
    }

    function cycleSpread(direction) {
        var keys = ["yesno", "single", "three", "celtic"];
        var index = keys.indexOf(state.spreadKey);
        state.spreadKey = keys[(index + direction + keys.length) % keys.length];
        showConsult();
    }

    async function startAccelerometer() {
        var sensors = window.creationSensors;
        if (!sensors || !sensors.accelerometer) {
            return;
        }

        try {
            var available = sensors.accelerometer.isAvailable ? await sensors.accelerometer.isAvailable() : true;
            if (!available) {
                return;
            }
            sensors.accelerometer.start(function (data) {
                var x = U.clamp(data.x || 0, -1, 1);
                var y = U.clamp(data.y || 0, -1, 1);
                var app = U.$("#app");
                if (!app) {
                    return;
                }
                app.style.setProperty("--tilt-x", x.toFixed(2));
                app.style.setProperty("--tilt-y", y.toFixed(2));
                app.classList.toggle("energy-active", Math.abs(x) + Math.abs(y) > 0.45);
            }, { frequency: 15 });
        } catch (error) {
            console.log("Acelerómetro no disponible", error);
        }
    }

    window.Oracle = {
        beginVoiceInput: beginVoiceInput,
        handlePluginMessage: handlePluginMessage,
        init: init,
        showPage: showPage
    };
}());
