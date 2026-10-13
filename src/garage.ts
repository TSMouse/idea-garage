import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Idea, QUESTIONS, readScore } from "./scoring";

export interface InboxItem {
	raw: string;
	name: string;
}

export const SECTIONS: { name: string; emoji: string; question: string; prompts: string[] }[] = [
	{ name: "Business Plan", emoji: "💼", question: "What is it, who is it for, and why would they pay?", prompts: ["What it is", "Who it's for", "Why they would pay", "How it makes money"] },
	{ name: "Structure Plan", emoji: "🏗️", question: "How will I build and run it?", prompts: ["How I build it", "How it runs", "What runs without me", "Tools"] },
	{ name: "To Do List", emoji: "✅", question: "What are my next small steps?", prompts: [] },
	{ name: "Marketing Plan", emoji: "📣", question: "How will people find it?", prompts: ["Who I'm talking to", "Where they hang out", "My first 3 posts or actions"] },
	{ name: "Expected Revenue", emoji: "📈", question: "What will it cost, and what could it earn?", prompts: ["Costs", "Price", "Sales per month (a guess is fine)", "Break-even"] },
	{ name: "Lessons Learned", emoji: "🌱", question: "What worked, what didn't, and what did I discover?", prompts: [] },
];

const PITCH_PATTERN = /^\*\*(?:In one sentence|One-line pitch):\*\*\s*(.*)$/m;

/** Characters that aren't allowed in file names on some systems. */
export function cleanName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
}

function today(): string {
	return window.moment().format("YYYY-MM-DD");
}

export class Garage {
	constructor(private app: App, private getIdeasFolder: () => string, private getInboxPath: () => string) {}

	/** The ideas folder: the setting, or "4 Ideas" from the template, or "Ideas". */
	ideasFolder(): string {
		const set = this.getIdeasFolder();
		if (set) return normalizePath(set);
		if (this.app.vault.getAbstractFileByPath("4 Ideas") instanceof TFolder) return "4 Ideas";
		return "Ideas";
	}

	/** The inbox note: the setting, or the template's inbox, or "Idea Inbox.md". */
	inboxPath(): string {
		const set = this.getInboxPath();
		if (set) return normalizePath(set.endsWith(".md") ? set : `${set}.md`);
		const templateInbox = "3 Idea Inbox/Idea Inbox.md";
		if (this.app.vault.getAbstractFileByPath(templateInbox) instanceof TFile) return templateInbox;
		return "Idea Inbox.md";
	}

	/** All idea cards in the vault (type: idea), skipping templates. */
	async loadIdeas(): Promise<Idea[]> {
		const ideas: Idea[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (/(^|\/)Templates\//i.test(file.path)) continue;
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm || fm.type !== "idea") continue;
			if (file.basename.includes("{{")) continue;

			const scores: Idea["scores"] = {};
			for (const q of QUESTIONS) {
				const v = readScore(fm[q.key]);
				if (v !== undefined) scores[q.key] = v;
			}

			let pitch = typeof fm.pitch === "string" ? fm.pitch : "";
			if (!pitch) {
				const text = await this.app.vault.cachedRead(file);
				pitch = text.match(PITCH_PATTERN)?.[1]?.trim() ?? "";
			}

			ideas.push({
				file,
				name: file.basename,
				pitch,
				status: typeof fm.status === "string" && fm.status ? fm.status : "parked",
				manualPick: fm.manual_pick === true || fm.manual_pick === "true",
				manualReason: typeof fm.manual_reason === "string" ? fm.manual_reason : "",
				scores,
			});
		}
		return ideas;
	}

