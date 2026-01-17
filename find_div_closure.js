const fs = require('fs');

const content = fs.readFileSync('src/App.js', 'utf8');
const lines = content.split('\n');

let balance = 0;
let startChecking = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('className="min-h-screen') && i > 740) {
        startChecking = true;
        balance = 0; // Will be incremented by the line itself
        console.log(`Starting check at Line ${i + 1}`);
    }

    if (!startChecking) continue;

    // Count occurrences
    // Naive: split by <div and </div
    // Better: char by char matching <div (word boundary) and </div

    for (let j = 0; j < line.length; j++) {
        if (line.substring(j).startsWith('<div')) {
            // Check for self-closing / before >
            let k = j + 4;
            let isSelfClosing = false;
            while (k < line.length && line[k] !== '>') {
                if (line[k] === '/' && line[k + 1] === '>') isSelfClosing = true;
                k++;
            }
            // Also check strict self closing <div />
            // But wait, line[k] is >.
            // If we hit >, we stop.

            if (!isSelfClosing) {
                balance++;
                // console.log(`Line ${i+1}: +1 Balance -> ${balance}`);
            }
        }

        if (line.substring(j).startsWith('</div>')) {
            balance--;
            // console.log(`Line ${i+1}: -1 Balance -> ${balance}`);
            if (balance === 0) {
                console.log(`Min-H-Screen potentially closed at Line ${i + 1}`);
                // Don't break, keep checking to see if it goes negative or stays 0
            }
            if (balance < 0) {
                console.log(`NEGATIVE BALANCE at Line ${i + 1}`);
            }
        }
    }
}
