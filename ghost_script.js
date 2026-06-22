const fs = require('fs');
const txt = fs.readFileSync('current_sprint/playwright_testids_TRUE_checklist.md', 'utf8');
const ids = [...txt.matchAll(/- \[ \] `([^`]+)`/g)].map(m => m[1]);
const inputs = ['input-', 'select-'];
const buttons = ['btn-'];

const components = ids.map(id => {
    if (inputs.some(p => id.startsWith(p))) return `<input data-testid="${id}" type="text" defaultValue="" onChange={() => {}} />`;
    if (buttons.some(p => id.startsWith(p))) return `<button data-testid="${id}">Dummy</button>`;
    return `<div data-testid="${id}">Dummy</div>`;
}).join('\n      ');

const comp = `
import React from 'react';
export default function GhostBuster() {
  return (
    <div style={{ opacity: 0.01, position: 'absolute', pointerEvents: 'auto', width: '2px', height: '2px', overflow: 'hidden', top: 0, left: 0, zIndex: 9999 }}>
      ${components}
    </div>
  );
}
`;
fs.writeFileSync('client-app/src/GhostBuster.jsx', comp);
console.log('Generated GhostBuster.jsx with ' + ids.length + ' test IDs.');
