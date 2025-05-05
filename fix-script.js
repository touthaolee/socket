const fs = require('fs');

// Read the file
const content = fs.readFileSync('setup-project.js', 'utf8');

// Replace template literals in client-side/client-main.js and other files
// This will properly escape the ${} syntax in nested template literals
const fixed = content.replace(/<h3>\${(.*?)}<\/h3>/g, '<h3>\\${$1}</h3>')
  .replace(/<p>\${(.*?)}<\/p>/g, '<p>\\${$1}</p>')
  .replace(/Time: \${(.*?)} sec/g, 'Time: \\${$1} sec')
  .replace(/Questions: \${(.*?)}</g, 'Questions: \\${$1}<')
  .replace(/textContent = \${(.*?)};/g, 'textContent = \\${$1};')
  .replace(/\`<h3>\${(.*?)}<\/h3>\`/g, '`<h3>\\${$1}</h3>`');

// Write the fixed content back to the file
fs.writeFileSync('setup-project.js', fixed);

console.log('Fixed template literals in setup-project.js');
