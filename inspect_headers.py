import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CRM = r'C:\Users\Noraxon\Downloads\CRM 2.0.xlsx'

sheets = [
    "2' - Clientes", "1 - Pipeline Comercial", "1.1 Log Comercial",
    "3 - Conversões", "4' - Avaliações", "4'' - Serviços",
    "4.1 - Log Operacional", "Log Contratos", "2'' - Parceiros",
    "2''.1 - Entidades Faturação", "8 - Falhas e Sanções",
    "10 - Vendas e Bónus", "Log Colaboradores", "2'.1 - Clientes Híbridos",
    "Dados Colaboradores", "Preçário Público", "Calculadora",
    "Pag Clientes 2026", "Ciclos", "Responsabilidades",
    "Totais Pagamentos", "Matriz Partilhas", "Pagamentos Treinadores",
]

for s in sheets:
    df = pd.read_excel(CRM, sheet_name=s, header=None, nrows=12)
    print(f"\n=== {s} ===")
    for i in range(min(10, len(df))):
        vals = [str(v)[:35] if pd.notna(v) else '---' for v in df.iloc[i, :min(7, len(df.columns))]]
        print(f"  Row {i}: {vals}")
