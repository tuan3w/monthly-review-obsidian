import { Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { createMonthlyNote, getAllMonthlyNotes, getMonthlyNote } from 'obsidian-daily-notes-interface';

interface IReviewSettings {
	dailyNotesFolder: string;
	reviewSectionHeading: string;
	linePrefix: string;
}

const DEFAULT_SETTINGS: IReviewSettings = {
	dailyNotesFolder: "",
	reviewSectionHeading: "## Links",
	linePrefix: "- ",
}


export default class Review extends Plugin {
	settings: IReviewSettings;

	async getOrCreateMonthlyNote() {
		let date = window.moment();
		let startOfMonth = date.clone().startOf('month');
		let allNotes: Record<string, TFile>;
		try {
			allNotes = getAllMonthlyNotes();
		} catch (err) {
			new Notice(`Failed to find your monthly notes folder`);
			return;
		}

		let note = await getMonthlyNote(startOfMonth, allNotes);
		if (!note) {
			// create new note
			try {
				note = await createMonthlyNote(startOfMonth);
			} catch (err) {
				new Notice(`Failed to create monthly note in notes folder`);
				return null;
			}

		}
		return note;
	}

	async openMonthyNote() {
		let note = await this.getOrCreateMonthlyNote();
		if (!note) return;

		// open file
		const { workspace } = this.app;
		const leaf = workspace.getUnpinnedLeaf();

		await leaf.openFile(note, { active: true });
	}

	async onload() {
		console.log('Loading the Monthly Review plugin.');

		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()))

		if (this.app.workspace.layoutReady) {
			this.onLayoutReady();
		} else {
			this.app.workspace.on("layout-ready", this.onLayoutReady.bind(this));
		}

		this.addCommand({
			id: 'add-to-monthy-note',
			name: 'Add link to this note in monthly note',

			checkCallback: (checking: boolean) => { // If a note is currently active, open the plugin's modal to receive a date string.
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.addLinkInMonthlyNote();
					}
					return true;
				}
				return false;
			}
		});
		this.addCommand({
			id: 'open-monthly-note',
			name: 'Open monthly note',

			checkCallback: (checking: boolean) => { 
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.openMonthyNote();
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new ReviewSettingTab(this.app, this));

	}

	onLayoutReady() {
		// Check for the Periodic Notes plugin after all the plugins are loaded.
		// If not found, tell the user to install it/initialize it.
		let naturalLanguageDates = (<any>this.app).plugins.getPlugin('periodic-notes');
		if (!naturalLanguageDates) {
			new Notice("The Periodic Notes plugin was not found. The Review plugin requires the Natural Language Dates plugin. Please install it first and make sure it is enabled before using Review.");
		}
	}

	onunload() {
		console.log('The Monthly Review plugin has been disabled and unloaded.');
	}

	async addLinkInMonthlyNote() {
		let obsidianApp = this.app;
		let periodicNotes = (<any>obsidianApp).plugins.getPlugin('periodic-notes'); // Get the Natural Language Dates plugin.

		if (!periodicNotes) {
			new Notice("The Periodic Notes plugin is not available. Please make sure it is installed and enabled before trying again.");
			return;
		}

		// Use the Natural Language Dates plugin's processDate method to convert the input date into a daily note title.
		let monthyNoteFile = await this.getOrCreateMonthlyNote();
		if (!monthyNoteFile) return;

		// Get the review section header.
		let reviewHeading = this.settings.reviewSectionHeading;

		// Get the line prefix.
		let reviewLinePrefix = this.settings.linePrefix;

		// If the date is recognized and valid
		// get the current note name
		let noteName = obsidianApp.workspace.activeLeaf.getDisplayText();
		//@ts-ignore
		let noteFile = obsidianApp.workspace.activeLeaf.view.file;
		let noteLink = obsidianApp.metadataCache.fileToLinktext(noteFile, noteFile.path, true);

		let previousNoteText = "";
		obsidianApp.vault.read(monthyNoteFile).then(function (result) { // Get the text in the note. Search it for ## Review and append to that section. Else, append ## Review and the link to the note for review.
			previousNoteText = result;
			let link = reviewLinePrefix + "[[" + noteLink + "]]";
			let newNoteText = "";
			if (previousNoteText.includes(reviewHeading)) {
				// append link to this section
				if (!previousNoteText.includes(link)) {
					newNoteText = previousNoteText.replace(reviewHeading, reviewHeading + "\n" + link);
					obsidianApp.vault.modify(monthyNoteFile, newNoteText);
				}
			} else {
				newNoteText = previousNoteText + "\n" + reviewHeading + "\n" + reviewLinePrefix + "[[" + noteLink + "]]";
				obsidianApp.vault.modify(monthyNoteFile, newNoteText);
			}
			new Notice("Add note \"" + noteName + "\" for review on " + monthyNoteFile.basename + ".");
		});
		return;
	}
}


class ReviewSettingTab extends PluginSettingTab {
	display(): void {
		let { containerEl } = this;
		const plugin: any = (this as any).plugin;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Review Settings' });

		new Setting(containerEl)
			.setName('Review section heading')
			.setDesc('Set the heading to use for the review section. BE CAREFUL: it must be unique in each daily note.')
			.addText((text) =>
				text
					.setPlaceholder('## Review')
					.setValue(plugin.settings.reviewSectionHeading)
					.onChange((value) => {
						if (value === "") {
							plugin.settings.reviewSectionHeading = "## Review";
						} else {
							plugin.settings.reviewSectionHeading = value;
						}
						plugin.saveData(plugin.settings);
					})
			);
		new Setting(containerEl)
			.setName('Line prefix')
			.setDesc('Set the prefix to use on each new line. E.g., use `- ` for bullets or `- [ ] ` for tasks. **Include the trailing space.**')
			.addText((text) =>
				text
					.setPlaceholder('- ')
					.setValue(plugin.settings.linePrefix)
					.onChange((value) => {
						plugin.settings.linePrefix = value;
						plugin.saveData(plugin.settings);
					})
			);

		// containerEl.createEl('h3', { text: 'Preset review schedules' });

		/*
		TKTKTK: Figure out how to add a function to a button inside the setting element. Currently `doSomething`, below, throws errors.
		containerEl.createEl('button', { text: "Add a new review schedule preset", attr: { onclick: "doSomething({ console.log('button clicked') });"}});
		*/
	}
}
