const fs = require('fs');

const content = fs.readFileSync('src/App.js', 'utf8');
const lines = content.split('\n');

const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Simple regex-based check (imperfect but helpful)
    // Check for closing first
    if (line.match(/<\/div>/)) {
        if (stack.length > 0 && stack[stack.length - 1].type === 'div') {
            stack.pop();
            // console.log(`Closed div at ${i+1}`);
        } else {
            console.log(`Unexpected </div> at line ${i + 1}`);
        }
    }

    // Check for opening
    // Match <div ...> but NOT <div ... />
    // Regex: <div followed by anything not containing /> 
    // Actually simplest way is check count per line.

    const openMatches = (line.match(/<div/g) || []).length;
    const selfCloseMatches = (line.match(/<div[^>]*\/>/g) || []).length;
    const closeMatches = (line.match(/<\/div>/g) || []).length;

    // Real Openings = Total <div - Self Closing - (Wait, <div ...></div> on same line?)

    // Let's assume standard formatting where <div> is start of line or end.

    if (line.match(/^<div.*[^/]>$/) || line.match(/^<div.*>.*[^/]$/)) {
        // This logic is flawed for complex lines.
    }
}

// SIMPLER STACK APPROACH TOKENIZER
let tokens = [];
let cursor = 0;
// We need to tokenize the whole file to handle multi-line tags
// But for now, let's just grep the file for <div and </div logic

let divBalance = 0;
let lastOpenLine = -1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Count explicit <div ...> (not self closing)
    // Regex for open div that is NOT self closing
    // <div [^>]* > (and no / before >)

    let opens = 0;
    // We'll iterate manually to be safe
    for (let j = 0; j < line.length; j++) {
        if (line.substring(j).startsWith('<div')) {
            // Check if self closing
            // Scan ahead for >
            let k = j + 4;
            while (k < line.length && line[k] !== '>') k++;
            if (k < line.length) {
                if (line[k - 1] !== '/') {
                    opens++;
                    divBalance++;
                    if (divBalance === 1) lastOpenLine = i + 1;
                }
            }
        }
        if (line.substring(j).startsWith('</div>')) {
            divBalance--;
        }
    }
}
console.log(`Final Div Balance: ${divBalance}`);
if (divBalance > 0) console.log(`Unclosed Div somewhere. Last known root open around ${lastOpenLine}? No.`); 
