
/**
 * External GitHub tutorial compatibility layer.
 *
 * PXT's static build requests GitHub tutorials from the
 * locally hosted /ghtutorial/ path, which GitHub Pages
 * cannot serve.
 *
 * Redirect only those requests to Microsoft's tutorial API.
 *
 * Temporary solution until BrickCode provides its own
 * browser-side tutorial loader.
 */
(function () {
    "use strict";

    const tutorialApi =
        "https://cdn.makecode.com/api/ghtutorial/";

    // Works at / for brickcode.org and /pxt-ev3/ for forks.
    const localTutorialPath =
        new URL("ghtutorial/", window.location.href).pathname;

    const originalOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function (
        method, url, ...args
    ) {
        if (String(method).toUpperCase() === "GET") {
            let requestUrl;

            try {
                requestUrl = new URL(String(url), location.href);
            } catch {
                // Preserve normal XHR behavior for invalid URLs.
            }

            if (
                requestUrl &&
                requestUrl.origin === location.origin &&
                requestUrl.pathname.startsWith(localTutorialPath)
            ) {
                const tutorialPath =
                    requestUrl.pathname.slice(
                        localTutorialPath.length
                    );

                if (tutorialPath) {
                    const redirectUrl =
                        tutorialApi +
                        tutorialPath +
                        requestUrl.search;

                    console.info(
                        "External tutorial redirected:",
                        redirectUrl
                    );

                    return originalOpen.call(
                        this,
                        method,
                        redirectUrl,
                        ...args
                    );
                }
            }
        }

        return originalOpen.call(
            this,
            method,
            url,
            ...args
        );
    };

    console.info("External tutorial routing enabled");
})();
