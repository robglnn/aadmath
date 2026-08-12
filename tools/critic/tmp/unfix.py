import re, os
subs = [
 ("src/ui/rift.css", "@media (max-width: 760px), (max-height: 520px) and (orientation: landscape) {", "@media (max-width: 760px) {"),
 ("src/report/report.css", "@media (max-width:720px),(max-height:520px) and (orientation:landscape){", "@media (max-width:720px){"),
 ("src/ui/menu.css", "@media (max-width: 720px), (max-height: 520px) and (orientation: landscape) {", "@media (max-width: 720px) {"),
 ("src/kit/kit.css", "@media (max-width: 720px), (max-height: 520px) and (orientation: landscape) {", "@media (max-width: 720px) {"),
 ("src/kit/ledger.css", "@media (max-width:760px),(max-height:520px) and (orientation:landscape){", "@media (max-width:760px){"),
 ("src/learn/echo.css", "@media (max-width: 900px), (max-height: 520px) and (orientation: landscape) {", "@media (max-width: 900px) {"),
 ("src/world/afford.css", "@media (max-width: 760px), (max-height: 520px) and (orientation: landscape) {", "@media (max-width: 760px) {"),
]
for path, new, old in subs:
    s = open(path, encoding='utf-8').read()
    n = s.count(new)
    s = s.replace(new, old)
    s = s.replace("/* breakpoint only — a phone is a phone in both orientations (mobile-landscape) */\n", "")
    open(path,'w',encoding='utf-8').write(s)
    print('reverted', path, n)
m = open("src/main.js", encoding='utf-8').read()
m = re.sub(r"// LAST, on purpose\..*?import '\./ui/landscape\.css';\n", "", m, flags=re.S)
open("src/main.js",'w',encoding='utf-8').write(m)
print("import removed:", "landscape.css" not in m)
os.rename("src/ui/landscape.css", "tools/critic/tmp/landscape.css.hold")
