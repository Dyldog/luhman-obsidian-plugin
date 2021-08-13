import './styles/styles.css';

import { Plugin, TFile, App, Vault, Workspace, Modal, MarkdownView, EditorPosition } from 'obsidian';

const regex = /^([0-9]+)(?:-([a-z]+)-([0-9]+)?)?\.md$/;
const lettersIDComponentSuccessors: Record<string, string> = {
    'a': 'b',
    'b': 'c', 
    'c': 'd', 
    'd': 'e', 
    'e': 'f', 
    'f': 'g', 
    'g': 'h', 
    'h': 'i', 
    'i': 'j', 
    'j': 'k', 
    'k': 'l', 
    'l': 'm', 
    'm': 'n', 
    'n': 'o', 
    'o': 'p', 
    'p': 'q', 
    'q': 'r', 
    'r': 's', 
    's': 't', 
    't': 'u', 
    'u': 'v', 
    'v': 'w', 
    'w': 'x', 
    'x': 'y', 
    'y': 'z', 
    'z': 'aa' 
};

export default class NewZettel extends Plugin {

    copyToClipboard(data: string): void {
        const listener = (e: ClipboardEvent) => {
            e.clipboardData?.setData('text/plain', data);
            e.preventDefault();
            document.removeEventListener('copy', listener);
        };
        document.addEventListener('copy', listener);
        document.execCommand('copy');
    }
    
    incrementStringIDComponent(id: string): string {
        let comps = id.split("")
        let last = comps.pop()!
        return comps.concat([lettersIDComponentSuccessors[last]]).join("")
    }

    incrementNumberIDComponent(id: string): string {
        return (parseInt(id) + 1).toString()
    }

    isNumber(string: string): boolean {
        return /^\d+$/.test(string)
    }
    incrementIDComponent(id: string): string {
        if (this.isNumber(id)) {
            return this.incrementNumberIDComponent(id)
        } else {
            return this.incrementStringIDComponent(id)
        }
    }

    incrementID(id: string): string {
        var parts = id.match(/([0-9]+|[a-z]+)/g)!
        var lastPart = parts.pop()!
        return parts.concat([this.incrementIDComponent(lastPart)]).join("")
    }

    nextComponentOf(id: string): string {
        var parts = id.match(/([0-9]+|[a-z]+)/g)!
        var lastPart = parts.pop()!
        if (this.isNumber(lastPart)) { 
            return "a"
        } else {
            return "1"
        }
    }
    firstChildOf(parentID: string): string {
        return parentID + this.nextComponentOf(parentID)
    }

    idExists(id: string): boolean {
        return this.app.vault.getMarkdownFiles().filter(function (file) { return file.basename == id }).length != 0
    }

    firstAvailableID(startingID: string): string {
        var nextID = startingID
        while(this.idExists(nextID)) { nextID = this.incrementID(nextID) }
        return nextID
    }

    makeNoteForNextSiblingOf(sibling: TFile, title: string): string {
        var nextID = this.firstAvailableID(this.incrementID(sibling.basename))
        let nextPath = this.app.fileManager.getNewFileParent(sibling.path).path + "/" + nextID + ".md"
        this.makeNote(nextPath, title)

        return nextID
    }

    makeNoteForNextChildOf(parent: TFile, title: string): string {
        var childID = this.firstAvailableID(this.firstChildOf(parent.basename))
        let nextPath = this.app.fileManager.getNewFileParent(parent.path).path + "/" + childID + ".md"
        this.makeNote(nextPath, title)
        return childID
    }

    makeNote(path: string, title: string) {
        let app = this.app
        this.app.vault.create(path, "# " + title + "\n\n").then (function (file) {
            app.workspace.activeLeaf?.openFile(file).then (function (file) {
                app.workspace.getActiveViewOfType(MarkdownView)?.editor.exec('goEnd')
            })
        })
    }

    isZettelFile(name: string): boolean {
        return /^((?:[0-9]+|[a-z]+)+)\.md$/.exec(name) != null
    }

    makeNoteFunction(idGenerator: ((file: TFile, title: string) => string), title: string) {
        var file = this.app.workspace.getActiveFile()
        if (file == null) { return }
        if (this.isZettelFile(file.name)) {
            let nextID = idGenerator.bind(this, file, title)()
            this.copyToClipboard("[[" + nextID + "]]")
        }
    }

    async onload() {
        console.log('loading New Zettel');
        // this.app.workspace.onLayoutReady(this.initialize);

        this.addCommand({
			id: 'new-sibling-note',
			name: 'New Sibling Zettel Note',
			callback: () => {
                new NewZettelModal(this.app, (title: string) => {
                    this.makeNoteFunction(this.makeNoteForNextSiblingOf, title)
                }).open()
			}
		});

        this.addCommand({
			id: 'new-child-note',
			name: 'New Child Zettel Note',
			callback: () => {
                new NewZettelModal(this.app, (title: string) => {
                    this.makeNoteFunction(this.makeNoteForNextChildOf, title)
                }).open()
			}
		});

        this.addCommand({
			id: 'zetel-test',
			name: 'Zettel Test',
			callback: () => {
                // let completion = (te)
				// new NewZettelModal(this.app).open();
			}
		});
    }

    onunload() {
        console.log('unloading New Zettel');
        // this.initialize(true);
    }
}

class NewZettelModal extends Modal {
    public completion: (text: string) => void
	constructor(app: App, completion: ((title: string) => void)) {
		super(app);
        this.completion = completion
	}

	onOpen() {
        let {contentEl} = this;
        contentEl.parentElement!.addClass("zettel-modal");
        this.titleEl.setText("New zettel title...");
        
        let container = contentEl.createEl("div")
        container.addClass("zettel-modal-container");
        
        let textBox = contentEl.createEl("input", { "type":"text" });
        textBox.addClass("zettel-modal-textbox")
        textBox.id = "zettel-modal-textbox"
        textBox.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                event.preventDefault()
                this.goTapped()
            }
        });
        container.append(textBox)
        
        let button = contentEl.createEl("input", { "type": "button", "value": "GO" })
        button.addClass("zettel-modal-button")
        button.addEventListener("click", (e:Event) => this.goTapped());
        container.append(button)
        
        contentEl.append(container)

        window.setTimeout(function () {
            textBox.focus();
        }, 0);
    }

    goTapped() {
        let title = (<HTMLInputElement>this.contentEl.ownerDocument.getElementById("zettel-modal-textbox")).value
        this.completion(title)
        this.close()
    }
    
}