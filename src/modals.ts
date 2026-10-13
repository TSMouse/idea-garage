import { App, Modal, Notice, Setting } from "obsidian";
import { Idea, QUESTIONS, STATUSES, ScoreKey, easyWin, fastRevenue, maxScore, totalScore } from "./scoring";

/** Ask for a name + one sentence, then create the idea. */
export class NewIdeaModal extends Modal {
	private name: string;
	private pitch = "";

	constructor(app: App, prefill: string, private onSubmit: (name: string, pitch: string) => Promise<void>) {
		super(app);
		this.name = prefill;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Park a new idea 🅿️");
		contentEl.createEl("p", {
			cls: "idea-garage-hint",
			text: "Give it a name and one sentence. You'll get a folder, an idea card and six ready-made notes.",
		});

		new Setting(contentEl).setName("Name").addText((text) => {
			text.setPlaceholder("Printable planners on Etsy").setValue(this.name).onChange((v) => (this.name = v));
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
		new Setting(contentEl).setName("In one sentence").addTextArea((text) => {
			text.setPlaceholder("What is it, and who is it for?").onChange((v) => (this.pitch = v));
			text.inputEl.rows = 3;
		});
		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Park it")
				.setCta()
				.onClick(() => void this.submit())
		);
		contentEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void this.submit();
		});
	}

	private async submit(): Promise<void> {
		try {
			await this.onSubmit(this.name, this.pitch);
			this.close();
		} catch (err) {
			new Notice(err instanceof Error ? err.message : String(err));
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Two-second capture into the Inbox. */
export class CaptureModal extends Modal {
	private text = "";

	constructor(app: App, private onSubmit: (text: string) => Promise<void>) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Quick idea 📥");
		contentEl.createEl("p", { cls: "idea-garage-hint", text: "Write it down and let it go. You can score it later." });
		new Setting(contentEl).setName("Idea").addText((t) => {
			t.setPlaceholder("Podcast editing service").onChange((v) => (this.text = v));
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") void this.submit();
			});
			window.setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(contentEl).addButton((b) => b.setButtonText("Add to inbox").setCta().onClick(() => void this.submit()));
	}

	private async submit(): Promise<void> {
		if (!this.text.trim()) return;
		await this.onSubmit(this.text);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export interface ScoreResult {
	scores: Partial<Record<ScoreKey, number>>;
	status: string;
	manualPick: boolean;
	manualReason: string;
}

/** The 8 questions with 1–5 buttons, a live total, status and gut pick. */
export class ScoreModal extends Modal {
	private draft: Idea;
	private totalEl: HTMLElement | null = null;

	constructor(
		app: App,
		idea: Idea,
		private weights: Record<ScoreKey, number>,
		private onSave: (result: ScoreResult) => Promise<void>
	) {
		super(app);
		this.draft = { ...idea, scores: { ...idea.scores } };
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("idea-garage-score-modal");
		this.setTitle(`Score: ${this.draft.name}`);
		contentEl.createEl("p", {
			cls: "idea-garage-hint",
			text: "Answer from 1 to 5. 5 is always the good side. A quick, honest guess is enough.",
		});

		for (const q of QUESTIONS) {
			const row = contentEl.createDiv({ cls: "idea-garage-question" });
			row.createDiv({ cls: "idea-garage-question-text", text: `${q.emoji} ${q.question}` });
			const scale = row.createDiv({ cls: "idea-garage-scale" });
			scale.createSpan({ cls: "idea-garage-scale-end", text: q.low });
			const buttons: HTMLButtonElement[] = [];
			for (let n = 1; n <= 5; n++) {
				const btn = scale.createEl("button", { text: String(n), cls: "idea-garage-scale-btn" });
				if (this.draft.scores[q.key] === n) btn.addClass("is-selected");
				btn.addEventListener("click", () => {
					this.draft.scores[q.key] = n;
					buttons.forEach((b) => b.removeClass("is-selected"));
					btn.addClass("is-selected");
					this.updateTotal();
				});
				buttons.push(btn);
			}
			scale.createSpan({ cls: "idea-garage-scale-end", text: q.high });
		}

		this.totalEl = contentEl.createDiv({ cls: "idea-garage-total" });
		this.updateTotal();

		new Setting(contentEl)
			.setName("Status")
			.addDropdown((d) => {
				const options = STATUSES.includes(this.draft.status) ? STATUSES : [this.draft.status, ...STATUSES];
				options.forEach((s) => d.addOption(s, s));
				d.setValue(this.draft.status).onChange((v) => (this.draft.status = v));
			});

		new Setting(contentEl)
			.setName("⭐ Gut pick")
			.setDesc("Put this idea on top of the queue, whatever its score.")
			.addToggle((t) => t.setValue(this.draft.manualPick).onChange((v) => (this.draft.manualPick = v)));

		new Setting(contentEl)
			.setName("Why?")
			.setDesc("One line. Later you'll see which gut feelings were right.")
			.addText((t) => t.setPlaceholder("Two people already asked for this").setValue(this.draft.manualReason).onChange((v) => (this.draft.manualReason = v)));

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					await this.onSave({
						scores: this.draft.scores,
						status: this.draft.status,
						manualPick: this.draft.manualPick,
						manualReason: this.draft.manualReason,
					});
					this.close();
				})
		);
	}

	private updateTotal(): void {
		if (!this.totalEl) return;
		this.totalEl.empty();
		const total = totalScore(this.draft, this.weights);
		const answered = QUESTIONS.filter((q) => this.draft.scores[q.key] !== undefined).length;
		if (total === undefined) {
			this.totalEl.setText(`${answered} of 8 answered`);
			return;
		}
		this.totalEl.createSpan({ cls: "idea-garage-total-main", text: `Score ${total} / ${maxScore(this.weights)}` });
		this.totalEl.createSpan({ text: `   ⚡ Easy win ${easyWin(this.draft)} / 25   💶 Fast revenue ${fastRevenue(this.draft)} / 25` });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Pick a date for a task (or remove it). */
export class DateModal extends Modal {
	private value: string;

	constructor(app: App, private label: string, current: string | undefined, private onPick: (date: string | null) => Promise<void>) {
		super(app);
		this.value = current ?? window.moment().format("YYYY-MM-DD");
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("📅 When?");
		contentEl.createEl("p", { cls: "idea-garage-hint", text: this.label });
		const input = contentEl.createEl("input", { type: "date", cls: "idea-garage-date-input" });
		input.value = this.value;
		input.addEventListener("change", () => (this.value = input.value));

		const quick = contentEl.createDiv({ cls: "idea-garage-actions idea-garage-quick-dates" });
		const add = (text: string, days: number) => {
			const b = quick.createEl("button", { text });
			b.addEventListener("click", () => {
				this.value = window.moment().add(days, "days").format("YYYY-MM-DD");
				input.value = this.value;
			});
		};
		add("Today", 0);
		add("Tomorrow", 1);
		add("In 3 days", 3);
		add("Next week", 7);

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("No date").onClick(async () => {
				await this.onPick(null);
				this.close();
			}))
			.addButton((b) => b.setButtonText("Save").setCta().onClick(async () => {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(this.value)) return;
				await this.onPick(this.value);
				this.close();
			}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Add a task to one of the active ideas. */
export class AddTaskModal extends Modal {
	private ideaPath: string;
	private text = "";
	private date = "";

	constructor(app: App, private ideas: Idea[], private onAdd: (idea: Idea, text: string, date: string | null) => Promise<void>) {
		super(app);
		this.ideaPath = ideas[0]?.file.path ?? "";
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle("➕ New task");
		if (this.ideas.length === 0) {
			contentEl.createEl("p", { cls: "idea-garage-hint", text: "Tasks belong to ideas that are in progress or live. Set an idea's status in its Score window first." });
			return;
		}
		new Setting(contentEl).setName("For which idea?").addDropdown((d) => {
			this.ideas.forEach((i) => d.addOption(i.file.path, i.name));
			d.setValue(this.ideaPath).onChange((v) => (this.ideaPath = v));
		});
		new Setting(contentEl).setName("What needs doing?").addText((t) => {
			t.setPlaceholder("Write the Etsy listing texts").onChange((v) => (this.text = v));
			window.setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(contentEl).setName("When? (optional)").addText((t) => {
			t.inputEl.type = "date";
			t.onChange((v) => (this.date = v));
		});
		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Add task").setCta().onClick(async () => {
				const idea = this.ideas.find((i) => i.file.path === this.ideaPath);
				if (!idea || !this.text.trim()) return;
				await this.onAdd(idea, this.text, this.date || null);
				this.close();
			})
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
