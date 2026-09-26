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
    const docurl = window.location.hash;
    if (docurl.startsWith("#doc:/docs") && !docurl.endsWith(":en"))
    {
        const originalOpen = XMLHttpRequest.prototype.open;

        XMLHttpRequest.prototype.open = function(method, url, ...rest)
        {
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

/* Register PWA offline service worker for reliable offline caching */
function registerPwaWorker()
{
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('pwaworker.js').then(reg => {
                console.log('BrickCode PWA ServiceWorker active:', reg.scope);
            }).catch(err => {
                console.warn('BrickCode PWA ServiceWorker registration failed:', err);
            });
        });
    }
}

registerPwaWorker();

/* Community Russian translations for custom BrickCode dialogs and NXT blocks */
const RU_TRANSLATIONS = {
    // Bluetooth and transfer dialogs
    "First time here?": "Вы здесь впервые?",
    "You must have version 1.10E or above of the firmware": "На блоке EV3 должна быть установлена прошивка версии 1.10E или выше",
    "Check your firmware version here and update if needed": "Проверьте версию прошивки здесь и обновите при необходимости",
    "File Transfer": "Передача файлов",
    "This is the standard way to transfer a program to your EV3. Download the program as a file and transfer it to the EV3 manually.": "Стандартный способ загрузки программы на EV3. Скачайте файл программы и вручную скопируйте его на диск EV3.",
    "Bluetooth": "Bluetooth",
    "Upload the program directly to your EV3 over a Bluetooth connection using Web Serial.": "Прямая загрузка программы на EV3 по Bluetooth через Web Serial.",
    "Note": "Примечание",
    "To change the upload method, click the '...' button next to Download and select 'Upload method'.": "Чтобы изменить способ загрузки, нажмите кнопку '...' рядом с кнопкой «Скачать» и выберите «Способ загрузки».",
    "Download to your EV3": "Загрузка на EV3",
    "I got it": "Понятно",
    "Connect the EV3 to your computer with a USB cable": "Подключите EV3 к компьютеру с помощью USB-кабеля",
    "Use the miniUSB port on the top of the EV3 Brick": "Используйте порт miniUSB в верхней части модуля EV3",
    "Move the .uf2 file to the EV3 Brick": "Переместите файл .uf2 на модуль EV3",
    "Locate the downloaded .uf2 file and drag it to the EV3 USB drive": "Найдите скачанный файл .uf2 и скопируйте его на USB-диск EV3",
    "Don't show this again": "Больше не показывать",
    "Done": "Готово",
    "Download Again": "Скачать снова",
    "Download as File": "Скачать как файл",
    "Upload method": "Способ загрузки",
    "Bluetooth pairing": "Сопряжение по Bluetooth",
    "Bluetooth download uses Web Serial. Your browser will ask you to select a serial port.": "Загрузка по Bluetooth использует Web Serial. Браузер попросит вас выбрать последовательный порт.",
    "Before continuing, make sure your EV3 is turned on and already paired with your computer. Close other applications that may be using the EV3 Bluetooth connection, such as 'EV3 Lab', 'EV3 Classroom', other BrickCode (MakeCode) editor tabs, or other applications using the EV3 Bluetooth serial connection.": "Перед продолжением убедитесь, что модуль EV3 включен и сопряжён с компьютером. Закройте другие программы, использующие Bluetooth-подключение EV3 (например, 'EV3 Lab', 'EV3 Classroom', другие вкладки редактора BrickCode).",
    "If 'Port View' is open on the EV3, close it before downloading. The program may download successfully, but it will not start.": "Если на модуле EV3 открыт режим «Просмотр порта» (Port View), закройте его перед загрузкой. Иначе программа загрузится, но не запустится.",
    "When the browser asks you to select a serial port, select the port with the name of your EV3. This is the name you set on your EV3 controller.": "Когда браузер предложит выбрать порт, выберите устройство с именем вашего EV3 (имя, указанное в настройках блока).",
    "On some Windows computers, the browser may not display your EV3 by name. The exact cause of this issue has not yet been determined. In this case, select the outgoing Bluetooth COM port assigned to your EV3. You can check the Bluetooth settings and open the COM Ports tab to identify the ports assigned to your EV3.": "На некоторых компьютерах с Windows браузер может не отображать имя EV3. В этом случае выберите исходящий COM-порт Bluetooth, назначенный вашему EV3 (его можно узнать в параметрах Bluetooth на вкладке «COM-порты»).",
    "Do not select unrelated COM ports, USB devices, or serial ports belonging to other hardware. If the EV3 does not respond after selecting a port, try selecting a different Bluetooth serial port.": "Не выбирайте сторонние COM-порты или USB-устройства. Если EV3 не отвечает после выбора порта, попробуйте выбрать другой Bluetooth COM-порт.",
    "Could not connect to EV3": "Не удалось подключиться к EV3",
    "The selected serial port did not respond as an EV3 device.": "Выбранный последовательный порт не отвечает как устройство EV3.",
    "Make sure your EV3 is turned on and paired with your computer, then select the correct Bluetooth serial port and try again.": "Убедитесь, что модуль EV3 включен и сопряжён с компьютером, затем выберите правильный Bluetooth COM-порт и повторите попытку.",
    "Bluetooth connection stuck": "Bluetooth-соединение зависло",
    "The Bluetooth connection could not be established.": "Не удалось установить соединение по Bluetooth.",
    "This can happen if a previous Bluetooth connection is still active or if the Bluetooth connection is temporarily unavailable.": "Это может произойти, если предыдущее соединение всё ещё активно или Bluetooth временно недоступен.",
    "If other robotics software (such as EV3 Classroom or EV3 Lab) is open, close it to release the port.": "Если открыты другие программы (например, EV3 Classroom или EV3 Lab), закройте их для освобождения порта.",
    "Stop the program on the EV3 and try again. If the problem persists, turn Bluetooth off and on again, then try again.": "Остановите выполнение программы на EV3 и повторите попытку. Если проблема сохраняется, выключите и снова включите Bluetooth на блоке EV3.",
    
    // NXT Touch Sensor blocks
    "on **nxt touch sensor** %this|%event": "при **датчик касания nxt** %this|%event",
    "pause until **nxt touch sensor** %this|%event": "ждать пока **датчик касания nxt** %this|%event",
    "**nxt touch sensor** %this|is pressed": "**датчик касания nxt** %this|нажат",
    "**nxt touch sensor** %this|was pressed": "**датчик касания nxt** %this|был нажат",
    "Run some code when the NXT touch sensor is pressed, released, or bumped.": "Выполнить код, когда датчик касания NXT нажат, отпущен или кликнут.",
    "Wait until the NXT touch sensor is touched.": "Ждать, пока датчик касания NXT не будет нажат.",
    "Check if the NXT touch sensor is currently pressed.": "Проверить, нажат ли датчик касания NXT в данный момент.",
    "Check if NXT touch sensor is touched since it was last checked.": "Проверить, нажимался ли датчик касания NXT с момента последней проверки.",

    // NXT Light Sensor blocks
    "on **nxt light sensor** %this|%event": "при **датчик света nxt** %this|%event",
    "pause until **nxt light sensor** %this|%event": "ждать пока **датчик света nxt** %this|%event",
    "**nxt light sensor** %this|light level": "**датчик света nxt** %this|уровень освещённости",
    "**nxt light sensor** %this|reflected light": "**датчик света nxt** %this|отражённый свет",
    "**nxt light sensor** %this|ambient light": "**датчик света nxt** %this|внешнее освещение",

    // NXT Sound Sensor blocks
    "**nxt sound sensor** %this|sound level": "**датчик звука nxt** %this|уровень звука",
    "on **nxt sound sensor** %this|%event": "при **датчик звука nxt** %this|%event",
    "pause until **nxt sound sensor** %this|%event": "ждать пока **датчик звука nxt** %this|%event"
};

