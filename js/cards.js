(function () {
    "use strict";

    var U = window.OracleUtils;

    // La baraja Rider-Waite se genera completa: 22 arcanos mayores + 56 arcanos menores.
    var majors = [
        ["fool", "El Loco", "inicio, fe, salto"],
        ["magician", "El Mago", "voluntad, enfoque, poder"],
        ["high-priestess", "La Sacerdotisa", "intuición, misterio, silencio"],
        ["empress", "La Emperatriz", "cuidado, belleza, fertilidad"],
        ["emperor", "El Emperador", "orden, límites, firmeza"],
        ["hierophant", "El Hierofante", "tradición, guía, aprendizaje"],
        ["lovers", "Los Enamorados", "elección, vínculo, valores"],
        ["chariot", "El Carro", "avance, dominio, dirección"],
        ["strength", "La Fuerza", "coraje, ternura, paciencia"],
        ["hermit", "El Ermitaño", "búsqueda, pausa, sabiduría"],
        ["wheel", "La Rueda de la Fortuna", "cambio, ciclo, oportunidad"],
        ["justice", "La Justicia", "verdad, equilibrio, consecuencia"],
        ["hanged-man", "El Colgado", "rendición, mirada nueva, espera"],
        ["death", "La Muerte", "cierre, transformación, renacer"],
        ["temperance", "La Templanza", "armonía, mezcla, calma"],
        ["devil", "El Diablo", "apego, deseo, sombra"],
        ["tower", "La Torre", "ruptura, revelación, liberación"],
        ["star", "La Estrella", "esperanza, sanación, claridad"],
        ["moon", "La Luna", "sueños, dudas, instinto"],
        ["sun", "El Sol", "alegría, vitalidad, éxito"],
        ["judgement", "El Juicio", "llamado, despertar, perdón"],
        ["world", "El Mundo", "logro, integración, viaje"]
    ];

    var suits = [
        { id: "wands", name: "Bastos", mark: "B", element: "Fuego", keywords: "impulso, deseo, creatividad" },
        { id: "cups", name: "Copas", mark: "C", element: "Agua", keywords: "amor, intuición, emoción" },
        { id: "swords", name: "Espadas", mark: "E", element: "Aire", keywords: "mente, verdad, decisión" },
        { id: "pentacles", name: "Oros", mark: "O", element: "Tierra", keywords: "cuerpo, recursos, trabajo" }
    ];

    var ranks = [
        { id: "ace", name: "As", keywords: "semilla, regalo, comienzo" },
        { id: "two", name: "Dos", keywords: "dualidad, elección, encuentro" },
        { id: "three", name: "Tres", keywords: "crecimiento, expresión, colaboración" },
        { id: "four", name: "Cuatro", keywords: "base, pausa, estructura" },
        { id: "five", name: "Cinco", keywords: "fricción, reto, ajuste" },
        { id: "six", name: "Seis", keywords: "ayuda, memoria, armonía" },
        { id: "seven", name: "Siete", keywords: "prueba, estrategia, fe" },
        { id: "eight", name: "Ocho", keywords: "movimiento, práctica, cambio" },
        { id: "nine", name: "Nueve", keywords: "madurez, cosecha, resistencia" },
        { id: "ten", name: "Diez", keywords: "culminación, peso, legado" },
        { id: "page", name: "Sota", keywords: "mensaje, curiosidad, aprendiz" },
        { id: "knight", name: "Caballero", keywords: "acción, búsqueda, impulso" },
        { id: "queen", name: "Reina", keywords: "dominio interno, cuidado, magnetismo" },
        { id: "king", name: "Rey", keywords: "autoridad, visión, responsabilidad" }
    ];

    var oracleDeck = [
        ["threshold", "El Umbral", "decisión sagrada, paso nuevo"],
        ["mirror", "El Espejo", "verdad íntima, reflejo"],
        ["lantern", "La Linterna", "guía, paciencia, foco"],
        ["river", "El Río", "flujo, entrega, limpieza"],
        ["crown", "La Corona", "dignidad, liderazgo, merecimiento"],
        ["seed", "La Semilla", "potencial, inicio lento"],
        ["key", "La Llave", "acceso, respuesta, apertura"],
        ["veil", "El Velo", "misterio, protección, intuición"],
        ["flame", "La Llama", "pasión, energía, voluntad"],
        ["garden", "El Jardín", "placer, cuidado, abundancia"],
        ["storm", "La Tormenta", "movimiento, limpieza, verdad"],
        ["dawn", "El Alba", "esperanza, renacer, claridad"]
    ];

    // El arte es SVG inline para evitar dependencias externas y funcionar sin red en el R1.
    function buildTarotDeck() {
        var deck = majors.map(function (card, index) {
            return {
                arcana: "Mayor",
                id: "major-" + card[0],
                keywords: card[2],
                name: card[1],
                number: index,
                suit: "Arcanos"
            };
        });

        suits.forEach(function (suit) {
            ranks.forEach(function (rank) {
                deck.push({
                    arcana: "Menor",
                    element: suit.element,
                    id: suit.id + "-" + rank.id,
                    keywords: rank.keywords + ", " + suit.keywords,
                    mark: suit.mark,
                    name: rank.name + " de " + suit.name,
                    rank: rank.name,
                    suit: suit.name
                });
            });
        });

        return deck;
    }

    function buildOracleDeck() {
        return oracleDeck.map(function (card) {
            return {
                arcana: "Oráculo",
                id: "oracle-" + card[0],
                keywords: card[2],
                mark: "O",
                name: card[1],
                suit: "Oráculo"
            };
        });
    }

    function getDeck(type) {
        return type === "oracle" ? buildOracleDeck() : buildTarotDeck();
    }

    function shuffle(cards) {
        var copy = cards.slice();
        for (var i = copy.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    function drawCards(count, deckType, positions) {
        return shuffle(getDeck(deckType)).slice(0, count).map(function (card, index) {
            return Object.assign({}, card, {
                orientation: Math.random() < 0.28 ? "invertida" : "derecha",
                position: positions[index] || "Carta " + (index + 1)
            });
        });
    }

    function findCardByName(name) {
        var normalized = U.normalizeSpeech(name);
        return getDeck("tarot").concat(getDeck("oracle")).find(function (card) {
            return U.normalizeSpeech(card.name) === normalized;
        }) || null;
    }

    function svgForCard(card) {
        var safeName = U.escapeHTML(card.name);
        var safeSuit = U.escapeHTML(card.suit || card.arcana || "");
        var safeMark = U.escapeHTML(card.mark || (card.arcana === "Mayor" ? "M" : "A"));
        var isMajor = card.arcana === "Mayor";
        var accent = isMajor ? "#f5c242" : "#9f86dd";

        return [
            "<svg viewBox=\"0 0 84 124\" role=\"img\" aria-label=\"" + safeName + "\">",
            "<defs>",
            "<linearGradient id=\"g-" + card.id + "\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"1\">",
            "<stop offset=\"0\" stop-color=\"#1a102a\"/>",
            "<stop offset=\"1\" stop-color=\"#111111\"/>",
            "</linearGradient>",
            "</defs>",
            "<rect x=\"2\" y=\"2\" width=\"80\" height=\"120\" rx=\"7\" fill=\"url(#g-" + card.id + ")\" stroke=\"#f5c242\" stroke-width=\"2\"/>",
            "<rect x=\"8\" y=\"8\" width=\"68\" height=\"108\" rx=\"5\" fill=\"none\" stroke=\"rgba(255,255,255,0.25)\"/>",
            "<path d=\"M42 18 L48 43 L70 46 L52 61 L58 88 L42 72 L26 88 L32 61 L14 46 L36 43 Z\" fill=\"" + accent + "\" opacity=\"0.22\"/>",
            "<circle cx=\"42\" cy=\"58\" r=\"22\" fill=\"none\" stroke=\"" + accent + "\" stroke-width=\"2\" opacity=\"0.72\"/>",
            "<text x=\"42\" y=\"54\" text-anchor=\"middle\" fill=\"#f5c242\" font-size=\"20\" font-family=\"serif\" font-weight=\"700\">" + safeMark + "</text>",
            "<text x=\"42\" y=\"70\" text-anchor=\"middle\" fill=\"#f6f0df\" font-size=\"7\" font-family=\"Arial\">" + safeSuit + "</text>",
            "<text x=\"42\" y=\"103\" text-anchor=\"middle\" fill=\"#f6f0df\" font-size=\"7\" font-family=\"Arial\" font-weight=\"700\">" + safeName.slice(0, 24) + "</text>",
            "</svg>"
        ].join("");
    }

    function renderCard(card, index, size, selected) {
        var className = [
            "tarot-card",
            size || "medium",
            selected ? "is-selected" : "",
            card.orientation === "invertida" ? "is-reversed" : ""
        ].join(" ");

        return [
            "<button class=\"" + className + "\" data-card-index=\"" + index + "\" aria-label=\"" + U.escapeHTML(card.name) + "\">",
            "<span class=\"card-art\">",
            svgForCard(card),
            "</span>",
            "</button>"
        ].join("");
    }

    function sparkle(container, count) {
        if (!container) {
            return;
        }
        for (var i = 0; i < count; i += 1) {
            var spark = document.createElement("span");
            spark.className = "spark";
            spark.style.left = Math.round(18 + Math.random() * 92) + "px";
            spark.style.top = Math.round(22 + Math.random() * 62) + "px";
            spark.style.animationDelay = Math.random().toFixed(2) + "s";
            container.appendChild(spark);
            setTimeout(function (node) {
                if (node && node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }, 980, spark);
        }
    }

    function animateShuffle(container) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        for (var i = 0; i < 4; i += 1) {
            var card = document.createElement("div");
            card.className = "shuffle-card";
            container.appendChild(card);
        }
        sparkle(container, 10);
    }

    function fallbackMeaning(card, question) {
        var orientation = card.orientation === "invertida" ? "invertida" : "derecha";
        var tone = orientation === "invertida"
            ? "aparece como una invitación a mirar con paciencia lo que aún se resiste"
            : "abre una señal favorable para actuar con presencia";
        return "Ante \"" + (question || "tu consulta") + "\", " + card.name + " " + tone + ". Sus claves son: " + card.keywords + ".";
    }

    window.OracleCards = {
        animateShuffle: animateShuffle,
        drawCards: drawCards,
        fallbackMeaning: fallbackMeaning,
        findCardByName: findCardByName,
        getDeck: getDeck,
        renderCard: renderCard,
        shuffle: shuffle,
        sparkle: sparkle
    };
}());
