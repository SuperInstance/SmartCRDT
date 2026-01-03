#!/usr/bin/env node
/**
 * Simple API Documentation Generator
 *
 * Generates markdown API documentation from TypeScript source files
 */

const fs = require('fs');
const path = require('path');

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
function extractExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = [];

  // Match export statements with more detailed patterns
  const patterns = [
    { regex: /export\s+(?:abstract\s+)?class\s+(\w+)/g, type: 'class' },
    { regex: /export\s+interface\s+(\w+)/g, type: 'interface' },
    { regex: /export\s+type\s+(\w+)/g, type: 'type' },
    { regex: /export\s+enum\s+(\w+)/g, type: 'enum' },
    { regex: /export\s+(?:async\s+)?function\s+(\w+)/g, type: 'function' },
    { regex: /export\s+(?:const|let|var)\s+(\w+)/g, type: 'constant' }
  ];

  // Also capture default exports
  const defaultPatterns = [
    { regex: /export\s+default\s+class\s+(\w+)/g, type: 'class' },
    { regex: /export\s+default\s+interface\s+(\w+)/g, type: 'interface' },
    { regex: /export\s+default\s+(?:async\s+)?function\s+(\w+)/g, type: 'function' },
    { regex: /export\s+default\s+\{[\s\S]*?(\w+)[\s\S]*?\}/g, type: 'named' }
  ];

  const allPatterns = [...patterns, ...defaultPatterns];

  for (const { regex, type } of allPatterns) {
    let match;
    regex.lastIndex = 0; // Reset regex state
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      const description = extractComment(content, match.index);

      entries.push({
        name,
        type,
        description,
        filePath,
        exportType: regex.toString().includes('default') ? 'default' : 'named'
      });
    }
  }

  // Filter out duplicates
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.name}-${entry.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract TSDoc comment before an export
 */
function extractComment(content, index) {
  const before = content.substring(0, index);
  const commentMatch = before.match(/\/\*\*([\s\S]*?)\*\//);
  if (!commentMatch) return undefined;

  const comment = commentMatch[1]
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(line => !line.startsWith('@'))
    .join('\n')
    .trim();

  return comment || undefined;
}

/**
 * Generate markdown for a doc entry
 */
function generateMarkdown(entries, packageName) {
  let markdown = `# ${packageName}\n\n`;
  markdown += `> Auto-generated API documentation for \`@lsi/${packageName}\`\n\n`;

  if (entries.length === 0) {
    markdown += `*No exports found*\n\n`;
    return markdown;
  }

  // Group by type
  const groups = entries.reduce((acc, entry) => {
    if (!acc[entry.type]) acc[entry.type] = [];
    acc[entry.type].push(entry);
    return acc;
  }, {});

  const typeOrder = ['class', 'interface', 'type', 'enum', 'function', 'constant'];

  for (const type of typeOrder) {
    const groupEntries = groups[type];
    if (!groupEntries || groupEntries.length === 0) continue;

    markdown += `## ${type.charAt(0).toUpperCase() + type.slice(1)}es\n\n`;

    for (const entry of groupEntries) {
      markdown += `### ${entry.name}\n\n`;

      if (entry.description) {
        markdown += `${entry.description}\n\n`;
      }

      const relPath = entry.filePath.replace(process.cwd() + '/', '');
      markdown += `**Type:** \`${entry.type}\`\n\n`;
      markdown += `**Export:** \`${entry.exportType}\`\n\n`;
      markdown += `**Location:** [\`${relPath}\`](${relPath})\n\n`;
      markdown += `---\n\n`;
    }
  }

  return markdown;
}

/**
 * Process a package
 */
function processPackage(packagePath) {
  const indexPath = path.join(process.cwd(), packagePath, 'src', 'index.ts');

  if (!fs.existsSync(indexPath)) {
    console.log(`⚠️  Skipping ${packagePath} - no index.ts found`);
    return { name: packagePath, count: 0, skipped: true };
  }

  console.log(`📦 Processing ${packagePath}...`);

  const entries = extractExports(indexPath);
  const packageName = path.basename(packagePath);
  const outputPath = path.join(process.cwd(), 'docs/api', `${packageName}.md`);

  const markdown = generateMarkdown(entries, packageName);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);

  console.log(`   ✓ Generated ${entries.length} API entries -> ${outputPath}`);

  return { name: packageName, count: entries.length, skipped: false };
}

/**
 * Generate index page
 */
function generateIndex(results) {
  let markdown = `# API Documentation Index\n\n`;
  markdown += `This directory contains automatically generated API documentation for all packages.\n\n`;
  markdown += `## Packages\n\n`;

  for (const result of results) {
    if (result.skipped) continue;

    const description = getPackageDescription(result.name);
    markdown += `- [\`@lsi/${result.name}\`](${result.name}.md)`;
    markdown += ` - ${description}`;
    markdown += ` (${result.count} exports)\n`;
  }

  markdown += `\n## Legend\n\n`;
  markdown += `- **Classes** - TypeScript class definitions\n`;
  markdown += `- **Interfaces** - TypeScript interface definitions\n`;
  markdown += `- **Types** - TypeScript type aliases\n`;
  markdown += `- **Enums** - TypeScript enumerations\n`;
  markdown += `- **Functions** - Exported functions\n`;
  markdown += `- **Constants** - Exported constants\n\n`;

  markdown += `## Regeneration\n\n`;
  markdown += `To regenerate this documentation:\n\n`;
  markdown += `\`\`\`bash\nnpm run docs:generate\n\`\`\`\n\n`;

  markdown += `---\n\n`;
  markdown += `*Generated by custom documentation generator*\n`;

  return markdown;
}

/**
 * Get package description
 */
function getPackageDescription(name) {
  const descriptions = {
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

/**
 * Main function
 */
function main() {
  console.log('\n📚 Generating API Documentation...\n');

  const outputDir = path.join(process.cwd(), 'docs/api');
  fs.mkdirSync(outputDir, { recursive: true });

  const results = [];

  for (const pkg of PACKAGES_TO_DOC) {
    const result = processPackage(pkg);
    results.push(result);
  }

  // Generate index
  console.log('\n📋 Generating index...');
  const indexPath = path.join(outputDir, '_index.md');
  const indexContent = generateIndex(results);
  fs.writeFileSync(indexPath, indexContent);
  console.log(`   ✓ Generated index -> ${indexPath}`);

  // Summary
  const totalExports = results.reduce((sum, r) => sum + r.count, 0);
  const successCount = results.filter(r => !r.skipped).length;

  console.log(`\n✅ Documentation generated successfully!`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📄 Packages documented: ${successCount}/${PACKAGES_TO_DOC.length}`);
  console.log(`📊 Total API entries: ${totalExports}\n`);
}

main();
