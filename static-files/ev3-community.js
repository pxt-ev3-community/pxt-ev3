/* This file contains custom scripts to fix various Makecode EV3 editor problems
 * when running as a static site on github pages.
 */

/* Normalize doc URLs: prevent double /docs/docs/ and preserve repository subpath */
function normalizeDocUrl(url) {
    if (typeof url !== "string") return url;
    url = url.replace(/\/docs\/docs\//g, "/docs/");

    var relprefix = (window.pxtConfig && window.pxtConfig.relprefix)
        ? window.pxtConfig.relprefix
        : (window.location.pathname.replace(/\/[^\/]*$/, "/") || "/");

    if (relprefix && relprefix !== "/" && url.startsWith("/docs/")) {
        var prefix = relprefix.replace(/\/+$/, "");
        if (!url.startsWith(prefix + "/")) {
            url = prefix + url;
        }
    }
    return url;
}

/* Normalize static asset URLs (images, logos) to include repository subpath */
function normalizeAssetSrc(src) {
    if (typeof src !== "string") return src;
    var relprefix = (window.pxtConfig && window.pxtConfig.relprefix)
        ? window.pxtConfig.relprefix
        : (window.location.pathname.replace(/\/[^\/]*$/, "/") || "/");
    if (!relprefix || relprefix === "/") return src;
    var prefix = relprefix.replace(/\/+$/, "");

    if (src.startsWith("/static/") || src.startsWith("/docs/static/") || src.startsWith("/docfiles/")) {
        if (!src.startsWith(prefix + "/")) {
            return prefix + src;
        }
    }
    return src;
}

function fixAssets(root) {
    var container = root || document;
    if (!container.querySelectorAll) return;
    var imgs = container.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].getAttribute("src");
        if (src) {
            var fixed = normalizeAssetSrc(src);
            if (fixed !== src) imgs[i].setAttribute("src", fixed);
        }
    }
    var links = container.querySelectorAll("a");
    for (var j = 0; j < links.length; j++) {
        var href = links[j].getAttribute("href");
        if (href) {
            var fixedHref = normalizeDocUrl(href);
            if (fixedHref !== href) links[j].setAttribute("href", fixedHref);
        }
    }
    var icons = container.querySelectorAll("link[rel*='icon']");
    for (var k = 0; k < icons.length; k++) {
        var iconHref = icons[k].getAttribute("href");
        if (iconHref && iconHref.startsWith("docs/static/")) {
            var relprefix = (window.pxtConfig && window.pxtConfig.relprefix)
                ? window.pxtConfig.relprefix
                : (window.location.pathname.replace(/\/[^\/]*$/, "/") || "/");
            var prefix = relprefix ? relprefix.replace(/\/+$/, "") : "";
            icons[k].setAttribute("href", prefix + "/" + iconHref);
        }
    }
}

// Observe dynamic DOM changes (e.g. rendered markdown docs or dialogs)
var assetObserver = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "childList") {
            for (var j = 0; j < m.addedNodes.length; j++) {
                var node = m.addedNodes[j];
                if (node.nodeType === 1) {
                    fixAssets(node);
                }
            }
        } else if (m.type === "attributes") {
            if (m.attributeName === "src" && m.target.tagName === "IMG") {
                var src = m.target.getAttribute("src");
                var fixed = normalizeAssetSrc(src);
                if (fixed !== src) m.target.setAttribute("src", fixed);
            }
        }
    }
});

try {
    assetObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "href"]
    });
} catch (e) {}

window.addEventListener("DOMContentLoaded", function() {
    fixAssets(document);
});

window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "opendoc" && typeof e.data.url === "string") {
        e.data.url = normalizeDocUrl(e.data.url);
    }
}, true);

const originalWindowOpen = window.open;
window.open = function(url, ...rest) {
    if (typeof url === "string") {
        url = normalizeDocUrl(url);
    }
    return originalWindowOpen.call(this, url, ...rest);
};

document.addEventListener("click", function(e) {
    var target = e.target;
    while (target && target.tagName !== "A") {
        target = target.parentElement;
    }
    if (target && target.tagName === "A" && target.getAttribute("href")) {
        var href = target.getAttribute("href");
        var normalized = normalizeDocUrl(href);
        if (normalized !== href) {
            target.setAttribute("href", normalized);
        }
    }
}, true);

