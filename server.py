from flask import Flask, render_template, request, jsonify, session
import json, os, uuid
from functools import wraps
from datetime import datetime, date, timedelta
import compute
import psycopg2
import psycopg2.extras

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-only-change-in-production')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

# ── Supabase / Postgres ───────────────────────────────────────────────────────
_SUPABASE_ENABLED = bool(os.environ.get('SUPABASE_DB_PASSWORD'))
_DB_CONF = dict(
    host='db.bocwqacwalzshjkhjzwi.supabase.co',
    port=5432, dbname='postgres', user='postgres',
    password=os.environ.get('SUPABASE_DB_PASSWORD', ''),
    sslmode='require',
)

def _get_conn():
    return psycopg2.connect(**_DB_CONF)

# Cache de colunas por tabela: {table_name: [(col_name, data_type), ...]}
_COL_CACHE: dict = {}

def _get_table_cols(name: str) -> list:
    """Devolve [(col_name, data_type)] da tabela, excluindo 'id'. Usa cache."""
    if name not in _COL_CACHE:
        try:
            with _get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema='public' AND table_name=%s AND column_name!='id'
                        ORDER BY ordinal_position
                    """, (name,))
                    _COL_CACHE[name] = cur.fetchall()
        except Exception:
            _COL_CACHE[name] = []
    return _COL_CACHE[name]

import re as _re

def _coerce_for_pg(val, data_type: str):
    """Converte val para o tipo PostgreSQL correcto. Retorna None em caso de falha."""
    if val is None:
        return None
    is_text = data_type in ('text', 'character varying', 'character')
    if isinstance(val, str) and val.strip() == '':
        return val if is_text else None
    if data_type in ('integer', 'bigint', 'smallint'):
        try:
            return int(float(str(val).strip()))
        except (ValueError, TypeError):
            return None
    if data_type in ('numeric', 'real', 'double precision'):
        try:
            return float(str(val).strip().replace(',', '.'))
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
    if data_type == 'date':
        s = str(val).strip()
        if _re.match(r'^\d{4}-\d{2}-\d{2}', s):
            return s[:10]
        return None
    if 'timestamp' in data_type:
        s = str(val).strip()
        if _re.match(r'^\d{4}-\d{2}-\d{2}', s):
            return s
        return None
    if data_type == 'jsonb':
        if isinstance(val, (dict, list)):
            return json.dumps(val, ensure_ascii=False, default=str)
        return str(val)
    # TEXT e outros
    return str(val)

def _sb_load(name: str) -> list:
    """Lê todos os registos de uma tabela tipada (SELECT *)."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f'SELECT * FROM "{name}" ORDER BY id')
            rows = cur.fetchall()
    result = []
    for r in rows:
        rec = dict(r)
        rec['_row_id'] = rec.pop('id')
        result.append(rec)
    return result

def _sb_save(name: str, records: list):
    """Substitui todos os registos (TRUNCATE + INSERT tipado)."""
    cols_info = _get_table_cols(name)
    if not cols_info:
        raise RuntimeError(f"Tabela '{name}' sem colunas conhecidas")
    col_type = {c: t for c, t in cols_info}
    col_names = [c for c, _ in cols_info]
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f'TRUNCATE TABLE "{name}" RESTART IDENTITY')
            for rec in records:
                if not isinstance(rec, dict):
                    continue
                fields = [(c, _coerce_for_pg(rec[c], col_type[c]))
                          for c in col_names if c in rec]
                if not fields:
                    continue
                col_sql = ', '.join(f'"{c}"' for c, _ in fields)
                val_sql = ', '.join(['%s'] * len(fields))
                cur.execute(
                    f'INSERT INTO "{name}" ({col_sql}) VALUES ({val_sql})',
                    [v for _, v in fields]
                )
        conn.commit()

def _sb_insert(name: str, record: dict) -> dict:
    """Insere um registo tipado; devolve o dict com _row_id preenchido."""
    cols_info = _get_table_cols(name)
    col_type = {c: t for c, t in cols_info}
    col_names = [c for c, _ in cols_info]
    fields = [(c, _coerce_for_pg(record[c], col_type[c]))
              for c in col_names if c in record]
    if not fields:
        raise ValueError(f"Registo sem campos válidos para '{name}'")
    col_sql = ', '.join(f'"{c}"' for c, _ in fields)
    val_sql = ', '.join(['%s'] * len(fields))
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'INSERT INTO "{name}" ({col_sql}) VALUES ({val_sql}) RETURNING id',
                [v for _, v in fields]
            )
            row_id = cur.fetchone()[0]
        conn.commit()
    record['_row_id'] = row_id
    return record

def _sb_update(name: str, row_id: int, record: dict):
    """Actualiza um registo tipado pelo id interno."""
    cols_info = _get_table_cols(name)
    col_type = {c: t for c, t in cols_info}
    col_names = [c for c, _ in cols_info]
    fields = [(c, _coerce_for_pg(record[c], col_type[c]))
              for c in col_names if c in record]
    if not fields:
        return
    set_sql = ', '.join(f'"{c}" = %s' for c, _ in fields)
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'UPDATE "{name}" SET {set_sql} WHERE id = %s',
                [v for _, v in fields] + [row_id]
            )
        conn.commit()

