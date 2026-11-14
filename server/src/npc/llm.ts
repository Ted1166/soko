import type { Archetype } from "./personalities.js";

export interface LlmConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface NarrateInput {
    archetype: Archetype;
    npcName: string;
    persona: string;
    good: string;
    pct: number;
    windowSeconds: number;
}

export class Llm {
    constructor(private readonly config: LlmConfig | null) { }

    get enabled(): boolean {
        return this.config !== null;
    }

    async narrate(input: NarrateInput): Promise<string | null> {
        if (!this.config) {
            return null;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4_000);
        try {
            const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: 80,
                    temperature: 0.9,
                    messages: [
                        {
                            role: "system",
                            content: `You are ${input.npcName}, a market trader in a Swahili-flavoured market town. Personality: ${input.archetype.blurb} ${input.persona}. Speak in one short radio call to your boss, at most 28 words, plain text, no quotes.`,
                        },
                        {
                            role: "user",
                            content: `A rival has undercut your ${input.good} by ${input.pct} percent. Ask the boss to choose match, hold or dump. End with "Match, hold or dump? ${input.windowSeconds}s."`,
                        },
                    ],
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                return null;
            }
            const body = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            const text = body.choices?.[0]?.message?.content?.trim();
            if (!text || text.length > 240 || !/match, hold or dump/i.test(text)) {
                return null;
            }
            return text;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }
}
