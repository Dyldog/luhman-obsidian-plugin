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
const checkSettingsMessage = "Try checking the settings if this seems wrong.";

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
  templateFile: string;
}

const DEFAULT_SETTINGS: LuhmanSettings = {
  matchRule: "strict",
  addTitle: false,
  separator: "⁝ ",
  templateFile: "",
};

class LuhmanSettingTab extends PluginSettingTab {
  plugin: NewZettel;

  constructor(app: App, plugin: NewZettel) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const { matchRule, separator, addTitle, templateFile } = this.plugin.settings;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "The ID is a block of letters and numbers at the beginning of the filename",
    });

    new Setting(containerEl)
      .setName("ID matching rule")
      .setDesc(
        "Strict means filenames consist of only an ID. " +
          "Separator means the ID must be followed by the separator. " +
          "Fuzzy treats the first non-alphanumeric character as the end of the ID."
      )
      .addDropdown((setting) =>
        setting
          .addOption("strict", "Strict")
          .addOption("separator", "Separator")
          .addOption("fuzzy", "Fuzzy")
          .setValue(matchRule)
          .onChange(async (value) => {
            this.plugin.settings.matchRule = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Template File")
      .setDesc(
        "Set the path to a template file that is used during the creation of a new note (with file extension). The template needs to have atleast one of the {{title}} and {{link}} placeholder or it will not work."
      )
      .addText((setting) => {
        setting
          .setPlaceholder("eg. /template/luhman.md")
          .setValue(templateFile)
          .onChange(async (value) => {
            this.plugin.settings.templateFile = value;
            await this.plugin.saveSettings();
          });
      });

    if (matchRule !== "strict") {
      new Setting(containerEl)
        .setName("Add titles automatically")
        .setDesc(
          "Add the separator and the title of the note when creating filenames"
        )
        .setDisabled(matchRule !== "strict")
        .addToggle((setting) =>
          setting.setValue(addTitle).onChange(async (value) => {
            this.plugin.settings.addTitle = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    const useSeparator =
      matchRule !== "strict" && (addTitle || matchRule === "separator");

    if (useSeparator) {
      new Setting(containerEl)
        .setName("ID Separator")
        .setDesc(
          "Used between id and title, include whitespace padding if needed"
        )
        .setDisabled(useSeparator)
        .addText((text) =>
          text
            .setPlaceholder("Enter your separator")
            .setValue(separator)
            .onChange(async (value) => {
              this.plugin.settings.separator = value;
              await this.plugin.saveSettings();
            })
        );
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
    const comps = id.split("");
    const last = comps.pop()!;
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
    const parts = id.match(idOnlyRegex)!;
    const lastPart = parts.pop()!;
    return parts.concat([this.incrementIDComponent(lastPart)]).join("");
  }

  parentID(id: string): string {
    const parts = id.match(idOnlyRegex)!;
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
      fuzzy: /^((?:[0-9]+|[a-z]+)+).*/,
    };
    const match = filename.match(ruleRegexes[this.settings.matchRule]);
    if (match) {
      return match[1];
    }
    return "";
  }

  idExists(id: string): boolean {
    const fileMatcher = (file: TFile) => this.fileToId(file.basename) === id;
    return this.app.vault.getMarkdownFiles().filter(fileMatcher).length != 0;
  }

  firstAvailableID(startingID: string): string {
    let nextID = startingID;
    while (this.idExists(nextID)) {
      nextID = this.incrementID(nextID);
    }
    return nextID;
  }

  makeNoteForNextSiblingOf(sibling: TFile): string {
    const nextID = this.firstAvailableID(
      this.incrementID(this.fileToId(sibling.basename))
    );
    return nextID;
  }

  makeNoteForNextChildOf(parent: TFile): string {
    const childID = this.firstAvailableID(
      this.firstChildOf(this.fileToId(parent.basename))
    );
    return childID;
  }

  async makeNote(
    path: string,
    title: string,
    fileLink: string,
    placeCursorAtStartOfContent: boolean,
    openZettel = false,
    successCallback: Function = () => {
      return;
    }
  ) {
    const app = this.app;
    let titleContent = null;
    if (title && title.length > 0) {
      titleContent = "# " + title;
    } else {
      titleContent = "";
    }

    let file = null;
    const backlinkRegex = /{{link}}/g;
    const titleRegex = /{{title}}/g;
    if (this.settings.templateFile && this.settings.templateFile.trim() != "") {
      let template_content = "";
      try {
        template_content = await this.app.vault.adapter.read(this.settings.templateFile.trim());
      } catch (err) {
        new Notice(`Couldn't read template file ${this.settings.templateFile} make sure that it is a valid file...`);
        return;
      }

      if (!titleRegex.test(template_content) || !backlinkRegex.test(template_content)) {
        new Notice("Title {{title}} or Backlink {{link}} placeholder in template missing. Please add and try again...");
        return;
      }

      const file_content = template_content.replace(titleRegex, titleContent).replace(backlinkRegex, fileLink);
      file = await this.app.vault.create(path, file_content);
      successCallback();
    } else {
      const fullContent = titleContent + "\n\n" + fileLink;
      file = await this.app.vault.create(path, fullContent);
      successCallback();
    }

    const active = app.workspace.getLeaf();
    if (active == null) {
      return;
    }
    if (openZettel == false) return;

    await active.openFile(file);

    const editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (editor == null) {
      return;
    }

    if (placeCursorAtStartOfContent) {
      const position: EditorPosition = { line: 2, ch: 0 };
      editor.setCursor(position);
    } else {
      editor.exec("goEnd");
    }
  }

  isZettelFile(name: string): boolean {
    const mdRegex = /.*\.md$/;
    return mdRegex.exec(name) != null && this.fileToId(name) !== "";
  }

  makeNoteFunction(idGenerator: (file: TFile) => string, openNewFile = true) {
    const file = this.app.workspace.getActiveFile();
    if (file == null) {
      return;
    }
    if (this.isZettelFile(file.name)) {
      const fileID = this.fileToId(file.basename);
      const fileLink = "[[" + file.basename + "]]";

      const editor =
        this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (editor == null) {
        return;
      }

      const selection = editor.getSelection();

      const nextID = idGenerator.bind(this, file)();
      const nextPath = (title: string) =>
        file?.path
          ? this.app.fileManager.getNewFileParent(file.path).path +
            "/" +
            nextID +
            (this.settings.addTitle ? this.settings.separator + title : "") +
            ".md"
          : "";

      const newLink = (title: string) =>
        `[[${nextID}${
          this.settings.addTitle ? this.settings.separator + title : ""
        }]]`;
      // const newLink = "[[" + nextID + "]]";

      if (selection) {
        // This current solution eats line returns spaces but thats
        // fine as it is turning the selection into a title so it makes sense
        const selectionTrimStart = selection.trimStart();
        const selectionTrimEnd = selectionTrimStart.trimEnd();
        const spaceBefore = selection.length - selectionTrimStart.length;
        const spaceAfter = selectionTrimStart.length - selectionTrimEnd.length;
        const title = selectionTrimEnd
          .split(/\s+/)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        const selectionPos = editor!.listSelections()[0];
        /* By default the anchor is what ever position the selection started
           how ever replaceRange does not accept it both ways and 
           gets weird if we just pass in the anchor then the head
           so here we create a vertual anchor and head position to pass in */
        const anchorCorrect =
          selectionPos.anchor.line == selectionPos.head.line // If the anchor and head are on the same line
            ? selectionPos.anchor.ch <= selectionPos.head.ch // Then if anchor is before the head
            : selectionPos.anchor.line < selectionPos.head.line; // else they are not on the same line and just check if anchor is before head

        // if anchorCorrect use as is, else switch
        const virtualAnchor = anchorCorrect ? selectionPos.anchor : selectionPos.head;
        const virtualHead = anchorCorrect ? selectionPos.head : selectionPos.anchor;
        // editor!.replaceRange(" ".repeat(spaceBefore) + newLink(title) + " ".repeat(spaceAfter), virtualAnchor, virtualHead);
        this.makeNote(nextPath(title), title, fileLink, true, openNewFile, () => {
          editor!.replaceRange(" ".repeat(spaceBefore) + newLink(title) + " ".repeat(spaceAfter), virtualAnchor, virtualHead);
        });
      } else {
        new NewZettelModal(
          this.app,
          (title: string, options) => {
            this.makeNote(nextPath(title), title, fileLink, true, options.openNewZettel, this.insertTextIntoCurrentNote(newLink(title)));
          },
          {
            openNewZettel: openNewFile,
          }
        ).open();
      }
    } else {
      new Notice(
        `Couldn't find ID in "${file.basename}". ${checkSettingsMessage}`
      );
    }
  }

  async renameZettel(id: string, toId: string) {
    const sep = this.settings.separator;
    const zettel = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.fileToId(file.basename) === id)
      .first();
    if (zettel) {
      const id = this.fileToId(zettel.basename);
      const rest = zettel.basename.split(id)[1];
      this.app.fileManager.renameFile(
        zettel,
        zettel.parent.path + toId + rest + "." + zettel.extension
      );
    } else {
      new Notice(`Couldn't find file for ID ${id}. ${checkSettingsMessage}`);
    }
  }

  async moveChildrenDown(id: string) {
    const children = this.getDirectChildZettels(id);
    for (const child of children) {
      await this.moveZettelDown(this.fileToId(child.basename));
    }
  }

  async moveZettelDown(id: string) {
    this.moveChildrenDown(id);
    await this.renameZettel(id, this.firstAvailableID(id));
  }

  async outdentZettel(id: string) {
    const newID = this.incrementID(this.parentID(id));
    if (this.idExists(newID)) {
      await this.moveZettelDown(newID);
    }

    for (const child of this.getDirectChildZettels(id)) {
      const newChildID: string = this.firstAvailableID(
        this.firstChildOf(newID)
      );
      await this.renameZettel(this.fileToId(child.basename), newChildID);
    }

    await this.renameZettel(id, newID);
  }

  async onload() {
    console.log("loading New Zettel");
    this.loadSettings();
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
      id: "new-sibling-note-dont-open",
      name: "New Sibling Zettel Note (Don't Open)",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextSiblingOf, false);
      },
    });

    this.addCommand({
      id: "new-child-note-dont-open",
      name: "New Child Zettel Note (Don't Open)",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextChildOf, false);
      },
    });

    this.addCommand({
      id: "insert-zettel-link",
      name: "Insert Zettel Link",
      callback: async () => {
        // let completion = (te)
        const titles = await this.getAllNoteTitles();
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
        const titles = await this.getAllNoteTitles();

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
          const parentId = this.parentID(id);
          if (parentId === "") {
            new Notice(
              `No parent found for "${file.basename}". ${checkSettingsMessage}`
            );
            return;
          }
          this.openZettel(parentId);
        } else {
          new Notice("No file open");
        }
      },
    });

    this.addCommand({
      id: "outdent-zettel",
      name: "Outdent Zettel",
      callback: () => {
        const file = this.currentFile();
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
    const file = this.app.vault
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
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (view) {
      const editor = view!.editor;

      let position: EditorPosition;
      let prefix = "";

      if (editor.getSelection()) {
        const selectionPos = editor.listSelections()[0];
        const positionCH = Math.max(
          selectionPos.head.ch,
          selectionPos.anchor.ch
        );
        position = { line: selectionPos.anchor.line, ch: positionCH + 1 };
        prefix = " ";
      } else {
        position = editor.getCursor();
      }

      return () => {
        editor.replaceRange(prefix + text, position, position);
      };
    }
  }

  getZettels(): TFile[] {
    const fileToId = (file: TFile) => this.fileToId(file.basename);
    return this.app.vault.getMarkdownFiles().filter((file) => {
      const ignore = !file.path.match(/^(_layouts|templates|scripts)/);
      return ignore && fileToId(file) !== "";
    });
  }

  getDirectChildZettels(ofParent: string): TFile[] {
    return this.getZettels().filter((file) => {
      return this.parentID(this.fileToId(file.basename)) == ofParent;
    });
  }

  async getAllNoteTitles(): Promise<Map<string, TFile>> {
    const regex = /# (.+)\s*/;
    const titles: Map<string, TFile> = new Map();
    for (const file of this.getZettels()) {
      const text = await this.app.vault.cachedRead(file);
      const match = text.match(regex);
      if (match) {
        titles.set(match[1], file);
      }
    }

    return titles;
  }
}

type ZettelModelCallback = (text: string, options: ZettelModelOptions) => void;
type ZettelModelOptions = {
  openNewZettel: boolean;
};

const MakeZettelModelOptionDefault: () => ZettelModelOptions = () => ({
  openNewZettel: true,
});

class NewZettelModal extends Modal {
  public completion: ZettelModelCallback;
  private textBox: HTMLInputElement;
  private openNewZettelCheckbox: HTMLInputElement;

  constructor(
    app: App,
    completion: ZettelModelCallback,
    options: ZettelModelOptions = MakeZettelModelOptionDefault()
  ) {
    super(app);
    this.completion = completion;

    /***********************************
     ** Model Title                   **
     ***********************************/
    const { contentEl } = this;
    contentEl.parentElement!.addClass("zettel-modal");
    this.titleEl.setText("New zettel title...");

    /***********************************
     ** Name and GO area              **
     ***********************************/

    // Setup the container
    const main_container = contentEl.createEl("div", {
      cls: "zettel-modal-container",
    });

    // Add the textBox
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
    main_container.append(this.textBox);

    // Add the go button
    const button = contentEl.createEl("input", {
      type: "button",
      value: "GO",
      cls: "zettel-modal-button",
    });
    button.addEventListener("click", (e: Event) => this.goTapped());
    main_container.append(button);

    contentEl.append(main_container);

    /***********************************
     ** New Zettel Options            **
     ***********************************/

    // Setup the container
    const options_container = contentEl.appendChild(
      contentEl.createEl("div", {
        cls: ["zettel-modal-container", "zettel-options-container"],
      })
    );
    // Create label inside the container
    const label = options_container.appendChild(
      contentEl.createEl("label", {
        cls: ["label", "zettel-label"],
      })
    );

    // Create label
    const openNewZettelCheckboxLabel = label.appendChild(
      contentEl.createEl("div", { cls: ["labelText"] })
    );
    openNewZettelCheckboxLabel.innerText = "Open New Zettel on Creation";

    // Create checkbox inside the container
    this.openNewZettelCheckbox = label.appendChild(
      contentEl.createEl("input", {
        type: "checkbox",
        cls: ["zettel-modal-checkbox"],
        value: options.openNewZettel.toString(),
      })
    );
    this.openNewZettelCheckbox.id = "zettel-modal-option-openZettel";
    this.openNewZettelCheckbox.checked = options.openNewZettel;
  }

  onOpen() {
    window.setTimeout(() => {
      this.textBox.focus();
    }, 0);
  }

  goTapped() {
    const title = this.textBox.value;
    const openNewZettel = this.openNewZettelCheckbox.checked;
    this.completion(title, {
      openNewZettel,
    });
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
    const event = new Event("input");
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

    const matches = value.match.matches;
    if (matches == null || matches.length == 0) {
      return;
    }
    const start = matches[0][0];
    const end = matches[0][1];

    const range = new Range();

    const text = el.firstChild;
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
