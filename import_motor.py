import pandas as pd, json, os
from datetime import datetime, date

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def clean(val):
    if pd.isna(val): return None
    if isinstance(val, (datetime, date)): return val.isoformat()
    if isinstance(val, float) and val == int(val): return int(val)
    return val

CRM = r'C:\Users\Noraxon\Downloads\CRM 2.0.xlsx'

df = pd.read_excel(CRM, sheet_name='Pag Clientes 2026 Motor', header=4)
df.columns = [str(c).strip() for c in df.columns]
df = df[[c for c in df.columns if not c.startswith('Unnamed')]]

records = []
for _, row in df.iterrows():
    r = {k: clean(v) for k, v in row.items()}
    if all(v is None for v in r.values()): continue
    if not r.get('Cliente'): continue
    records.append(r)

with open(os.path.join(DATA_DIR, 'motor2026.json'), 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2, default=str)

print(f"motor2026.json: {len(records)} registos")
print("Colunas:", list(records[0].keys()) if records else [])
print("Exemplo:", {k: records[0][k] for k in list(records[0].keys())[:8]} if records else {})
