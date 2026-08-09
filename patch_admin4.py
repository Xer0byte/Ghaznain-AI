with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

# Remove lines 905-908 (0-indexed 904-907)
del lines[904:908]

with open('src/App.tsx', 'w') as f:
    f.writelines(lines)
