import './styles/patch.css';

import {
    rootHiddenClass,
    showAllNumbersClass,
    withSubfolderClass,
} from 'misc';
import { FileExplorer, Plugin, TFile } from 'obsidian';
import { VaultHandler } from 'vault-handler';

import { setupTitle } from './folder-title';
import { DEFAULT_SETTINGS, FENoteCountSettingTab } from './settings';

export default class FileExplorerNoteCount extends Plugin {
    settings = DEFAULT_SETTINGS;

    fileExplorer?: FileExplorer;

    vaultHandler = new VaultHandler(this);

    /** compatible with theme that hide root folder */
    doHiddenRoot = (revert = false) => {
        if (!this.fileExplorer) {
            console.error('file-explorer not found');
            return;
        }
        const root = this.fileExplorer.fileItems['/'];
        const styles = getComputedStyle(root.titleInnerEl);
        const setup = () => {
            const shouldHide =
                styles.display === 'none' ||
                styles.color === 'rgba(0, 0, 0, 0)';
            root.titleEl.toggleClass(rootHiddenClass, !revert && shouldHide);
        };
        if (styles.display !== '') setup();
        else {
            let count = 0;
            const doId = window.setInterval(() => {
                if (count > 10) {
                    console.error('%o styles empty', root.titleInnerEl);
                    window.clearInterval(doId);
                } else if (styles.display === '') {
                    count++;
                } else {
                    setup();
                    window.clearInterval(doId);
                }
            }, 100);
        }
    };

    initialize = (revert = false) => {
        const leaves = this.app.workspace.getLeavesOfType('file-explorer');
        if (leaves.length > 1) console.error('more then one file-explorer');
        else if (leaves.length < 1) console.error('file-explorer not found');
        else {
            if (!this.fileExplorer)
                this.fileExplorer = leaves[0].view as FileExplorer;
            setupTitle(this, this.vaultHandler.vault, revert);

            // this.doHiddenRoot(revert);
            if (!revert) {
                // this.registerEvent(
                //     this.app.workspace.on('css-change', this.doHiddenRoot),
                // );
                this.vaultHandler.registerVaultEvent();
                if (this.settings.showAllNumbers)
                    document.body.addClass('oz-show-all-num');
            } else {
                for (const el of document.getElementsByClassName(
                    withSubfolderClass,
                )) {
                    el.removeClass(withSubfolderClass);
                }
                document.body.removeClass(showAllNumbersClass);
            }
        }
    };

    async onload() {
        console.log('loading FileExplorerNoteTitle');
        this.app.workspace.onLayoutReady(this.initialize);
    }

    onunload() {
        console.log('unloading FileExplorerNoteTitle');
        this.initialize(true);
    }

    reloadTitle() {
        setupTitle(this, this.vaultHandler.vault);
    }
}
