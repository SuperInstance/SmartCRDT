/**
 * TutorialSystem - Interactive tutorial system for Aequor CLI
 *
 * Provides guided walkthroughs for first-time users, common workflows,
 * and advanced features.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import ora, { Ora } from 'ora';

/**
 * Tutorial step interface
 */
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: 'command' | 'explain' | 'choice' | 'input';
  command?: string;
  choices?: TutorialChoice[];
  inputPrompt?: string;
  validation?: (input: string) => boolean;
  skipIf?: () => boolean;
}

/**
 * Tutorial choice interface
 */
export interface TutorialChoice {
  name: string;
  value: string;
  description?: string;
  nextStep?: string;
}

/**
 * Tutorial definition interface
 */
export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Tutorial progress interface
 */
export interface TutorialProgress {
  tutorialId: string;
  currentStep: number;
  completedSteps: string[];
  startTime: number;
  lastUpdate: number;
}

/**
 * Main TutorialSystem class
 */
export class TutorialSystem {
  private tutorials: Map<string, Tutorial>;
  private progress: Map<string, TutorialProgress>;

  constructor() {
    this.tutorials = new Map();
    this.progress = new Map();
    this.initializeTutorials();
  }

  /**
   * List all available tutorials
   */
  listTutorials(): string {
    const lines: string[] = [];

    lines.push(chalk.cyan.bold('\nAvailable Tutorials\n'));
    lines.push(chalk.grey('═'.repeat(60)));

    const sortedTutorials = Array.from(this.tutorials.values()).sort((a, b) =>
      a.difficulty.localeCompare(b.difficulty)
    );

    const difficultyColors = {
      beginner: chalk.green,
      intermediate: chalk.yellow,
      advanced: chalk.red,
    };

    sortedTutorials.forEach((tutorial) => {
      const color = difficultyColors[tutorial.difficulty];
      lines.push(
        `\n${color(tutorial.difficulty.toUpperCase())} ${chalk.cyan.bold(tutorial.name)}\n`
      );
      lines.push(`  ${tutorial.description}`);
      lines.push(`  ${chalk.grey(`Estimated time: ${tutorial.estimatedTime}`)}`);
      lines.push(`  ${chalk.grey(`ID: ${tutorial.id}`)}`);
    });

    lines.push('\n' + chalk.grey('═'.repeat(60)));
    lines.push(chalk.grey('\nRun a tutorial: aequor tutorial <id>\n'));

    return lines.join('\n');
  }

  /**
   * Run a tutorial
   */
  async runTutorial(tutorialId: string): Promise<void> {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      console.log(chalk.red(`Tutorial not found: ${tutorialId}`));
      console.log(chalk.yellow('Run ') + chalk.cyan('aequor tutorial list') + chalk.yellow(' to see available tutorials.'));
      return;
    }

    console.log(chalk.cyan.bold(`\n${tutorial.name}\n`));
    console.log(chalk.grey('═'.repeat(60)));
    console.log(`${tutorial.description}`);
    console.log(chalk.grey(`Difficulty: ${tutorial.difficulty} | Estimated time: ${tutorial.estimatedTime}\n`));

