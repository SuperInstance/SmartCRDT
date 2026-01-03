/**
 * @lsi/vljepa-synthetic - Content Mutator
 *
 * Mutates text content in UI components.
 *
 * @module mutators
 */

import type {
  MutationConfig,
  AppliedMutation,
  GeneratedComponent,
} from "../types.js";
import { createSeededRandom } from "../utils.js";

const CONTENT_VARIANTS = {
  button: [
    "Click Me",
    "Submit",
    "Save",
    "Cancel",
    "Delete",
    "Edit",
    "Add",
    "Remove",
    "Continue",
    "Back",
  ],
  input: [
    "Enter text...",
    "Type here...",
    "Your input...",
    "Search...",
    "Email...",
    "Password...",
  ],
  textarea: [
    "Enter your message...",
    "Write something...",
    "Description...",
    "Comments...",
  ],
  card: {
    title: [
      "Card Title",
      "Important Notice",
      "Featured Item",
      "New Update",
      "Announcement",
    ],
    text: [
      "This is a sample card with some content.",
      "Card content goes here.",
      "Lorem ipsum dolor sit amet.",
      "Important information displayed here.",
    ],
  },
  alert: {
    info: ["Information message", "Please note", "FYI", "Info"],
    success: ["Success!", "Completed", "Done", "Saved successfully"],
    warning: ["Warning!", "Caution", "Please be careful", "Attention"],
    error: ["Error!", "Something went wrong", "Failed", "Unable to complete"],
  },
};

export class ContentMutator {
  private config: MutationConfig;
  private rng: ReturnType<typeof createSeededRandom>;

  constructor(config: MutationConfig) {
    this.config = config;
    this.rng = createSeededRandom(config.seed);
  }

  /**
   * Mutate content in components
   */
  mutate(component: GeneratedComponent): {
    component: GeneratedComponent;
    mutations: AppliedMutation[];
  } {
    const mutations: AppliedMutation[] = [];
    const newComponent = { ...component };

    if (this.rng.float(0, 1) < this.config.rate) {
      const contentMutation = this.mutateContent(component);
      mutations.push(contentMutation);
      newComponent.code = contentMutation.mutated as string;
    }

    return { component: newComponent, mutations };
  }

  /**
   * Mutate component content
   */
  private mutateContent(component: GeneratedComponent): AppliedMutation {
    const type = component.type;
    const original = component.code;

    let mutated = original;

    switch (type) {
      case "button":
        mutated = this.mutateButtonContent(original);
        break;

      case "input":
      case "textarea":
        mutated = this.mutateInputContent(original);
        break;

      case "card":
        mutated = this.mutateCardContent(original);
        break;

      case "alert":
        mutated = this.mutateAlertContent(original);
        break;

      default:
        mutated = this.mutateGenericContent(original);
    }

    return {
      type: "content",
      target: `component.${type}`,
      original,
      mutated,
      description: `Mutated ${type} content`,
    };
  }

  private mutateButtonContent(code: string): string {
    const buttonTexts = CONTENT_VARIANTS.button;
    const newText = this.rng.pick(buttonTexts);
    return code.replace(/(>)([^<]+)(<)/, `$1${newText}$3`);
  }

  private mutateInputContent(code: string): string {
    const placeholders = CONTENT_VARIANTS.input;
    const newPlaceholder = this.rng.pick(placeholders);
    return code.replace(
      /placeholder="[^"]*"/,
      `placeholder="${newPlaceholder}"`
    );
  }

  private mutateCardContent(code: string): string {
    const titles = CONTENT_VARIANTS.card.title;
    const texts = CONTENT_VARIANTS.card.text;

    const newTitle = this.rng.pick(titles);
    const newText = this.rng.pick(texts);

    let mutated = code.replace(/Card Title/, newTitle);
    mutated = mutated.replace(/Card content goes here\./, newText);

    return mutated;
  }

  private mutateAlertContent(code: string): string {
    // Find alert type from class
    const typeMatch = code.match(/alert--(info|success|warning|error)/);

    if (typeMatch) {
      const type = typeMatch[1] as keyof typeof CONTENT_VARIANTS.alert;
      const messages = CONTENT_VARIANTS.alert[type];
      const newMessage = this.rng.pick(messages);

      return code
        .replace(/(Info|Success|Warning|Error) Message/, newMessage)
        .replace(
          /This is a (info|success|warning|error) alert message\./,
          `${newMessage}!`
        );
    }

    return code;
  }

  private mutateGenericContent(code: string): string {
    // Replace any text content with similar length
    return code.replace(
      />[^<]+</g,
      match =>
        `>${this.rng.pick(["Sample", "Example", "Demo", "Test", "Item"])}<`
    );
  }
}
