import {
  App,
  EditorPosition,
  FuzzyMatch,
  FuzzySuggestModal,
  MarkdownView,
  Modal,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Notice,
} from "obsidian";
import "./styles/styles.css";

const idOnlyRegex = /([0-9]+|[a-z]+)/g;
const checkSettingsMessage = 'Try checking the settings if this seems wrong.'

const lettersIDComponentSuccessors: Record<string, string> = {
  a: "b",
  b: "c",
  c: "d",
  d: "e",
  e: "f",
  f: "g",
  g: "h",
  h: "i",
  i: "j",
  j: "k",
  k: "l",
  l: "m",
  m: "n",
  n: "o",
  o: "p",
  p: "q",
  q: "r",
  r: "s",
  s: "t",
  t: "u",
  u: "v",
  v: "w",
  w: "x",
  x: "y",
  y: "z",
  z: "aa",
};

interface LuhmanSettings {
  matchRule: string;
  separator: string;
  addTitle: boolean;
}

const DEFAULT_SETTINGS: LuhmanSettings = {
  matchRule: 'strict',
  addTitle: false,
  separator: '⁝ '
}

class LuhmanSettingTab extends PluginSettingTab {
  plugin: NewZettel;

  constructor(app: App, plugin: NewZettel) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let {containerEl} = this;
    const {matchRule, separator, addTitle} = this.plugin.settings;
    containerEl.empty();
    containerEl.createEl('p', {text: 'The ID is a block of letters and numbers at the beginning of the filename'});

    new Setting(containerEl)
      .setName('ID matching rule')
      .setDesc(
'Strict means filenames consist of only an ID. ' +
'Separator means the ID must be followed by the separator. ' +
'Fuzzy treats the first non-alphanumeric character as the end of the ID.')
      .addDropdown(setting => setting
        .addOption('strict', 'Strict')
        .addOption('separator', 'Separator')
        .addOption('fuzzy', 'Fuzzy')
        .setValue(matchRule)
        .onChange(async (value) => {
          this.plugin.settings.matchRule = value;
          await this.plugin.saveSettings()
          this.display()
        }));

    if (matchRule !== 'strict'){
      new Setting(containerEl)
        .setName('Add titles automatically')
        .setDesc('Add the separator and the title of the note when creating filenames')
        .setDisabled(matchRule !== 'strict')
        .addToggle(setting => setting
          .setValue(addTitle)
          .onChange(async (value) => {
            this.plugin.settings.addTitle = value;
            await this.plugin.saveSettings()
            this.display()
          }));
    }

    const useSeparator =
      matchRule !== 'strict' &&
      (addTitle || matchRule === 'separator')

    if (useSeparator) {
      new Setting(containerEl)
        .setName('ID Separator')
        .setDesc('Used between id and title, include whitespace padding if needed')
        .setDisabled(useSeparator)
        .addText(text => text
          .setPlaceholder('Enter your separator')
          .setValue(separator)
          .onChange(async (value) => {
            this.plugin.settings.separator = value;
            await this.plugin.saveSettings();
          }));
    }     
  }
}

export default class NewZettel extends Plugin {
  settings: LuhmanSettings = DEFAULT_SETTINGS;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  incrementStringIDComponent(id: string): string {
    let comps = id.split("");
    let last = comps.pop()!;
    return comps.concat([lettersIDComponentSuccessors[last]]).join("");
  }

  incrementNumberIDComponent(id: string): string {
    return (parseInt(id) + 1).toString();
  }

  isNumber(string: string): boolean {
    return /^\d+$/.test(string);
  }

  incrementIDComponent(id: string): string {
    if (this.isNumber(id)) {
      return this.incrementNumberIDComponent(id);
    } else {
      return this.incrementStringIDComponent(id);
    }
  }

  incrementID(id: string): string {
    var parts = id.match(idOnlyRegex)!;
    var lastPart = parts.pop()!;
    return parts.concat([this.incrementIDComponent(lastPart)]).join("");
  }

