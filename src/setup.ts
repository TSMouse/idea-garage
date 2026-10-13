import { App, Modal, Notice, Setting, TFile, TFolder, normalizePath } from "obsidian";
import { ScoreKey } from "./scoring";

export interface Profile {
	skills: string;
	enjoy: string;
	hoursPerWeek: string;
	money: string;
	where: string;
	goal: string;
	why: string;
	success: string;
	oneYear: string;
	fiveYears: string;
	days: string;
	wontDo: string;
	priority: PresetId;
}

export const EMPTY_PROFILE: Profile = {
	skills: "",
	enjoy: "",
	hoursPerWeek: "",
	money: "",
	where: "",
	goal: "",
	why: "",
	success: "",
	oneYear: "",
	fiveYears: "",
	days: "",
	wontDo: "",
	priority: "balanced",
};

export type PresetId = "balanced" | "money" | "passive" | "life";

export const PRESETS: { id: PresetId; label: string; desc: string; weights: Record<ScoreKey, number> }[] = [
	{
		id: "balanced",
		label: "⚖️ A bit of everything",
		desc: "Fast to start and able to run without me, with an eye on money and my life.",
		weights: { speed: 3, automation: 3, revenue: 2, life_plan_fit: 2, startup_cost: 1, time_to_first_eur: 1, synergy: 1, risk: 1 },
	},
	{
		id: "money",
		label: "💶 Money, soon",
		desc: "I need income first. Ideas that can pay quickly win.",
		weights: { speed: 2, automation: 1, revenue: 3, life_plan_fit: 2, startup_cost: 2, time_to_first_eur: 3, synergy: 1, risk: 1 },
	},
	{
		id: "passive",
		label: "🤖 Runs without me",
		desc: "I have little time. Ideas I can build once and automate win.",
		weights: { speed: 2, automation: 4, revenue: 2, life_plan_fit: 2, startup_cost: 1, time_to_first_eur: 1, synergy: 2, risk: 1 },
	},
	{
		id: "life",
		label: "🌱 Fits my life first",
		desc: "Money matters, but the life I want matters more.",
		weights: { speed: 1, automation: 2, revenue: 2, life_plan_fit: 4, startup_cost: 1, time_to_first_eur: 1, synergy: 1, risk: 2 },
	},
];

interface Field {
	key: keyof Profile;
	label: string;
	hint: string;
	long?: boolean;
}

interface Step {
	title: string;
	intro: string;
	fields: Field[];
}

const STEPS: Step[] = [
	{
		title: "👋 Welcome to your garage",
		intro: "A few quick questions so the garage can help you choose ideas that fit *you*. About 3 minutes. Skip anything you're not sure about; you can change it later.",
		fields: [],
	},
	{
		title: "🧰 What you have to work with",
		intro: "Your starting point. This is what makes ideas realistic.",
		fields: [
			{ key: "skills", label: "Skills and experience", hint: "e.g. 8 years in retail, good with Excel, I can sew", long: true },
			{ key: "enjoy", label: "Things I enjoy", hint: "e.g. cooking, drawing, helping people learn" },
			{ key: "hoursPerWeek", label: "Hours per week I can really give", hint: "e.g. 6" },
			{ key: "money", label: "Money I can put in to start", hint: "e.g. €300" },
			{ key: "where", label: "Where I live / languages", hint: "e.g. Austria, German + English" },
		],
	},
	{
		title: "🎯 Your goal",
		intro: "Every idea in the garage is a step toward something bigger.",
		fields: [
			{ key: "goal", label: "In one sentence, what do I want?", hint: "e.g. Earn €1,000 a month on my own by next summer", long: true },
			{ key: "why", label: "Why does it matter to me?", hint: "The real reason. It keeps you going on hard days.", long: true },
			{ key: "success", label: "How will I know I made it?", hint: "e.g. 3 products live, €1,000/month, by June" },
		],
	},
	{
		title: "🧭 Your life plan",
		intro: "An idea can be profitable and still be wrong for you. These answers keep your ideas honest.",
		fields: [
			{ key: "oneYear", label: "Where do I want to be in 1 year?", hint: "", long: true },
			{ key: "fiveYears", label: "Where do I want to be in 5 years?", hint: "", long: true },
			{ key: "days", label: "How do I want to spend my days?", hint: "time with family, health, freedom, the kind of work that feels good", long: true },
			{ key: "wontDo", label: "What will I NOT do, even for money?", hint: "", long: true },
		],
	},
	{
		title: "⚖️ What matters most right now?",
		intro: "This sets how the garage ranks your ideas. You can fine-tune it in settings anytime.",
		fields: [],
	},
	{
		title: "💡 Your first ideas",
		intro: "Write down any ideas you already have, one per line. They go into your Idea Inbox. No ideas yet? Copy the AI prompt below; it already knows your answers.",
		fields: [],
	},
];