def _sb_delete(name: str, row_id: int):
    """Apaga um registo pelo id interno do Supabase."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f'DELETE FROM "{name}" WHERE id = %s', (row_id,))
        conn.commit()

# Colecções que dependem de outras para calcular campos
COMPUTE_DEPS = {
    'clientes':           ['conversoes', 'log_comercial', 'motor2026', 'servicos'],
    'pipeline':           ['log_comercial', 'conversoes'],
    'conversoes':         [],
    'avaliacoes':         [],
    'log_comercial':      [],
    'log_contratos':      [],
    'pag_clientes_2026':  [],
    'pag_clientes_2025':  [],
    'servicos':           ['log_operacional', 'precario_publico'],
    'ciclos':             ['servicos'],
    'parceiros':          ['clientes'],
    'totais_pagamentos':  ['pagamentos_treinadores', 'dados_colaboradores'],
    'motor2026':          ['log_contratos'],
    'falhas_sancoes':     ['catalogo_faltas', 'niveis_sancao', 'dados_colaboradores'],
    'vendas_log':         [],
}

def load(name):
    if _SUPABASE_ENABLED:
        try:
            return _sb_load(name)
        except Exception as e:
            app.logger.warning(f'Supabase load({name}) falhou, fallback JSON: {e}')
    # Fallback: ficheiro local
    path = os.path.join(DATA_DIR, f'{name}.json')
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save(name, data):
    if _SUPABASE_ENABLED:
        try:
            _sb_save(name, data)
            return
        except Exception as e:
            app.logger.warning(f'Supabase save({name}) falhou, fallback JSON: {e}')
    # Fallback: ficheiro local
    path = os.path.join(DATA_DIR, f'{name}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

def load_with_compute(collection):
    """Carrega dados e aplica campos calculados se existirem."""
    data = load(collection)
    if collection not in COMPUTE_DEPS:
        return data
    deps = {dep: load(dep) for dep in COMPUTE_DEPS[collection]}
    return compute.enrich(collection, data, deps)

# Mapa: colecção → campo que contém o nome do cliente
CLIENT_FIELD = {
    'conversoes':          'Cliente',
    'servicos':            'Cliente',
    'avaliacoes':          'Nome',
    'pag_clientes_2026':   'Cliente',
    'pag_clientes_2025':   'Cliente',
    'log_contratos':       'Cliente',
    'log_comercial':       'Contacto',
    'pagamentos_treinadores': 'Cliente',
    'dados_colaboradores':    'Nome Oficial',
    'log_colaboradores':      'Colaborador',
}

# Rótulos legíveis por tipo de operação e colecção
ACTION_LABELS = {
    ('conversoes',  'add'):    ('🔄', 'Nova Conversão'),
    ('conversoes',  'edit'):   ('✏️', 'Conversão editada'),
    ('conversoes',  'delete'): ('🗑️', 'Conversão removida'),
    ('servicos',    'add'):    ('💪', 'Novo Serviço'),
    ('servicos',    'edit'):   ('✏️', 'Serviço editado'),
    ('servicos',    'delete'): ('🗑️', 'Serviço removido'),
    ('avaliacoes',  'add'):    ('📋', 'Nova Avaliação'),
    ('avaliacoes',  'edit'):   ('✏️', 'Avaliação editada'),
    ('avaliacoes',  'delete'): ('🗑️', 'Avaliação removida'),
    ('pag_clientes_2026', 'add'):  ('💳', 'Pagamento 2026 adicionado'),
    ('pag_clientes_2026', 'edit'): ('💳', 'Pagamento 2026 atualizado'),
    ('pag_clientes_2025', 'add'):  ('💳', 'Pagamento 2025 adicionado'),
    ('pag_clientes_2025', 'edit'): ('💳', 'Pagamento 2025 atualizado'),
    ('log_contratos','add'):   ('📝', 'Alteração de Contrato'),
    ('log_contratos','edit'):  ('📝', 'Contrato editado'),
    ('log_comercial','add'):   ('📞', 'Contacto comercial'),
    ('log_comercial','edit'):  ('📞', 'Contacto editado'),
    ('clientes',    'edit'):   ('👤', 'Ficha de cliente editada'),
    ('pagamentos_treinadores','add'):  ('💰', 'Pagamento treinador adicionado'),
    ('pagamentos_treinadores','edit'): ('💰', 'Pagamento treinador atualizado'),
    ('dados_colaboradores','add'):    ('👤', 'Colaborador adicionado'),
    ('dados_colaboradores','edit'):   ('✏️', 'Ficha de colaborador editada'),
    ('dados_colaboradores','delete'): ('🗑️', 'Colaborador removido'),
    ('log_colaboradores','add'):      ('📋', 'Evento registado'),
    ('log_colaboradores','edit'):     ('📋', 'Evento editado'),
    ('log_colaboradores','delete'):   ('🗑️', 'Evento removido'),
}

def _desc_from_record(collection, action, record):
    """Gera descrição legível a partir do registo."""
    if collection == 'conversoes' and action == 'add':
        return f"{record.get('Serviço','—')} | Técnico: {record.get('Técnico Responsável','—')} | {record.get('Data da Marcação/Início','')}"
    if collection == 'servicos' and action == 'add':
        return f"{record.get('Serviço','—')} ({record.get('Código','—')}) | Início: {record.get('Data Conversão','—')}"
    if collection == 'avaliacoes' and action == 'add':
        return f"{record.get('Serviço','—')} | {record.get('Data','—')} | Técnico: {record.get('Técnico Responsável','—')}"
    if collection in ('pag_clientes_2026','pag_clientes_2025') and action in ('add','edit'):
        return f"{record.get('Mês','—')} | {record.get('Modalidade','—')} | A pagar: {record.get('Valor a Pagar','—')}€ | Pago: {record.get('Valor Pago','—')}€ | {record.get('Forma Pagamento','—')}"
    if collection == 'log_contratos' and action == 'add':
        return f"{record.get('Estado','—')} | Motivo: {record.get('Motivo','—')} | {record.get('Data Início','—')}"
    if collection == 'log_comercial' and action == 'add':
        return f"{record.get('Tipo Ação','—')} via {record.get('Canal','—')} | {record.get('Resumo','—')}"
    if collection == 'clientes' and action == 'edit':
        campos = [k for k,v in record.items() if v and k not in ('_id','Status','Último Contacto','Dias s/ Contacto')]
        return f"Campos alterados: {', '.join(campos[:6])}"
    if collection == 'dados_colaboradores' and action == 'edit':
        campos = [k for k,v in record.items() if v and k not in ('_id',)]
        return f"Campos alterados: {', '.join(campos[:6])}"
    if collection == 'dados_colaboradores' and action == 'add':
        return f"Cargo: {record.get('Cargo','—')} | Regime: {record.get('Tipo de regime','—')}"
    if collection == 'log_colaboradores' and action == 'add':
        return f"{record.get('Evento','—')} | Cargo: {record.get('Cargo Novo','—')} | {record.get('Motivo','—')}"
    return json.dumps({k:v for k,v in list(record.items())[:4] if v}, ensure_ascii=False)

def log_history(cliente, collection, action, record):
    """Adiciona entrada no histórico do cliente."""
    if not cliente:
        return
    icon, label = ACTION_LABELS.get((collection, action), ('📌', action))
    user = session.get('user', {}).get('name', 'sistema')
    entry = {
        '_id':       str(uuid.uuid4())[:8],
        'timestamp': datetime.now().isoformat(),
        'cliente':   cliente,
        'icon':      icon,
        'tipo':      label,
        'colecao':   collection,
        'acao':      action,
        'descricao': _desc_from_record(collection, action, record),
        'utilizador': user,
    }
    # Guardar snapshot completo do registo eliminado (para revert)
    if action == 'delete':
        entry['snapshot'] = record
    # Supabase: INSERT directo (eficiente — não carrega todos os registos)
    if _SUPABASE_ENABLED:
        try:
            _sb_insert('historico', entry)
            return
        except Exception as e:
            app.logger.warning(f'log_history Supabase insert falhou: {e}')
    # Fallback JSON
    hist = load('historico')
    if not isinstance(hist, list):
        hist = []
    hist.append(entry)
    save('historico', hist)

COLLECTIONS = [
    'clientes', 'pipeline', 'log_comercial', 'conversoes', 'avaliacoes',
    'servicos', 'log_operacional', 'log_contratos', 'parceiros',
    'entidades_faturacao', 'falhas_sancoes', 'vendas_bonus', 'log_colaboradores',
    'dados_colaboradores', 'precario_publico', 'calculadora',
    'catalogo_faltas', 'niveis_sancao',
    'pag_clientes_2026', 'pag_clientes_2025', 'historico_faturacao', 'ciclos', 'responsabilidades',
    'totais_pagamentos', 'alertas', 'matriz_partilhas', 'pagamentos_treinadores',
    'adesoes_validar', 'vendas_log'
]

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Não autenticado'}), 401
        return f(*args, **kwargs)
    return decorated

def has_permission(collection):
    user = session.get('user')
    if not user:
        return False
    role = user.get('role', '')
    perms = load('permissions')
    allowed = perms.get(role, [])
    return collection in allowed or role == 'Admin'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    users = load('users')
    for u in users:
        if u['username'] == data.get('username') and u['password'] == data.get('password') and u.get('active', True):
            session['user'] = u
            perms = load('permissions')
            allowed = perms.get(u['role'], [])
            return jsonify({'ok': True, 'user': u, 'permissions': allowed})
    return jsonify({'ok': False, 'error': 'Credenciais inválidas'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'ok': True})

@app.route('/api/me')
def me():
    user = session.get('user')
    if not user:
        return jsonify({'ok': False}), 401
    perms = load('permissions')
    allowed = perms.get(user['role'], [])
    return jsonify({'ok': True, 'user': user, 'permissions': allowed})

@app.route('/api/data/<collection>')
@login_required
def get_data(collection):
    if collection not in COLLECTIONS:
        return jsonify({'error': 'Colecção inválida'}), 404
    if not has_permission(collection):
        return jsonify({'error': 'Sem permissão'}), 403
    return jsonify(load_with_compute(collection))

@app.route('/api/data/<collection>', methods=['POST'])
@login_required
def add_record(collection):
    if collection not in COLLECTIONS:
        return jsonify({'error': 'Colecção inválida'}), 404
    if not has_permission(collection):
        return jsonify({'error': 'Sem permissão'}), 403
    record = request.json
    record['_id'] = str(uuid.uuid4())[:8]

    if _SUPABASE_ENABLED:
        try:
            record = _sb_insert(collection, record)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        data = load(collection)
        data.append(record)
        save(collection, data)

    # histórico automático
    if collection in CLIENT_FIELD:
        log_history(record.get(CLIENT_FIELD[collection]), collection, 'add', record)

    # Conversão automática: Convertido em Log Comercial → Parceiro ou Cliente
    extra = None
    if collection == 'log_comercial' and record.get('Resultado') == 'Convertido':
        contacto = record.get('Contacto', '').strip()
        tipo = record.get('Tipo Conversão', '').strip()
        if contacto and tipo == 'Parceiro':
            parceiros = load('parceiros')
            if not any(p.get('Nome / Empresa') == contacto for p in parceiros):
                novo = {'_id': str(uuid.uuid4())[:8], 'Nome / Empresa': contacto,
                        'Tipo Entidade': 'Particular', 'Origem': 'Pipeline'}
                if _SUPABASE_ENABLED:
                    _sb_insert('parceiros', novo)
                else:
                    parceiros.append(novo); save('parceiros', parceiros)
                extra = {'criado': 'parceiro', 'nome': contacto}
        elif contacto and tipo == 'Cliente':
            clientes = load('clientes')
            if not any(c.get('Nome') == contacto for c in clientes):
                novo = {'_id': str(uuid.uuid4())[:8], 'Nome': contacto,
                        'Origem': 'Pipeline', 'Data Criação': datetime.now().date().isoformat()}
                if _SUPABASE_ENABLED:
                    _sb_insert('clientes', novo)
                else:
                    clientes.append(novo); save('clientes', clientes)
                extra = {'criado': 'cliente', 'nome': contacto}
            else:
                extra = {'criado': 'existia', 'nome': contacto, 'tipo': 'cliente'}

    return jsonify({'ok': True, 'record': record, 'extra': extra})

@app.route('/api/data/<collection>/<int:idx>', methods=['PUT'])
@login_required
def update_record(collection, idx):
    if collection not in COLLECTIONS:
        return jsonify({'error': 'Colecção inválida'}), 404
    if not has_permission(collection):
        return jsonify({'error': 'Sem permissão'}), 403
    data = load(collection)
    if idx < 0 or idx >= len(data):
        return jsonify({'error': 'Índice inválido'}), 404
    updates = request.json
    # Não sobrescrever campos calculados com valores vazios vindos do form
    COMPUTED = {'Status','Último Contacto','Dias s/ Contacto','Data Criação',
                'Aberta/Fechada','PVP s/IVA','Valor Receber (HOP)',
                'Dias para Avaliação','_Status_Aval','_Estado_Pag','Dias Atrás',
                '_Urgencia','_nClientes','_UltimaExecucao','_DiasUltimaExec',
                'Semana Actual','Data Fim','_Q1_Vendas','_Q1_Bonus_Elegivel',
                'CF60'}
    for k, v in updates.items():
        if k not in COMPUTED or v not in (None, '', 'None'):
            data[idx][k] = v

    if _SUPABASE_ENABLED:
        row_id = data[idx].get('_row_id')
        if row_id:
            _sb_update(collection, row_id, data[idx])
        else:
            save(collection, data)   # fallback
    else:
        save(collection, data)
    # histórico automático
    if collection in CLIENT_FIELD:
        cliente = data[idx].get(CLIENT_FIELD[collection])
        log_history(cliente, collection, 'edit', data[idx])
    elif collection == 'clientes':
        log_history(data[idx].get('Nome'), 'clientes', 'edit', updates)
    return jsonify({'ok': True, 'record': data[idx]})

@app.route('/api/data/<collection>/<int:idx>', methods=['DELETE'])
@login_required
def delete_record(collection, idx):
    if collection not in COLLECTIONS:
        return jsonify({'error': 'Colecção inválida'}), 404
    if not has_permission(collection):
        return jsonify({'error': 'Sem permissão'}), 403
    data = load(collection)
    if idx < 0 or idx >= len(data):
        return jsonify({'error': 'Índice inválido'}), 404
    removed = data[idx]
    if _SUPABASE_ENABLED:
        row_id = removed.get('_row_id')
        if row_id:
            _sb_delete(collection, row_id)
        else:
            data.pop(idx); save(collection, data)
    else:
        data.pop(idx); save(collection, data)
    if collection in CLIENT_FIELD:
        cliente = removed.get(CLIENT_FIELD[collection])
        log_history(cliente, collection, 'delete', removed)
    return jsonify({'ok': True, 'removed': removed})

@app.route('/api/historico/revert/<hist_id>', methods=['POST'])
@login_required
def revert_historico(hist_id):
    """Reverte um registo eliminado: restaura o snapshot na colecção original."""
    hist = load('historico')
    entry = next((h for h in hist if h.get('_id') == hist_id), None)
    if not entry:
        return jsonify({'error': 'Entrada não encontrada'}), 404
    if entry.get('acao') != 'delete':
        return jsonify({'error': 'Só é possível reverter eliminações'}), 400
    snapshot = entry.get('snapshot')
    if not snapshot:
        return jsonify({'error': 'Sem snapshot para restaurar (registo antigo)'}), 400
    collection = entry.get('colecao')
    if collection not in COLLECTIONS:
        return jsonify({'error': 'Colecção inválida'}), 400
    # Restaurar
    data = load(collection)
    snapshot['_id'] = str(uuid.uuid4())[:8]  # novo _id para evitar conflitos
    data.append(snapshot)
    save(collection, data)
    # Marcar no histórico como revertido
    for h in hist:
        if h.get('_id') == hist_id:
            h['revertido'] = True
            h['revertido_em'] = datetime.now().isoformat()
    save('historico', hist)
    # Log da reversão
    cliente = entry.get('cliente')
    log_history(cliente, collection, 'add', snapshot)
    return jsonify({'ok': True, 'restored': snapshot})

# --- Estado do Cliente (Suspender / Cancelar / Reativar / Férias / Desconto) ---
@app.route('/api/clientes/<path:nome>/estado', methods=['POST'])
@login_required
def mudar_estado_cliente(nome):
    """
    Muda o estado de um cliente.
    Body JSON:
      { estado: 'Suspenso'|'Cancelado'|'Ativo'|'Férias'|'Desconto',
        motivo: str, data_inicio: str (YYYY-MM-DD), data_fim: str|null,
        notas: str|null, desconto_pct: float|null }
    Para clientes Híbridos: atualiza Estado Híbrido + ajusta par DUO.
    Para clientes normais: adiciona entrada em log_contratos + atualiza motor2026.
    """
    body = request.json or {}
    estado     = body.get('estado', 'Ativo')
    motivo     = body.get('motivo', '')
    data_inicio = body.get('data_inicio') or datetime.now().date().isoformat()
    data_fim   = body.get('data_fim') or None
    notas      = body.get('notas', '')
    desconto_pct = body.get('desconto_pct')
    user = session.get('user', {}).get('name', 'sistema')

    clientes = load('clientes')
    cliente_rec = next((c for c in clientes if c.get('Nome') == nome), None)
    if not cliente_rec:
        return jsonify({'error': 'Cliente não encontrado'}), 404

    is_hibrido = cliente_rec.get('Regime') == 'Híbrido'

    if is_hibrido:
        # ── Híbrido: atualiza Estado Híbrido directamente no cliente ──
        estado_hib = 'Activo' if estado == 'Ativo' else estado  # normalizar
        cliente_rec['Estado Híbrido'] = estado_hib

        # Lógica DUO: ajustar Valor Híbrido do próprio + do par
        par_nome = cliente_rec.get('Par Híbrido')
        single   = cliente_rec.get('Valor Single')
        duo_base = cliente_rec.get('Valor Duo Base')

        if estado_hib == 'Suspenso' or estado_hib == 'Cancelado':
            cliente_rec['Valor Híbrido'] = 0
            # Par fica a pagar valor single
            if par_nome and single:
                par_rec = next((c for c in clientes if c.get('Nome') == par_nome), None)
                if par_rec and par_rec.get('Estado Híbrido') == 'Activo':
                    par_rec['Valor Híbrido'] = par_rec.get('Valor Single') or single
        else:  # Reativar
            cliente_rec['Valor Híbrido'] = duo_base if duo_base else single
            # Par volta ao preço duo se ambos activos
            if par_nome and duo_base:
                par_rec = next((c for c in clientes if c.get('Nome') == par_nome), None)
                if par_rec and par_rec.get('Estado Híbrido') == 'Activo':
                    par_rec['Valor Híbrido'] = par_rec.get('Valor Duo Base') or duo_base

        save('clientes', clientes)

        # Log histórico
        icon_map = {'Suspenso':'⏸️','Cancelado':'❌','Activo':'✅'}
        log_history(nome, 'clientes', 'edit', {
            'Estado Híbrido': estado_hib, 'Motivo': motivo, 'Notas': notas
        })

        return jsonify({'ok': True, 'tipo': 'hibrido', 'estado': estado_hib,
                        'par_atualizado': par_nome if par_nome else None})

    else:
        # ── Normal: adiciona entrada em log_contratos + actualiza motor2026 ──
        log_c = load('log_contratos')
        novo_ev = {
            '_id':         str(uuid.uuid4())[:8],
            'Data_Inicio': data_inicio,
            'Cliente':     nome,
            'Estado':      estado,
            'Motivo':      motivo,
            'Data_Fim':    data_fim,
            'Registado_por': user,
            'Notas':       notas,
            'Desconto_pct': desconto_pct,
            'Tipo_Desconto': body.get('tipo_desconto'),
            'Ambito':      body.get('ambito'),
        }
        log_c.append(novo_ev)
        save('log_contratos', log_c)

        # Actualizar motor2026.Estado Hoje em tempo real
        motor = load('motor2026')
        for m in motor:
            if m.get('Cliente') == nome:
                if estado in ('Suspenso', 'Cancelado', 'Férias'):
                    m['Estado Hoje'] = estado
                elif estado == 'Ativo':
                    m['Estado Hoje'] = 'Ativo'
                break
        save('motor2026', motor)

        log_history(nome, 'log_contratos', 'add', novo_ev)
        return jsonify({'ok': True, 'tipo': 'normal', 'estado': estado, 'evento': novo_ev})


# --- Backoffice: Users ---
@app.route('/api/users')
@login_required
def get_users():
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    return jsonify(load('users'))

@app.route('/api/users', methods=['POST'])
@login_required
def add_user():
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    users = load('users')
    user = request.json
    user['id'] = max((u['id'] for u in users), default=0) + 1
    user['active'] = True
    users.append(user)
    save('users', users)
    return jsonify({'ok': True, 'user': user})

@app.route('/api/users/<int:uid>', methods=['PUT'])
@login_required
def update_user(uid):
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    users = load('users')
    for u in users:
        if u['id'] == uid:
            u.update(request.json)
            save('users', users)
            return jsonify({'ok': True, 'user': u})
    return jsonify({'error': 'Utilizador não encontrado'}), 404

@app.route('/api/users/<int:uid>', methods=['DELETE'])
@login_required
def delete_user(uid):
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    users = load('users')
    users = [u for u in users if u['id'] != uid]
    save('users', users)
    return jsonify({'ok': True})

# --- Backoffice: Permissions ---
@app.route('/api/permissions')
@login_required
def get_permissions():
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    return jsonify(load('permissions'))

@app.route('/api/permissions', methods=['PUT'])
@login_required
def update_permissions():
    if session['user']['role'] != 'Admin':
        return jsonify({'error': 'Apenas Admin'}), 403
    perms = request.json
    save('permissions', perms)
    return jsonify({'ok': True})

@app.route('/api/cliente/<path:nome>')
@login_required
def get_cliente_detalhe(nome):
    """Vista 360° — agrega todos os dados de um cliente."""
    clientes = load_with_compute('clientes')
    info = next((c for c in clientes if c.get('Nome') == nome), {})

    def fetch(col, field):
        """Devolve registos do cliente, com _idx = posição no ficheiro e _colecao = nome."""
        rows = []
        for i, r in enumerate(load(col)):
            if r.get(field) == nome:
                r['_idx']    = i
                r['_colecao'] = col
                rows.append(r)
        return rows

    def fetch_pag(col, nome_alt=None):
        """Pagamentos: match por Cliente, Cliente Motor, ou nome alternativo (nome completo)."""
        rows = []
        for i, r in enumerate(load(col)):
            cliente_r = r.get('Cliente') or ''
            motor_r   = r.get('Cliente Motor') or ''
            if cliente_r == nome or motor_r == nome or (nome_alt and cliente_r == nome_alt):
                r['_idx']    = i
                r['_colecao'] = col
                rows.append(r)
        return rows

    pag26 = fetch_pag('pag_clientes_2026')
    # Obter nome completo a partir do pag26 (ex: "Carlos Manuel Pina Cabral")
    nome_completo = next(
        (p.get('Cliente') for p in pag26 if p.get('Cliente') and p.get('Cliente') != nome),
        None
    )
    pag25 = fetch_pag('pag_clientes_2025', nome_alt=nome_completo)
    # enriquecer pagamentos com estado calculado
    pag26 = compute.enrich_pagamentos(pag26)
    pag25 = compute.enrich_pagamentos(pag25)

    avals = fetch('avaliacoes', 'Nome')

    # Também incluir conversões AM* que ainda não estejam em avaliacoes
    # (são a fonte usada pelo _status_cliente para calcular ultima_aval)
    conv_avals = [
        {
            'Nome':                  nome,
            'Serviço':               c.get('Serviço', ''),
            'Data':                  c.get('Data da Marcação/Início', ''),
            'Técnico Responsável':   c.get('Técnico Responsável', ''),
            'Nível':                 c.get('Nível', ''),
            '_fonte':                'Conversão',
            '_idx':                  c.get('_idx'),
            '_colecao':              'conversoes',
        }
        for c in fetch('conversoes', 'Cliente')
        if str(c.get('Serviço', '') or '').startswith('AM')
        and not any(
            a.get('Serviço') == c.get('Serviço') and
            str(a.get('Data', ''))[:10] == str(c.get('Data da Marcação/Início', ''))[:10]
            for a in avals
        )
    ]
    avals = compute.enrich_avaliacoes(avals + conv_avals)

    # Motor 2026 — plano e pagamentos mensais esperados
    motor2026 = load('motor2026')
    motor = next((m for m in motor2026 if m.get('Cliente') == nome), None)

    hist = load('historico')
    hist_cliente = sorted(
        [h for h in hist if h.get('cliente') == nome],
        key=lambda h: h.get('timestamp',''), reverse=True
    )

    return jsonify({
        'info':           info,
        'servicos':       fetch('servicos', 'Cliente'),
        'avaliacoes':     avals,
        'pag_2026':       pag26,
        'pag_2025':       pag25,
        'motor':          motor,
        'log_contratos':  fetch('log_contratos', 'Cliente'),
        'log_comercial':  fetch('log_comercial', 'Contacto'),
        'historico':      hist_cliente,
    })

@app.route('/api/on/<n_on>')
@login_required
def get_on_detalhe(n_on):
    """Vista 360° de uma Oportunidade de Negócio (Pipeline)."""
    # Aceitar ON como número ou string
    try:
        n_on_num = int(n_on)
    except ValueError:
        n_on_num = n_on

    pipeline = load_with_compute('pipeline')
    info = next(
        (p for p in pipeline
         if p.get('Nº ON') == n_on_num or str(p.get('Nº ON','')) == str(n_on)),
        {}
    )
    contacto = info.get('Contacto', '')

    # Log comercial deste ON (com _idx para poder eliminar)
    log_raw = []
    for i, l in enumerate(load('log_comercial')):
        if l.get('Nº ON') == n_on_num or str(l.get('Nº ON','')) == str(n_on):
            l['_idx'] = i
            l['_colecao'] = 'log_comercial'
            log_raw.append(l)
    log_enriched = compute.enrich_log_comercial(log_raw)
    log_enriched.sort(key=lambda l: str(l.get('Data Ação') or ''), reverse=True)

    # Histórico do contacto associado a este ON
    hist = load('historico')
    hist_on = sorted(
        [h for h in hist if h.get('cliente') == contacto],
        key=lambda h: h.get('timestamp', ''), reverse=True
    )

    return jsonify({
        'info':         info,
        'log_comercial': log_enriched,
        'historico':    hist_on,
    })


@app.route('/api/colaborador/<path:nome>')
@login_required
def get_colaborador(nome):
    """Vista 360° de um colaborador: ficha + log eventos + histórico de sistema."""
    colabs = load('dados_colaboradores')
    info = next((c for c in colabs if c.get('Nome Oficial') == nome), None)
    if not info:
        return jsonify({'error': 'Colaborador não encontrado'}), 404

    # Log de eventos (admissão, suspensão, promoção, …)
    log_ev = sorted(
        [e for e in load('log_colaboradores') if e.get('Colaborador') == nome],
        key=lambda e: str(e.get('Data') or ''), reverse=True
    )

    # Histórico de sistema (edições à ficha + eventos registados)
    hist = load('historico')
    hist_col = sorted(
        [h for h in hist if h.get('cliente') == nome],
        key=lambda h: h.get('timestamp', ''), reverse=True
    )

    return jsonify({
        'info':             info,
        'log_colaboradores': log_ev,
        'historico':        hist_col,
    })


@app.route('/api/historico/<path:nome>')
@login_required
def get_historico(nome):
    hist = load('historico')
    return jsonify(sorted(
        [h for h in hist if h.get('cliente') == nome],
        key=lambda h: h.get('timestamp',''), reverse=True
    ))

@app.route('/api/alertas')
@login_required
def get_alertas():
    """Devolve todos os alertas com índice original para operações CRUD."""
    if not has_permission('alertas'):
        return jsonify({'error': 'Sem permissão'}), 403
    alertas = load('alertas')
    return jsonify([dict(r, _idx=i) for i, r in enumerate(alertas)])


@app.route('/api/historico_faturacao')
@login_required
def historico_faturacao_list():
    """Devolve registos de pag_clientes_2025 e 2026 juntos, enriquecidos com _Ano e _Colecao/_idx."""
    if not has_permission('pag_clientes_2026') and not has_permission('pag_clientes_2025'):
        return jsonify({'error': 'Sem permissão'}), 403

    def load_ano(col, ano):
        rows = []
        for i, r in enumerate(compute.enrich_pagamentos(load(col))):
            r = dict(r)
            r['_Ano']    = ano
            r['_Colecao'] = col
            r['_idx']    = i
            rows.append(r)
        return rows

    dados = load_ano('pag_clientes_2026', 2026) + load_ano('pag_clientes_2025', 2025)

    # Ordenar: ano desc, mês desc
    MES_ORD = {'Janeiro':1,'Fevereiro':2,'Março':3,'Abril':4,'Maio':5,'Junho':6,
               'Julho':7,'Agosto':8,'Setembro':9,'Outubro':10,'Novembro':11,'Dezembro':12}
    dados.sort(key=lambda r: (-r['_Ano'], -MES_ORD.get(r.get('Mês',''), 0)))
    return jsonify(dados)


@app.route('/api/lookup/<collection>/<field>')
@login_required
def lookup_values(collection, field):
    """Devolve lista ordenada de valores únicos de um campo, para preencher dropdowns."""
    data = load(collection)
    # Para o preçário, filtrar só linhas com Código definido (serviços reais)
    if collection == 'precario_publico' and field == 'Serviço':
        data = [r for r in data if r.get('Código') and str(r.get('Código',''))
                not in ('None','') and not str(r.get('Código','')).startswith('*')]
    # Colaboradores cancelados não aparecem nos dropdowns
    if collection == 'dados_colaboradores':
        data = [r for r in data if str(r.get('Estado', 'Activo')).strip() != 'Cancelado']
    values = sorted(
        {str(r[field]) for r in data if r.get(field) not in (None, '', 'None')},
        key=str.lower
    )
    return jsonify(values)

@app.route('/api/autofill')
@login_required
def autofill():
    """Devolve o valor de um campo de um registo que corresponde a um critério.
    Query params: src, match_field, match_val, return_field
    Usa a última correspondência (como XLOOKUP com -1).
    """
    src          = request.args.get('src', '')
    match_field  = request.args.get('match_field', '')
    match_val    = request.args.get('match_val', '')
    return_field = request.args.get('return_field', '')

    if not all([src, match_field, match_val, return_field]):
        return jsonify({'error': 'Parâmetros em falta'}), 400

    data = load(src)
    # Percorrer de trás para a frente → última correspondência (XLOOKUP -1)
    for r in reversed(data):
        if str(r.get(match_field, '') or '') == match_val:
            val = r.get(return_field)
            if val is not None:
                return jsonify({'value': val})

    return jsonify({'value': None})


@app.route('/api/collections')
@login_required
def list_collections():
    return jsonify(COLLECTIONS)

@app.route('/api/falhas/resumo')
@login_required
def get_falhas_resumo():
    trimestre = request.args.get('trimestre', None)
    log       = load_with_compute('falhas_sancoes')
    niveis    = load('niveis_sancao')
    colab     = load('dados_colaboradores')
    resumo    = compute.calcular_resumo_trimestral(log, niveis, colab, trimestre)
    # trimestres disponíveis
    trimestres = sorted({e.get('Trimestre') for e in log if e.get('Trimestre')}, reverse=True)
    return jsonify({'resumo': resumo, 'trimestres': trimestres})


@app.route('/api/falhas/catalogo')
@login_required
def get_falhas_catalogo():
    return jsonify(load('catalogo_faltas'))


@app.route('/api/agenda')
@login_required
def get_agenda():
    periodo = request.args.get('periodo', 'semana')
    data_str = request.args.get('data', date.today().isoformat())
    try:
        ref = date.fromisoformat(data_str)
    except Exception:
        ref = date.today()

    if periodo == 'hoje':
        d_ini = d_fim = ref
    elif periodo == 'semana':
        dow = ref.weekday()          # Mon=0
        d_ini = ref - timedelta(days=dow)
        d_fim = d_ini + timedelta(days=6)
    else:  # mes
        import calendar
        d_ini = ref.replace(day=1)
        d_fim = ref.replace(day=calendar.monthrange(ref.year, ref.month)[1])

    events = []

    def in_range(val):
        d = compute.parse_date(val)
        return d and d_ini <= d <= d_fim

    # Avaliações — conjunto de (cliente, data) já cobertos para deduplicar conversões
    avals_vistas = set()
    for _aidx, a in enumerate(load('avaliacoes')):
        if in_range(a.get('Data')):
            dt = (compute.parse_date(a.get('Data')) or d_ini).isoformat()
            avals_vistas.add((a.get('Nome', ''), dt))
            events.append({
                'data':         dt,
                'hora':         a.get('Hora', ''),
                'cliente':      a.get('Nome', ''),
                'tipo':         'Avaliação',
                'servico':      a.get('Serviço', ''),
                'tecnico':      a.get('Técnico Responsável', ''),
                'nivel':        a.get('Nível', ''),
                'status':       a.get('_Status_Aval', ''),
                '_idx':         _aidx,
                'sinal':        a.get('Sinal'),
                'apareceu':     a.get('Apareceu'),
                'cobranca':     a.get('Cobrança'),
                'valor_cobrar': a.get('Valor a Cobrar'),
                'origem':       a.get('Origem', ''),
                'cod_serv':     a.get('_CodServ') or a.get('Código Serviço') or '',
            })

    # Serviços — consultas (CF, CN, CM, CFT, CPE)
    consulta_pref = ('CF', 'CN', 'CM', 'CFT', 'CPE')
    for s in load_with_compute('servicos'):
        cod = s.get('Código', '') or ''
        if not any(cod.startswith(p) for p in consulta_pref):
            continue
        data_serv = s.get('Data Marcação/Início') or s.get('Data Conversão')
        if in_range(data_serv):
            events.append({
                'data':    (compute.parse_date(data_serv) or d_ini).isoformat(),
                'cliente': s.get('Cliente', ''),
                'tipo':    'Consulta',
                'servico': s.get('Serviço', ''),
                'tecnico': s.get('Técnico Responsável', ''),
                'nivel':   s.get('Nível', ''),
                'status':  s.get('Estado do serviço', ''),
            })

    # Conversões AM* — apenas se não houver já entrada em avaliacoes para o mesmo cliente+data
    for c in load('conversoes'):
        cod = str(c.get('Código Serviço', '') or c.get('Serviço', '') or '')
        if not cod.startswith('AM'):
            continue
        data_marc = c.get('Data da Marcação/Início')
        if not in_range(data_marc):
            continue
        dt = (compute.parse_date(data_marc) or d_ini).isoformat()
        cliente = c.get('Cliente', '')
        if (cliente, dt) in avals_vistas:
            continue   # já representado via avaliacoes, não duplicar
        events.append({
            'data':    dt,
            'cliente': cliente,
            'tipo':    'Avaliação',
            'servico': c.get('Serviço', ''),
            'tecnico': c.get('Técnico Responsável', ''),
            'nivel':   c.get('Nível', ''),
            'status':  'Agendado',
        })

    events.sort(key=lambda e: (e['data'], e.get('hora') or ''))
    # Build precario lookup (code → pvp + sinal)
    precario_lookup = {}
    for p in load('precario_publico'):
        cod = p.get('Código')
        if cod and isinstance(cod, str) and cod != 'Código':
            pvp = p.get('PVP Promocional (c/IVA)') or p.get('PVP Base (c/IVA)')
            try:
                pvp_val = float(pvp) if pvp else None
            except Exception:
                pvp_val = None
            try:
                sinal_val = float(p.get('Sinal') or 0) or None
            except Exception:
                sinal_val = None
            precario_lookup[cod] = {'pvp': pvp_val, 'sinal': sinal_val, 'nome': p.get('Serviço', '')}
    return jsonify({
        'events':   events,
        'periodo':  periodo,
        'data_ini': d_ini.isoformat(),
        'data_fim': d_fim.isoformat(),
        'precario': precario_lookup,
    })


@app.route('/api/avaliacoes/lista')
@login_required
def get_avaliacoes_lista():
    """Retorna todas as avaliações com índice para edição operacional."""
    data = load('avaliacoes')
    result = []
    for i, a in enumerate(data):
        result.append({**a, '_idx': i})
    return jsonify(result)


@app.route('/api/vendas/resumo')
@login_required
def get_vendas_resumo():
    trimestre  = request.args.get('trimestre', None)
    conversoes = load('conversoes')
    servicos   = load_with_compute('servicos')
    falhas_log = load_with_compute('falhas_sancoes')
    niveis     = load('niveis_sancao')
    colab      = load('dados_colaboradores')
    totais     = load('totais_pagamentos')

    resumo = compute.calcular_bonus_trimestral(
        conversoes, servicos, falhas_log, niveis, colab, totais, trimestre
    )

    # Trimestres disponíveis — de avaliações vendidas + PT mensalidades vendidas + falhas
    _AVAL_PREF = ('AM', 'AMP', 'AMR', 'PE', 'PV', 'PP', 'PEP', 'INS', 'CF', 'CN', 'CM', 'CFT')
    tset = set()
    for c in conversoes:
        vd  = (c.get('Venda de') or '').strip()
        cod = (c.get('Código Serviço') or '').strip()
        if vd and any(cod.startswith(p) for p in _AVAL_PREF):
            t = compute._conv_trimestre(c.get('Data da Marcação/Início'))
            if t:
                tset.add(t)
    for s in servicos:
        vd  = (s.get('Venda de') or '').strip()
        cod = (s.get('Código') or '').strip()
        if vd and cod.startswith('PT'):
            t = compute._conv_trimestre(s.get('Data Conversão') or s.get('Data Marcação/Início'))
            if t:
                tset.add(t)
    for f in falhas_log:
        if f.get('Trimestre'):
            tset.add(f['Trimestre'])

    trimestres = sorted(tset, reverse=True)
    hoje = date.today()
    q_atual = f'Q{(hoje.month-1)//3+1} {hoje.year}'
    if q_atual not in trimestres:
        trimestres.insert(0, q_atual)

    return jsonify({'resumo': resumo, 'trimestres': trimestres,
                    'trimestre': trimestre or q_atual})


@app.route('/api/vendas/angariacoes')
@login_required
def get_vendas_angariacoes():
    """PT/DUO services classified by angariação type."""
    servicos = load_with_compute('servicos')
    colab    = load('dados_colaboradores')
    result   = compute.angariacoes_pt(servicos, colab)
    treinador = request.args.get('treinador', None)
    if treinador:
        result = [r for r in result if r['Treinador'] == treinador]
    return jsonify(result)


@app.route('/api/stats')
@login_required
def stats():
    result = {}
    for c in COLLECTIONS:
        if has_permission(c):
            data = load(c)
            result[c] = len(data) if isinstance(data, list) else 0
    return jsonify(result)

if __name__ == '__main__':
    print("\n  HOP Lab CRM 2.0")
    print("  ================")
    print("  Abrir: http://localhost:5000")
    print("  Login: admin / admin\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
