import pandas as pd
import json, os
from datetime import datetime, date

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def clean(val):
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, float) and val == int(val):
        return int(val)
    return val

def read_sheet(path, sheet, header_row, drop_unnamed=True):
    df = pd.read_excel(path, sheet_name=sheet, header=header_row)
    df.columns = [str(c).strip() for c in df.columns]
    if drop_unnamed:
        df = df[[c for c in df.columns if not c.startswith('Unnamed')]]
    records = []
    for _, row in df.iterrows():
        r = {k: clean(v) for k, v in row.items()}
        if all(v is None for v in r.values()):
            continue
        records.append(r)
    return records

def save(name, data):
    with open(os.path.join(DATA_DIR, f'{name}.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  -> {name}.json: {len(data)} registos")

CRM = r'C:\Users\Noraxon\Downloads\CRM 2.0.xlsx'
ARQ = r'C:\Users\Noraxon\Downloads\Arquivo.xlsx'
DASH = r'C:\Users\Noraxon\Downloads\Dashboards.xlsx'

# Map: (file, sheet, header_row, output_name)
IMPORTS = [
    # CRM 2.0
    (CRM, "2' - Clientes", 5, 'clientes'),
    (CRM, "1 - Pipeline Comercial", 5, 'pipeline'),
    (CRM, "1.1 Log Comercial", 5, 'log_comercial'),
    (CRM, "3 - Conversões", 5, 'conversoes'),
    (CRM, "4' - Avaliações", 5, 'avaliacoes'),
    (CRM, "4'' - Serviços", 5, 'servicos'),
    (CRM, "4.1 - Log Operacional", 5, 'log_operacional'),
    (CRM, "Log Contratos", 8, 'log_contratos'),
    (CRM, "2'' - Parceiros", 6, 'parceiros'),
    (CRM, "2''.1 - Entidades Faturação", 6, 'entidades_faturacao'),
    (CRM, "8 - Falhas e Sanções", 7, 'falhas_sancoes'),
    (CRM, "10 - Vendas e Bónus", 8, 'vendas_bonus'),
    (CRM, "Log Colaboradores", 6, 'log_colaboradores'),
    (CRM, "Dados Colaboradores", 7, 'dados_colaboradores'),
    (CRM, "Preçário Público", 7, 'precario_publico'),
    (CRM, "Pag Clientes 2026", 3, 'pag_clientes_2026'),
    (CRM, "Ciclos", 5, 'ciclos'),
    (CRM, "Responsabilidades", 8, 'responsabilidades'),
    (CRM, "Totais Pagamentos", 6, 'totais_pagamentos'),
    (CRM, "Matriz Partilhas", 7, 'matriz_partilhas'),
    (CRM, "Pagamentos Treinadores", 5, 'pagamentos_treinadores'),
    # Clientes Híbridos - complex structure, needs special handling
    # Calculadora - complex structure, needs special handling
    # Arquivo
    (ARQ, "Pag Clientes 2025", 3, 'pag_clientes_2025'),
    (ARQ, "_Adesões_Validar", 3, 'adesoes_validar'),
    # Dashboards
    (DASH, "Auxiliares", 1, 'alertas'),
]

print("=== A importar dados ===\n")
for filepath, sheet, hrow, name in IMPORTS:
    try:
        data = read_sheet(filepath, sheet, hrow)
        save(name, data)
    except Exception as e:
        print(f"  ERRO {name}: {e}")

# --- Clientes Híbridos (complex layout, rows 10+) ---
try:
    df = pd.read_excel(CRM, sheet_name="2'.1 - Clientes Híbridos", header=None)
    # Find header row by looking for 'Cliente' text
    for i in range(len(df)):
        row_vals = [str(v) for v in df.iloc[i] if pd.notna(v)]
        if any('Cliente' in v and 'Duo' not in v and 'HÍBRIDOS' not in v for v in row_vals):
            header_idx = i
            break
    else:
        header_idx = 10
    data = read_sheet(CRM, "2'.1 - Clientes Híbridos", header_idx)
    pass  # clientes_hibridos removido — dados integrados em clientes.json
except Exception as e:
    pass  # sheet pode não existir, ignorar

# --- Calculadora (complex layout) ---
try:
    df = pd.read_excel(CRM, sheet_name="Calculadora", header=9)
    df.columns = [str(c).strip() for c in df.columns]
    df = df[[c for c in df.columns if not c.startswith('Unnamed')]]
    records = []
    for _, row in df.iterrows():
        r = {k: clean(v) for k, v in row.items()}
        if all(v is None for v in r.values()):
            continue
        records.append(r)
    save('calculadora', records)
except Exception as e:
    print(f"  ERRO calculadora: {e}")

# --- Keep existing users and permissions ---
users_path = os.path.join(DATA_DIR, 'users.json')
perms_path = os.path.join(DATA_DIR, 'permissions.json')

if not os.path.exists(users_path):
    users = [
        {"id": 1, "username": "admin", "password": "admin", "name": "Administrador", "role": "Admin", "active": True},
        {"id": 2, "username": "comercial", "password": "1234", "name": "Comercial", "role": "Comercial", "active": True},
        {"id": 3, "username": "coordenador", "password": "1234", "name": "Coordenador", "role": "Coordenador", "active": True},
        {"id": 4, "username": "tecnico", "password": "1234", "name": "Técnico", "role": "Técnico", "active": True},
        {"id": 5, "username": "direcao", "password": "1234", "name": "Direcção", "role": "Direcção", "active": True},
    ]
    save('users', users)

if not os.path.exists(perms_path):
    permissions = {
        "Admin": ["pipeline", "log_comercial", "clientes", "parceiros",
                  "entidades_faturacao", "conversoes", "avaliacoes", "servicos", "log_operacional",
                  "log_contratos", "falhas_sancoes", "vendas_bonus", "log_colaboradores", "ciclos",
                  "totais_pagamentos", "calculadora", "precario_publico", "pag_clientes_2026",
                  "pag_clientes_2025", "dados_colaboradores", "responsabilidades", "alertas",
                  "matriz_partilhas", "pagamentos_treinadores", "adesoes_validar", "backoffice"],
        "Comercial": ["pipeline", "log_comercial", "clientes", "conversoes", "vendas_bonus",
                      "calculadora", "precario_publico", "parceiros"],
        "Coordenador": ["clientes", "conversoes", "avaliacoes", "servicos",
                        "log_operacional", "log_contratos", "falhas_sancoes", "vendas_bonus",
                        "ciclos", "calculadora", "responsabilidades", "alertas", "matriz_partilhas"],
        "Técnico": ["avaliacoes", "servicos", "log_operacional", "responsabilidades"],
        "Direcção": ["clientes", "conversoes", "totais_pagamentos", "pag_clientes_2026",
                     "pag_clientes_2025", "dados_colaboradores", "precario_publico", "alertas",
                     "pagamentos_treinadores", "responsabilidades"]
    }
    save('permissions', permissions)

print("\n=== Importação concluída! ===")