  parentID(id: string): string {
    var parts = id.match(idOnlyRegex)!;
    if (parts) {
      parts.pop();
      return parts.join("");
    } else {
      return "";
    }
  }

  nextComponentOf(id: string): string {
    const parts = id.match(idOnlyRegex)!;
    const lastPart = parts.pop()!;
    if (this.isNumber(lastPart)) {
      return "a";
    } else {
      return "1";
    }
  }

  firstChildOf(parentID: string): string {
    return parentID + this.nextComponentOf(parentID);
  }

  fileToId(filename: string): string {  
    const ruleRegexes: Record<string, RegExp> = {
      strict: /^((?:[0-9]+|[a-z]+)+)$/,
      separator: new RegExp(
        `^((?:[0-9]+|[a-z]+)+)${this.settings.separator}.*`
      ),
      fuzzy: /^((?:[0-9]+|[a-z]+)+).*/
    }
    const match = filename.match(ruleRegexes[this.settings.matchRule]);
    if (match) {
      return match[1]
    }
    return '';
  }

  idExists(id: string): boolean {
    const fileMatcher = (file: TFile) => this.fileToId(file.basename) === id;
    return (
      this.app.vault.getMarkdownFiles().filter(fileMatcher).length != 0
    );
  }

  firstAvailableID(startingID: string): string {
    var nextID = startingID;
    while (this.idExists(nextID)) {
      nextID = this.incrementID(nextID);
    }
    return nextID;
  }

  makeNoteForNextSiblingOf(sibling: TFile): string {
    var nextID = this.firstAvailableID(this.incrementID(this.fileToId(sibling.basename)));
    return nextID;
  }

  makeNoteForNextChildOf(parent: TFile): string {
    var childID = this.firstAvailableID(this.firstChildOf(this.fileToId(parent.basename)));
    return childID;
  }

  async makeNote(
    path: string,
    title: string,
    content: string,
    placeCursorAtStartOfContent: boolean
  ) {
    let app = this.app;
    let titleContent = "# " + title + "\n\n";
    let fullContent = titleContent + content;
    let file = await this.app.vault.create(path, fullContent);
    let active = app.workspace.getLeaf();
    if (active == null) {
      return;
    }

    await active.openFile(file);

    let editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (editor == null) {
      return;
    }

    if (placeCursorAtStartOfContent) {
      let position: EditorPosition = { line: 2, ch: 0 };
      editor.setCursor(position);
    } else {
      editor.exec("goEnd");
    }
  }

  isZettelFile(name: string): boolean {
    const mdRegex = /.*\.md$/
    return mdRegex.exec(name) != null && this.fileToId(name) !== '';
  }

  makeNoteFunction(idGenerator: (file: TFile) => string) {
    var file = this.app.workspace.getActiveFile();
    if (file == null) {
      return;
    }
    if (this.isZettelFile(file.name)) {
      let fileID = this.fileToId(file.basename);
      let fileLink = "[[" + file.basename + "]]";

      let editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (editor == null) {
        return;
      }

      let selection = editor.getSelection();

      let nextID = idGenerator.bind(this, file)();
      let nextPath = (title: string) =>
        file?.path
          ? this.app.fileManager.getNewFileParent(file.path).path +
              "/" +
              nextID +
              (this.settings.addTitle
                ? this.settings.separator + title
                : ''
              ) +
              ".md"
          : '';
      let newLink = "[[" + nextID + "]]";

      if (selection) {
        let title = selection
          .split(/\s+/)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        let selectionPos = editor!.listSelections()[0];
        let positionCH = Math.max(selectionPos.head.ch, selectionPos.anchor.ch);
        let position: EditorPosition = {
          line: selectionPos.anchor.line,
          ch: positionCH + 1,
        };
        editor!.replaceRange(" " + newLink, position, position);
        this.makeNote(nextPath(title), title, fileLink, true);
      } else {
        new NewZettelModal(this.app, (title: string) => {
          this.insertTextIntoCurrentNote(newLink);
          this.makeNote(nextPath(title), title, fileLink, true);
        }).open();
      }
    } else {
      new Notice(`Couldn't find ID in "${file.basename}". ${checkSettingsMessage}`)
    }
  }

