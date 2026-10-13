import { TFile } from "obsidian";

export type ScoreKey =
	| "speed"
	| "automation"
	| "revenue"
	| "life_plan_fit"
	| "startup_cost"
	| "time_to_first_eur"
	| "synergy"
	| "risk";

export interface Question {
	key: ScoreKey;
	emoji: string;
	short: string;
	question: string;
	low: string;
	high: string;
}

/** The 8 questions, in plain words. 5 is always the good side. */
export const QUESTIONS: Question[] = [
	{ key: "speed", emoji: "⚡", short: "Speed", question: "How fast can I launch it?", low: "over 3 months", high: "under 1 week" },
	{ key: "automation", emoji: "🤖", short: "Runs without me", question: "How much can run without me?", low: "under 20%", high: "over 80%" },
	{ key: "revenue", emoji: "💶", short: "Money", question: "How much could it earn per month, a year from now?", low: "under €100", high: "over €2,000" },
	{ key: "life_plan_fit", emoji: "🧭", short: "Fits my life", question: "How well does it fit the life I want?", low: "works against it", high: "it's at the core" },
	{ key: "startup_cost", emoji: "💰", short: "Cheap to start", question: "How cheap is it to start?", low: "over €5,000", high: "under €50" },
	{ key: "time_to_first_eur", emoji: "⏱️", short: "First sale soon", question: "How soon after launch could the first sale come?", low: "after 6+ months", high: "within a week" },
	{ key: "synergy", emoji: "🔗", short: "Reuses what I have", question: "Does it reuse things I already have?", low: "completely new", high: "mostly reused" },
	{ key: "risk", emoji: "🛡️", short: "Safe", question: "How safe is it (legal, platform, reputation)?", low: "risky", high: "very safe" },
];

export const STATUSES = ["parked", "debating", "planned", "in progress", "live", "automated", "paused", "dropped"];

export interface Idea {
	file: TFile;
	name: string;
	pitch: string;
	status: string;
	manualPick: boolean;
	manualReason: string;
	scores: Partial<Record<ScoreKey, number>>;
}

export function readScore(value: unknown): number | undefined {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (!Number.isFinite(n) || n < 1 || n > 5) return undefined;
	return Math.round(n);
}

export function missingCount(idea: Idea): number {
	return QUESTIONS.filter((q) => idea.scores[q.key] === undefined).length;
}

/** Weighted total, or undefined if any question is unanswered. */
export function totalScore(idea: Idea, weights: Record<ScoreKey, number>): number | undefined {
	let sum = 0;
	for (const q of QUESTIONS) {
		const v = idea.scores[q.key];
		if (v === undefined) return undefined;
		sum += v * weights[q.key];
	}
	return sum;
}

export function maxScore(weights: Record<ScoreKey, number>): number {
	return QUESTIONS.reduce((sum, q) => sum + 5 * weights[q.key], 0);
}

function partial(idea: Idea, parts: [ScoreKey, number][]): number | undefined {
	let sum = 0;
	for (const [key, w] of parts) {
		const v = idea.scores[key];
		if (v === undefined) return undefined;
		sum += v * w;
	}
	return sum;
}

/** Fastest and cheapest to launch (max 25). */
export function easyWin(idea: Idea): number | undefined {
	return partial(idea, [["speed", 2], ["startup_cost", 2], ["time_to_first_eur", 1]]);
}

/** Real money in soonest (max 25). */
export function fastRevenue(idea: Idea): number | undefined {
	return partial(idea, [["time_to_first_eur", 2], ["revenue", 2], ["speed", 1]]);
}
