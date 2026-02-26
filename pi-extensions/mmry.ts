/**
 * mmry Extension - Persistent memory management for AI agents
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface Memory {
	id: string;
	content: string;
	type: "episodic" | "semantic" | "procedural";
	category?: string;
	tags?: string[];
	importance?: number;
	created_at?: string;
	updated_at?: string;
}

interface MemoryDetails {
	action: "add" | "search" | "list" | "delete" | "update";
	memories: Memory[];
	error?: string;
	message?: string;
}

const MemoryParams = Type.Object({
	action: StringEnum(["add", "search", "list", "delete", "update"] as const),
	content: Type.Optional(Type.String({ description: "Memory content (for add/update)" })),
	id: Type.Optional(Type.String({ description: "Memory ID (for delete/update)" })),
	query: Type.Optional(Type.String({ description: "Search query (for search)" })),
	type: Type.Optional(
		StringEnum(["episodic", "semantic", "procedural"] as const, {
			description: "Memory type (for add/filter search/list results)",
		}),
	),
	category: Type.Optional(Type.String({ description: "Category (for add/search)" })),
	tags: Type.Optional(Type.String({ description: "Tags as comma-separated list (for add)" })),
	importance: Type.Optional(Type.Number({ description: "Importance 1-10 (for add)" })),
	mode: Type.Optional(
		StringEnum(["hybrid", "keyword", "fuzzy", "semantic", "bm25", "sparse"] as const, {
			description: "Search mode (for search)",
		}),
	),
	limit: Type.Optional(Type.Number({ description: "Result limit (for search/list)" })),
});

async function execMmry(args: string[]): Promise<{ stdout: string; stderr: string }> {
	try {
		const { stdout, stderr } = await execFileAsync("mmry", args, {
			maxBuffer: 10 * 1024 * 1024,
		});
		return { stdout, stderr };
	} catch (error: unknown) {
		if (error instanceof Error) {
			throw new Error(`mmry execution failed: ${error.message}`);
		}
		throw error;
	}
}

function parseMemoriesFromJson(json: string): Memory[] {
	try {
		const data = JSON.parse(json);
		// Handle mmry JSON structure: 
		// - { memories: [...] } for search/list
		// - { memory: {...} } for add
		// - direct array or object
		let memories: any[] = [];
		
		if (data.memories && Array.isArray(data.memories)) {
			// search/ls format: { memories: [...] }
			memories = data.memories;
		} else if (data.memory && typeof data.memory === "object") {
			// add format: { memory: {...} }
			memories = [data.memory];
		} else if (Array.isArray(data)) {
			// direct array
			memories = data;
		} else if (typeof data === "object" && data.id) {
			// single memory object
			memories = [data];
		}

		// Map mmry flat structure (memory_type) to our interface (type)
		memories = memories.map((item: any) => {
			return {
				id: item.id,
				content: item.content,
				type: item.memory_type || item.type || "semantic",
				category: item.category,
				tags: item.tags,
				importance: item.importance,
				created_at: item.created_at,
				updated_at: item.updated_at,
			};
		});

		// Deduplicate by ID
		const seen = new Set<string>();
		return memories.filter((m) => {
			if (!m || !m.id) return false;
			if (seen.has(m.id)) return false;
			seen.add(m.id);
			return true;
		});
	} catch {
		return [];
	}
}

class MemoryListComponent {
	private memories: Memory[];
	private theme: Theme;
	private onClose: () => void;
	private selectedIndex: number = 0;
	private searchQuery: string = "";
	private isSearchMode: boolean = false;
	private isViewMode: boolean = false;
	private isViewingSearchResults: boolean = false;
	private searchResults: Memory[] = [];
	private currentPage: number = 0;
	private pageSize: number = 6;
	private cachedWidth?: number;
	private cachedLines?: string[];
	private execMmry: (args: string[]) => Promise<{ stdout: string; stderr: string }>;
	private deleteConfirm: boolean = false;
	private deleteConfirmTimer?: NodeJS.Timeout;

	constructor(
		memories: Memory[],
		theme: Theme,
		onClose: () => void,
		execMmry: (args: string[]) => Promise<{ stdout: string; stderr: string }>,
	) {
		this.memories = memories;
		this.theme = theme;
		this.onClose = onClose;
		this.execMmry = execMmry;
	}

	async handleInput(data: string): Promise<void> {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			if (this.deleteConfirm) {
				this.deleteConfirm = false;
				if (this.deleteConfirmTimer) clearTimeout(this.deleteConfirmTimer);
				this.invalidate();
				return;
			}
			if (this.isViewMode) {
				this.isViewMode = false;
				this.invalidate();
				return;
			}
			if (this.isSearchMode) {
				this.isSearchMode = false;
				this.searchQuery = "";
				this.selectedIndex = 0;
				this.currentPage = 0;
				this.invalidate();
				return;
			}
			if (this.isViewingSearchResults) {
				this.isViewingSearchResults = false;
				this.searchResults = [];
				this.searchQuery = "";
				this.selectedIndex = 0;
				this.currentPage = 0;
				this.invalidate();
				return;
			}
			this.onClose();
			return;
		}

		if (this.isViewMode) {
			if (matchesKey(data, "d")) {
				this.deleteConfirm = true;
				if (this.deleteConfirmTimer) clearTimeout(this.deleteConfirmTimer);
				this.deleteConfirmTimer = setTimeout(() => {
					this.deleteConfirm = false;
					this.invalidate();
				}, 3000);
				this.invalidate();
			} else if (this.deleteConfirm && matchesKey(data, "y")) {
				await this.deleteMemory();
				this.isViewMode = false;
				this.deleteConfirm = false;
				this.invalidate();
			}
			return;
		}

		if (this.isSearchMode) {
			if (matchesKey(data, "enter")) {
				await this.performSearch();
				this.isSearchMode = false;
				this.isViewingSearchResults = true;
				this.invalidate();
			} else if (matchesKey(data, "backspace")) {
				this.searchQuery = this.searchQuery.slice(0, -1);
				this.invalidate();
			} else if (data.length === 1 && /[a-zA-Z0-9\s\-_:.,;?!@#$%^&*()+=\[\]{}|\\<>]/.test(data)) {
				this.searchQuery += data;
				this.invalidate();
			}
		} else {
			const displayMemories = this.getDisplayMemories();
			const totalPages = Math.ceil(displayMemories.length / this.pageSize);
			const startIdx = this.currentPage * this.pageSize;
			const pageMemories = displayMemories.slice(startIdx, startIdx + this.pageSize);

			if (matchesKey(data, "down") || matchesKey(data, "j")) {
				if (this.selectedIndex < pageMemories.length - 1) {
					this.selectedIndex++;
				} else if (this.currentPage < totalPages - 1) {
					this.currentPage++;
					this.selectedIndex = 0;
				}
				this.invalidate();
			} else if (matchesKey(data, "up") || matchesKey(data, "k")) {
				if (this.selectedIndex > 0) {
					this.selectedIndex--;
				} else if (this.currentPage > 0) {
					this.currentPage--;
					this.selectedIndex = this.pageSize - 1;
				}
				this.invalidate();
			} else if (matchesKey(data, "pagedown") || matchesKey(data, "ctrl+d")) {
				this.currentPage = Math.min(this.currentPage + 1, totalPages - 1);
				this.selectedIndex = 0;
				this.invalidate();
			} else if (matchesKey(data, "pageup") || matchesKey(data, "ctrl+u")) {
				this.currentPage = Math.max(this.currentPage - 1, 0);
				this.selectedIndex = 0;
				this.invalidate();
			} else if (matchesKey(data, "/")) {
				this.isSearchMode = true;
				this.searchQuery = "";
				this.invalidate();
			} else if (matchesKey(data, "g")) {
				this.selectedIndex = 0;
				this.currentPage = 0;
				this.invalidate();
			} else if (matchesKey(data, "G")) {
				this.currentPage = Math.max(totalPages - 1, 0);
				const lastPage = displayMemories.slice(this.currentPage * this.pageSize, this.currentPage * this.pageSize + this.pageSize);
				this.selectedIndex = Math.max(lastPage.length - 1, 0);
				this.invalidate();
			} else if (matchesKey(data, "enter") || matchesKey(data, "v")) {
				if (displayMemories.length > 0) {
					this.isViewMode = true;
					this.invalidate();
				}
			} else if (matchesKey(data, "d")) {
				if (displayMemories.length > 0) {
					this.deleteConfirm = true;
					if (this.deleteConfirmTimer) clearTimeout(this.deleteConfirmTimer);
					this.deleteConfirmTimer = setTimeout(() => {
						this.deleteConfirm = false;
						this.invalidate();
					}, 3000);
					this.invalidate();
				}
			} else if (this.deleteConfirm && matchesKey(data, "y")) {
				await this.deleteMemory();
				this.invalidate();
			}
		}
	}

	private async performSearch(): Promise<void> {
		if (!this.searchQuery.trim()) {
			this.searchResults = [];
			return;
		}
		try {
			const { stdout } = await this.execMmry(["search", this.searchQuery, "--json", "--limit", "100"]);
			const data = JSON.parse(stdout);
			const results = Array.isArray(data) ? data : [data];
			const seen = new Set<string>();
			this.searchResults = results.filter((m) => {
				if (seen.has(m.id)) return false;
				seen.add(m.id);
				return true;
			});
		} catch {
			this.searchResults = [];
		}
		this.selectedIndex = 0;
		this.currentPage = 0;
	}

	private async deleteMemory(): Promise<void> {
		const displayMemories = this.getDisplayMemories();
		const mem = displayMemories[this.currentPage * this.pageSize + this.selectedIndex];
		if (!mem) return;
		try {
			await this.execMmry(["delete", mem.id, "--yes"]);
			this.memories = this.memories.filter((m) => m.id !== mem.id);
			this.searchResults = this.searchResults.filter((m) => m.id !== mem.id);
			const updated = this.getDisplayMemories();
			if (this.selectedIndex >= updated.length && this.selectedIndex > 0) {
				this.selectedIndex--;
			}
		} catch {
			// Silently fail
		}
	}

	private getDisplayMemories(): Memory[] {
		return this.isViewingSearchResults ? this.searchResults : this.memories;
	}

	private getSelectedMemory(): Memory | undefined {
		const displayMemories = this.getDisplayMemories();
		return displayMemories[this.currentPage * this.pageSize + this.selectedIndex];
	}

	render(width: number): string[] {
		if (this.cachedWidth && this.cachedWidth === width && !this.deleteConfirm) {
			return this.cachedLines || [];
		}

		const lines: string[] = [];
		const th = this.theme;
		lines.push("");

		if (this.isViewMode) {
			const mem = this.getSelectedMemory();
			if (!mem) {
				lines.push(truncateToWidth(th.fg("error", "Memory not found"), width));
			} else {
				const title = th.fg("accent", " Memory Details ");
				lines.push(truncateToWidth(th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 18))), width));
				lines.push("");
				const memType = mem.type || "semantic";
				const typeColor = ({ episodic: "muted", semantic: "accent", procedural: "success" } as any)[memType];
				lines.push(truncateToWidth(`  ${th.fg(typeColor || "muted", memType.toUpperCase())}`, width));
				if (mem.importance) lines.push(truncateToWidth(`  ${th.fg("dim", `Importance: ${mem.importance}/10`)}`, width));
				if (mem.category) lines.push(truncateToWidth(`  ${th.fg("dim", `Category: ${mem.category}`)}`, width));
				if (mem.tags?.length) lines.push(truncateToWidth(`  Tags: ${mem.tags.map((t) => th.fg("dim", `#${t}`)).join(" ")}`, width));
				lines.push("");
				lines.push(truncateToWidth(th.fg("borderMuted", "─".repeat(width)), width));
				lines.push("");
				for (const line of this.wrapText(mem.content || "", width - 4)) {
					lines.push(truncateToWidth(`  ${line}`, width));
				}
				lines.push("");
				lines.push(truncateToWidth(th.fg("borderMuted", "─".repeat(width)), width));
				lines.push("");
				lines.push(truncateToWidth(th.fg("dim", `ID: ${mem.id}`), width));
				if (mem.created_at) lines.push(truncateToWidth(th.fg("dim", `Created: ${mem.created_at}`), width));
				if (mem.updated_at) lines.push(truncateToWidth(th.fg("dim", `Updated: ${mem.updated_at}`), width));
				lines.push("");
				lines.push(truncateToWidth(this.deleteConfirm ? th.fg("error", "Delete this memory? (y/n)") : th.fg("dim", "d: delete | Esc: back"), width));
			}
		} else if (this.isSearchMode) {
			const title = th.fg("accent", " Search Memories ");
			lines.push(truncateToWidth(th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 18))), width));
			lines.push("");
			lines.push(truncateToWidth(th.fg("muted", "Search: ") + th.fg("text", this.searchQuery) + th.fg("dim", "_"), width));
			lines.push("");
			lines.push(truncateToWidth(th.fg("dim", "Type to search, Enter to execute, Esc to cancel"), width));
		} else {
			const title = th.fg("accent", " Memories ");
			lines.push(truncateToWidth(th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 12))), width));
			lines.push("");

			const displayMemories = this.getDisplayMemories();
			if (displayMemories.length === 0) {
				lines.push(truncateToWidth(`  ${th.fg("dim", "No memories yet. Ask the agent to add some!")}`, width));
			} else {
				const typeCount = {
					episodic: displayMemories.filter((m) => m.type === "episodic").length,
					semantic: displayMemories.filter((m) => m.type === "semantic").length,
					procedural: displayMemories.filter((m) => m.type === "procedural").length,
				};
				const statusText = this.isViewingSearchResults ? ` (search: "${this.searchQuery}")` : "";
				lines.push(truncateToWidth(`  ${th.fg("muted", `${displayMemories.length}${statusText} total: ${typeCount.episodic} episodic, ${typeCount.semantic} semantic, ${typeCount.procedural} procedural`)}`, width));
				lines.push("");

				const totalPages = Math.ceil(displayMemories.length / this.pageSize);
				const startIdx = this.currentPage * this.pageSize;
				const pageMemories = displayMemories.slice(startIdx, startIdx + this.pageSize);

				for (let i = 0; i < pageMemories.length; i++) {
					const mem = pageMemories[i];
					const isSelected = i === this.selectedIndex;
					const memType = mem.type || "semantic";
					const typeColor = ({ episodic: "muted", semantic: "accent", procedural: "success" } as any)[memType];
					const typeLabel = th.fg(typeColor || "muted", memType.substring(0, 3).toUpperCase());
					const importance = mem.importance ? th.fg("dim", `[${mem.importance}/10]`) : "";
					const content = this.truncateContent(mem.content, width - 40);
					const prefix = isSelected ? th.fg("accent", "❯ ") : "  ";
					const bgColor = isSelected ? th.bg("selectedBg", " ") : "";
					lines.push(truncateToWidth(`${prefix}${typeLabel} ${importance} ${th.fg("text", content)}${bgColor}`, width));
				}

				if (totalPages > 1) {
					lines.push(truncateToWidth(`  ${th.fg("dim", `Page ${this.currentPage + 1}/${totalPages}`)}`, width));
				}
			}

			lines.push("");
			lines.push(truncateToWidth(
				this.deleteConfirm
					? th.fg("error", "Delete this memory? (y/n)")
					: th.fg("dim", "↑↓/jk: navigate | /: search | v: view | d: delete | g/G: start/end | Esc: close"),
				width,
			));
		}

		lines.push("");
		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	private truncateContent(content: string | undefined, maxLen: number): string {
		const singleLine = (content || "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
		return singleLine.length > maxLen ? singleLine.substring(0, maxLen - 3) + "..." : singleLine;
	}

	private wrapText(text: string, maxWidth: number): string[] {
		const lines: string[] = [];
		for (const line of text.split("\n")) {
			if (line.length <= maxWidth) {
				lines.push(line);
			} else {
				let currentLine = "";
				for (const word of line.split(" ")) {
					if ((currentLine + " " + word).length > maxWidth) {
						if (currentLine) lines.push(currentLine);
						currentLine = word;
					} else {
						currentLine = currentLine ? currentLine + " " + word : word;
					}
				}
				if (currentLine) lines.push(currentLine);
			}
		}
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

export default function (pi: ExtensionAPI) {
	let memoryCache: Memory[] = [];

	const reconstructCache = (ctx: ExtensionContext) => {
		memoryCache = [];
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (msg.role !== "toolResult" || msg.toolName !== "memory") continue;
			const details = msg.details as MemoryDetails | undefined;
			if (details?.memories) {
				if (details.action === "list" || details.action === "search") {
					memoryCache = details.memories;
				} else if (details.action === "add" && details.memories.length > memoryCache.length) {
					memoryCache = details.memories;
				}
			}
		}
	};

	pi.on("session_start", async (_event, ctx) => reconstructCache(ctx));
	pi.on("session_switch", async (_event, ctx) => reconstructCache(ctx));
	pi.on("session_fork", async (_event, ctx) => reconstructCache(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructCache(ctx));

	pi.registerTool({
		name: "memory",
		label: "Memory",
		description: "Manage persistent memories. Actions: add (content, type, category, tags, importance), search (query, mode, limit, type), list (limit, type), delete (id), update (id, content)",
		parameters: MemoryParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			try {
				switch (params.action) {
					case "add": {
						if (!params.content) {
							return {
								content: [{ type: "text", text: "Error: content required for add" }],
								details: { action: "add", memories: [...memoryCache], error: "content required" } as MemoryDetails,
							};
						}
						const args = ["add", params.content, "--json"];
						if (params.type) args.push("--memory-type", params.type);
						if (params.category) args.push("--category", params.category);
						if (params.tags) args.push("--tags", params.tags);
						if (params.importance) args.push("--importance", params.importance.toString());
						const { stdout } = await execMmry(args);
						const added = parseMemoriesFromJson(stdout);
						if (added.length > 0) {
							memoryCache.push(...added);
							return {
								content: [{ type: "text", text: `Added memory: ${(added[0]?.content || "").substring(0, 50)}...` }],
								details: { action: "add", memories: [...memoryCache], message: `Added ${added.length} memory(ies)` } as MemoryDetails,
							};
						}
						return {
							content: [{ type: "text", text: "Memory added but could not parse response" }],
							details: { action: "add", memories: [...memoryCache] } as MemoryDetails,
						};
					}

					case "search": {
						if (!params.query) {
							return {
								content: [{ type: "text", text: "Error: query required for search" }],
								details: { action: "search", memories: [], error: "query required" } as MemoryDetails,
							};
						}
						const args = ["search", params.query, "--json"];
						if (params.mode) args.push("--mode", params.mode);
						if (params.limit) args.push("--limit", params.limit.toString());
						if (params.category) args.push("--category", params.category);
						const { stdout } = await execMmry(args);
						let results = parseMemoriesFromJson(stdout);
						if (params.type) results = results.filter((m) => m.type === params.type);
						memoryCache = results;
						const displayText = results.map((m) => {
							const tags = m.tags?.length ? `[${m.tags.join(", ")}]` : "[no-tags]";
							const category = m.category ? `(${m.category})` : "(uncategorized)";
							const preview = (m.content || "").substring(0, 50);
							return `- [${m.type || "?"}] ${category} ${tags}\n  ${preview}...`;
						}).join("\n");
						return {
							content: [{ type: "text", text: `Found ${results.length} memory(ies):\n${displayText}` }],
							details: { action: "search", memories: results, message: `Found ${results.length} results` } as MemoryDetails,
						};
					}

					case "list": {
						const args = ["ls", "--json"];
						if (params.limit) args.push("--limit", params.limit.toString());
						const { stdout } = await execMmry(args);
						const memories = parseMemoriesFromJson(stdout);
						memoryCache = memories;
						const filtered = params.type ? memories.filter((m) => m.type === params.type) : memories;
						const displayText = filtered.map((m) => {
							const tags = m.tags?.length ? `[${m.tags.join(", ")}]` : "[no-tags]";
							const category = m.category ? `(${m.category})` : "(uncategorized)";
							const preview = (m.content || "").substring(0, 50);
							return `- [${m.type || "?"}] ${category} ${tags}\n  ${preview}...`;
						}).join("\n");
						return {
							content: [{ type: "text", text: `${filtered.length} memory(ies):\n${displayText}` }],
							details: { action: "list", memories: filtered, message: `Listed ${filtered.length} memories` } as MemoryDetails,
						};
					}

					case "delete": {
						if (!params.id) {
							return {
								content: [{ type: "text", text: "Error: id required for delete" }],
								details: { action: "delete", memories: [...memoryCache], error: "id required" } as MemoryDetails,
							};
						}
						await execMmry(["rm", params.id]);
						memoryCache = memoryCache.filter((m) => m.id !== params.id);
						return {
							content: [{ type: "text", text: `Deleted memory ${params.id}` }],
							details: { action: "delete", memories: [...memoryCache], message: "Deleted memory" } as MemoryDetails,
						};
					}

					case "update": {
						if (!params.id || !params.content) {
							return {
								content: [{ type: "text", text: "Error: id and content required for update" }],
								details: { action: "update", memories: [...memoryCache], error: "id and content required" } as MemoryDetails,
							};
						}
						const existing = memoryCache.find((m) => m.id === params.id);
						if (!existing) {
							return {
								content: [{ type: "text", text: `Memory ${params.id} not found` }],
								details: { action: "update", memories: [...memoryCache], error: "memory not found" } as MemoryDetails,
							};
						}
						await execMmry(["delete", params.id, "--yes"]);
						const addArgs = ["add", params.content, "--json"];
						if (existing.type) addArgs.push("--memory-type", existing.type);
						if (existing.category) addArgs.push("--category", existing.category);
						if (existing.tags?.length) addArgs.push("--tags", existing.tags.join(","));
						if (existing.importance) addArgs.push("--importance", existing.importance.toString());
						const { stdout } = await execMmry(addArgs);
						const updated = parseMemoriesFromJson(stdout);
						memoryCache = memoryCache.filter((m) => m.id !== params.id);
						if (updated.length > 0) memoryCache.push(...updated);
						return {
							content: [{ type: "text", text: `Updated memory ${params.id}` }],
							details: { action: "update", memories: [...memoryCache], message: "Memory updated" } as MemoryDetails,
						};
					}

					default:
						return {
							content: [{ type: "text", text: `Unknown action: ${params.action}` }],
							details: { action: "list", memories: [...memoryCache], error: `unknown action: ${params.action}` } as MemoryDetails,
						};
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${errorMsg}` }],
					details: { action: params.action, memories: [...memoryCache], error: errorMsg } as MemoryDetails,
				};
			}
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("memory ")) + theme.fg("muted", args.action);
			if (args.content) text += ` ${theme.fg("dim", `"${(args.content || "").substring(0, 30)}..."`)}`;
			if (args.query) text += ` ${theme.fg("accent", `query="${(args.query || "").substring(0, 20)}"`)}`;
			if (args.id) text += ` ${theme.fg("accent", `id="${(args.id || "").substring(0, 8)}"`)}`;
			if (args.type) text += ` ${theme.fg("dim", `[${args.type}]`)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as MemoryDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}
			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}
			const memories = details.memories;
			switch (details.action) {
				case "list":
				case "search": {
					if (memories.length === 0) return new Text(theme.fg("dim", "No memories"), 0, 0);
					let listText = theme.fg("muted", `${memories.length} memory(ies):`);
					const display = expanded ? memories : memories.slice(0, 5);
					for (const mem of display) {
						if (!mem) continue;
						const memType = (mem.type || "semantic").toString();
						const typeColor = ({ episodic: "muted", semantic: "accent", procedural: "success" } as any)[memType];
						const typeLabel = theme.fg(typeColor || "muted", memType.substring(0, 3).toUpperCase());
						const importance = mem.importance ? theme.fg("dim", `[${mem.importance}/10]`) : "";
						const content = (mem.content || "").substring(0, 50);
						listText += `\n${typeLabel} ${importance} ${theme.fg("text", content)}`;
					}
					if (!expanded && memories.length > 5) {
						listText += `\n${theme.fg("dim", `... ${memories.length - 5} more`)}`;
					}
					return new Text(listText, 0, 0);
				}
				case "add": {
					const added = memories[memories.length - 1];
					return new Text(
						theme.fg("success", "✓ Added ") +
						theme.fg("muted", (added?.content || "").substring(0, 40)) +
						theme.fg("dim", ` [${added?.type || "?"}]`),
						0, 0,
					);
				}
				case "delete":
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Memory deleted"), 0, 0);
				case "update":
					return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Memory updated"), 0, 0);
				default:
					return new Text(theme.fg("muted", details.message || "Done"), 0, 0);
			}
		},
	});

	pi.registerCommand("memories", {
		description: "Show all memories with search and navigation",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/memories requires interactive mode", "error");
				return;
			}
			try {
				const { stdout } = await execMmry(["ls", "--json", "--limit", "100"]);
				const memories = parseMemoriesFromJson(stdout);
				memoryCache = memories;
				const seen = new Set<string>();
				const uniqueMemories = memories.filter((m) => {
					if (seen.has(m.id)) return false;
					seen.add(m.id);
					return true;
				});
				await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
					const component = new MemoryListComponent(uniqueMemories, theme, () => done(), execMmry);
					return {
						render: (width: number) => component.render(width),
						handleInput: (data: string) => component.handleInput(data),
					};
				});
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to load memories: ${errorMsg}`, "error");
			}
		},
	});
}
