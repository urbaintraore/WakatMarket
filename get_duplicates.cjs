const fs = require('fs');
const content = fs.readFileSync('src/components/RoleDashboards.tsx', 'utf8');
const lines = content.split('\n');

const checkLine = (lineNumber) => {
  const start = Math.max(0, lineNumber - 5);
  const end = Math.min(lines.length - 1, lineNumber + 5);
  console.log(`\nLines ${start}-${end}:`);
  for (let i = start; i <= end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
};

checkLine(1792);
checkLine(1845);