    // Check if tutorial should continue from progress
    let startIndex = 0;
    const savedProgress = this.progress.get(tutorialId);
    if (savedProgress) {
      const resume = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: 'You have unfinished progress for this tutorial. Continue?',
          default: true,
        },
      ]);

      if (resume.resume) {
        startIndex = savedProgress.currentStep;
      } else {
        this.progress.delete(tutorialId);
      }
    }

    // Run tutorial steps
    for (let i = startIndex; i < tutorial.steps.length; i++) {
      const step = tutorial.steps[i];

      // Check if step should be skipped
      if (step.skipIf && step.skipIf()) {
        continue;
      }

      const success = await this.runStep(step);
      if (!success) {
        // Save progress
        this.progress.set(tutorialId, {
          tutorialId,
          currentStep: i,
          completedSteps: savedProgress?.completedSteps || [],
          startTime: savedProgress?.startTime || Date.now(),
          lastUpdate: Date.now(),
        });

        const shouldStop = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'stop',
            message: 'Stop tutorial? (Your progress will be saved)',
            default: true,
          },
        ]);

        if (shouldStop.stop) {
          console.log(chalk.yellow('\nTutorial paused. Your progress has been saved.'));
          console.log(chalk.cyan('Run ') + chalk.cyan.bold(`aequor tutorial ${tutorialId}`) + chalk.cyan(' to continue.\n'));
          return;
        }
      } else {
        // Mark step as completed
        const progress = this.progress.get(tutorialId);
        if (progress) {
          progress.completedSteps.push(step.id);
          progress.currentStep = i + 1;
          progress.lastUpdate = Date.now();
        }
      }
    }

    // Tutorial completed
    this.progress.delete(tutorialId);
    console.log(chalk.green.bold('\nTutorial Completed! 🎉\n'));
    console.log(chalk.cyan('What\'s next?'));
    console.log('  • Try other tutorials: aequor tutorial list');
    console.log('  • Explore commands: aequor help');
    console.log('  • Read documentation: https://github.com/SuperInstance/SmartCRDT\n');
  }

  /**
   * Run a single tutorial step
   */
  private async runStep(step: TutorialStep): Promise<boolean> {
    console.log(chalk.cyan.bold(`\n${step.title}\n`));
    console.log(`${step.description}\n`);

    switch (step.action) {
      case 'explain':
        const cont = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continue',
            message: 'Continue?',
            default: true,
          },
        ]);
        return cont.continue;

      case 'command':
        if (step.command) {
          const run = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'run',
              message: `Run command: ${chalk.cyan(step.command)}`,
              default: true,
            },
          ]);

          if (run.run) {
            try {
              const spinner = ora('Running command...').start();
              const output = execSync(step.command, { encoding: 'utf-8', cwd: process.cwd() });
              spinner.succeed('Command completed');
              console.log(output);
            } catch (error: any) {
              spinner.fail('Command failed');
              console.log(chalk.red(`Error: ${(error as Error).message}`));

              const retry = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'retry',
                  message: 'Continue anyway?',
                  default: false,
                },
              ]);

              return retry.retry;
            }
          }
        }
        return true;

      case 'choice':
        if (step.choices) {
          const answer = await inquirer.prompt([
            {
              type: 'list',
              name: 'choice',
              message: 'What would you like to do?',
              choices: step.choices.map((c) => ({
                name: c.description ? `${c.name} - ${c.description}` : c.name,
                value: c.value,
              })),
            },
          ]);

          const selected = step.choices.find((c) => c.value === answer.choice);
          if (selected && selected.nextStep) {
            // Jump to next step (not implemented for simplicity)
          }
        }
        return true;

      case 'input':
        if (step.inputPrompt) {
          const answer = await inquirer.prompt([
            {
              type: 'input',
              name: 'input',
              message: step.inputPrompt,
              validate: (input: string) => {
                if (step.validation && !step.validation(input)) {
                  return 'Invalid input. Please try again.';
                }
                return true;
              },
            },
          ]);
          console.log(chalk.grey(`You entered: ${answer.input}\n`));
        }
        return true;

      default:
        return true;
    }
  }

  /**
   * Show tutorial progress
   */
  showProgress(tutorialId?: string): string {
    const lines: string[] = [];

    if (tutorialId) {
      const tutorial = this.tutorials.get(tutorialId);
      const progress = this.progress.get(tutorialId);

      if (!tutorial || !progress) {
        return chalk.red(`No progress found for tutorial: ${tutorialId}`);
      }

      lines.push(chalk.cyan.bold(`\n${tutorial.name} - Progress\n`));
      lines.push(chalk.grey('═'.repeat(60)));
      lines.push(`\nCompleted Steps: ${progress.completedSteps.length}/${tutorial.steps.length}`);
      lines.push(`Current Step: ${progress.currentStep + 1}`);

      const elapsed = Date.now() - progress.startTime;
      lines.push(`Time Elapsed: ${Math.floor(elapsed / 60000)} minutes\n`);
    } else {
      const allProgress = Array.from(this.progress.entries());

      if (allProgress.length === 0) {
        return chalk.yellow('\nNo tutorial progress found.\n');
      }

      lines.push(chalk.cyan.bold('\nTutorial Progress\n'));
      lines.push(chalk.grey('═'.repeat(60)));

      allProgress.forEach(([id, progress]) => {
        const tutorial = this.tutorials.get(id);
        lines.push(
          `\n${chalk.cyan(tutorial?.name || id)}: ${progress.completedSteps.length}/${
            tutorial?.steps.length || 0
          } steps completed`
        );
      });

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Reset tutorial progress
   */
  resetProgress(tutorialId?: string): void {
    if (tutorialId) {
      this.progress.delete(tutorialId);
      console.log(chalk.green(`Progress reset for: ${tutorialId}\n`));
    } else {
      this.progress.clear();
      console.log(chalk.green('All tutorial progress reset.\n'));
    }
  }

  /**
   * Initialize tutorials
   */
  private initializeTutorials(): void {
    // Quick Start Tutorial
    this.tutorials.set('quickstart', {
      id: 'quickstart',
      name: 'Quick Start Guide',
      description: 'Get started with Aequor CLI in 5 minutes',
      estimatedTime: '5 minutes',
      difficulty: 'beginner',
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Aequor!',
          description:
            'This tutorial will guide you through the basics of using Aequor CLI. You\'ll learn how to run queries, manage caching, and configure privacy settings.',
          action: 'explain',
        },
        {
          id: 'check-status',
          title: 'Check System Status',
          description: 'Let\'s first check if Aequor is running properly.',
          action: 'command',
          command: 'aequor status',
        },
        {
          id: 'first-query',
          title: 'Run Your First Query',
          description: 'Now let\'s run a simple query to see Aequor in action.',
          action: 'command',
          command: 'aequor query "What is 2+2?"',
        },
        {
          id: 'enable-cache',
          title: 'Enable Caching',
          description: 'Enable caching to speed up repeated queries.',
          action: 'command',
          command: 'aequor config cache.enabled true',
        },
        {
          id: 'cache-stats',
          title: 'View Cache Statistics',
          description: 'Check your cache performance.',
          action: 'command',
          command: 'aequor cache stats',
        },
        {
          id: 'privacy-check',
          title: 'Privacy Check',
          description: 'Test Aequor\'s privacy features with a sample query.',
          action: 'command',
          command: 'aequor privacy "My email is user@example.com"',
        },
        {
          id: 'completion',
          title: 'Tutorial Complete!',
          description:
            'Congratulations! You\'ve completed the quick start tutorial. You now know how to run queries, enable caching, and check privacy settings.',
          action: 'explain',
        },
      ],
    });

    // Chat Tutorial
    this.tutorials.set('chat', {
      id: 'chat',
      name: 'Interactive Chat Tutorial',
      description: 'Learn how to use Aequor\'s interactive chat mode',
      estimatedTime: '10 minutes',
      difficulty: 'beginner',
      steps: [
        {
          id: 'intro',
          title: 'Interactive Chat Mode',
          description:
            'Aequor\'s chat mode provides an interactive conversational interface. You can have multi-turn conversations, maintain context, and get more natural responses.',
          action: 'explain',
        },
        {
          id: 'start-chat',
          title: 'Start Chat Mode',
          description:
            'Let\'s start the interactive chat mode. Type "exit" or press Ctrl+C to quit when done.',
          action: 'command',
          command: 'echo "This is a demo. In a real tutorial, this would start chat mode."',
        },
        {
          id: 'chat-features',
          title: 'Chat Features',
          description:
            'Chat mode supports:\n• Multi-turn conversations\n• Context awareness\n• Model selection\n• History saving\n• Privacy controls',
          action: 'explain',
        },
        {
          id: 'complete',
          title: 'Chat Tutorial Complete!',
          description: 'You\'re now ready to use Aequor\'s interactive chat mode!',
          action: 'explain',
        },
      ],
    });

    // Cache Tutorial
    this.tutorials.set('cache', {
      id: 'cache',
      name: 'Cache Management Tutorial',
      description: 'Learn how to manage and optimize semantic caching',
      estimatedTime: '15 minutes',
      difficulty: 'intermediate',
      steps: [
        {
          id: 'cache-intro',
          title: 'Semantic Caching',
          description:
            'Aequor uses semantic caching to store query results based on meaning, not just exact text matches. This provides high hit rates (80-95%) and faster responses.',
          action: 'explain',
        },
        {
          id: 'cache-config',
          title: 'Configure Cache',
          description: 'Set up cache size and time-to-live.',
          action: 'command',
          command: 'aequor config cache.size 100 && aequor config cache.ttl 3600',
        },
        {
          id: 'warm-cache',
          title: 'Warm the Cache',
          description: 'Pre-populate cache with common queries.',
          action: 'command',
          command: 'aequor cache warm',
        },
        {
          id: 'view-stats',
          title: 'View Cache Statistics',
          description: 'Check cache performance metrics.',
          action: 'command',
          command: 'aequor cache stats',
        },
        {
          id: 'invalidate',
          title: 'Invalidate Cache Entries',
          description: 'Remove specific cache entries by pattern.',
          action: 'input',
          inputPrompt: 'Enter a pattern to invalidate (or press Enter to skip):',
        },
        {
          id: 'complete',
          title: 'Cache Tutorial Complete!',
          description: 'You\'ve learned how to configure, warm, and manage the semantic cache!',
          action: 'explain',
        },
      ],
    });

    // Privacy Tutorial
    this.tutorials.set('privacy', {
      id: 'privacy',
      name: 'Privacy Features Tutorial',
      description: 'Learn about Aequor\'s privacy-preserving features',
      estimatedTime: '20 minutes',
      difficulty: 'advanced',
      steps: [
        {
          id: 'privacy-intro',
          title: 'Privacy by Design',
          description:
            'Aequor implements privacy through:\n• Intent encoding (vector representation)\n• Redaction (PII removal)\n• ε-differential privacy\n• Privacy classification',
          action: 'explain',
        },
        {
          id: 'privacy-config',
          title: 'Configure Privacy',
          description: 'Set privacy epsilon and enable privacy features.',
          action: 'command',
          command: 'aequor config privacy.epsilon 1.0 && aequor config privacy.enabled true',
        },
        {
          id: 'classify-query',
          title: 'Classify Query Privacy',
          description: 'Analyze the privacy level of a query.',
          action: 'command',
          command: 'aequor privacy "What is JavaScript?" --classify',
        },
        {
          id: 'redact-pii',
          title: 'Redact PII',
          description: 'Automatically redact personally identifiable information.',
          action: 'command',
          command: 'aequor privacy "My email is test@example.com" --redact',
        },
        {
          id: 'encode-intent',
          title: 'Encode Intent',
          description: 'Convert a query to an intent vector for privacy-preserving cloud inference.',
          action: 'command',
          command: 'aequor privacy "Write a sorting function" --encode',
        },
        {
          id: 'privacy-audit',
          title: 'Privacy Audit',
          description: 'View the privacy audit log.',
          action: 'command',
          command: 'aequor privacy --audit',
        },
        {
          id: 'complete',
          title: 'Privacy Tutorial Complete!',
          description: 'You\'ve mastered Aequor\'s privacy-preserving features!',
          action: 'explain',
        },
      ],
    });
  }
}
