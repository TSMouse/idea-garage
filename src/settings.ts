import { App, PluginSettingTab, Setting } from "obsidian";
import type IdeaGaragePlugin from "./main";
import { QUESTIONS, ScoreKey } from "./scoring";
import { EMPTY_PROFILE, Profile } from "./setup";

export interface IdeaGarageSettings {
	ideasFolder: string;
	inboxPath: string;
	weights: Record<ScoreKey, number>;
	profile: Profile;
	setupDone: boolean;
	checklistHidden: boolean;
}

export const DEFAULT_WEIGHTS: Record<ScoreKey, number> = {
	speed: 3,
	automation: 3,
	revenue: 2,
	life_plan_fit: 2,
	startup_cost: 1,
	time_to_first_eur: 1,
	synergy: 1,
	risk: 1,
};

export const DEFAULT_SETTINGS: IdeaGarageSettings = {
	ideasFolder: "",
	inboxPath: "",
	weights: { ...DEFAULT_WEIGHTS },
	profile: { ...EMPTY_PROFILE },
	setupDone: false,
	checklistHidden: false,
};

export class IdeaGarageSettingTab extends PluginSettingTab {
	plugin: IdeaGaragePlugin;

	constructor(app: App, plugin: IdeaGaragePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Set up my garage")
			.setDesc("A few quick questions about you, your goal and what matters most. About 3 minutes.")
			.addButton((b) =>
				b
					.setButtonText(this.plugin.settings.setupDone ? "Run setup again" : "Start setup")
					.setCta()
					.onClick(() => this.plugin.openSetup())
			);

		new Setting(containerEl).setName("Where your ideas live").setHeading();

		new Setting(containerEl)
			.setName("Ideas folder")
			.setDesc("Every new idea gets its own folder in here.")
			.addText((text) =>
				text
					.setPlaceholder("Ideas")
					.setValue(this.plugin.settings.ideasFolder)
					.onChange(async (value) => {
						this.plugin.settings.ideasFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Idea Inbox note")
			.setDesc("Quick ideas land here first. Created for you if it doesn't exist yet.")
			.addText((text) =>
				text
					.setPlaceholder("Idea Inbox.md")
					.setValue(this.plugin.settings.inboxPath)
					.onChange(async (value) => {
						this.plugin.settings.inboxPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("How much each question counts").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Higher number = this question matters more in the total score. The defaults favour ideas that are fast to start and can run without you.",
		});

		for (const q of QUESTIONS) {
			new Setting(containerEl)
				.setName(`${q.emoji} ${q.short}`)
				.setDesc(q.question)
				.addSlider((slider) =>
					slider
						.setLimits(0, 5, 1)
						.setValue(this.plugin.settings.weights[q.key])
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.weights[q.key] = value;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						})
				);
		}

		new Setting(containerEl).addButton((button) =>
			button.setButtonText("Reset to defaults").onClick(async () => {
				this.plugin.settings.weights = { ...DEFAULT_WEIGHTS };
				await this.plugin.saveSettings();
				this.plugin.refreshViews();
				this.display();
			})
		);

		new Setting(containerEl).setName("Dashboard").setHeading();
		new Setting(containerEl)
			.setName("Show the getting-started checklist")
			.addToggle((t) =>
				t.setValue(!this.plugin.settings.checklistHidden).onChange(async (v) => {
					this.plugin.settings.checklistHidden = !v;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				})
			);

		new Setting(containerEl).setName("About").setHeading();
		const about = containerEl.createDiv({ cls: "setting-item-description idea-garage-about" });
		about.createEl("p", { text: "Idea Garage is free. I built it while launching 40 small businesses in one year, starting with €500." });
		const p = about.createEl("p", { text: "Want the whole system: money pot, schedule, worked examples and the AI helper? " });
		p.createEl("a", { text: "Get the full Idea Garage vault", href: "https://tjasas77.gumroad.com/l/idea-garage" });
	}
}
