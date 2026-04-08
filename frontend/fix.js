const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'NurseDashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const reps = {
    'â€”': '-',
    'ðŸ‘©â€ âš•ï¸ ': '',
    'Â·': '•',
    'ðŸ‘¥': '',
    'ðŸ’“': '',
    'ðŸ“‹': '',
    'ðŸ“¡': '',
    'âš ï¸ ': '[Alert]',
    'â™¥': '',
    'â†‘': '',
    'â†“': '',
    'ðŸŒ¡ï¸ ': '',
    'ðŸ’¨': '',
    'ðŸŒ¬ï¸ ': '',
    'âš–ï¸ ': '',
    'âœ“': '',
    'âœ…': '[Success]',
    'ðŸ©¸': '',
    'ðŸ” ': 'Search',
    'ï¼‹': '+',
    'ðŸ ¥': '[Condition]',
    'ðŸ‘¤': '',
    'âœ•': 'x',
    'Â°C': '°C',
    'SpOâ‚‚': 'SpO2'
};

for (const [k, v] of Object.entries(reps)) {
    content = content.split(k).join(v);
}

// Modal fixes
content = content.replace(
    /position: 'fixed', inset: 0, zIndex: 1000,\s*background: 'rgba\(0,0,0,0\.72\)',\s*backdropFilter: 'blur\(4px\)',\s*display: 'flex', alignItems: 'center', justifyContent: 'center',\s*padding: '16px',\s*boxSizing: 'border-box',/g,
    `position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
            overflow: 'hidden',`
);

content = content.replace(
    /width: '100%',\s*maxWidth: 620,\s*maxHeight: '90vh',\s*display: 'flex',\s*flexDirection: 'column',\s*overflow: 'hidden',/g,
    `width: '100%',
              maxWidth: 620,
              maxHeight: 'calc(100vh - 32px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',`
);

content = content.replace(
    /<div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '20px 24px' }}>/g,
    `<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '20px 24px' }}>`
);

fs.writeFileSync(filePath, content);
console.log('Fixed file properly.');
