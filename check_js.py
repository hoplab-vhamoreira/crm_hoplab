import urllib.request, re

html = urllib.request.urlopen('http://localhost:5000/').read().decode('utf-8')
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
js = scripts[-1]

# Simple brace depth checker (ignores strings/comments — just looks for imbalance)
depth = 0
in_single = False
in_double = False
in_backtick = 0   # depth of backtick nesting
prev = ''

problems = []
for idx, ch in enumerate(js):
    ln = js[:idx].count('\n') + 1

    if in_single:
        if ch == "'" and prev != '\\': in_single = False
    elif in_double:
        if ch == '"' and prev != '\\': in_double = False
    elif in_backtick > 0:
        if ch == '`' and prev != '\\': in_backtick -= 1
    else:
        if ch == "'": in_single = True
        elif ch == '"': in_double = True
        elif ch == '`': in_backtick += 1
        elif ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                problems.append(f'Line {ln}: unexpected }}')
                depth = 0

    prev = ch if ch != '\\' else ('' if prev == '\\' else '\\')

print(f'Final brace depth: {depth}')
print(f'Problems: {problems[:10] if problems else "none"}')
print(f'JS length: {len(js)} chars, lines: {js.count(chr(10))}')
