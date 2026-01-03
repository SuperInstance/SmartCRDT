/**
 * Search Command
 *
 * Search for components in the registry.
 * Supports filtering by type, stability, category, and relevance scoring.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import Table from 'cli-table3';
import chalk from 'chalk';

// ============================================================================
// SEARCH OPTIONS
// ============================================================================

/**
 * Search command options
 */
export interface SearchOptions {
  /** Filter by component type */
  type?: string;
  /** Filter by stability level */
  stability?: string;
  /** Filter by category */
  category?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Output format (table, json, plain) */
  format?: 'table' | 'json' | 'plain';
  /** Verbose output */
  verbose?: boolean;
  /** Show only installed components */
  installed?: boolean;
}

// ============================================================================
// SEARCH COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Search for components
 */
export async function searchCommand(
  query: string,
  options: SearchOptions = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  // Build search query
  const searchQuery = {
    query,
    type: options.type as any,
    stability: options.stability as any,
    category: options.category as any,
    limit: options.limit || 20,
    offset: options.offset || 0,
  };

  // Perform search
  const results = await registry.search(searchQuery);

  if (results.length === 0) {
    console.log('');
    console.log(chalk.yellow('No results found'));
    console.log('');
    console.log('Suggestions:');
    console.log(`  ${chalk.cyan('aequor list')}  - List all available components`);
    console.log(`  ${chalk.cyan('aequor search <type>')}  - Search by type`);
    console.log('');
    return;
  }

  // Format output
  switch (options.format) {
    case 'json':
      formatJson(results, searchQuery);
      break;
    case 'plain':
      formatPlain(results, searchQuery, options.verbose);
      break;
    case 'table':
    default:
      formatTable(results, searchQuery, options.verbose);
      break;
  }
}

/**
 * Format as table
 */
function formatTable(results: any[], query: any, verbose?: boolean): void {
  console.log('');
  console.log(chalk.bold(`Search results for "${query.query}":`));
  console.log(chalk.gray(`Found ${results.length} result(s)`));
  console.log('');

  // Create table
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Version'),
      chalk.cyan('Type'),
      chalk.cyan('Score'),
      ...[verbose ? chalk.cyan('Description') : []],
      ...[verbose ? chalk.cyan('Installed') : []],
    ].filter(Boolean),
    style: {
      head: [],
      border: ['gray'],
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
  });

  // Add rows
  for (const result of results) {
    const row = [
      result.name,
      result.latest_version,
      result.type,
      formatScore(result.score),
    ];

    if (verbose) {
      // Truncate description
      const description = result.description
        ? result.description.substring(0, 50) + (result.description.length > 50 ? '...' : '')
        : '-';
      row.push(description);
      row.push(result.installed ? chalk.green('Yes') : chalk.gray('No'));
    }

    table.push(row);
  }

  console.log(table.toString());

  // Show pagination info
  if (query.offset > 0 || results.length === query.limit) {
    console.log('');
    console.log(chalk.gray('Showing results ' + (query.offset + 1) + '-' + (query.offset + results.length)));
    console.log(chalk.gray('Use --offset and --limit for pagination'));
  }

  console.log('');
}

/**
 * Format as JSON
 */
function formatJson(results: any[], query: any): void {
  console.log(JSON.stringify({
    query: query.query,
    total: results.length,
    offset: query.offset,
    limit: query.limit,
    results,
  }, null, 2));
}

/**
 * Format as plain text
 */
function formatPlain(results: any[], query: any, verbose?: boolean): void {
  console.log('');
  console.log(`Search results for "${query.query}":`);
  console.log(`Found ${results.length} result(s)`);
  console.log('');

  for (const result of results) {
    console.log(chalk.bold(result.name));

    if (verbose) {
      console.log(`  Version: ${result.latest_version}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Stability: ${result.stability}`);

      if (result.description) {
        console.log(`  Description: ${result.description}`);
      }

      if (result.matched_fields && result.matched_fields.length > 0) {
        console.log(`  Matched in: ${result.matched_fields.join(', ')}`);
      }

      console.log(`  Score: ${result.score.toFixed(2)}`);
      console.log(`  Installed: ${result.installed ? 'Yes' : 'No'}`);
    } else {
      console.log(`  ${result.type} @ ${result.latest_version} (${(result.score * 100).toFixed(0)}% match)`);
    }

    console.log('');
  }

  console.log(`Total: ${results.length} result(s)`);
}

