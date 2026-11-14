/// <reference path="../node_modules/pxt-core/localtypings/pxtarget.d.ts" />
/// <reference path="../node_modules/pxt-core/built/pxtcompiler.d.ts" />
/// <reference path="../node_modules/pxt-core/built/pxtlib.d.ts" />
/// <reference path="../node_modules/pxt-core/localtypings/pxteditor.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>

import { deployCoreAsync, isDeployTransportSelected, resetDeployTransport } from "./deploy";
import { 
    setConfirmAsync, 
    resetFileTransferDialog, 
    resetBluetoothPairingDialog, 
    resetUsbPairingDialog,
    showDownloadDialogAsync, 
    showFileTransferDialogAsync
} from "./dialogs";


export let projectView: pxt.editor.IProjectView;

let projectPxtJson: JSON;

async function loadProjectPxtJson(view: any): Promise<boolean> {
    const mainEditor: any = view.editor || view.blocksEditor;
    if (mainEditor?.currFile?.epkg?.files?.["pxt.json"]) {
        projectPxtJson = JSON.parse(mainEditor.currFile.epkg.files["pxt.json"].content);
        
        return true;
    }

    return false;
}

async function getDownloadFileName(): Promise<string> {
    const pxtJson = await (window as any).getPxtJson();
    const projectName = pxtJson?.name || "Untitled";

    const filter = pxt.appTarget.appTheme.fileNameExclusiveFilter;

    if (filter && new RegExp(filter).test(projectName)) return "Untitled";

    return projectName;
}

pxt.editor.initExtensionsAsync = function (opts: pxt.editor.ExtensionOptions): Promise<pxt.editor.ExtensionResult> {
    pxt.debug('loading pxt-ev3 target extensions...')
    projectView = opts.projectView;
    
    loadProjectPxtJson(projectView).catch(console.error);

    const res: pxt.editor.ExtensionResult = {
        deployAsync: deployCoreAsync,
        initAsync: async ({ confirmAsync }) => {
            setConfirmAsync(confirmAsync);
        },
        onDownloadButtonClick: async () => {
            if (isDeployTransportSelected()) return projectView.compile();

            await showDownloadDialogAsync(await getDownloadFileName());
        },
        showUploadInstructionsAsync: (fn, url, confirmAsync) => {
            return showFileTransferDialogAsync(fn, url, confirmAsync);
        },
        getDownloadMenuItems: () => [
            /*
            {
                text: lf("Download as File"),
                icon: "download",
                className: "file-download",
                onClick: () => {
                    pxt.tickEvent("upload.fileTransfer");
                    setUseFileTransfer();
                    return projectView.compile();
                }
            },
            */
            isDeployTransportSelected() && {
                text: lf("Upload method"),
                icon: "exchange",
                className: "upload-method",
                onClick: async () => {
                    resetDeployTransport();
                    resetFileTransferDialog();
                    resetBluetoothPairingDialog();
                    resetUsbPairingDialog();

                    return showDownloadDialogAsync(await getDownloadFileName());
                }
            },
            {
                text: lf("Help"),
                icon: "help",
                className: "upload-help",
                onClick: () => {
                    window.open("/troubleshoot", "_blank");
                }
            }
        ].filter(Boolean)
    };

    return Promise.resolve<pxt.editor.ExtensionResult>(res);
};

// Expose helpers for retrieving the latest project pxt.json from the editor.
// The project configuration is cached in projectPxtJson and must be reloaded before it is returned.
(window as any).reloadProjectPxtJson = async () => await loadProjectPxtJson(projectView);
(window as any).getPxtJson = async (): Promise<any> => {
    await (window as any).reloadProjectPxtJson();

    return projectPxtJson;
};