export interface SetupResult {
	profile: Profile;
	ideas: string[];
}

export class SetupModal extends Modal {
	private step = 0;
	private profile: Profile;
	private ideasText = "";

	constructor(app: App, start: Profile, private onFinish: (result: SetupResult) => Promise<void>) {
		super(app);
		this.profile = { ...EMPTY_PROFILE, ...start };
	}

	onOpen(): void {
		this.modalEl.addClass("idea-garage-setup");
		this.draw();
	}

	private draw(): void {
		const { contentEl } = this;
		contentEl.empty();
		const step = STEPS[this.step];
		this.setTitle(step.title);

		const dots = contentEl.createDiv({ cls: "idea-garage-steps" });
		STEPS.forEach((_, i) => dots.createSpan({ cls: i === this.step ? "is-active" : i < this.step ? "is-done" : "" }));
		contentEl.createEl("p", { cls: "idea-garage-hint", text: step.intro.replace(/\*/g, "") });

		for (const f of step.fields) {
			const s = new Setting(contentEl).setName(f.label);
			if (f.hint) s.setDesc(f.hint);
			if (f.long) {
				s.addTextArea((t) => {
					t.setValue(this.profile[f.key]).onChange((v) => ((this.profile[f.key] as string) = v));
					t.inputEl.rows = 2;
				});
				s.settingEl.addClass("idea-garage-setting-long");
			} else {
				s.addText((t) => t.setValue(this.profile[f.key]).onChange((v) => ((this.profile[f.key] as string) = v)));
			}
		}

		if (this.step === 4) this.drawPresets(contentEl);
		if (this.step === 5) this.drawIdeas(contentEl);

		const nav = contentEl.createDiv({ cls: "idea-garage-setup-nav" });
		if (this.step > 0) {
			const back = nav.createEl("button", { text: "← Back" });
			back.addEventListener("click", () => {
				this.step--;
				this.draw();
			});
		} else {
			nav.createSpan();
		}
		const last = this.step === STEPS.length - 1;
		const next = nav.createEl("button", { cls: "mod-cta", text: this.step === 0 ? "Let's go →" : last ? "Finish 🎉" : "Next →" });
		next.addEventListener("click", () => {
			if (last) {
				void this.finish();
			} else {
				this.step++;
				this.draw();
			}
		});
	}

	private drawPresets(el: HTMLElement): void {
		const grid = el.createDiv({ cls: "idea-garage-presets" });
		for (const p of PRESETS) {
			const card = grid.createEl("button", { cls: "idea-garage-preset" });
			if (this.profile.priority === p.id) card.addClass("is-selected");
			card.createDiv({ cls: "idea-garage-preset-label", text: p.label });
			card.createDiv({ cls: "idea-garage-preset-desc", text: p.desc });
			card.addEventListener("click", () => {
				this.profile.priority = p.id;
				this.draw();
			});
		}
	}