/**
 * Format relevance score
 */
function formatScore(score: number): string {
  const percentage = Math.round(score * 100);

  if (percentage >= 90) {
    return chalk.green(percentage + '%');
  } else if (percentage >= 70) {
    return chalk.yellow(percentage + '%');
  } else if (percentage >= 50) {
    return chalk.orange(percentage + '%');
  } else {
    return chalk.gray(percentage + '%');
  }
}

// ============================================================================
// TYPE SEARCH COMMAND
// ============================================================================

/**
 * List components by type
 */
export async function searchByTypeCommand(
  type: string,
  options: SearchOptions = {}
): Promise<void> {
  await searchCommand(type, { ...options, type });
}

// ============================================================================
// KEYWORD SEARCH COMMAND
// ============================================================================

/**
 * Search by keywords
 */
export async function searchByKeywordsCommand(
  keywords: string[],
  options: SearchOptions = {}
): Promise<void> {
  const query = keywords.join(' ');
  await searchCommand(query, options);
}

// ============================================================================
// FUZZY SEARCH
// ============================================================================

/**
 * Fuzzy search with typo tolerance
 */
export async function fuzzySearchCommand(
  query: string,
  options: SearchOptions = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  // Get all components
  const allComponents = await registry.list();

  // Perform fuzzy matching
  const results = fuzzyMatch(query, allComponents);

  if (results.length === 0) {
    console.log('');
    console.log(chalk.yellow('No results found'));
    console.log('');
    console.log('Did you mean?');
    console.log('');

    // Show closest matches
    const closest = allComponents
      .map(c => ({
        ...c,
        distance: levenshteinDistance(query, c.name),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    for (const match of closest) {
      console.log(`  ${chalk.cyan(match.name)} - ${match.description}`);
    }

    console.log('');
    return;
  }

  // Format results
  console.log('');
  console.log(chalk.bold(`Fuzzy search results for "${query}":`));
  console.log('');

  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Version'),
      chalk.cyan('Type'),
      chalk.cyan('Distance'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const result of results) {
    table.push([
      result.name,
      result.latest_version,
      result.type,
      result.distance.toString(),
    ]);
  }

  console.log(table.toString());
  console.log('');
}

/**
 * Perform fuzzy matching
 */
function fuzzyMatch(query: string, components: any[]): any[] {
  const threshold = 3; // Maximum edit distance

  return components
    .map(component => ({
      ...component,
      distance: levenshteinDistance(query, component.name),
    }))
    .filter(component => component.distance <= threshold)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10); // Return top 10 matches
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================================
// DISCOVER COMMAND
// ============================================================================

/**
 * Discover popular and trending components
 */
export async function discoverCommand(options: {
  /** Show by type */
  type?: string;
  /** Show by stability */
  stability?: string;
  /** Limit results */
  limit?: number;
} = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  const components = await registry.list({
    type: options.type as any,
    stability: options.stability as any,
  });

  // Sort by "popularity" (for now, just alphabetical)
  // In real implementation, would use download counts, ratings, etc.
  const sorted = components
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, options.limit || 10);

  console.log('');
  console.log(chalk.bold('Discover Components:'));
  console.log('');

  if (sorted.length === 0) {
    console.log(chalk.yellow('No components found'));
    console.log('');
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('Component'),
      chalk.cyan('Type'),
      chalk.cyan('Stability'),
      chalk.cyan('Description'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
    colWidths: [25, 15, 12, 50],
  });

  for (const component of sorted) {
    table.push([
      component.name + chalk.gray('@' + component.latest_version),
      component.type,
      component.stability,
      component.description.substring(0, 50) + (component.description.length > 50 ? '...' : ''),
    ]);
  }

  console.log(table.toString());
  console.log('');
  console.log(chalk.gray('To install, run: aequor pull <component>'));
  console.log('');
}
