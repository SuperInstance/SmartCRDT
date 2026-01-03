/**
 * Privacy-First Application Example
 */

const PrivacyFirstApp = require('../src/index');

async function demonstratePrivacyApp() {
  const app = new PrivacyFirstApp({
    storageType: 'memory'
  });

  await app.initialize();

  console.log('=== Privacy-First App Demo ===\n');

  // Store user profile
  console.log('1. Storing user profile...');
  await app.storeData('user_profile', {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      language: 'en'
    }
  });
  console.log('✓ Profile stored\n');

  // Store usage data
  console.log('2. Storing usage data...');
  await app.storeData('usage_data', {
    action: 'page_view',
    page: '/dashboard',
    duration: 120
  });
  console.log('✓ Usage data stored\n');

  // Retrieve data
  console.log('3. Retrieving user profile...');
  const profile = await app.getData('user_profile');
  console.log('Profile:', JSON.stringify(profile, null, 2));
  console.log();

  // Get privacy dashboard
  console.log('4. Privacy Dashboard:');
  const dashboard = app.getPrivacyDashboard();
  console.log('Summary:', JSON.stringify(dashboard.summary, null, 2));
  console.log();

  // Export data
  console.log('5. Exporting user data...');
  const exportData = await app.exportUserData();
  console.log('Exported:', JSON.stringify(exportData, null, 2));
  console.log();

  // In real app, user would trigger deletion
  // await app.deleteAllData();
  console.log('Demo complete. In production, user can delete all data if desired.');
}

demonstratePrivacyApp().catch(console.error);
