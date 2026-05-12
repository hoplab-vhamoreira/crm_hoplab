"""
Migração JSON → Supabase com colunas tipadas.
Lê cada ficheiro JSON, coerce os valores para os tipos correctos
e insere nas tabelas tipadas criadas no Supabase.

Uso:
    $env:SUPABASE_DB_PASSWORD = 'a-tua-password'
    python migrate_typed.py
"""
import os
import json
import sys
import re
import psycopg2
import psycopg2.extras

DB_HOST     = "db.bocwqacwalzshjkhjzwi.supabase.co"
DB_PORT     = 5432
DB_NAME     = "postgres"
DB_USER     = "postgres"
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Tabelas a migrar (na ordem definida)
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

# Linhas a ignorar (cabeçalhos embutidos nos JSON)
SKIP_PATTERNS = [
    lambda r: r.get("Código") == "Código",          # precario_publico / calculadora
    lambda r: r.get("Serviço") == "Serviço",         # precario_publico / calculadora
    lambda r: r.get("Cód. Origem") == "Cód. Origem", # matriz_partilhas
    lambda r: r.get("Professor") == "Professor",     # pagamentos_treinadores
    lambda r: r.get("Falta") == "Falta",             # catalogo_faltas
    lambda r: r.get("Nível") in ("Nível", "nivel"),  # niveis_sancao
    lambda r: r.get("#") == "#",                     # motor2026 / responsabilidades
]

def is_header_row(record):
    return any(fn(record) for fn in SKIP_PATTERNS)


def get_table_columns(cur, table_name):
    """Devolve lista de (column_name, data_type) para a tabela, excluindo 'id'."""
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name != 'id'
        ORDER BY ordinal_position
    """, (table_name,))
    return cur.fetchall()


def coerce_value(val, data_type):
    """Converte val para o tipo PostgreSQL correcto. Retorna None em caso de falha."""
    if val is None:
        return None
    if isinstance(val, str) and val.strip() == '':
        return None

    if data_type in ('integer', 'bigint', 'smallint'):
        try:
            # Aceita "123", "123.0", "  45  "
            return int(float(str(val).strip()))
        except (ValueError, TypeError):
            return None

    if data_type in ('numeric', 'real', 'double precision'):
        try:
            s = str(val).strip().replace(',', '.')
            return float(s)
        except (ValueError, TypeError):
            return None

    if data_type == 'boolean':
        if isinstance(val, bool):
            return val
        low = str(val).strip().lower()
        if low in ('true', '1', 'yes', 'sim', 'verdadeiro'):
            return True
        if low in ('false', '0', 'no', 'não', 'nao', 'falso'):
            return False
        return None

    if data_type in ('date',):
        s = str(val).strip()
        if not s:
            return None
        # Aceita YYYY-MM-DD e outros formatos padrão
        try:
            # Básico: se tem só dígitos e hífens, deixa o psycopg2 tratar
            if re.match(r'^\d{4}-\d{2}-\d{2}', s):
                return s[:10]  # corta horário se existir
            return None
        except Exception:
            return None

    if data_type in ('timestamp with time zone', 'timestamp without time zone',
                     'timestamptz'):
        s = str(val).strip()
        if not s:
            return None
        # Verifica se parece uma data/timestamp válida
        if re.match(r'^\d{4}-\d{2}-\d{2}', s):
            return s
        return None

    # TEXT e tudo o resto → string
    return str(val)


def migrate_table(conn, cur, table_name):
    path = os.path.join(DATA_DIR, f"{table_name}.json")
    if not os.path.exists(path):
        print(f"  [SKIP] {table_name}.json não existe")
        return 0

    with open(path, encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        records = [records]

    if not records:
        print(f"  [EMPTY] {table_name}")
        return 0

    # Obter colunas da tabela
    cols_info = get_table_columns(cur, table_name)
    if not cols_info:
        print(f"  [NO COLS] {table_name} — tabela não encontrada?")
        return 0

    col_type = {c: t for c, t in cols_info}
    col_names = [c for c, _ in cols_info]

    # Limpar tabela antes de reinserir
    cur.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY')

    inserted = 0
    skipped = 0
    for record in records:
        if not isinstance(record, dict):
            skipped += 1
            continue
        if is_header_row(record):
            skipped += 1
            continue

        # Filtrar apenas campos que existem na tabela
        fields = [(c, coerce_value(record.get(c), col_type[c]))
                  for c in col_names if c in record or c in col_type]

        # Só inserir campos presentes no registo (não incluir NULL para campos ausentes
        # excepto se quisermos inserir NULL explicitamente — fazemos isso para todos os cols)
        # Estratégia: inserir TODOS os campos da tabela, usando NULL para os ausentes
        all_fields = [(c, coerce_value(record.get(c), col_type[c]))
                      for c in col_names]

        valid_fields = [(c, v) for c, v in all_fields]  # incluir todos, com NULL

        if not valid_fields:
            skipped += 1
            continue

        col_sql = ', '.join(f'"{c}"' for c, _ in valid_fields)
        val_sql = ', '.join(['%s'] * len(valid_fields))
        vals = [v for _, v in valid_fields]

        try:
            cur.execute(
                f'INSERT INTO "{table_name}" ({col_sql}) VALUES ({val_sql})',
                vals
            )
            inserted += 1
        except Exception as e:
            print(f"    [ROW ERR] {table_name}: {e} | row={record}")
            conn.rollback()
            # Reiniciar transacção para continuar
            cur.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY')
            inserted = 0
            skipped = 0
            # Tentar modo seguro: só TEXT para todos
            for record2 in records:
                if not isinstance(record2, dict) or is_header_row(record2):
                    continue
                safe_fields = [(c, str(record2[c]) if record2.get(c) not in (None, '') else None)
                               for c in col_names if c in record2]
                if not safe_fields:
                    continue
                col_sql2 = ', '.join(f'"{c}"' for c, _ in safe_fields)
                val_sql2 = ', '.join(['%s'] * len(safe_fields))
                vals2 = [v for _, v in safe_fields]
                try:
                    cur.execute(
                        f'INSERT INTO "{table_name}" ({col_sql2}) VALUES ({val_sql2})',
                        vals2
                    )
                    inserted += 1
                except Exception as e2:
                    print(f"    [SAFE ERR] {table_name}: {e2}")
                    skipped += 1
            break

    conn.commit()
    print(f"  [OK] {table_name}: {inserted} inseridos, {skipped} ignorados")
    return inserted


def main():
    if not DB_PASSWORD:
        print("ERRO: define $env:SUPABASE_DB_PASSWORD com a password do projeto.")
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
            total += migrate_table(conn, cur, name)
        except Exception as e:
            print(f"  [ERRO FATAL] {name}: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
            errors.append(name)

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
