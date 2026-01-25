
const fs = require('fs');
const path = require('path');

const reportPath = path.resolve(__dirname, '../lint_report.txt');
const reportContent = fs.readFileSync(reportPath, 'utf8');

// Regex to find file blocks and issues
// Report format:
// C:\path\to\file.jsx
//   1:8  warning 'React' is defined but never used
//
// We can split by file paths.

const lines = reportContent.split('\n');
let currentFile = null;
const filesToFix = new Set();

lines.forEach(line => {
    // Check if line is a file path (underlined in some outputs, but here just check if it starts with C: and ends with .js/.jsx?)
    // In the provided view_file output, it looked like:
    // [0m [4mC:\Users\ChrisFro\...\file.jsx [24m [0m
    // ANSI codes are present.

    // Remove ANSI codes
    const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, '').trim();

    if (cleanLine.match(/^[a-zA-Z]:\\.*\.jsx?$/) || cleanLine.match(/^\/.*\.jsx?$/)) {
        currentFile = cleanLine;
    }

    if (currentFile && cleanLine.includes("'React' is defined but never used")) {
        filesToFix.add(currentFile);
    }
});

console.log(`Found ${filesToFix.size} files to fix React imports.`);

filesToFix.forEach(filePath => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        // Remove import React from 'react';
        // Handle variations: "import React from 'react'" or "import React from 'react';"
        // Also "import React, { ... } from 'react'" -> if React is unused, it might become "{ ... }" but usually it is default import.
        // The error says "'React' is defined but never used", implies the default import.

        const newContent = content.replace(/^import React from 'react';?\r?\n?/m, '');

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Fixed: ${path.basename(filePath)}`);
        } else {
            // Try searching for mixed import: import React, { ... }
            // If React is unused, we should remove "React, "
            const mixedRegex = /import React, \{(.+)\} from 'react';?/;
            // Wait, if we remove React, it becomes import { ... } from 'react'
            // But we need to use a regex that matches exactly "React, " or ", React"

            // Simplest heuristic: if 'React' is unused, removing "import React from 'react'" covers 99% of cases.
            // If failed, maybe it is "import React, { useEffect }..."
            // Let's print warning.
            const content2 = content.replace(/import React, /, 'import ');
            if (content2 !== content) {
                fs.writeFileSync(filePath, content2, 'utf8');
                console.log(`Fixed (mixed): ${path.basename(filePath)}`);
            } else {
                console.log(`Skipped (pattern not found): ${path.basename(filePath)}`);
            }
        }
    } catch (e) {
        console.error(`Error fixing ${filePath}:`, e.message);
    }
});