/* Fix URL prefix in docs when running the beta site */
function checkDocsBetaUrl()
{
    const docurl = window.location.hash;
    if (docurl.startsWith("#doc:/pxt-ev3/beta/"))
    {
        const newurl = docurl.replace("pxt-ev3/beta/", "");
        window.location.replace(window.location.origin + window.location.pathname + window.location.search + newurl);
    }
    else if (docurl.includes("/docs/docs/"))
    {
        const newurl = docurl.replace(/\/docs\/docs\//g, "/docs/");
        window.location.replace(window.location.origin + window.location.pathname + window.location.search + newurl);
    }
}

/* Rewrite XMLHttpRequest urls to download translated docs from MakeCode API when needed,
 * with fallback to local documentation if translation is not found on CDN. */
function bindDocsXHROpen()
{
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest)
    {
        if (typeof url === "string" && url.includes("/docs/docs/")) {
            url = url.replace(/\/docs\/docs\//g, "/docs/");
        }

        const match = typeof url === "string" ? url.match(/(?:^|\/)docs\/(.+?)\.md\?lang=([\w-]+)$/) : null;
        if (match && !url.includes("cdn.makecode.com") && match[2] !== "en") {
            const docPath = match[1];
            const lang = match[2];
            const cdnUrl = "https://cdn.makecode.com/api/md/ev3/" + docPath + "?targetVersion=1.4.41&lang=" + lang;
            const originalUrl = url;

            this._isDocTranslation = true;
            this._originalDocUrl = originalUrl;
            this._cdnDocUrl = cdnUrl;
            this._openArgs = [method, ...rest];

            return originalOpen.apply(this, [method, cdnUrl, ...rest]);
        }

        return originalOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function(...args)
    {
        if (this._isDocTranslation) {
            const xhr = this;
            const originalUrl = this._originalDocUrl;
            const openArgs = this._openArgs;

            let fallbackAttempted = false;
            const tryFallback = function() {
                if (fallbackAttempted) return;
                fallbackAttempted = true;
                console.log("Translation not found on CDN, falling back to local doc: " + originalUrl);
                const fallbackXhr = new XMLHttpRequest();
                fallbackXhr.open(openArgs[0], originalUrl, openArgs[1] !== undefined ? openArgs[1] : true);
                fallbackXhr.onload = function() {
                    Object.defineProperty(xhr, "status", { value: fallbackXhr.status, writable: true, configurable: true });
                    Object.defineProperty(xhr, "responseText", { value: fallbackXhr.responseText, writable: true, configurable: true });
                    Object.defineProperty(xhr, "response", { value: fallbackXhr.response, writable: true, configurable: true });
                    Object.defineProperty(xhr, "readyState", { value: fallbackXhr.readyState, writable: true, configurable: true });
                    if (xhr.onload) xhr.onload();
                    if (xhr.onreadystatechange) xhr.onreadystatechange();
                };
                fallbackXhr.onerror = function() {
                    if (xhr.onerror) xhr.onerror();
                };
                fallbackXhr.send(...args);
            };

            xhr.addEventListener("load", function() {
                if (xhr.status === 404) {
                    tryFallback();
                }
            });
            xhr.addEventListener("error", function() {
                tryFallback();
            });
        }
        return originalSend.apply(this, args);
    };
}

if (window.location.pathname.split('/').pop() == "docs.html")
{
    checkDocsBetaUrl();
    bindDocsXHROpen();
}

/* Add class to body to customize CSS for beta site */
if (window.location.hostname != 'brickcode.org')
{
    window.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('ev3beta');
    });
}

/* Automatically select "API key" for GitHub login dialog, as OAuth
 * cannot work with GitHub pages. */
function bindGitHubLoginHook()
{
    function callback(mutationList, observer)
    {
        for (const mutation of mutationList) {
            if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach(node => {
                        node.querySelectorAll('h3').forEach(hdr => {
                            if (hdr.textContent.includes("GitHub"))
                            {
                                const link = node.querySelector("a.ui.link");
                                if (link)
                                {
                                    console.log("Selecting GitHub API token mode");
                                    link.click();
                                }
                            }
                        });
                  });
            }
        }
    };
    
    const observer = new MutationObserver(callback);
    observer.observe(document.body, { childList: true, subtree: false });
}

window.addEventListener('DOMContentLoaded', bindGitHubLoginHook);

