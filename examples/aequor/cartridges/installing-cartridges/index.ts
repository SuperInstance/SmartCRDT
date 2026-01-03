#!/usr/bin/env node
/**
 * Cartridge Installation Example
 *
 * This example demonstrates installing and using knowledge cartridges.
 * Cartridges are pre-packaged knowledge bundles for specific domains.
 *
 * Run: npx tsx index.ts
 */

interface KnowledgeCartridge {
  id: string;
  name: string;
  version: string;
  description: string;
  domain: string;
  entries: Array<{
    query: string;
    response: string;
    embedding?: number[];
  }>;
}

class CartridgeInstaller {
  private installed = new Map<string, KnowledgeCartridge>();

  async install(cartridge: KnowledgeCartridge): Promise<boolean> {
    console.log(`\n📦 Installing ${cartridge.name} v${cartridge.version}...`);
    console.log(`   Domain: ${cartridge.domain}`);
    console.log(`   Entries: ${cartridge.entries.length}`);

    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 500));

    this.installed.set(cartridge.id, cartridge);

    console.log(`   ✅ Installed successfully!`);
    return true;
  }

  async uninstall(cartridgeId: string): Promise<boolean> {
    const cartridge = this.installed.get(cartridgeId);

    if (!cartridge) {
      console.log(`❌ Cartridge ${cartridgeId} not found`);
      return false;
    }

    console.log(`\n🗑️  Uninstalling ${cartridge.name}...`);

    await new Promise(resolve => setTimeout(resolve, 200));

    this.installed.delete(cartridgeId);

    console.log(`   ✅ Uninstalled successfully!`);
    return true;
  }

  list(): KnowledgeCartridge[] {
    return Array.from(this.installed.values());
  }

  search(query: string): Array<{ cartridge: string; response: string }>[] {
    const results: Array<{ cartridge: string; response: string }>[] = [];

    for (const cartridge of this.installed.values()) {
      for (const entry of cartridge.entries) {
        if (entry.query.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            cartridge: cartridge.name,
            response: entry.response,
          });
        }
      }
    }

    return results;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Cartridge Installation Example                         ║');
  console.log('║        Installing and Using Knowledge Cartridges                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const installer = new CartridgeInstaller();

  // Sample cartridges
  const javascriptCartridge: KnowledgeCartridge = {
    id: 'js-fundamentals-v1',
    name: 'JavaScript Fundamentals',
    version: '1.0.0',
    description: 'Core JavaScript concepts and patterns',
    domain: 'programming',
    entries: [
      { query: 'What is a closure?', response: 'A closure is a function that retains access to its outer scope even after execution.' },
      { query: 'Explain `this` in JavaScript', response: '`this` refers to the object executing the current function, determined by call site.' },
      { query: 'What is a promise?', response: 'A Promise is an object representing eventual completion or failure of async operation.' },
    ],
  };

  const reactCartridge: KnowledgeCartridge = {
    id: 'react-basics-v1',
    name: 'React Basics',
    version: '1.0.0',
    description: 'React fundamentals and best practices',
    domain: 'programming',
    entries: [
      { query: 'What is a React component?', response: 'A React component is a reusable piece of UI that accepts props and returns JSX.' },
      { query: 'Explain useState', response: 'useState is a hook that adds state to functional components.' },
      { query: 'What is useEffect?', response: 'useEffect runs side effects in functional components after render.' },
    ],
  };

  // Install cartridges
  await installer.install(javascriptCartridge);
  await installer.install(reactCartridge);

  // List installed
  console.log('\n' + '='.repeat(70));
  console.log('📋 Installed Cartridges');
  console.log('='.repeat(70));

  const installed = installer.list();

  for (const cart of installed) {
    console.log(`\n📦 ${cart.name} v${cart.version}`);
    console.log(`   Domain: ${cart.domain}`);
    console.log(`   Description: ${cart.description}`);
    console.log(`   Entries: ${cart.entries.length}`);
  }

  // Search cartridges
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Searching Cartridges');
  console.log('='.repeat(70));

  const searchQueries = ['closure', 'useState', 'component'];

  for (const query of searchQueries) {
    const results = installer.search(query);

    console.log(`\nQuery: "${query}"`);
    if (results.length > 0) {
      for (const result of results) {
        console.log(`  📖 ${result.cartridge}: ${result.response.substring(0, 60)}...`);
      }
    } else {
      console.log('  ❌ No results found');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 CARTRIDGE SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ Benefits:');
  console.log('   • Pre-packaged domain knowledge');
  console.log('   • Instant expertise in specific areas');
  console.log('   • Community-curated content');
  console.log('   • Version control and updates');

  console.log('\n💡 Use Cases:');
  console.log('   1. Domain-specific expertise');
  console.log('   2. Rapid onboarding');
  console.log('   3. Knowledge sharing');
  console.log('   4. Standardized responses');

  console.log('\n🔧 Management:');
  console.log('   • Install: Add new cartridges');
  console.log('   • Uninstall: Remove unused cartridges');
  console.log('   • Update: Get latest versions');
  console.log('   • Search: Find relevant content');

  console.log('\n✨ Example complete!');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
