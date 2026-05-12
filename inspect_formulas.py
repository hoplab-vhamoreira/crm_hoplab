import pandas as pd
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CRM = r'C:\Users\Noraxon\Downloads\CRM 2.0.xlsx'

# Read clientes with formulas (data_only=False shows formula strings)
from openpyxl import load_workbook

print("=== 2' - Clientes — primeiras colunas e fórmulas ===")
wb = load_workbook(CRM, data_only=False)

sheet = wb["2' - Clientes"]
# Find header row (row 6 = index 5, openpyxl is 1-based so row 6)
headers = [cell.value for cell in sheet[6]]
print("Headers:", [h for h in headers if h])

print("\n--- Fórmulas nas primeiras 3 linhas de dados (rows 7-9) ---")
for row_idx in range(7, 10):
    row = sheet[row_idx]
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            col_name = headers[cell.column - 1] if cell.column - 1 < len(headers) else f"Col{cell.column}"
            print(f"  [{cell.coordinate}] {col_name}: {str(cell.value)[:120]}")

print("\n\n=== 1 - Pipeline Comercial — fórmulas ===")
sheet2 = wb["1 - Pipeline Comercial"]
headers2 = [cell.value for cell in sheet2[6]]
print("Headers:", [h for h in headers2 if h][:15])
for row_idx in range(7, 9):
    row = sheet2[row_idx]
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            col_name = headers2[cell.column - 1] if cell.column - 1 < len(headers2) else f"Col{cell.column}"
            print(f"  [{cell.coordinate}] {col_name}: {str(cell.value)[:120]}")

print("\n\n=== 3 - Conversões — fórmulas ===")
sheet3 = wb["3 - Conversões"]
headers3 = [cell.value for cell in sheet3[6]]
print("Headers:", [h for h in headers3 if h][:15])
for row_idx in range(7, 9):
    row = sheet3[row_idx]
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            col_name = headers3[cell.column - 1] if cell.column - 1 < len(headers3) else f"Col{cell.column}"
            print(f"  [{cell.coordinate}] {col_name}: {str(cell.value)[:120]}")

print("\n\n=== Pag Clientes 2026 — fórmulas ===")
sheet4 = wb["Pag Clientes 2026"]
headers4 = [cell.value for cell in sheet4[4]]
print("Headers:", [h for h in headers4 if h][:12])
for row_idx in range(5, 7):
    row = sheet4[row_idx]
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            col_name = headers4[cell.column - 1] if cell.column - 1 < len(headers4) else f"Col{cell.column}"
            print(f"  [{cell.coordinate}] {col_name}: {str(cell.value)[:120]}")

print("\n\n=== 4' - Avaliações — fórmulas ===")
sheet5 = wb["4' - Avaliações"]
headers5 = [cell.value for cell in sheet5[6]]
print("Headers:", [h for h in headers5 if h][:15])
for row_idx in range(7, 9):
    row = sheet5[row_idx]
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            col_name = headers5[cell.column - 1] if cell.column - 1 < len(headers5) else f"Col{cell.column}"
            print(f"  [{cell.coordinate}] {col_name}: {str(cell.value)[:120]}")
