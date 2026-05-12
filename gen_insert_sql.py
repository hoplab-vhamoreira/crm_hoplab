"""
Gera INSERT SQL a partir dos ficheiros JSON, para execução via MCP.
Output: insert_data.sql  (uma tabela de cada vez, transacções separadas)
"""
import os, json, re

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

COLLECTIONS = [
    "users", "clientes", "pipeline", "log_comercial", "conversoes", "avaliacoes",
    "servicos", "log_operacional", "log_contratos", "parceiros",
    "entidades_faturacao", "falhas_sancoes", "vendas_bonus", "vendas_log",
    "log_colaboradores", "dados_colaboradores", "precario_publico",
    "calculadora", "catalogo_faltas", "niveis_sancao",
    "pag_clientes_2026", "pag_clientes_2025", "ciclos", "responsabilidades",
    "totais_pagamentos", "alertas", "matriz_partilhas", "pagamentos_treinadores",
    "adesoes_validar", "motor2026", "historico",
]

SKIP_PATTERNS = [
    lambda r: r.get("Código") == "Código",
    lambda r: r.get("Serviço") == "Serviço",
    lambda r: r.get("Cód. Origem") == "Cód. Origem",
    lambda r: r.get("Professor") == "Professor",
    lambda r: r.get("Falta") == "Falta",
    lambda r: str(r.get("Nível","")) in ("Nível","nivel"),
    lambda r: str(r.get("#","")) == "#",
]

def is_header(r):
    return any(fn(r) for fn in SKIP_PATTERNS)

def pg_literal(val, key=""):
    """Converte valor Python para literal PostgreSQL."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        s = json.dumps(val, ensure_ascii=False, default=str)
        return "'" + s.replace("'", "''") + "'::jsonb"
    # string vazia → NULL para campos não-texto (datas, números)
    s = str(val)
    if s.strip() == "":
        k = key.lower()
        if any(x in k for x in ("data", "date", "time", "stamp", "início",
                                 "inicio", "fim", "criação", "criacao",
                                 "admissão", "admissao")):
            return "NULL"
    return "'" + s.replace("'", "''") + "'"

out_lines = []
total = 0

for name in COLLECTIONS:
    path = os.path.join(DATA_DIR, f"{name}.json")
    if not os.path.exists(path):
        print(f"[SKIP] {name}.json não existe")
        continue

    with open(path, encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        records = [records]

    records = [r for r in records if isinstance(r, dict) and not is_header(r)]

    if not records:
        print(f"[EMPTY] {name}")
        continue

    out_lines.append(f"\n-- ===== {name} =====")
    out_lines.append(f'TRUNCATE TABLE "{name}" RESTART IDENTITY;')

    inserted = 0
    for rec in records:
        # Remover chaves internas
        rec2 = {k: v for k, v in rec.items() if not k.startswith('_row_id')}
        if not rec2:
            continue
        col_sql = ", ".join(f'"{k}"' for k in rec2.keys())
        val_sql = ", ".join(pg_literal(v, k) for k, v in rec2.items())
        out_lines.append(f'INSERT INTO "{name}" ({col_sql}) VALUES ({val_sql});')
        inserted += 1

    total += inserted
    print(f"[OK] {name}: {inserted} registos")

out_path = os.path.join(os.path.dirname(__file__), "insert_data.sql")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))

print(f"\nTotal: {total} registos → insert_data.sql")