function installCommunityTranslations()
{
    function applyTranslations()
    {
        const isRu = (window.pxt && window.pxt.Util && window.pxt.Util.userLanguage && window.pxt.Util.userLanguage() === "ru")
            || (document.documentElement.lang && document.documentElement.lang.startsWith("ru"));

        if (!isRu || !window.pxt || !window.pxt.Util) return;

        const pxtUtil = window.pxt.Util;
        if (pxtUtil.getLocalizedStrings) {
            const current = pxtUtil.getLocalizedStrings() || {};
            Object.assign(current, RU_TRANSLATIONS);
            if (pxtUtil.setLocalizedStrings) {
                pxtUtil.setLocalizedStrings(current);
            }
        }

        if (pxtUtil._localize && !pxtUtil._communityPatched) {
            const originalLocalize = pxtUtil._localize;
            pxtUtil._localize = function(s) {
                if (RU_TRANSLATIONS[s]) {
                    return RU_TRANSLATIONS[s];
                }
                return originalLocalize.call(this, s);
            };
            pxtUtil._communityPatched = true;
        }
    }

    if (window.pxt && window.pxt.Util) {
        applyTranslations();
    } else {
        window.addEventListener('DOMContentLoaded', applyTranslations);
        const timer = setInterval(() => {
            if (window.pxt && window.pxt.Util) {
                applyTranslations();
                clearInterval(timer);
            }
        }, 200);
        setTimeout(() => clearInterval(timer), 5000);
    }
}

installCommunityTranslations();
