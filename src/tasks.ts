import { App, TFile, normalizePath } from "obsidian";
import { Idea } from "./scoring";

export interface GarageTask {
	idea: Idea;
	file: TFile;
	line: number;
	raw: string;
	text: string;
	due?: string;
}

const TASK = /^(\s*)- \[( )\] (.*)$/;
const DUE = /\s*📅\s*(\d{4}-\d{2}-\d{2})/;

export function today(): string {
	return window.moment().format("YYYY-MM-DD");
}

/** The idea's To Do List note: "<folder>/<Idea> - To Do List.md". */
export function todoFileFor(app: App, idea: Idea): TFile | null {
	const folder = idea.file.parent?.path ?? "";
	const path = normalizePath(`${folder ? folder + "/" : ""}${idea.name} - To Do List.md`);
	const file = app.vault.getAbstractFileByPath(path);
	return file instanceof TFile ? file : null;
}

/** All open tasks from the To Do Lists of active ideas. */
export async function collectTasks(app: App, ideas: Idea[], activeStatuses: string[]): Promise<GarageTask[]> {
	const tasks: GarageTask[] = [];
	for (const idea of ideas) {
		if (!activeStatuses.includes(idea.status)) continue;
		const file = todoFileFor(app, idea);
		if (!file) continue;
		const lines = (await app.vault.cachedRead(file)).split("\n");
		lines.forEach((raw, line) => {
			const m = raw.match(TASK);
			if (!m) return;
			const body = m[3];
			const due = body.match(DUE)?.[1];
			const text = body.replace(DUE, "").trim();
			if (!text) return;
			tasks.push({ idea, file, line, raw, text, due });
		});
	}
	return tasks;
}

/** Changes one line, but only if it still looks the way we read it. */
async function editLine(app: App, task: GarageTask, change: (line: string) => string): Promise<boolean> {
	let ok = false;
	await app.vault.process(task.file, (data) => {
		const lines = data.split("\n");
		let idx = task.line;
		if (lines[idx] !== task.raw) idx = lines.indexOf(task.raw);
		if (idx === -1) return data;
		lines[idx] = change(lines[idx]);
		ok = true;
		return lines.join("\n");
	});
	return ok;
}

export function completeTask(app: App, task: GarageTask): Promise<boolean> {
	return editLine(app, task, (l) => `${l.replace("- [ ]", "- [x]")} ✅ ${today()}`);
}

export function setDue(app: App, task: GarageTask, date: string | null): Promise<boolean> {
	return editLine(app, task, (l) => {
		const clean = l.replace(DUE, "").trimEnd();
		return date ? `${clean} 📅 ${date}` : clean;
	});
}

/** Adds a task to an idea's To Do List (creates the note if needed). */
export async function addTask(app: App, idea: Idea, text: string, date: string | null): Promise<void> {
	const line = `- [ ] ${text.trim()}${date ? ` 📅 ${date}` : ""}`;
	let file = todoFileFor(app, idea);
	if (!file) {
		const folder = idea.file.parent?.path ?? "";
		const path = normalizePath(`${folder ? folder + "/" : ""}${idea.name} - To Do List.md`);
		file = await app.vault.create(
			path,
			["---", "type: idea-section", `idea: "[[${idea.name}]]"`, "section: To Do List", "---", "# ✅ To Do List", "", line, ""].join("\n")
		);
		return;
	}
	await app.vault.process(file, (data) => {
		const lines = data.split("\n");
		let lastTask = -1;
		lines.forEach((l, i) => {
			if (/^\s*- \[[ xX]\]/.test(l)) lastTask = i;
		});
		// Replace an empty placeholder "- [ ]" if there is one.
		const empty = lines.findIndex((l) => /^\s*- \[ \]\s*$/.test(l));
		if (empty !== -1) {
			lines[empty] = line;
		} else if (lastTask !== -1) {
			lines.splice(lastTask + 1, 0, line);
		} else {
			lines.push("", line);
		}
		return lines.join("\n");
	});
}

export type Bucket = "overdue" | "today" | "week" | "later" | "nodate";

export function bucketOf(task: GarageTask): Bucket {
	if (!task.due) return "nodate";
	const t = today();
	if (task.due < t) return "overdue";
	if (task.due === t) return "today";
	const weekEnd = window.moment().add(6, "days").format("YYYY-MM-DD");
	return task.due <= weekEnd ? "week" : "later";
}
