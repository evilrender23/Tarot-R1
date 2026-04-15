(function () {
    "use strict";

    var U = window.OracleUtils;

    // Los prompts fuerzan JSON para que la UI pueda pintar cartas, resumen y texto hablado.
    function cardLine(card, index) {
        return [
            index + 1 + ". " + card.position,
            card.name,
            "(" + card.orientation + ")",
            "claves: " + card.keywords
        ].join(" - ");
    }

    function buildReadingPrompt(draft) {
        var cards = draft.cards.map(cardLine).join("\n");
        var yesNoInstruction = draft.spread.mode === "yesno"
            ? "Modalidad Sí o No: entrega un veredicto claro, honesto y matizado. Usa yesNo.answer con una de estas opciones: \"Sí\", \"No\", \"Todavía no\" o \"Sí, pero\"."
            : "Modalidad lectura: deja yesNo en null.";
        return [
            "Eres AI Oracle, un oráculo antiguo para Rabbit R1. Habla en español con tono dramático, pausado, místico y compasivo.",
            "Interpreta tarot de forma profunda, personalizada, positiva pero honesta. No prometas certezas absolutas, diagnósticos médicos, legales ni financieros.",
            yesNoInstruction,
            "Pregunta del consultante: \"" + draft.question + "\"",
            "Tirada: " + draft.spread.label + ". Baraja: " + (draft.deckType === "oracle" ? "oráculo simple" : "tarot Rider-Waite de 78 cartas") + ".",
            "Cartas extraídas:",
            cards,
            "Devuelve SOLO JSON válido, sin markdown, con esta estructura exacta:",
            "{\"spoken\":\"lectura completa para que el R1 la lea en voz alta, empieza con Las cartas susurran...\",\"summary\":\"resumen de máximo 120 caracteres\",\"yesNo\":null,\"overall\":\"síntesis general en 3-5 frases\",\"cards\":[{\"id\":\"id de carta\",\"name\":\"nombre\",\"orientation\":\"derecha o invertida\",\"position\":\"posición\",\"meaning\":\"interpretación profunda de 2-3 frases\",\"advice\":\"consejo práctico de 1 frase\"}],\"ritual\":\"frase final breve y memorable\"}",
            "Si es modalidad Sí o No, yesNo debe ser un objeto: {\"answer\":\"Sí/No/Todavía no/Sí, pero\",\"confidence\":\"alta/media/baja\",\"reason\":\"motivo breve\"}."
        ].join("\n");
    }

    function buildScanPrompt() {
        return [
            "Eres AI Oracle en Rabbit R1. Observa la imagen enviada por Rabbit Eye, identifica la carta física de tarot si es posible e interprétala.",
            "Responde en español como un oráculo antiguo. Si la imagen no permite identificarla, dilo con delicadeza y pide acercar la carta.",
            "Devuelve SOLO JSON válido:",
            "{\"spoken\":\"texto para voz, empieza con El ojo del conejo contempla...\",\"identifiedCard\":\"nombre de la carta o desconocida\",\"orientation\":\"derecha, invertida o desconocida\",\"confidence\":\"alta, media o baja\",\"summary\":\"resumen breve\",\"overall\":\"interpretación de 3-5 frases\",\"ritual\":\"consejo final\"}"
        ].join("\n");
    }

    function postToLLM(payload) {
        if (typeof PluginMessageHandler === "undefined" || !PluginMessageHandler.postMessage) {
            return false;
        }
        // Canal oficial del creations-sdk: el R1 habla porque wantsR1Response va siempre en true.
        PluginMessageHandler.postMessage(JSON.stringify(payload));
        return true;
    }

    function requestReading(draft) {
        var requestId = U.uid("reading");
        var payload = {
            message: buildReadingPrompt(draft),
            metadata: {
                creation: "AI Oracle",
                kind: "tarot_reading",
                requestId: requestId
            },
            requestId: requestId,
            useLLM: true,
            wantsJournalEntry: true,
            wantsR1Response: true
        };

        return {
            requestId: requestId,
            sent: postToLLM(payload)
        };
    }

    function requestPhysicalScan(imageData) {
        var requestId = U.uid("scan");
        var payload = {
            imageData: imageData,
            images: imageData ? [imageData] : [],
            message: buildScanPrompt(),
            metadata: {
                creation: "AI Oracle",
                kind: "physical_card_scan",
                requestId: requestId
            },
            requestId: requestId,
            useLLM: true,
            wantsJournalEntry: true,
            wantsR1Response: true
        };

        return {
            requestId: requestId,
            sent: postToLLM(payload)
        };
    }

    function speak(spokenText) {
        if (!spokenText) {
            return false;
        }
        return postToLLM({
            message: "Lee en voz alta con tono de oráculo antiguo, misterioso y pausado. Texto: " + spokenText,
            metadata: {
                creation: "AI Oracle",
                kind: "oracle_voice_readback"
            },
            useLLM: true,
            wantsJournalEntry: false,
            wantsR1Response: true
        });
    }

    function normalizeResponse(data) {
        var parsed = U.extractPluginJSON(data);
        if (parsed) {
            return parsed;
        }

        var text = "";
        if (data && data.data) {
            text = String(data.data);
        } else if (data && data.message) {
            text = String(data.message);
        } else if (typeof data === "string") {
            text = data;
        }

        if (!text) {
            return null;
        }

        return {
            overall: text,
            spoken: text,
            summary: U.shortText(text, 120)
        };
    }

    function fallbackReading(draft) {
        var isYesNo = draft.spread.mode === "yesno";
        var cardDetails = draft.cards.map(function (card) {
            return {
                advice: card.orientation === "invertida"
                    ? "Respira antes de actuar; lo oculto necesita espacio para ordenarse."
                    : "Da un paso pequeño y claro durante las próximas veinticuatro horas.",
                id: card.id,
                meaning: window.OracleCards.fallbackMeaning(card, draft.question),
                name: card.name,
                orientation: card.orientation,
                position: card.position
            };
        });

        var yesNo = isYesNo ? {
            answer: draft.cards[0].orientation === "invertida" ? "Todavía no" : "Sí, pero",
            confidence: "media",
            reason: draft.cards[0].orientation === "invertida"
                ? "La carta invertida pide espera, ajuste y una señal más clara."
                : "La carta abre una vía favorable, siempre que actúes con intención."
        } : null;

        var overall = isYesNo
            ? "Las cartas susurran una respuesta breve: " + yesNo.answer + ". No lo recibas como sentencia inmóvil, sino como clima del momento. " + yesNo.reason
            : "Las cartas susurran que tu pregunta pide presencia, no prisa. La lectura marca un camino de claridad gradual: mira la señal principal, honra los límites y elige el gesto más honesto que puedas sostener.";

        return {
            cards: cardDetails,
            overall: overall,
            ritual: "El destino revela una puerta; tu calma es la llave.",
            spoken: overall + " " + cardDetails.map(function (card) {
                return card.position + ": " + card.name + ". " + card.meaning + " " + card.advice;
            }).join(" ") + " El destino revela una puerta; tu calma es la llave.",
            summary: isYesNo ? yesNo.answer + " · " + yesNo.reason : "Claridad gradual, honestidad y un paso pequeño con calma.",
            yesNo: yesNo
        };
    }

    function fallbackScan() {
        return {
            confidence: "baja",
            identifiedCard: "desconocida",
            orientation: "desconocida",
            overall: "El ojo del conejo contempla la carta, pero la niebla aún cubre su símbolo. Acerca la imagen, ilumina sus bordes y vuelve a invocar al oráculo.",
            ritual: "La visión mejora cuando la carta ocupa todo el marco.",
            spoken: "El ojo del conejo contempla la carta, pero la niebla aún cubre su símbolo. Acerca la imagen, ilumina sus bordes y vuelve a invocar al oráculo.",
            summary: "No se pudo identificar la carta con claridad."
        };
    }

    window.OracleLLM = {
        fallbackReading: fallbackReading,
        fallbackScan: fallbackScan,
        normalizeResponse: normalizeResponse,
        requestPhysicalScan: requestPhysicalScan,
        requestReading: requestReading,
        speak: speak
    };
}());