	private drawIdeas(el: HTMLElement): void {
		new Setting(el)
			.setName("Ideas I already have")
			.setDesc("One per line")
			.addTextArea((t) => {
				t.setPlaceholder("Printable planners\nDog walking in my area\nTeach Excel to small businesses").setValue(this.ideasText).onChange((v) => (this.ideasText = v));
				t.inputEl.rows = 5;
			})
			.settingEl.addClass("idea-garage-setting-long");

		new Setting(el)
			.setName("🤖 No ideas yet?")
			.setDesc("Copies a prompt with your answers. Paste it into ChatGPT, Claude or Gemini, then paste the ideas you like here.")
			.addButton((b) =>
				b.setButtonText("Copy AI prompt").onClick(async () => {
					await navigator.clipboard.writeText(aiIdeaPrompt(this.profile));
					new Notice("📋 Prompt copied. Paste it into your AI chat.");
				})
			);
	}

	private async finish(): Promise<void> {
		const ideas = this.ideasText
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
		await this.onFinish({ profile: this.profile, ideas });
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function aiIdeaPrompt(p: Profile): string {
	const line = (label: string, value: string) => `- ${label}: ${value.trim() || "(not given)"}`;
	return [
		"You are a senior business consultant. Suggest 20 small business ideas that fit me personally. Use what I tell you below; don't suggest generic ideas that could fit anyone.",
		"",
		"About me:",
		line("Skills and experience", p.skills),
		line("Things I enjoy", p.enjoy),
		line("Hours per week", p.hoursPerWeek),
		line("Money to start", p.money),
		line("Where I live / languages", p.where),
		line("My goal", p.goal),
		line("Where I want to be in 1 year", p.oneYear),
		line("How I want to spend my days", p.days),
		line("What I won't do", p.wontDo),
		"",
		"Mix: some FAST to launch (under 2 weeks), some with GOOD REVENUE potential, and a few that would simply be FUN for me.",
		"Answer as a simple list: one idea per line, with a short reason why it fits me.",
	].join("\n");
}

/** Writes My Goal and Life Plan notes. Never overwrites: existing notes get a dated section added. */
export async function writeProfileNotes(app: App, p: Profile): Promise<void> {
	const date = window.moment().format("YYYY-MM-DD");
	const folder = app.vault.getAbstractFileByPath("2 My goal") instanceof TFolder ? "2 My goal" : "";
	const path = (name: string) => normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
	const val = (v: string) => v.trim() || "_(not filled in yet)_";

	const goal = [
		"## In one sentence, what do I want?",
		val(p.goal),
		"",
		"## Why does this matter to me?",
		val(p.why),
		"",
		"## How will I know I made it?",
		val(p.success),
		"",
	].join("\n");

	const life = [
		"## What I have to work with",
		`- **Skills and experience:** ${val(p.skills)}`,
		`- **Things I enjoy:** ${val(p.enjoy)}`,
		`- **Hours per week:** ${val(p.hoursPerWeek)}`,
		`- **Money to start:** ${val(p.money)}`,
		`- **Where / languages:** ${val(p.where)}`,
		"",
		"## Where do I want to be in 1 year?",
		val(p.oneYear),
		"",
		"## Where do I want to be in 5 years?",
		val(p.fiveYears),
		"",
		"## How do I want to spend my days?",
		val(p.days),
		"",
		"## What will I not do, even for money?",
		val(p.wontDo),
		"",
	].join("\n");

	await upsert(app, path("My Goal"), "# 🎯 My Goal", goal, date);
	await upsert(app, path("Life Plan"), "# 🧭 My Life Plan", life, date);
}

async function upsert(app: App, path: string, heading: string, body: string, date: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.process(existing, (data) => `${data.trimEnd()}\n\n---\n\n## ✍️ From my garage setup (${date})\n\n${body.replace(/^## /gm, "### ")}`);
	} else {
		await app.vault.create(path, `---\ntype: system\n---\n${heading}\n\n${body}`);
	}
}
