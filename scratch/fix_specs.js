const fs = require('fs');

const files = {
  'tests/loop_builder.spec.js': 'adminPage',
  'tests/loop_persistence.spec.js': 'adminPage',
  'tests/media_cloud_verification.spec.js': 'adminPage',
  'tests/campaign_wizard_happy_path.spec.js': 'brandPage',
  'tests/retailer_validation.spec.js': 'retailerPage',
  'tests/integration_gold_path.spec.js': 'adminPage',
  'tests/personas.spec.js': 'adminPage',
  'tests/personas_mvp.spec.js': 'adminPage'
};

for (const [file, persona] of Object.entries(files)) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace async ({ page }) with async ({ <persona>: page })
    content = content.replace(/async \(\{\s*page\s*\}\)/g, `async ({ ${persona}: page })`);
    
    fs.writeFileSync(file, content);
    console.log('Updated', file, 'with', persona);
}
