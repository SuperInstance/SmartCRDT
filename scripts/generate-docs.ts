#!/usr/bin/env node
/**
 * Simple API Documentation Generator
 *
 * Generates markdown API documentation from TypeScript source files
 * without requiring TypeDoc installation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocEntry {
  name: string;
  type: 'class' | 'interface' | 'function' | 'type' | 'enum' | 'constant';
  description?: string;
  signature?: string;
  members?: DocEntry[];
  filePath: string;
  exportType: 'named' | 'default';
}

const PACKAGES_TO_DOC = [
  'packages/cascade',
  'packages/core',
  'packages/protocol',
  'packages/embeddings',
  'packages/privacy',
  'packages/config',
  'packages/swarm',
  'packages/utils'
];

/**
 * Extract exports from a TypeScript file
 */
function extractExports(filePath: string): DocEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries: DocEntry[] = [];

  // Match export statements
  const patterns = [
    // export class ClassName
    /export\s+(?:abstract\s+)?class\s+(\w+)/g,
    // export interface InterfaceName
    /export\s+interface\s+(\w+)/g,
    // export type TypeName
    /export\s+type\s+(\w+)/g,
    // export enum EnumName
    /export\s+enum\s+(\w+)/g,
    // export function functionName
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    // export const/let/var name
    /export\s+(?:const|let|var)\s+(\w+)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      const type = getTypeFromPattern(pattern);
      const description = extractComment(content, match.index);

      entries.push({
        name,
        type,
        description,
        filePath,
        exportType: 'named'
      });
    }
  }

  return entries;
}

/**
 * Get type from regex pattern
 */
function getTypeFromPattern(pattern: RegExp): DocEntry['type'] {
  const patternStr = pattern.toString();
  if (patternStr.includes('class')) return 'class';
  if (patternStr.includes('interface')) return 'interface';
  if (patternStr.includes('type')) return 'type';
  if (patternStr.includes('enum')) return 'enum';
  if (patternStr.includes('function')) return 'function';
  return 'constant';
}

/**
 * Extract TSDoc comment before an export
 */
function extractComment(content: string, index: number): string | undefined {
  const before = content.substring(0, index);
  const commentMatch = before.match(/\/\*\*([\s\S]*?)\*\//);
  if (!commentMatch) return undefined;

  const comment = commentMatch[1]
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(line => !line.startsWith('@'))
    .join('\n');

  return comment || undefined;
}

/**
 * Generate markdown for a doc entry
 */
function generateMarkdown(entries: DocEntry[], packageName: string): string {
  let markdown = `# ${packageName}\n\n`;
  markdown += `> Auto-generated API documentation for \`${packageName}\`\n\n`;

  // Group by type
  const groups = entries.reduce((acc, entry) => {
    if (!acc[entry.type]) acc[entry.type] = [];
    acc[entry.type].push(entry);
    return acc;
  }, {} as Record<string, DocEntry[]>);

  const typeOrder: Array<DocEntry['type']> = ['class', 'interface', 'type', 'enum', 'function', 'constant'];

  for (const type of typeOrder) {
    const groupEntries = groups[type];
    if (!groupEntries || groupEntries.length === 0) continue;

    markdown += `## ${type.charAt(0).toUpperCase() + type.slice(1)}es\n\n`;

    for (const entry of groupEntries) {
      markdown += `### ${entry.name}\n\n`;

      if (entry.description) {
        markdown += `${entry.description}\n\n`;
      }

      markdown += `**Type:** \`${entry.type}\`\n\n`;
      markdown += `**Location:** \`${entry.filePath}\`\n\n`;
      markdown += `---\n\n`;
    }
  }

  return markdown;
}

/**
 * Process a package
 */
function processPackage(packagePath: string): void {
  const indexPath = path.join(process.cwd(), packagePath, 'src', 'index.ts');

  if (!fs.existsSync(indexPath)) {
    console.log(`Skipping ${packagePath} - no index.ts found`);
    return;
  }

  console.log(`Processing ${packagePath}...`);

  const entries = extractExports(indexPath);
  const packageName = path.basename(packagePath);
  const outputPath = path.join(process.cwd(), 'docs/api', `${packageName}.md`);

  const markdown = generateMarkdown(entries, packageName);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);

  console.log(`  Generated ${entries.length} API entries -> ${outputPath}`);
}

/**
 * Main function
 */
function main(): void {
  console.log('📚 Generating API Documentation...\n');

  const outputDir = path.join(process.cwd(), 'docs/api');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const pkg of PACKAGES_TO_DOC) {
    processPackage(pkg);
  }

  // Generate index
  const indexPath = path.join(outputDir, '_index.md');
  const indexContent = generateIndex();
  fs.writeFileSync(indexPath, indexContent);

  console.log(`\n✅ Documentation generated successfully!`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📄 View docs/api/README.md for instructions\n`);
}

/**
 * Generate index page
 */
function generateIndex(): string {
  return `# API Documentation Index

This directory contains automatically generated API documentation for all packages.

## Packages

${PACKAGES_TO_DOC.map(pkg => {
  const name = path.basename(pkg);
  return `- [\`@lsi/${name}\`](${name}.md) - ${getPackageDescription(name)}`;
}).join('\n')}

## Legend

- **Classes** - TypeScript class definitions
- **Interfaces** - TypeScript interface definitions
- **Types** - TypeScript type aliases
- **Enums** - TypeScript enumerations
- **Functions** - Exported functions
- **Constants** - Exported constants

## Regeneration

To regenerate this documentation:

\`\`\`bash
npm run docs:generate
\`\`\`

---

*Generated by custom documentation generator*
`;
}

/**
 * Get package description
 */
function getPackageDescription(name: string): string {
  const descriptions: Record<string, string> = {
    cascade: 'Cascade routing with complexity-based model selection',
    core: 'Core libcognitive API primitives',
    protocol: 'ATP/ACP protocol definitions',
    embeddings: 'Text embedding and vector operations',
    privacy: 'Privacy-preserving protocols',
    config: 'Configuration management',
    swarm: 'Distributed coordination and CRDTs',
    utils: 'Utility functions and helpers'
  };
  return descriptions[name] || 'Core package';
}

main();