	private async ensureFolder(path: string): Promise<void> {
		if (!path || this.app.vault.getAbstractFileByPath(path)) return;
		const parts = path.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	/** Creates the idea folder, the idea card and its six notes. Returns the card. */
	async createIdea(rawName: string, pitch: string): Promise<TFile> {
		const name = cleanName(rawName);
		if (!name) throw new Error("Please give your idea a name.");
		const folder = normalizePath(`${this.ideasFolder()}/${name}`);
		const cardPath = normalizePath(`${folder}/${name}.md`);
		if (this.app.vault.getAbstractFileByPath(cardPath)) {
			throw new Error(`"${name}" is already in your garage.`);
		}
		await this.ensureFolder(folder);

		const scoreLines = QUESTIONS.map((q) => `${q.key}:`).join("\n");
		const links = SECTIONS.map((s) => `- [[${name} - ${s.name}]]`).join("\n");
		const card = [
			"---",
			"type: idea",
			"status: parked",
			"parent:",
			"manual_pick: false",
			"manual_reason:",
			scoreLines,
			`added: ${today()}`,
			"---",
			"",
			`# ${name}`,
			"",
			`**In one sentence:** ${pitch.trim()}`,
			"",
			"## 📂 My six notes",
			"_Start with the Business Plan and To Do List; the rest can come later._",
			links,
			"",
			"## 🔢 My scores",
			"Open the **Idea Garage** panel and click **Score** on this idea. Eight quick questions, and your total appears by itself.",
			"",
			"## 📝 My decisions",
			`- ${today()}: Parked in the garage.`,
			"",
		].join("\n");
		const cardFile = await this.app.vault.create(cardPath, card);

		for (const s of SECTIONS) {
			const path = normalizePath(`${folder}/${name} - ${s.name}.md`);
			if (this.app.vault.getAbstractFileByPath(path)) continue;
			const body: string[] = [
				"---",
				"type: idea-section",
				`idea: "[[${name}]]"`,
				`section: ${s.name}`,
				"---",
				`# ${s.emoji} ${s.name}`,
				"",
				`> ${s.question}`,
				"",
			];
			if (s.name === "To Do List") {
				body.push("- [ ] ", "");
			} else if (s.name === "Lessons Learned") {
				body.push("## ✅ What worked", "", "## ❌ What didn't work (and that's OK)", "", "## 🔎 What I found online", "", "| Date | What I found | Source |", "|---|---|---|", "");
			} else {
				for (const p of s.prompts) body.push(`## ${p}`, "", "");
			}
			body.push(`➡️ Back to [[${name}]]`, "");
			await this.app.vault.create(path, body.join("\n"));
		}
		return cardFile;
	}

	/** Ideas written in the Inbox table (rows with something in the "Idea" column). */
	async inboxItems(): Promise<InboxItem[]> {
		const file = this.app.vault.getAbstractFileByPath(this.inboxPath());
		if (!(file instanceof TFile)) return [];
		const text = await this.app.vault.cachedRead(file);
		const items: InboxItem[] = [];
		for (const line of text.split("\n")) {
			const cells = this.tableCells(line);
			if (!cells || cells.length < 2) continue;
			const idea = cells[1];
			if (!idea || idea === "Idea" || /^-+$/.test(idea)) continue;
			const bold = idea.match(/\*\*(.+?)\*\*/);
			items.push({ raw: idea, name: cleanName(bold ? bold[1] : idea) });
		}
		return items;
	}

	private tableCells(line: string): string[] | null {
		const t = line.trim();
		if (!t.startsWith("|") || !t.endsWith("|")) return null;
		return t.slice(1, -1).split("|").map((c) => c.trim());
	}

	/** Adds an idea to the Inbox table (fills the first empty row, or adds a new one). */
	async capture(idea: string): Promise<void> {
		const text = idea.replace(/\|/g, "/").trim();
		if (!text) return;
		const path = this.inboxPath();
		let file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
			await this.ensureFolder(dir);
			file = await this.app.vault.create(
				path,
				[
					"# 📥 Idea Inbox",
					"",
					"The first stop for every idea. **Write it down and let it go.** No judging yet.",
					"",
					"| # | Idea | Type | Rough cost | Notes | Builds on |",
					"|---|---|---|---|---|---|",
					"",
					"## 🚗 Moved into the garage",
					"",
				].join("\n")
			);
		}
		await this.app.vault.process(file as TFile, (data) => {
			const lines = data.split("\n");
			let headerIdx = -1;
			let lastRow = -1;
			let maxNum = 0;
			for (let i = 0; i < lines.length; i++) {
				const cells = this.tableCells(lines[i]);
				if (!cells) continue;
				if (headerIdx === -1 && cells[0] === "#" && cells[1] === "Idea") {
					headerIdx = i;
					lastRow = i + 1;
					continue;
				}
				if (headerIdx !== -1 && i === lastRow + 1) {
					lastRow = i;
					const n = Number(cells[0]);
					if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
					if (!cells[1]) {
						cells[1] = text;
						lines[i] = `| ${cells.join(" | ")} |`;
						return lines.join("\n");
					}
				}
			}
			const row = `| ${maxNum + 1} | ${text} | | | | |`;
			if (headerIdx === -1) {
				lines.push("", "| # | Idea | Type | Rough cost | Notes | Builds on |", "|---|---|---|---|---|---|", row);
			} else {
				lines.splice(lastRow + 1, 0, row);
			}
			return lines.join("\n");
		});
	}

	/** Removes an idea from the Inbox and notes where it went. */
	async markMoved(idea: string, cardName: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.inboxPath());
		if (!(file instanceof TFile)) return;
		await this.app.vault.process(file, (data) => {
			const lines = data.split("\n");
			const idx = lines.findIndex((l) => this.tableCells(l)?.[1] === idea);
			if (idx !== -1) lines.splice(idx, 1);
			const entry = `- ${today()} → [[${cardName}]]`;
			const heading = lines.findIndex((l) => /^#{2,3}\s.*(Moved into the garage|Promoted so far)/i.test(l));
			if (heading !== -1) {
				let insertAt = heading + 1;
				while (insertAt < lines.length && !/^#/.test(lines[insertAt])) insertAt++;
				while (insertAt > heading + 1 && lines[insertAt - 1].trim() === "") insertAt--;
				lines.splice(insertAt, 0, entry);
			} else {
				lines.push("", "## 🚗 Moved into the garage", entry);
			}
			return lines.join("\n");
		});
	}
}
