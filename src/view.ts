import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type IdeaGaragePlugin from "./main";
import { Idea, easyWin, fastRevenue, maxScore, missingCount, totalScore } from "./scoring";
import { Bucket, GarageTask, bucketOf, collectTasks, today } from "./tasks";

export const VIEW_TYPE = "idea-garage-dashboard";

type Tab = "queue" | "tasks" | "easy" | "fast" | "gut" | "inbox";

const TABS: { id: Tab; label: string; hint: string }[] = [
	{ id: "queue", label: "🏁 Queue", hint: "Your best idea overall. Gut picks always sit on top." },
	{ id: "tasks", label: "📅 Tasks", hint: "One list for every idea that is in progress or live. Tick tasks off here." },
	{ id: "easy", label: "⚡ Easy wins", hint: "Fastest and cheapest to launch. Great for momentum." },
	{ id: "fast", label: "💶 Fast revenue", hint: "The ideas most likely to bring money in soon." },
	{ id: "gut", label: "⭐ Gut picks", hint: "Ideas you chose on feeling, with your reason." },
	{ id: "inbox", label: "📥 Inbox", hint: "Quick ideas waiting for their own spot in the garage." },
];

const CLOSED = ["dropped", "paused"];

export class DashboardView extends ItemView {
	private tab: Tab = "queue";
	private rendering = false;
	private pending = false;

	constructor(leaf: WorkspaceLeaf, private plugin: IdeaGaragePlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Idea Garage";
	}

	getIcon(): string {
		return "lightbulb";
	}