  async renameZettel(id: string, toId: string) {
    const sep = this.settings.separator;
    const zettel = this.app.vault
      .getMarkdownFiles()
      .filter(file => this.fileToId(file.basename) === id)
      .first();
    if (zettel) {
      const id = this.fileToId(zettel.basename);
      const rest = zettel.basename.split(id)[1]
      this.app.fileManager.renameFile(
        zettel,
        zettel.parent.path + toId + rest + '.' + zettel.extension
      );
    } else {
      new Notice(`Couldn't find file for ID ${id}. ${checkSettingsMessage}`)
    }
  }

  async moveChildrenDown(id: string) {
    let children = this.getDirectChildZettels(id);
    for (const child of children) {
      await this.moveZettelDown(this.fileToId(child.basename));
    }
  }

  async moveZettelDown(id: string) {
    this.moveChildrenDown(id);
    await this.renameZettel(id, this.firstAvailableID(id));
  }

  async outdentZettel(id: string) {
    let newID = this.incrementID(this.parentID(id));
    if (this.idExists(newID)) {
      await this.moveZettelDown(newID);
    }

    for (const child of this.getDirectChildZettels(id)) {
      let newChildID: string = this.firstAvailableID(this.firstChildOf(newID));
      await this.renameZettel(this.fileToId(child.basename), newChildID);
    }

    await this.renameZettel(id, newID);
  }

