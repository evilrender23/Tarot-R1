// Navegación principal y puente con los mensajes del SDK de Rabbit R1.
(function () {
    "use strict";

    var currentPage = "home";

    document.addEventListener("DOMContentLoaded", function () {
        initializeNavigation();
        initializeBackButton();

        if (window.Oracle && window.Oracle.init) {
            window.Oracle.init();
        }

        if (typeof PluginMessageHandler !== "undefined") {
            console.log("AI Oracle ejecutándose como Rabbit R1 Creation");
        } else {
            console.log("AI Oracle en modo navegador con respuestas locales");
        }
    });

    function initializeNavigation() {
        var menuBtn = document.getElementById("menuBtn");
        var closeMenu = document.getElementById("closeMenu");
        var menuNav = document.getElementById("menuNav");
        var menuLinks = document.querySelectorAll(".menu-nav a");

        menuBtn.addEventListener("click", function () {
            menuNav.classList.add("open");
        });

        closeMenu.addEventListener("click", function () {
            menuNav.classList.remove("open");
        });

        menuLinks.forEach(function (link) {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                loadPage(link.dataset.page);
                menuNav.classList.remove("open");
            });
        });
    }

    function initializeBackButton() {
        var backBtn = document.getElementById("backBtn");
        backBtn.addEventListener("click", function () {
            if (currentPage === "home") {
                if (typeof closeWebView !== "undefined" && closeWebView.postMessage) {
                    closeWebView.postMessage("");
                }
                return;
            }
            loadPage("home");
        });
    }

    function loadPage(pageName) {
        currentPage = pageName || "home";
        if (window.Oracle && window.Oracle.showPage) {
            window.Oracle.showPage(currentPage);
        }
        setActive(currentPage);
    }

    function setActive(pageName) {
        currentPage = pageName || "home";
        document.querySelectorAll(".menu-nav a").forEach(function (link) {
            link.classList.toggle("active", link.dataset.page === currentPage);
        });
    }

    // Todas las respuestas LLM y posibles comandos entran por el callback oficial.
    window.onPluginMessage = function (data) {
        console.log("Mensaje recibido desde Rabbit R1:", data);
        if (window.Oracle && window.Oracle.handlePluginMessage) {
            window.Oracle.handlePluginMessage(data);
        }
    };

    window.AppNavigation = {
        loadPage: loadPage,
        setActive: setActive
    };
}());