	showTab(tab: Tab): void {
		this.tab = tab;
		void this.render();
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async render(): Promise<void> {
		if (this.rendering) {
			this.pending = true;
			return;
		}
		this.rendering = true;
		try {
			do {
				this.pending = false;
				await this.draw();
			} while (this.pending);
		} finally {
			this.rendering = false;
		}
	}

	private async draw(): Promise<void> {
		const root = this.contentEl;
		const ideas = await this.plugin.garage.loadIdeas();
		const inbox = await this.plugin.garage.inboxItems();
		const tasks = await collectTasks(this.app, ideas, this.plugin.settings.taskStatuses);
		const urgent = tasks.filter((t) => ["overdue", "today"].includes(bucketOf(t))).length;
		root.empty();
		root.addClass("idea-garage");

		// Header
		const header = root.createDiv({ cls: "idea-garage-header" });
		const brand = header.createDiv({ cls: "idea-garage-brand" });
		brand.createSpan({ cls: "idea-garage-p", text: "P" });
		brand.createSpan({ cls: "idea-garage-title", text: "Idea Garage" });
		const actions = header.createDiv({ cls: "idea-garage-actions" });
		this.button(actions, "plus", "New idea", () => this.plugin.openNewIdea(), true);
		this.button(actions, "inbox", "Quick idea", () => this.plugin.openCapture());

		this.checklist(root, ideas, inbox);

		// Tabs
		const tabs = root.createDiv({ cls: "idea-garage-tabs" });
		for (const t of TABS) {
			const label =
				t.id === "inbox" && inbox.length ? `${t.label} (${inbox.length})` : t.id === "tasks" && urgent ? `${t.label} (${urgent})` : t.label;
			const el = tabs.createEl("button", { text: label, cls: "idea-garage-tab" });
			if (t.id === this.tab) el.addClass("is-active");
			el.addEventListener("click", () => {
				this.tab = t.id;
				void this.render();
			});
		}
		root.createDiv({ cls: "idea-garage-hint", text: TABS.find((t) => t.id === this.tab)?.hint ?? "" });

		const list = root.createDiv({ cls: "idea-garage-list" });

		if (this.tab === "inbox") {
			this.drawInbox(list, inbox);
			return;
		}

		if (this.tab === "tasks") {
			this.drawTasks(list, tasks, ideas);
			return;
		}

		if (ideas.length === 0) {
			this.empty(list, "Your garage is empty, for now.", "Park your first idea, or jot down a quick one for later. Nothing is too small or too silly.");
			return;
		}

		const weights = this.plugin.settings.weights;
		const max = maxScore(weights);
		let rows: { idea: Idea; value: number | undefined; max: number }[];

		if (this.tab === "queue") {
			rows = ideas
				.filter((i) => !CLOSED.includes(i.status))
				.map((idea) => ({ idea, value: totalScore(idea, weights), max }))
				.sort((a, b) => Number(b.idea.manualPick) - Number(a.idea.manualPick) || (b.value ?? -1) - (a.value ?? -1));
		} else if (this.tab === "easy") {
			rows = ideas.filter((i) => !CLOSED.includes(i.status)).map((idea) => ({ idea, value: easyWin(idea), max: 25 }));
			rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
		} else if (this.tab === "fast") {
			rows = ideas.filter((i) => !CLOSED.includes(i.status)).map((idea) => ({ idea, value: fastRevenue(idea), max: 25 }));
			rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
		} else {
			rows = ideas.filter((i) => i.manualPick).map((idea) => ({ idea, value: totalScore(idea, weights), max }));
			if (rows.length === 0) {
				this.empty(list, "No gut picks yet.", "When you just know an idea should go first, open Score and switch on ⭐ Gut pick.");
				return;
			}
		}

		rows.forEach((row, index) => this.card(list, row.idea, row.value, row.max, index + 1));

		const closed = ideas.filter((i) => CLOSED.includes(i.status)).length;
		if (closed && this.tab !== "gut") {
			list.createDiv({ cls: "idea-garage-footnote", text: `${closed} paused or dropped idea${closed === 1 ? "" : "s"} not shown.` });
		}
	}

	/** Getting-started checklist: shows what the garage still needs from you. */
	private checklist(root: HTMLElement, ideas: Idea[], inbox: string[]): void {
		if (this.plugin.settings.checklistHidden) return;
		const unscored = ideas.filter((i) => missingCount(i) > 0 && !CLOSED.includes(i.status)).length;
		const steps: { done: boolean; label: string; action?: [string, () => void] }[] = [
			{ done: this.plugin.settings.setupDone, label: "Tell the garage about you (3 min)", action: ["Start setup", () => this.plugin.openSetup()] },
			{ done: ideas.length + inbox.length >= 3, label: `Collect at least 3 ideas (${Math.min(ideas.length + inbox.length, 3)}/3)`, action: ["Quick idea", () => this.plugin.openCapture()] },
			{ done: ideas.length >= 1, label: "Move your first idea into the garage", action: ["New idea", () => this.plugin.openNewIdea()] },
			{ done: ideas.length >= 1 && unscored === 0, label: unscored ? `Score your ideas (${unscored} still open)` : "Score your ideas" },
		];
		if (steps.every((s) => s.done)) return;

		const box = root.createDiv({ cls: "idea-garage-checklist" });
		const head = box.createDiv({ cls: "idea-garage-checklist-head" });
		head.createSpan({ text: `🚦 Getting started: ${steps.filter((s) => s.done).length} of ${steps.length} done` });
		const hide = head.createEl("button", { cls: "idea-garage-link-btn", text: "Hide" });
		hide.addEventListener("click", async () => {
			this.plugin.settings.checklistHidden = true;
			await this.plugin.saveSettings();
			void this.render();
		});

		const next = steps.find((s) => !s.done);
		for (const s of steps) {
			const row = box.createDiv({ cls: `idea-garage-check ${s.done ? "is-done" : ""}` });
			row.createSpan({ cls: "idea-garage-check-mark", text: s.done ? "✅" : "⬜" });
			row.createSpan({ cls: "idea-garage-check-label", text: s.label });
			if (s === next && s.action) {
				const [label, fn] = s.action;
				const b = row.createEl("button", { cls: "mod-cta idea-garage-score-btn", text: label });
				b.addEventListener("click", fn);
			}
		}
	}

	private card(parent: HTMLElement, idea: Idea, value: number | undefined, max: number, rank: number): void {
		const card = parent.createDiv({ cls: "idea-garage-card" });
		if (rank === 1 && value !== undefined) card.addClass("is-top");

		const top = card.createDiv({ cls: "idea-garage-card-top" });
		top.createSpan({ cls: "idea-garage-rank", text: String(rank) });
		const name = top.createEl("a", { cls: "idea-garage-name", text: idea.name });
		name.addEventListener("click", () => void this.app.workspace.getLeaf(false).openFile(idea.file));
		if (idea.manualPick) top.createSpan({ cls: "idea-garage-star", text: "⭐", attr: { "aria-label": idea.manualReason || "Gut pick" } });
		top.createSpan({ cls: `idea-garage-status status-${idea.status.replace(/\s+/g, "-")}`, text: idea.status });

		if (idea.pitch) card.createDiv({ cls: "idea-garage-pitch", text: idea.pitch });

		const bottom = card.createDiv({ cls: "idea-garage-card-bottom" });
		if (value !== undefined) {
			const meter = bottom.createDiv({ cls: "idea-garage-meter" });
			meter.createEl("progress", { attr: { value: String(value), max: String(max) } });
			meter.createSpan({ cls: "idea-garage-value", text: `${value} / ${max}` });
		} else {
			const missing = missingCount(idea);
			bottom.createSpan({
				cls: "idea-garage-missing",
				text: missing === 8 ? "Not scored yet" : `${missing} question${missing === 1 ? "" : "s"} left`,
			});
		}
		const score = bottom.createEl("button", { cls: "idea-garage-score-btn", text: value === undefined ? "Score me" : "Score" });
		score.addEventListener("click", () => this.plugin.openScore(idea));
	}

	private drawTasks(list: HTMLElement, tasks: GarageTask[], ideas: Idea[]): void {
		const active = ideas.filter((i) => this.plugin.settings.taskStatuses.includes(i.status));
		const top = list.createDiv({ cls: "idea-garage-actions" });
		this.button(top, "plus", "New task", () => this.plugin.openAddTask(active), true);

		if (active.length === 0) {
			this.emptyText(
				list,
				"No ideas in progress yet.",
				`Tasks show up here once an idea's status is ${this.plugin.settings.taskStatuses.join(" or ")}. Open an idea's Score window and change its status.`
			);
			return;
		}

		// Week strip: the next 7 days with how many tasks are due.
		const week = list.createDiv({ cls: "idea-garage-week" });
		for (let d = 0; d < 7; d++) {
			const date = window.moment().add(d, "days");
			const iso = date.format("YYYY-MM-DD");
			const count = tasks.filter((t) => t.due === iso).length;
			const day = week.createDiv({ cls: `idea-garage-day${d === 0 ? " is-today" : ""}${count ? " has-tasks" : ""}` });
			day.createDiv({ cls: "idea-garage-day-name", text: d === 0 ? "Today" : date.format("ddd") });
			day.createDiv({ cls: "idea-garage-day-num", text: date.format("D") });
			day.createDiv({ cls: "idea-garage-day-count", text: count ? `${count}` : "·" });
		}

		if (tasks.length === 0) {
			this.emptyText(list, "Nothing to do. 🎉", "All tasks of your active ideas are done, or their To Do Lists are still empty.");
			return;
		}

		const groups: { id: Bucket; title: string }[] = [
			{ id: "overdue", title: "⚠️ Overdue" },
			{ id: "today", title: "📍 Today" },
			{ id: "week", title: "🗓️ This week" },
			{ id: "later", title: "⏭️ Later" },
			{ id: "nodate", title: "📝 No date yet" },
		];
		for (const g of groups) {
			const items = tasks.filter((t) => bucketOf(t) === g.id).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
			if (!items.length) continue;
			list.createDiv({ cls: `idea-garage-group-title group-${g.id}`, text: `${g.title} (${items.length})` });
			for (const t of items) this.taskRow(list, t);
		}
	}

	private taskRow(parent: HTMLElement, task: GarageTask): void {
		const row = parent.createDiv({ cls: "idea-garage-task" });
		const box = row.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
		box.addEventListener("change", () => void this.plugin.finishTask(task));

		const body = row.createDiv({ cls: "idea-garage-task-body" });
		body.createDiv({ cls: "idea-garage-task-text", text: task.text });
		const meta = body.createDiv({ cls: "idea-garage-task-meta" });
		const idea = meta.createEl("a", { cls: "idea-garage-task-idea", text: task.idea.name });
		idea.addEventListener("click", () => void this.app.workspace.getLeaf(false).openFile(task.file, { eState: { line: task.line } }));

		const label = task.due
			? task.due === today()
				? "📅 Today"
				: `📅 ${window.moment(task.due).format("ddd D MMM")}`
			: "📅 Add date";
		const date = meta.createEl("button", { cls: `idea-garage-date-btn${task.due ? "" : " is-empty"}`, text: label });
		date.addEventListener("click", () => this.plugin.openDate(task));
	}

	private emptyText(parent: HTMLElement, title: string, text: string): void {
		const box = parent.createDiv({ cls: "idea-garage-empty" });
		box.createDiv({ cls: "idea-garage-empty-title", text: title });
		box.createDiv({ text });
	}

	private drawInbox(list: HTMLElement, items: string[]): void {
		if (items.length === 0) {
			this.empty(list, "Your inbox is empty.", "Use 📥 Quick idea whenever something pops into your head. Score it later.");
			return;
		}
		for (const item of items) {
			const row = list.createDiv({ cls: "idea-garage-card idea-garage-inbox-item" });
			row.createSpan({ cls: "idea-garage-name", text: item });
			const move = row.createEl("button", { cls: "idea-garage-score-btn", text: "Move into garage" });
			move.addEventListener("click", () => this.plugin.openNewIdea(item));
		}
	}

	private empty(parent: HTMLElement, title: string, text: string): void {
		const box = parent.createDiv({ cls: "idea-garage-empty" });
		box.createDiv({ cls: "idea-garage-empty-title", text: title });
		box.createDiv({ text });
		const actions = box.createDiv({ cls: "idea-garage-actions" });
		this.button(actions, "plus", "New idea", () => this.plugin.openNewIdea(), true);
		this.button(actions, "inbox", "Quick idea", () => this.plugin.openCapture());
	}

	private button(parent: HTMLElement, icon: string, label: string, onClick: () => void, cta = false): void {
		const b = parent.createEl("button", { cls: cta ? "mod-cta idea-garage-btn" : "idea-garage-btn" });
		const iconEl = b.createSpan({ cls: "idea-garage-btn-icon" });
		setIcon(iconEl, icon);
		b.createSpan({ text: label });
		b.addEventListener("click", onClick);
	}
}
