
const fs = require('fs');

try {
    const content = fs.readFileSync('lint_report.json', 'utf8');
    const report = JSON.parse(content);

    console.log('--- Lint Errors ---');
    report.forEach(file => {
        const errors = file.messages.filter(m => m.severity === 2); // 2 = error
        if (errors.length > 0) {
            console.log(`FILE: ${file.filePath}`);
            errors.forEach(m => {
                console.log(`  Line ${m.line}:${m.column} [${m.ruleId}] ${m.message}`);
            });
        }
    });
} catch (e) {
    console.error('Error parsing report:', e);
}
