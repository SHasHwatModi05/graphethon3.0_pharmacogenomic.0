# coding=utf-8
import os

path = r'c:\Users\Ashish yadav\OneDrive\Desktop\priyanshu genevariant2\GeneVariant_Graphethon\frontend\src\pages\NurseDashboard.jsx'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_line = line.replace('ðŸ‘©â€ âš•ï¸ ', '') \
                   .replace('â”€â”€', '--') \
                   .replace('â”€', '-') \
                   .replace('ðŸ‘¥', '') \
                   .replace('ðŸ’“', '') \
                   .replace('ðŸ“‹', '') \
                   .replace('ðŸ“¡', '') \
                   .replace('âš ï¸ ', '[Alert]') \
                   .replace('â™¥', '') \
                   .replace('â†‘', '') \
                   .replace('â†“', '') \
                   .replace('ðŸŒ¡ï¸ ', '') \
                   .replace('ðŸ’¨', '') \
                   .replace('ðŸŒ¬ï¸ ', '') \
                   .replace('âš–ï¸ ', '') \
                   .replace('âœ“', '') \
                   .replace('âœ…', '[Success]') \
                   .replace('ðŸ©¸', '') \
                   .replace('ðŸ” ', 'Search') \
                   .replace('ï¼‹', '+') \
                   .replace('ðŸ ¥', '[Condition]') \
                   .replace('ðŸ‘¤', '') \
                   .replace('âœ•', 'X') \
                   .replace('â€¦', '...') \
                   .replace('Â°C', '°C') \
                   .replace('SpOâ‚‚', 'SpO2') \
                   .replace('Â·', '•') \
                   .replace('â€”', '-')

    # Strip any remaining non-ascii except for standard ones
    cleaned = ""
    for ch in new_line:
        if ord(ch) < 128 or ch in ('°', '•', '²'):
            cleaned += ch
    
    new_lines.append(cleaned)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('File cleaned successfully!')