  async onload() {
    console.log("loading New Zettel");
    this.loadSettings()
    this.addSettingTab(new LuhmanSettingTab(this.app, this));
    // this.app.workspace.onLayoutReady(this.initialize);

    this.addCommand({
      id: "new-sibling-note",
      name: "New Sibling Zettel Note",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextSiblingOf);
      },
    });

    this.addCommand({
      id: "new-child-note",
      name: "New Child Zettel Note",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextChildOf);
      },
    });

    this.addCommand({
      id: "insert-zettel-link",
      name: "Insert Zettel Link",
      callback: async () => {
        // let completion = (te)
        let titles = await this.getAllNoteTitles();
        new ZettelSuggester(
          this.app,
          titles,
          this.currentlySelectedText(),
          (file) => {
            this.insertTextIntoCurrentNote("[[" + file.basename + "]]");
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-zettel",
      name: "Open Zettel",
      callback: async () => {
        let titles = await this.getAllNoteTitles();

        new ZettelSuggester(
          this.app,
          titles,
          this.currentlySelectedText(),
          (file) => {
            this.app.workspace.getLeaf().openFile(file);
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-parent-zettel",
      name: "Open Parent Zettel",
      callback: () => {
        const file = this.currentFile();
        if (file) {
          const id = this.fileToId(file.basename);
          const parentId = this.parentID(id)
          if (parentId === '') {
            new Notice(`No parent found for "${file.basename}". ${checkSettingsMessage}`)
            return;
          }
          this.openZettel(parentId);
        } else {
          new Notice ('No file open')
        }
      },
    });

    this.addCommand({
      id: "outdent-zettel",
      name: "Outdent Zettel",
      callback: () => {
        let file = this.currentFile();
        if (file) {
          this.outdentZettel(this.fileToId(file.basename));
        }
      },
    });
  }

  onunload() {
    console.log("unloading New Zettel");
    // this.initialize(true);
  }

  currentFile(): TFile | undefined {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
  }

  openZettel(id: string) {
    let file = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.fileToId(file.basename) == id)
      .first();
    if (file) {
      this.app.workspace.getLeaf().openFile(file);
    }
  }

  currentlySelectedText(): string | undefined {
    return this.app.workspace
      .getActiveViewOfType(MarkdownView)
      ?.editor.getSelection();
  }

  insertTextIntoCurrentNote(text: string) {
    let view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (view) {
      let editor = view!.editor;

      let position: EditorPosition;
      var prefix: string = "";

      if (editor.getSelection()) {
        let selectionPos = editor.listSelections()[0];
        let positionCH = Math.max(selectionPos.head.ch, selectionPos.anchor.ch);
        position = { line: selectionPos.anchor.line, ch: positionCH + 1 };
        prefix = " ";
      } else {
        position = editor.getCursor();
      }

      editor.replaceRange(" " + text, position, position);
    }
  }

  getZettels(): TFile[] {
    const fileToId = (file: TFile) => this.fileToId(file.basename)
    return this.app.vault.getMarkdownFiles().filter(file => {
      const ignore = !file.path.match(/^[_layouts|templates|scripts]/);
      return ignore && fileToId(file) !== '';
    });
  }

  getDirectChildZettels(ofParent: string): TFile[] {
    return this.getZettels().filter((file) => {
      return this.parentID(this.fileToId(file.basename)) == ofParent;
    });
  }

  async getAllNoteTitles(): Promise<Map<string, TFile>> {
    const regex = /# (.+)\s*/;
    let titles: Map<string, TFile> = new Map();
    for (const file of this.getZettels()) {
      let text = await this.app.vault.cachedRead(file);
      let match = text.match(regex);
      if (match) {
        titles.set(match[1], file);
      }
    }

    return titles;
  }
}

class NewZettelModal extends Modal {
  public completion: (text: string) => void;
  private textBox: HTMLInputElement;

  constructor(app: App, completion: (title: string) => void) {
    super(app);
    this.completion = completion;

    let { contentEl } = this;
    contentEl.parentElement!.addClass("zettel-modal");
    this.titleEl.setText("New zettel title...");

    let container = contentEl.createEl("div", {
      cls: "zettel-modal-container",
    });
    this.textBox = contentEl.createEl("input", {
      type: "text",
      cls: "zettel-modal-textbox",
    });
    this.textBox.id = "zettel-modal-textbox";
    this.textBox.addEventListener("keydown", (event) => {
      if (event.key == "Enter") {
        event.preventDefault();
        this.goTapped();
      }
    });
    container.append(this.textBox);

    let button = contentEl.createEl("input", {
      type: "button",
      value: "GO",
      cls: "zettel-modal-button",
    });
    button.addEventListener("click", (e: Event) => this.goTapped());
    container.append(button);

    contentEl.append(container);
  }

  onOpen() {
    window.setTimeout(() => {
      this.textBox.focus();
    }, 0);
  }

  goTapped() {
    let title = this.textBox.value;
    this.completion(title);
    this.close();
  }
}

class ZettelSuggester extends FuzzySuggestModal<string> {
  private titles: Map<string, TFile>;
  private completion: (file: TFile) => void;
  private initialQuery: string;

  constructor(
    app: App,
    titles: Map<string, TFile>,
    search: string | undefined,
    completion: (file: TFile) => void
  ) {
    super(app);
    this.initialQuery = search ?? "";
    this.titles = titles;
    this.completion = completion;
    this.emptyStateText = "No zettels found";
    this.setPlaceholder("Search for a zettel...");
    console.log(this.initialQuery);
  }

  onOpen() {
    super.onOpen();
    this.inputEl.value = this.initialQuery;
    var event = new Event("input");
    this.inputEl.dispatchEvent(event);
  }

  getItems(): string[] {
    return Array.from(this.titles.keys()).sort();
  }

  getItemText(item: string): string {
    return item;
  }

  renderSuggestion(value: FuzzyMatch<string>, el: HTMLElement) {
    el.setText(value.item);

    let matches = value.match.matches;
    if (matches == null || matches.length == 0) {
      return;
    }
    let start = matches[0][0];
    let end = matches[0][1];

    let range = new Range();

    let text = el.firstChild;
    if (text == null) {
      return;
    }

    range.setStart(text, start);
    range.setEnd(text, end);
    range.surroundContents(document.createElement("b"));
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent) {
    this.completion(this.titles.get(item)!);
  }
}
