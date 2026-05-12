"""
Migração de dados JSON → Supabase (crm_hoplab) via psycopg2
Corre uma vez; idempotente (TRUNCATE + INSERT).
"""
import os, json, sys
import psycopg2
import psycopg2.extras

# Supabase Postgres — connection pooler (porta 6543) ou directa (5432)
DB_HOST     = "db.bocwqacwalzshjkhjzwi.supabase.co"
DB_PORT     = 5432
DB_NAME     = "postgres"
DB_USER     = "postgres"
# A password do Supabase DB deve ser definida como variável de ambiente SUPABASE_DB_PASSWORD
# ou introduzida manualmente abaixo
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

COLLECTIONS = [
    "clientes", "pipeline", "log_comercial", "conversoes", "avaliacoes",
    "servicos", "log_operacional", "log_contratos", "parceiros",
    "entidades_faturacao", "falhas_sancoes", "vendas_bonus", "vendas_log",
    "log_colaboradores", "dados_colaboradores", "precario_publico",
    "calculadora", "catalogo_faltas", "niveis_sancao",
    "pag_clientes_2026", "pag_clientes_2025", "ciclos", "responsabilidades",
    "totais_pagamentos", "alertas", "matriz_partilhas", "pagamentos_treinadores",
    "adesoes_validar", "motor2026", "historico", "users",
]

def migrate_table(cur, name: str):
    path = os.path.join(DATA_DIR, f"{name}.json")
    if not os.path.exists(path):
        print(f"  [SKIP] {name}.json não existe")
        return 0

    with open(path, encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        records = [records]

    if not records:
        print(f"  [EMPTY] {name}")
        return 0

    # Limpa e re-insere (idempotente)
    cur.execute(f'TRUNCATE TABLE "{name}" RESTART IDENTITY')

    rows = [(json.dumps(r, ensure_ascii=False),) for r in records]
    psycopg2.extras.execute_batch(
        cur,
        f'INSERT INTO "{name}" (data) VALUES (%s::jsonb)',
        rows,
        page_size=200
    )
    print(f"  [OK] {name}: {len(rows)} registos")
    return len(rows)

def main():
    if not DB_PASSWORD:
        print("ERRO: define a variável de ambiente SUPABASE_DB_PASSWORD com a password do projeto.")
        print("  Windows: $env:SUPABASE_DB_PASSWORD='a-tua-password'")
        sys.exit(1)

    print(f"A ligar a {DB_HOST}…")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD, sslmode="require"
    )
    conn.autocommit = False
    cur = conn.cursor()
    print(f"Ligado. A migrar {len(COLLECTIONS)} colecções…\n")

    total = 0
    errors = []
    for name in COLLECTIONS:
        try:
            total += migrate_table(cur, name)
        except Exception as e:
            print(f"  [ERRO] {name}: {e}")
            conn.rollback()
            errors.append(name)
            continue
        conn.commit()

    cur.close()
    conn.close()

    print(f"\n{'='*40}")
    print(f"Total migrado: {total} registos")
    if errors:
        print(f"Erros em: {', '.join(errors)}")
        sys.exit(1)
    else:
        print("MIGRAÇÃO COMPLETA.")

if __name__ == "__main__":
    main()
