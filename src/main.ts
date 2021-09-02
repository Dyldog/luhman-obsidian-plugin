import './styles/styles.css';

import { Plugin, TFile, App, Vault, Workspace, Modal, MarkdownView, EditorPosition, SuggestModal } from 'obsidian';
import { resolve } from 'path';

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

    parentID(id: string): string {
        var parts = id.match(/([0-9]+|[a-z]+)/g)!
        if (parts) {
            parts.pop()
            return parts.join("")
        } else {
            return ""
        }

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

    makeNoteForNextSiblingOf(sibling: TFile): string {
        var nextID = this.firstAvailableID(this.incrementID(sibling.basename))
        let nextPath = this.app.fileManager.getNewFileParent(sibling.path).path + "/" + nextID + ".md"
        return nextID
    }

    makeNoteForNextChildOf(parent: TFile): string {
        var childID = this.firstAvailableID(this.firstChildOf(parent.basename))
        let nextPath = this.app.fileManager.getNewFileParent(parent.path).path + "/" + childID + ".md"
        return childID
    }

    async makeNote(path: string, title: string, content: string, placeCursorAtStartOfContent: boolean) {
        let app = this.app
        let titleContent = "# " + title + "\n\n"
        let fullContent = titleContent + content
        let file = await this.app.vault.create(path,  fullContent)
        let active = app.workspace.getLeaf()
        if (active == null) { return }
        
        await active.openFile(file)

        let editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor
        if (editor == null) { return }

        if (placeCursorAtStartOfContent) {
            let position: EditorPosition = { line: 2, ch: 0 }
            editor.setCursor(position)
        } else {
            editor.exec('goEnd')
        }
    }

    isZettelFile(name: string): boolean {
        return /^((?:[0-9]+|[a-z]+)+)\.md$/.exec(name) != null
    }

    makeNoteFunction(idGenerator: ((file: TFile) => string)) {
        var file = this.app.workspace.getActiveFile()
        if (file == null) { return }
        if (this.isZettelFile(file.name)) {
            let fileID = file.basename
            let fileLink = "[[" + fileID + "]]"
            
            let editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
            if (editor == null) { return }

            let selection = editor.getSelection()
            
            let nextID = idGenerator.bind(this, file)()
            let nextPath = this.app.fileManager.getNewFileParent(file.path).path + "/" + nextID + ".md"
            let newLink = "[[" + nextID + "]]"

            if (selection) {
                let title =  selection.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
                let selectionPos = editor!.listSelections()[0]
                let positionCH = Math.max(selectionPos.head.ch, selectionPos.anchor.ch)
                let position: EditorPosition = { line: selectionPos.anchor.line, ch: positionCH + 1 }
                editor!.replaceRange(" " + newLink, position, position)
                this.makeNote(nextPath, title, fileLink, true)
            } else {
                new NewZettelModal(this.app, (title: string) => {
                    this.insertTextIntoCurrentNote(newLink)
                    this.makeNote(nextPath, title, fileLink, true)
                }).open()
            }
        }
    }

    async renameZettel(id: string, toName: string) {
        let zettel = this.app.vault.getMarkdownFiles().filter((file) => file.basename == id).first()
        if (zettel) {
            this.app.fileManager.renameFile(zettel, zettel.parent.path + toName + "." + zettel.extension)
        }
    }

    async moveChildrenDown(id: string) {
        let children = this.getDirectChildZettels(id)
        for (const child of children) {
            await this.moveZettelDown(child.basename)
        }
    }

    async moveZettelDown(id: string) {
        this.moveChildrenDown(id)
        await this.renameZettel(id, this.firstAvailableID(id))
    }

    async outdentZettel(id: string) {
        let newID = this.incrementID(this.parentID(id))
        if (this.idExists(newID)) {
            await this.moveZettelDown(id)
        }

        for (const child of this.getDirectChildZettels(id)) {
            let newChildID: string = this.firstAvailableID(this.firstChildOf(newID))
            await this.renameZettel(child.basename, newChildID)
        }

        await this.renameZettel(id, newID)
    }

    async onload() {
        console.log('loading New Zettel');
        // this.app.workspace.onLayoutReady(this.initialize);

        this.addCommand({
			id: 'new-sibling-note',
			name: 'New Sibling Zettel Note',
			callback: () => {
                this.makeNoteFunction(this.makeNoteForNextSiblingOf)
			}
		});

        this.addCommand({
			id: 'new-child-note',
			name: 'New Child Zettel Note',
			callback: () => {
                this.makeNoteFunction(this.makeNoteForNextChildOf)
			}
		});

        this.addCommand({
			id: 'insert-zettel-link',
			name: 'Insert Zettel Link',
			callback: async () => {
                // let completion = (te)
                let titles = await this.getAllNoteTitles()
                new ZettelSuggester(this.app, titles, this.currentlySelectedText(), (file) => {
                    this.insertTextIntoCurrentNote("[[" + file.basename + "]]")
                }).open();
			}
		});

        this.addCommand({
			id: 'open-zettel',
			name: 'Open Zettel',
			callback: async () => {
                let titles =  await this.getAllNoteTitles()

                new ZettelSuggester(this.app, titles, this.currentlySelectedText(), (file) => {
                    this.app.workspace.getUnpinnedLeaf().openFile(file)
                }).open();
			}
		});

        this.addCommand({
			id: 'open-parent-zettel',
			name: 'Open Parent Zettel',
			callback: () => {
                let file = this.currentFile()
                if (file) {
                    this.openZettel(this.parentID(file.basename))
                }
			}
		});

        this.addCommand({
			id: 'outdent-zettel',
			name: 'Outdent Zettel',
			callback: () => {
                let file = this.currentFile()
                if (file) {
                    this.outdentZettel(file.basename)
                }
			}
		});
    }

    onunload() {
        console.log('unloading New Zettel');
        // this.initialize(true);
    }

    currentFile(): TFile | undefined {
        return this.app.workspace.getActiveViewOfType(MarkdownView)?.file
    }

    openZettel(id: string) {
        let file = this.app.vault.getMarkdownFiles().filter((file) => file.basename == id).first()
        if (file) {
            this.app.workspace.getUnpinnedLeaf().openFile(file)
        }
    }

    currentlySelectedText(): string | undefined {
        return this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.getSelection()
    }

    insertTextIntoCurrentNote(text: string) {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView)

        if (view) {
            let editor = view!.editor
        
            let position: EditorPosition
            var prefix: string = ""

            if (editor.getSelection()) {
                let selectionPos = editor.listSelections()[0]
                let positionCH = Math.max(selectionPos.head.ch, selectionPos.anchor.ch)
                position = { line: selectionPos.anchor.line, ch: positionCH + 1 }
                prefix = " "
            } else {
                position = editor.getCursor()
                
            }

            editor.replaceRange(" " + text, position, position)
        }
    }

    getZettels(): TFile[] {
        return this.app.vault.getMarkdownFiles().filter((file) => {
            const ignore = /^[_layouts|templates|scripts]/
            return file.path.match(ignore) == null
        })
    }

    getDirectChildZettels(ofParent: string): TFile[] {
        return this.getZettels().filter((file) => { return this.parentID(file.basename) == ofParent })
    }

    async getAllNoteTitles(): Promise<Map<string, TFile>> {
        const regex = /# (.+)\s*/;

        let titles: Map<string, TFile> = new Map()
        for (const file of this.getZettels()) {
            let text = await this.app.vault.cachedRead(file)
            
            let match = text.match(regex)
            if (match) {
                titles.set(match[1], file)
            }
        }

        return titles
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

class ZettelSuggester extends SuggestModal<string> {
    private titles: Map<string, TFile>
    private completion: (file: TFile) => void
    private initialQuery: string
	constructor(app: App, titles: Map<string, TFile>, search: string | undefined, completion: (file: TFile) => void) {
		super(app);
        this.initialQuery = search ?? ""
        this.titles = titles
        this.completion = completion
	}

    onOpen() {
        super.onOpen()
        this.inputEl.value = this.initialQuery
        var event = new Event('input');
        this.inputEl.dispatchEvent(event);
    }

    getSuggestions(query: string): string[] {
        let sanitisedQuery = query.toLowerCase().replace(" ", "")
        return Array.from(this.titles.keys()).filter((title) => { 
            let sanitisedTitle = title.toLowerCase().replace(" ", "")
            return sanitisedTitle.contains(sanitisedQuery)
        })
    }
    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value)
    }
    onChooseSuggestion(item: string, evt: KeyboardEvent | MouseEvent) {
        this.completion(this.titles.get(item)!)
    }

}