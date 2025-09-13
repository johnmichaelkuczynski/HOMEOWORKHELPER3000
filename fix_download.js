// Quick script to remove all download-related code
const fs = require('fs');

let content = fs.readFileSync('client/src/pages/homework-assistant.tsx', 'utf8');

// Remove all download button references
content = content.replace(/onClick={handlePrint}/g, 'onClick={() => {}}');
content = content.replace(/Download/g, 'Copy');
content = content.replace(/title="Print\/Save as PDF"/g, 'title="Copy to clipboard"');
content = content.replace(/title="Download this formatted solution as PDF"/g, 'title="Copy to clipboard"');

fs.writeFileSync('client/src/pages/homework-assistant.tsx', content);
console.log('Fixed download references');