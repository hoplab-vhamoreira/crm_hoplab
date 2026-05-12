"""Regenera SQL para as tabelas restantes com tratamento correcto de NULL."""
import os, json

DATA_DIR = r'C:\Users\Noraxon\HopLabCRM\data'
CHUNKS   = r'C:\Users\Noraxon\HopLabCRM\sql_chunks'

TABLES = [
    'clientes','avaliacoes','servicos','conversoes',
    'pipeline','log_comercial','pag_clientes_2026','pag_clientes_2025','log_operacional'
]

DATE_HINTS = ('data','date','time','stamp','inicio','fim','criacao',
              'admissao','admissão','criação','início')

def pg_literal(val, key=''):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        s = json.dumps(val, ensure_ascii=False, default=str)
        return "'" + s.replace("'", "''") + "'::jsonb"
    s = str(val)
    # String vazia em campo de data/timestamp → NULL
    if s.strip() == '':
        k = key.lower()
        if any(x in k for x in DATE_HINTS):
            return 'NULL'
    return "'" + s.replace("'", "''") + "'"

for name in TABLES:
    path = os.path.join(DATA_DIR, f'{name}.json')
    with open(path, encoding='utf-8') as f:
        records = json.load(f)
    if not isinstance(records, list):
        records = [records]
    records = [r for r in records if isinstance(r, dict)]

    lines = [f'TRUNCATE TABLE "{name}" RESTART IDENTITY;']
    for rec in records:
        rec2 = {k: v for k, v in rec.items() if k != '_row_id'}
        if not rec2:
            continue
        col_sql = ', '.join(f'"{k}"' for k in rec2)
        val_sql = ', '.join(pg_literal(v, k) for k, v in rec2.items())
        lines.append(f'INSERT INTO "{name}" ({col_sql}) VALUES ({val_sql});')

    out = os.path.join(CHUNKS, f'{name}_v2.sql')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{name}: {len(lines)-1} rows')

print('Feito.')
