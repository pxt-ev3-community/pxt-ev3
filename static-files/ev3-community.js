/* This file contains custom scripts to fix various Makecode EV3 editor problems
 * when running as a static site on github pages.
 */

/* Fix URL prefix in docs when running the beta site */
function checkDocsBetaUrl()
{
    const docurl = window.location.hash;
    if (docurl.startsWith("#doc:/pxt-ev3/beta/"))
    {
        const newurl = docurl.replace("pxt-ev3/beta/", "");
        window.location.replace(window.location.origin + window.location.pathname + window.location.search + newurl);
    }
}

/* Rewrite XMLHttpRequest urls to download translated docs from MakeCode API when needed. */
function bindDocsXHROpen()
{
    console.log("Here1");
    const docurl = window.location.hash;
    if (docurl.startsWith("#doc:/docs") && !docurl.endsWith(":en"))
    {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest)
        {
            console.log("Here2 " + url);
            const match = url.match(/docs\/([\w\/]+).md\?lang=([\w-]+)$/);
            if (match) {
                const newurl = "https://cdn.makecode.com/api/md/ev3/" + match[1] + "?targetVersion=1.4.41&lang=" + match[2];
                console.log("Getting translated docs for " + url + " from " + newurl);
                return originalOpen.apply(this, [method, newurl, ...rest]);
            }
            return originalOpen.apply(this, [method, url, ...rest]);
        };
    }
}

/* Redirect external GitHub tutorial requests on static sites. */
function bindGitHubTutorialXHROpen()
{
    const tutorialApi = "https://cdn.makecode.com/api/ghtutorial/";
    const localTutorialPath =
        new URL("ghtutorial/", window.location.href).pathname;

    const originalOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url, ...rest)
    {
        if (String(method).toUpperCase() === "GET") {
            let requestUrl;

            try {
                requestUrl = new URL(String(url), window.location.href);
            } catch (e) {
                // Let normal XHR handling deal with invalid URLs.
            }

            if (requestUrl &&
                requestUrl.origin === window.location.origin &&
                requestUrl.pathname.startsWith(localTutorialPath))
            {
                const tutorialPath =
                    requestUrl.pathname.slice(localTutorialPath.length);

                if (tutorialPath) {
                    const newUrl =
                        tutorialApi + tutorialPath + requestUrl.search;

                    return originalOpen.call(
                        this, method, newUrl, ...rest
                    );
                }
            }
        }

        return originalOpen.call(this, method, url, ...rest);
    };
}

bindGitHubTutorialXHROpen();

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

