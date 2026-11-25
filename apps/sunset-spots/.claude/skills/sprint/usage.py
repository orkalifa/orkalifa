"""Sum Claude Code token usage per session (manager + team worktrees) from local transcripts.
Weighted cost uses list prices per 1M tokens (input, output, cache write, cache read) as a relative measure."""
import json, os, glob, collections

PRICES = {  # $/1M: input, output, cache_write(5m), cache_read
    'opus': (4.0, 20.0, 5.0, 0.20), 'sonnet': (2.0, 10.0, 2.5, 0.10), 'haiku': (0.10, 0.50, 0.125, 0.01),
    'fable': (8.0, 40.0, 10.0, 0.20),
}
def tier(model):
    m = (model or '').lower()
    for k in PRICES:
        if k in m: return k
    return 'opus'

root = os.path.expanduser('~/.claude/projects')
rows = []
for proj in ['C--Users-or-orkalifa'] + [d for d in os.listdir(root) if 'orkalifa-team' in d]:
    for f in glob.glob(os.path.join(root, proj, '*.jsonl')):
        tot = collections.Counter(); models = collections.Counter(); first = None; title = ''
        for line in open(f, encoding='utf-8', errors='ignore'):
            try: d = json.loads(line)
            except Exception: continue
            if d.get('type') == 'user' and not title:
                c = d.get('message', {}).get('content')
                txt = c if isinstance(c, str) else ' '.join(x.get('text', '') for x in (c or []) if isinstance(x, dict))
                for key in ('TASK ', 'Task:', 'task "'):
                    if key in txt: title = txt[txt.index(key):][:60].replace('\n', ' '); break
            msg = d.get('message') or {}
            u = msg.get('usage')
            if not u or d.get('type') != 'assistant': continue
            first = first or d.get('timestamp')
            mdl = msg.get('model', '')
            models[tier(mdl)] += 1
            for k in ('input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'):
                tot[(tier(mdl), k)] += u.get(k) or 0
        if not models: continue
        cost = 0.0; agg = collections.Counter()
        for (t, k), v in tot.items():
            p = PRICES[t]
            cost += v / 1e6 * {'input_tokens': p[0], 'output_tokens': p[1], 'cache_creation_input_tokens': p[2], 'cache_read_input_tokens': p[3]}[k]
            agg[k] += v
        rows.append((cost, proj.replace('C--Users-or-orca-workspaces-orkalifa-', '').replace('C--Users-or-', ''), os.path.basename(f)[:8], dict(models), agg, title, first))

rows.sort(reverse=True)
total = sum(r[0] for r in rows)
print(f'{"cost$":>8} {"share":>6}  {"where":<14} {"session":<9} {"model":<16} {"in":>9} {"out":>8} {"cacheW":>10} {"cacheR":>12}  task')
for cost, where, sid, models, agg, title, first in rows[:25]:
    print(f'{cost:8.2f} {cost/total*100:5.1f}%  {where:<14} {sid:<9} {",".join(models):<16} {agg["input_tokens"]:>9} {agg["output_tokens"]:>8} {agg["cache_creation_input_tokens"]:>10} {agg["cache_read_input_tokens"]:>12}  {title[:40]}')
print(f'\nTOTAL list-price equivalent: ${total:.2f} across {len(rows)} sessions')
mgr = sum(r[0] for r in rows if r[1] == 'orkalifa')
print(f'manager sessions share: {mgr/total*100:.1f}%  | workers: {(total-mgr)/total*100:.1f}%')
cr = sum(r[4]['cache_read_input_tokens'] for r in rows); allin = sum(r[4]['input_tokens'] + r[4]['cache_creation_input_tokens'] + r[4]['cache_read_input_tokens'] for r in rows)
print(f'cache-read share of input tokens: {cr/allin*100:.1f}%')
