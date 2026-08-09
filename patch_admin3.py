with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\\n" in line or "const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('" in line:
        lines[i] = "                  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\\n');\n"
        if lines[i+1].strip() == "');" or lines[i+1].strip() == "');":
            lines[i+1] = ""
        break

with open('src/App.tsx', 'w') as f:
    f.writelines(lines)
