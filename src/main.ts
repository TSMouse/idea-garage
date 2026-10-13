import { Notice, Plugin, TFile, debounce } from "obsidian";
import { Garage } from "./garage";
import { AddTaskModal, CaptureModal, DateModal, NewIdeaModal, ScoreModal } from "./modals";
import { GarageTask, addTask, completeTask, setDue } from "./tasks";
import { Idea, QUESTIONS } from "./scoring";
import { DEFAULT_SETTINGS, DEFAULT_WEIGHTS, IdeaGarageSettingTab, IdeaGarageSettings } from "./settings";
import { EMPTY_PROFILE, PRESETS, SetupModal, writeProfileNotes } from "./setup";
import { DashboardView, VIEW_TYPE } from "./view";

export default class IdeaGaragePlugin extends Plugin {
	settings: IdeaGarageSettings = DEFAULT_SETTINGS;
	garage!: Garage;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.garage = new Garage(
			this.app,
			() => this.settings.ideasFolder,
			() => this.settings.inboxPath
		);

		this.registerView(VIEW_TYPE, (leaf) => new DashboardView(leaf, this));

		this.addRibbonIcon("lightbulb", "Open Idea Garage", () => void this.activateView());

		this.addCommand({ id: "setup", name: "Set up my garage", callback: () => this.openSetup() });
		this.addCommand({ id: "open-dashboard", name: "Open dashboard", callback: () => void this.activateView() });
		this.addCommand({ id: "open-tasks", name: "Open tasks", callback: () => void this.openTasks() });
		this.addCommand({ id: "new-idea", name: "Park a new idea", callback: () => this.openNewIdea() });
		this.addCommand({ id: "quick-idea", name: "Quick idea to inbox", callback: () => this.openCapture() });
		this.addCommand({
			id: "score-current-idea",
			name: "Score this idea",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const isIdea = file && this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "idea";
				if (!file || !isIdea) return false;
				if (!checking) void this.scoreFile(file);
				return true;
			},
		});

		this.addSettingTab(new IdeaGarageSettingTab(this.app, this));

		const refresh = debounce(() => this.refreshViews(), 400, true);
		this.registerEvent(this.app.metadataCache.on("changed", refresh));
		this.registerEvent(this.app.vault.on("delete", refresh));
		this.registerEvent(this.app.vault.on("rename", refresh));
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<IdeaGarageSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...saved,
			weights: { ...DEFAULT_WEIGHTS, ...(saved?.weights ?? {}) },
			profile: { ...EMPTY_PROFILE, ...(saved?.profile ?? {}) },
			taskStatuses: saved?.taskStatuses?.length ? saved.taskStatuses : DEFAULT_SETTINGS.taskStatuses,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE, active: true });
			leaf = right;
		}
		await workspace.revealLeaf(leaf);
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof DashboardView) void view.render();
		}
	}

	openNewIdea(prefill = "", inboxRaw = ""): void {
		new NewIdeaModal(this.app, prefill, async (name, pitch) => {
			const card = await this.garage.createIdea(name, pitch);
			if (inboxRaw) await this.garage.markMoved(inboxRaw, card.basename);
			await this.app.workspace.getLeaf(false).openFile(card);
			new Notice(`🅿️ "${card.basename}" is parked. Click Score in the Idea Garage panel when you're ready.`);
			this.refreshViews();
		}).open();
	}

	openSetup(): void {
		new SetupModal(this.app, this.settings.profile, async ({ profile, ideas }) => {
			this.settings.profile = profile;
			const preset = PRESETS.find((p) => p.id === profile.priority);
			if (preset) this.settings.weights = { ...preset.weights };
			this.settings.setupDone = true;
			await this.saveSettings();
			await writeProfileNotes(this.app, profile);
			for (const idea of ideas) await this.garage.capture(idea);
			new Notice(
				ideas.length
					? `🎉 Your garage is set up. ${ideas.length} idea${ideas.length === 1 ? "" : "s"} waiting in your Inbox.`
					: "🎉 Your garage is set up. Park your first idea when you're ready."
			);
			await this.activateView();
			this.refreshViews();
		}).open();
	}

	openAddTask(active: Idea[]): void {
		new AddTaskModal(this.app, active, async (idea, text, date) => {
			await addTask(this.app, idea, text, date);
			new Notice(`✅ Task added to "${idea.name}".`);
			this.refreshViews();
		}).open();
	}

	openDate(task: GarageTask): void {
		new DateModal(this.app, task.text, task.due, async (date) => {
			const ok = await setDue(this.app, task, date);
			if (!ok) new Notice("That task changed in the meantime. Please try again.");
			this.refreshViews();
		}).open();
	}

	async finishTask(task: GarageTask): Promise<void> {
		const ok = await completeTask(this.app, task);
		new Notice(ok ? `🎉 Done: ${task.text}` : "That task changed in the meantime. Please try again.");
		this.refreshViews();
	}

	async openTasks(): Promise<void> {
		await this.activateView();
		const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
		if (view instanceof DashboardView) view.showTab("tasks");
	}

	openCapture(): void {
		new CaptureModal(this.app, async (text) => {
			await this.garage.capture(text);
			new Notice("📥 Added to your Idea Inbox.");
			this.refreshViews();
		}).open();
	}

	openScore(idea: Idea): void {
		new ScoreModal(this.app, idea, this.settings.weights, async (result) => {
			await this.app.fileManager.processFrontMatter(idea.file, (fm: Record<string, unknown>) => {
				for (const q of QUESTIONS) {
					const v = result.scores[q.key];
					if (v !== undefined) fm[q.key] = v;
				}
				fm.status = result.status;
				fm.manual_pick = result.manualPick;
				fm.manual_reason = result.manualReason.trim() || null;
			});
			new Notice("🔢 Scores saved.");
			this.refreshViews();
		}).open();
	}

	private async scoreFile(file: TFile): Promise<void> {
		const ideas = await this.garage.loadIdeas();
		const idea = ideas.find((i) => i.file.path === file.path);
		if (idea) this.openScore(idea);
	}

	onunload(): void {
		// Views registered with registerView are cleaned up by Obsidian.
	}
}
