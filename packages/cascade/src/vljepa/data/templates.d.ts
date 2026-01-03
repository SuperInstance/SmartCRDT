/**
 * Template System for Synthetic Query Generation
 *
 * Provides template-based generation of labeled query-intent pairs
 * for training intent classification models.
 *
 * @package vljepa/data
 */
declare enum IntentCategory {
    QUERY = "query",
    COMMAND = "command",
    CONVERSATION = "conversation",
    CODE_GENERATION = "code_generation",
    ANALYSIS = "analysis",
    CREATIVE = "creative",
    DEBUGGING = "debugging",
    SYSTEM = "system",
    UNKNOWN = "unknown"
}
/**
 * Query template with slots for variation
 */
export interface QueryTemplate {
    /** Template string with {slot} placeholders */
    template: string;
    /** Intent category */
    intent: IntentCategory;
    /** Slot values to fill templates */
    slots: Record<string, string[]>;
    /** Difficulty level */
    difficulty: "beginner" | "intermediate" | "advanced";
}
export declare const QUERY_TEMPLATES: QueryTemplate[];
export declare const COMMAND_TEMPLATES: QueryTemplate[];
export declare const ANALYSIS_TEMPLATES: QueryTemplate[];
export declare const CREATIVE_TEMPLATES: QueryTemplate[];
export declare const CONVERSATION_TEMPLATES: QueryTemplate[];
export declare const REASONING_TEMPLATES: QueryTemplate[];
export declare const DEBUGGING_TEMPLATES: QueryTemplate[];
export declare const LEARNING_TEMPLATES: QueryTemplate[];
export declare const OPTIMIZATION_TEMPLATES: QueryTemplate[];
export declare const ALL_TEMPLATES: QueryTemplate[];
export {};
//# sourceMappingURL=templates.d.ts.map