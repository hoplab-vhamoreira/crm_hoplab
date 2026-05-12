"""
Campos calculados equivalentes às fórmulas do Excel.
Chamado pelo servidor a cada leitura — os resultados NÃO são persistidos em disco.
"""
from datetime import date, datetime, timedelta

MESES       = [None,'Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
MESES_FULL  = [None,'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    for fmt in ['%Y-%m-%dT%H:%M:%S','%Y-%m-%d','%d-%m-%Y','%d/%m/%Y','%Y/%m/%d']:
        try:
            return datetime.strptime(s[:10], fmt[:len(s[:10])]).date()
        except Exception:
            pass
    return None

# ─────────────────────────────────────────────
# CLIENTES — Status calculado (replica fórmula Excel exacta)
# ─────────────────────────────────────────────
def _status_cliente(nome, hoje, hibridos_set, hibrido_estado, motor_map, conversoes_por_cliente):
    mes_idx = hoje.month

    # --- ehHibrido ---
    eh_hibrido = nome in hibridos_set
    estado_hib = hibrido_estado.get(nome, '')

    # --- Motor 2026 ---
    motor = motor_map.get(nome, {})
    cliente_motor = nome if motor else ''
    estado_motor = motor.get('Estado Hoje', '') or ''
    mes_col = MESES[mes_idx]
    try:
        valor_mes = float(motor.get(mes_col, 0) or 0)
    except Exception:
        valor_mes = 0

    # --- ultimaAval = max date de conversões com Serviço que começa por "AM" ---
    ultima_aval = None
    for c in conversoes_por_cliente.get(nome, []):
        servico = str(c.get('Serviço', '') or '')
        if servico.startswith('AM'):
            d = parse_date(c.get('Data da Marcação/Início'))
            if d and (ultima_aval is None or d > ultima_aval):
                ultima_aval = d

    tem_aval   = ultima_aval is not None
    aval_valida = tem_aval and (hoje - ultima_aval).days <= 92

    is_cancelado  = estado_motor == 'Cancelado'
    is_suspenso   = estado_motor == 'Suspenso'
    em_prazo      = hoje.day < 8
    tem_mensalidade = (valor_mes > 0) or (em_prazo and cliente_motor and estado_motor == 'Ativo')

    # --- statusHib ---
    if eh_hibrido:
        if estado_hib == 'Activo':
            if not tem_aval:
                return 'Híbrido ativo · ⚠️ Sem Avaliação'
            return 'Híbrido ativo' if aval_valida else 'Híbrido ativo · ⚠️ Aval. Fora de Prazo'
        return 'Híbrido suspenso'

    # --- statusNorm ---
    if is_cancelado:
        return 'Cancelado'
    if is_suspenso:
        return 'Suspenso'
    if tem_mensalidade:
        if not tem_aval:
            return 'Ativo · ⚠️ Sem Avaliação'
        return 'Ativo' if aval_valida else 'Ativo · ⚠️ Aval. Fora de Prazo'
    if aval_valida:
        return 'Ativo (Avaliação)'
    return 'Avaliação expirada' if tem_aval else 'Sem Serviço'


def enrich_clientes(clientes, conversoes, log_comercial, motor2026, servicos=None):
    hoje = date.today()

    # Clientes com PT/DUO ativo — dias s/ contacto em pausa
    _PT_PREFIXES = ('PT', 'DUO')
    clientes_pt = set()
    for s in (servicos or []):
        cod = (s.get('Código') or '').strip()
        if any(cod.startswith(p) for p in _PT_PREFIXES):
            nome = s.get('Cliente', '')
            if nome:
                clientes_pt.add(nome)

    # Índices pré-calculados
    # Híbridos: lidos dos campos do próprio cliente (Regime='Híbrido', Estado Híbrido)
    hibridos_set   = {c.get('Nome') for c in clientes if c.get('Regime') == 'Híbrido' and c.get('Nome')}
    hibrido_estado = {c.get('Nome'): c.get('Estado Híbrido', '') for c in clientes if c.get('Regime') == 'Híbrido' and c.get('Nome')}
    motor_map      = {m.get('Cliente'): m for m in motor2026 if m.get('Cliente')}

    conv_por_cliente = {}
    for c in conversoes:
        nome = c.get('Cliente')
        if nome:
            conv_por_cliente.setdefault(nome, []).append(c)

    log_por_contacto = {}
    for l in log_comercial:
        nome = l.get('Contacto')
        if nome:
            log_por_contacto.setdefault(nome, []).append(l)

    for cliente in clientes:
        nome = cliente.get('Nome')
        if not nome:
            continue

        # Status calculado (replica fórmula exacta)
        cliente['Status'] = _status_cliente(
            nome, hoje, hibridos_set, hibrido_estado, motor_map, conv_por_cliente
        )

        # Último Contacto = max(datas conversões, datas log comercial)
        datas_conv = [parse_date(c.get('Data da Marcação/Início')) for c in conv_por_cliente.get(nome, [])]
        datas_log  = [parse_date(l.get('Data Ação')) for l in log_por_contacto.get(nome, [])]
        todas = [d for d in datas_conv + datas_log if d]
        if todas:
            ultimo = max(todas)
            cliente['Último Contacto'] = ultimo.isoformat()
            # Clientes PT/DUO: contador em pausa (acompanhamento regular garantido pelo serviço)
            if nome in clientes_pt:
                cliente['Dias s/ Contacto'] = None
                cliente['_ContactoPausa'] = True
            else:
                cliente['Dias s/ Contacto'] = (hoje - ultimo).days
                cliente['_ContactoPausa'] = False
        else:
            cliente['Último Contacto'] = None
            cliente['Dias s/ Contacto'] = None
            cliente['_ContactoPausa'] = nome in clientes_pt

        # Data Criação = data mais antiga nas conversões
        datas_inicio = [d for d in datas_conv if d]
        if datas_inicio and not cliente.get('Data Criação'):
            cliente['Data Criação'] = min(datas_inicio).isoformat()

    return clientes


# ─────────────────────────────────────────────
# PIPELINE — Status e Aberta/Fechada
# ─────────────────────────────────────────────
def enrich_pipeline(pipeline, log_comercial, conversoes=None):
    # Último resultado por Nº ON — ordenado por Data Ação (mais recente ganha)
    log_por_on = {}
    for l in log_comercial:
        n = l.get('Nº ON')
        if n is None:
            continue
        d = parse_date(l.get('Data Ação'))
        existing = log_por_on.get(n)
        if existing is None or (d and (existing[0] is None or d >= existing[0])):
            log_por_on[n] = (d, l.get('Resultado') or 'Em Análise')

    log_status = {n: v[1] for n, v in log_por_on.items()}

    # Contactos que têm conversão registada → forçar Convertido
    contactos_convertidos = set()
    if conversoes:
        for c in conversoes:
            nome = c.get('Cliente') or c.get('Nome') or ''
            if nome:
                contactos_convertidos.add(nome)

    FECHADOS = {'Perdido', 'Não Avançou', 'Convertido'}

    for p in pipeline:
        n = p.get('Nº ON')
        contacto = p.get('Contacto', '')
        status = log_status.get(n, 'Em Análise') or 'Em Análise'
        # Se o contacto já tem conversão mas o log ainda não reflecte, forçar Convertido
        if contacto and contacto in contactos_convertidos and status not in FECHADOS:
            status = 'Convertido'
        p['Status'] = status
        p['Aberta/Fechada'] = 'Fechada' if status in FECHADOS else 'Aberta'

    return pipeline


# ─────────────────────────────────────────────
# CONVERSÕES — PVP s/IVA e Valor Receber HOP
# ─────────────────────────────────────────────
def enrich_conversoes(conversoes):
    for c in conversoes:
        try:
            valor = float(c.get('Valor total a Cobrar Serviço') or 0)
            if valor:
                c['PVP s/IVA']          = round(valor / 1.23, 2)
                sinal = float(c.get('Sinal') or 0)
                c['Valor Receber (HOP)'] = round(valor + sinal, 2)
        except Exception:
            pass
    return conversoes


# ─────────────────────────────────────────────
# AVALIAÇÕES — Status e Dias
# ─────────────────────────────────────────────
def enrich_avaliacoes(avaliacoes):
    hoje = date.today()
    for a in avaliacoes:
        d = parse_date(a.get('Data'))
        if d:
            diff = (d - hoje).days          # negativo = passado
            dias_desde = -diff              # quantos dias passou
            a['Dias para Avaliação'] = diff
            if diff > 3:
                a['_Status_Aval'] = '🔵 Agendada'
            elif diff > 0:
                a['_Status_Aval'] = '🟡 Em breve'
            elif diff == 0:
                a['_Status_Aval'] = '📅 Hoje'
            elif diff >= -7:
                a['_Status_Aval'] = '⚠️ Em falta'
            elif dias_desde <= 92:
                a['_Status_Aval'] = '✅ Válida'
            else:
                a['_Status_Aval'] = '🔴 Expirada'
            a['_AvalDiasDesde'] = dias_desde if diff < 0 else None
    return avaliacoes


# ─────────────────────────────────────────────
# LOG COMERCIAL — Dias Atrás + Urgência
# ─────────────────────────────────────────────
def enrich_log_comercial(log):
    hoje = date.today()
    for l in log:
        d = parse_date(l.get('Data Ação'))
        if d:
            dias = (hoje - d).days
            l['Dias Atrás'] = dias
        else:
            dias = None

        resultado = l.get('Resultado') or ''
        if resultado in ('Ganho', 'Perdido', 'Não Avançou', 'Convertido'):
            l['_Urgencia'] = 4   # Fechado — sem ação necessária
        elif dias is None:
            l['_Urgencia'] = 2
        elif dias > 7:
            l['_Urgencia'] = 1   # Follow-up em atraso
        elif dias > 3:
            l['_Urgencia'] = 2   # Follow-up próximo
        else:
            l['_Urgencia'] = 3   # Contacto recente
    return log


# ─────────────────────────────────────────────
# SERVIÇOS — Estado calculado a partir do Log Operacional
# ─────────────────────────────────────────────
def _servico_meta(codigo):
    """Deriva Nível, Repetição, Ciclo e Coberto N3? a partir do Código do serviço."""
    c = (codigo or '').strip()
    import re
    # HOP Studio — PT<n>-<30|60> (ex: PT1-30, PT2-60)
    if re.match(r'^PT\d+-\d+$', c):
        return {'Nível': 'HOP Studio', 'Repetição': 'Mensal',
                'Ciclo': 'Mensal', 'Coberto N3?': 'Não'}
    # Sessões avulsas/packs Studio
    if re.match(r'^PT[AP]', c):
        return {'Nível': 'Add-on', 'Repetição': 'Pontual',
                'Ciclo': None, 'Coberto N3?': 'Não'}
    # Gestão Light
    if c == 'GL4':
        return {'Nível': 'Add-on', 'Repetição': 'Ciclo 4 semanas',
                'Ciclo': '4 semanas', 'Coberto N3?': 'Não'}
    if c == 'GL12':
        return {'Nível': 'Add-on', 'Repetição': 'Ciclo 4 semanas',
                'Ciclo': '12 semanas', 'Coberto N3?': 'Não'}
    # Gestão Integral N3
    if c == 'GI':
        return {'Nível': 'N3 - Validar', 'Repetição': 'Mensal',
                'Ciclo': 'Mensal', 'Coberto N3?': 'Sim'}
    # N1 — Avaliações e Packs
    if re.match(r'^(AM|AMP|AMR|PE|PV|PP|PEP|INS)', c):
        return {'Nível': 'N1 - Avaliar', 'Repetição': 'Pontual',
                'Ciclo': None, 'Coberto N3?': 'Não'}
    # N2 — Consultas
    if re.match(r'^(CF|CN|CM$|CFT)', c):
        return {'Nível': 'N2 - Direcionar', 'Repetição': 'Pontual',
                'Ciclo': None, 'Coberto N3?': 'Não'}
    # Cedências e outros Add-ons
    if re.match(r'^(CED|CPE|PTA)', c):
        return {'Nível': 'Add-on', 'Repetição': 'Pontual',
                'Ciclo': None, 'Coberto N3?': 'Não'}
    return {}


def enrich_servicos(servicos, log_operacional, precario=None):
    hoje = date.today()

    # Índice do preçário por Serviço e por Código
    prec_by_serv = {}
    prec_by_cod  = {}
    for p in (precario or []):
        if p.get('Serviço') and p.get('Serviço') not in ('Serviço',):
            prec_by_serv[p['Serviço']] = p
        if p.get('Código') and p.get('Código') not in ('Código',):
            prec_by_cod[p['Código']] = p

    # Indexar log por Código de serviço
    log_by_code = {}
    for l in log_operacional:
        cod = l.get('Código') or ''
        if cod:
            log_by_code.setdefault(cod, []).append(l)

    for s in servicos:
        cod = s.get('Código') or ''
        logs = log_by_code.get(cod, [])

        # ── Campos automáticos derivados do código ──────────────────────
        meta = _servico_meta(cod)
        for campo, valor in meta.items():
            if not s.get(campo) and valor is not None:
                s[campo] = valor

        # Valor total a Cobrar — do preçário, se não preenchido
        if not s.get('Valor total a Cobrar'):
            prec = prec_by_cod.get(cod) or prec_by_serv.get(s.get('Serviço', ''))
            if prec:
                pvp = prec.get('PVP Base (c/IVA)')
                if pvp and str(pvp) not in ('nan', 'None', ''):
                    try:
                        s['Valor total a Cobrar'] = float(pvp)
                    except (ValueError, TypeError):
                        pass

        # Cobrança — texto calculado (valor - sinal)
        if not s.get('Cobrança'):
            total = s.get('Valor total a Cobrar')
            sinal = s.get('Sinal')
            if total and sinal:
                try:
                    dif = float(total) - float(sinal)
                    s['Cobrança'] = f'Diferença no dia: €{dif:.0f} (sinal de €{float(sinal):.0f} já pago)'
                except (ValueError, TypeError):
                    pass

        # _UltimaExecucao: data mais recente com ação
        datas = [parse_date(l.get('Data Entrada')) for l in logs]
        datas = [d for d in datas if d]
        if datas:
            ultima = max(datas)
            s['_UltimaExecucao']  = ultima.isoformat()
            s['_DiasUltimaExec']  = (hoje - ultima).days

        # Estado do serviço dinâmico
        if not logs:
            # Preservar estado importado do Excel se existir
            if not s.get('Estado do serviço'):
                s['Estado do serviço'] = 'Pendente'
        elif any((l.get('Status') or '').strip() == 'Concluído' for l in logs):
            s['Estado do serviço'] = 'Concluído'
        elif any((l.get('Acção') or '').strip() == 'Cancelado' for l in logs
                 if parse_date(l.get('Data Entrada')) == (max(datas) if datas else None)):
            s['Estado do serviço'] = 'Cancelado'
        else:
            s['Estado do serviço'] = 'Em curso'

    return servicos


# ─────────────────────────────────────────────
# CICLOS — Semanas, datas e estados calculados
# ─────────────────────────────────────────────
def enrich_ciclos(ciclos, servicos=None):
    hoje = date.today()

    # CF60 = Consultas de Fisiologia (60') concluídas, por cliente
    cf60_por_cliente: dict = {}
    for s in (servicos or []):
        if not str(s.get('Código') or '').startswith('CF60'):
            continue
        nome = s.get('Cliente', '')
        if not nome:
            continue
        concluido = (
            s.get('Realizou?') == 'Sim' or
            str(s.get('Estado do serviço') or '') == 'Concluído'
        )
        if concluido:
            cf60_por_cliente[nome] = cf60_por_cliente.get(nome, 0) + 1

    for c in ciclos:
        # CF60 calculado automaticamente
        c['CF60'] = cf60_por_cliente.get(c.get('Cliente', ''), 0)
        tipo_raw = str(c.get('Tipo') or '').upper()
        # GL12 → 12 semanas (84 dias), GL4 → 4 semanas (28 dias)
        if 'GL12' in tipo_raw or 'GL 12' in tipo_raw:
            n_semanas = 12
        else:
            n_semanas = 4

        d_inicio = parse_date(c.get('Data Início'))
        if not d_inicio:
            continue

        # Data Fim
        d_fim = d_inicio + timedelta(days=n_semanas * 7 - 1)
        c['Data Fim'] = d_fim.isoformat()

        # Semana actual (1-based, 0 = não iniciado)
        dias_passados = (hoje - d_inicio).days
        if dias_passados < 0:
            semana_atual = 0
        else:
            semana_atual = min(dias_passados // 7 + 1, n_semanas)
        c['Semana Actual'] = semana_atual

        # Estado por semana
        todas_feitas = True
        alguma_feita = False
        for n in range(1, n_semanas + 1):
            feito_em   = parse_date(c.get(f'Sem {n} — Feito em'))
            sem_inicio = d_inicio + timedelta(days=(n - 1) * 7)
            sem_fim    = d_inicio + timedelta(days=n * 7 - 1)

            # Data prevista = início da semana (data de referência para a ação)
            c[f'Sem {n} — Data Prevista'] = sem_inicio.isoformat()

            if feito_em:
                c[f'Sem {n} — Status']     = '✅ Feito'
                c[f'Sem {n} — Dias Atraso'] = None
                alguma_feita = True
            elif hoje < sem_inicio:
                c[f'Sem {n} — Status']     = '📅 Futuro'
                c[f'Sem {n} — Dias Atraso'] = None
                todas_feitas = False
            elif sem_inicio <= hoje <= sem_fim:
                c[f'Sem {n} — Status']     = '🔵 Esta semana'
                c[f'Sem {n} — Dias Atraso'] = None
                todas_feitas = False
            else:
                dias_atraso = (hoje - sem_fim).days
                c[f'Sem {n} — Status']     = '⚠️ ATRASADO'
                c[f'Sem {n} — Dias Atraso'] = dias_atraso
                todas_feitas = False

        # Estado geral do ciclo
        if hoje < d_inicio:
            c['Status'] = 'Não iniciado'
        elif todas_feitas or hoje > d_fim:
            c['Status'] = 'Concluído'
        elif alguma_feita:
            c['Status'] = 'Em curso'
        else:
            c['Status'] = 'Por iniciar'

    return ciclos


# ─────────────────────────────────────────────
# PARCEIROS — Contagem de clientes por parceiro
# ─────────────────────────────────────────────
def enrich_parceiros(parceiros, clientes):
    # Contar clientes cujo campo Parceiro ou Origem corresponde ao parceiro
    parceiro_counts = {}
    for c in clientes:
        for campo in ('Parceiro', 'Origem'):
            val = c.get(campo) or ''
            if val:
                parceiro_counts[val] = parceiro_counts.get(val, 0) + 1

    for p in parceiros:
        nome = p.get('Nome / Empresa') or ''
        p['_nClientes'] = parceiro_counts.get(nome, 0)

    return parceiros


# ─────────────────────────────────────────────
# TOTAIS PAGAMENTOS — Saldo NET mensal por professor
# ─────────────────────────────────────────────
def enrich_totais_pagamentos(totais, pag_treinadores, dados_colaboradores):
    """
    Para cada linha de totais_pagamentos:
      Pagamento  = SUMIFS(pag_treinadores.J_<Mês>, Professor == prof)
      Cedência   = PRESERVADA do JSON (já inclui híbridos e casos especiais,
                   ex. João Sá Gomes = 0, Miguel Gomes = base + híbridos)
      Saldo NET  = Pagamento - Cedência
    """
    for t in totais:
        prof = t.get('Professor') or ''
        if not prof:
            continue

        for idx in range(1, 13):
            mes_short = MESES[idx]           # 'Jan','Fev',...
            mes_full  = MESES_FULL[idx]      # 'Janeiro','Fevereiro',...

            # Pagamento = serviços prestados no mês ANTERIOR
            # (ex.: linha "Maio" mostra os serviços feitos em Abril)
            prev_idx      = idx - 1 if idx > 1 else 12   # Jan→Dez do ano anterior
            mes_full_prev = MESES_FULL[prev_idx]

            try:
                pag = sum(
                    float(p.get(f'J_{mes_full_prev}') or 0)
                    for p in pag_treinadores
                    if (p.get('Professor') or '') == prof
                )
            except Exception:
                pag = 0

            # Cedência = aluguer do mês corrente (preservada do JSON;
            # NÃO usar dados_colaboradores.Ced_* pois não inclui híbridos)
            ced = float(t.get(f'{mes_short} Cedência') or 0)

            saldo = round(pag - ced, 2)

            if pag:
                t[f'{mes_short} Pagamento'] = round(pag, 2)
            # Cedência mantida; recalcular apenas o Saldo NET
            t[f'{mes_short} Saldo NET'] = saldo

        # Bónus Q1 — só calcula se não preenchido manualmente
        if not t.get('Bónus Q1'):
            q1 = sum(t.get(f'{m} Pagamento', 0) or 0 for m in ('Jan', 'Fev', 'Mar'))
            # Critério Excel: vendas ≥ 750€ AND zero falhas → bónus 5% / 0.65
            t['_Q1_Vendas'] = round(q1, 2)
            t['_Q1_Bonus_Elegivel'] = q1 >= 750  # verificar falhas fica para frontend

    return totais


# ─────────────────────────────────────────────
# PAGAMENTOS — Estado de pagamento por linha
# ─────────────────────────────────────────────
def enrich_pagamentos(pagamentos):
    for p in pagamentos:
        try:
            a_pagar = float(p.get('Valor a Pagar') or 0)
            pago    = float(p.get('Valor Pago') or 0)
            if a_pagar == 0:
                p['_Estado_Pag'] = '—'
            elif pago >= a_pagar:
                p['_Estado_Pag'] = '✅ Pago'
            elif pago > 0:
                p['_Estado_Pag'] = '⚠️ Parcial'
            else:
                p['_Estado_Pag'] = '🔴 Pendente'
        except Exception:
            pass
    return pagamentos


# ─────────────────────────────────────────────
# LOG CONTRATOS — Estado calculado por evento mais recente
# ─────────────────────────────────────────────
def enrich_log_contratos(log):
    hoje = date.today()
    for l in log:
        d = parse_date(l.get('Data_Inicio'))
        if d:
            l['_DiasAtras'] = (hoje - d).days
    return log


def enrich_motor2026(motor, log_contratos):
    """
    Recalcula Estado Hoje de cada cliente com base no log_contratos.
    Regra: para cada cliente, o evento com Data_Inicio <= hoje e
    (Data_Fim >= hoje ou Data_Fim ausente) mais recente determina o estado.
    Se não há evento activo → Ativo.
    """
    hoje = date.today()

    # Agrupar eventos por cliente
    eventos_por_cliente = {}
    for ev in log_contratos:
        nome = ev.get('Cliente')
        if not nome:
            continue
        d_ini = parse_date(ev.get('Data_Inicio'))
        if not d_ini or d_ini > hoje:
            continue
        d_fim = parse_date(ev.get('Data_Fim'))
        # evento activo se d_fim ausente ou d_fim >= hoje
        if d_fim and d_fim < hoje:
            continue
        eventos_por_cliente.setdefault(nome, []).append((d_ini, ev))

    for m in motor:
        nome = m.get('Cliente')
        if not nome:
            continue
        eventos = eventos_por_cliente.get(nome, [])
        if not eventos:
            # sem evento activo → mantém estado actual ou Ativo
            if not m.get('Estado Hoje'):
                m['Estado Hoje'] = 'Ativo'
            continue
        # evento mais recente (maior Data_Inicio)
        _, ev_mais_recente = max(eventos, key=lambda x: x[0])
        estado_ev = ev_mais_recente.get('Estado') or ''
        if estado_ev in ('Suspenso', 'Cancelado'):
            m['Estado Hoje'] = estado_ev
        elif estado_ev in ('Férias',):
            m['Estado Hoje'] = 'Férias'
        # Desconto, Troca Mensalidade, etc. não alteram o estado geral
        # (mantém Ativo ou o que estava antes)

    return motor


# ─────────────────────────────────────────────
# FALHAS E SANÇÕES
# ─────────────────────────────────────────────
def enrich_falhas_sancoes(log, catalogo, niveis, colaboradores=None):
    """
    Auto-preenche Categoria, Pontos, Fim do Mês, Início Trimestre a partir de:
    - catalogo_faltas  (lookup por Falta)
    - niveis_sancao    (lookup por pontos totais)
    """
    # Índice catálogo por Falta
    cat_idx = {c['Falta']: c for c in catalogo}

    for entry in log:
        # Campos auto a partir da data
        d = parse_date(entry.get('Data'))
        if d:
            import calendar as _cal
            last_day = _cal.monthrange(d.year, d.month)[1]
            entry['Fim do Mês']       = date(d.year, d.month, last_day).isoformat()
            # Início do trimestre (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct)
            tri_month = ((d.month - 1) // 3) * 3 + 1
            entry['Início Trimestre'] = date(d.year, tri_month, 1).isoformat()
            entry['Trimestre']        = f'Q{(d.month-1)//3+1} {d.year}'

        # Auto-fill from catalog
        falta_nome = entry.get('Falta', '')
        cat = cat_idx.get(falta_nome, {})
        if cat:
            entry['Categoria'] = cat.get('Categoria', '')
            entry['Pontos']    = cat.get('Pontos', 0)
            if not entry.get('Âmbito'):
                entry['Âmbito'] = cat.get('Âmbito', '')

    return log


def calcular_resumo_trimestral(log, niveis, colaboradores, trimestre=None):
    """
    Calcula o resumo trimestral por colaborador.
    trimestre: ex. 'Q2 2026'. Se None, usa o trimestre actual.
    """
    hoje = date.today()
    if not trimestre:
        t_num = (hoje.month - 1) // 3 + 1
        trimestre = f'Q{t_num} {hoje.year}'

    # Filtrar log pelo trimestre
    pontos_por_prof = {}
    faltas_por_prof = {}
    for entry in log:
        if entry.get('Trimestre') == trimestre:
            prof = entry.get('Professor', '')
            if not prof:
                continue
            pts = entry.get('Pontos', 0) or 0
            pontos_por_prof[prof] = pontos_por_prof.get(prof, 0) + pts
            faltas_por_prof.setdefault(prof, []).append(entry)

    # Lookup nível a partir de pontos
    def pts_to_nivel(pts):
        for n in sorted(niveis, key=lambda x: x.get('Nível', 0), reverse=True):
            if pts >= n.get('Pontos Mín', 0) and (n.get('Pontos Máx', 999) == 0 or pts <= n.get('Pontos Máx', 999)):
                return n
        return {'Nível': 0, 'Designação': 'Sem Sanção', 'Medida': '—'}

    # Lista de colaboradores relevantes (Treinador + Coordenador)
    profs_activos = []
    if colaboradores:
        for c in colaboradores:
            cargo = c.get('Cargo', '')
            if cargo in ('Treinador', 'Coordenador') and c.get('Estado', '') in ('Activo', 'Ativo', ''):
                profs_activos.append(c.get('Nome Oficial', ''))
    # Incluir também quem tenha entradas no log mas não esteja na lista
    for p in pontos_por_prof:
        if p not in profs_activos:
            profs_activos.append(p)

    resumo = []
    for prof in profs_activos:
        if not prof:
            continue
        pts = pontos_por_prof.get(prof, 0)
        nivel_info = pts_to_nivel(pts)
        resumo.append({
            'Professor':   prof,
            'Pontos':      pts,
            'Nível':       nivel_info.get('Nível', 0),
            'Designação':  nivel_info.get('Designação', 'Sem Sanção'),
            'Medida':      nivel_info.get('Medida', '—'),
            'Clean':       'Sim' if pts == 0 else 'Não',
            'Faltas':      faltas_por_prof.get(prof, []),
        })

    resumo.sort(key=lambda r: -r['Pontos'])
    return resumo


# ─────────────────────────────────────────────
# VENDAS E BÓNUS
# ─────────────────────────────────────────────
_Q_MESES = {
    1:('Jan','Fev','Mar'), 2:('Abr','Mai','Jun'),
    3:('Jul','Ago','Set'), 4:('Out','Nov','Dez'),
}

# Prefixos de avaliação que contam para o bónus (excluindo PT)
_AVAL_PREFIXES = ('AM', 'AMP', 'AMR', 'PE', 'PV', 'PP', 'PEP', 'INS', 'CF', 'CN', 'CM', 'CFT')

def _trimestre_q_year(trimestre):
    """'Q2 2026' → (2, 2026)"""
    try:
        parts = trimestre.split()
        q = int(parts[0][1])
        yr = int(parts[1])
        return q, yr
    except Exception:
        return None, None

def _conv_trimestre(val):
    """Data → 'Q1 2026' string"""
    d = parse_date(val)
    if not d or d.year < 2020:
        return None
    return f'Q{(d.month-1)//3+1} {d.year}'


def calcular_bonus_trimestral(conversoes, servicos, falhas_log, niveis_sancao,
                               dados_colaboradores, totais_pagamentos,
                               trimestre=None):
    """
    Calcula resumo de Vendas e Bónus por colaborador no trimestre dado.

    TREINADOR (Cond=0.65):
      Vendas = avaliações (AM*/AMP*/AMR*/PV*/etc.) com 'Venda de' preenchido em conversoes
      Elegível se: Clean E Vendas ≥ 750€/trimestre
      Bónus = Train65 × (5%/65%)

    COORDENADOR (Cond=0.70):
      Vendas = PT* mensalidades com 'Venda de' = Coordenador em servicos (Data Conversão no trim.)
      Elegível se: Clean E Vendas > 1€
      Bónus = Train70 × (5%/70%)
    """
    hoje = date.today()
    if not trimestre:
        q = (hoje.month - 1) // 3 + 1
        trimestre = f'Q{q} {hoje.year}'

    q_num, q_year = _trimestre_q_year(trimestre)

    # ── índice colaboradores ────────────────────────────────────────────
    colab_map = {}
    for c in dados_colaboradores:
        nome = c.get('Nome Oficial', '')
        if nome:
            colab_map[nome] = c

    # ── Train: soma de pagamentos mensais do trimestre (de totais_pagamentos) ──
    meses_short = _Q_MESES.get(q_num, ())
    train_por_prof = {}
    for t in totais_pagamentos:
        prof = t.get('Professor', '')
        if not prof:
            continue
        total = 0.0
        for ms in meses_short:
            try:
                total += float(t.get(f'{ms} Pagamento') or 0)
            except Exception:
                pass
        if total > 0:
            train_por_prof[prof] = round(total, 2)

    # ── Vendas TREINADOR: avaliações em conversoes com Venda de preenchido ──
    aval_vendas_por_prof = {}   # prof → list
    for c in conversoes:
        vd  = (c.get('Venda de') or '').strip()
        if not vd:
            continue
        cod = (c.get('Código Serviço') or c.get('Serviço') or '').strip()
        if not any(cod.startswith(p) for p in _AVAL_PREFIXES):
            continue
        if _conv_trimestre(c.get('Data da Marcação/Início')) != trimestre:
            continue
        try:
            valor_total = float(c.get('Valor total a Cobrar Serviço') or 0)
            valor_siva  = round(valor_total / 1.23, 2) if valor_total else 0.0
        except Exception:
            valor_siva = 0.0
        aval_vendas_por_prof.setdefault(vd, []).append({
            'tipo':        'Avaliação',
            'cliente':     c.get('Cliente', ''),
            'servico':     c.get('Serviço', ''),
            'codigo':      cod,
            'data':        c.get('Data da Marcação/Início', ''),
            'valor_total': valor_total,
            'valor_siva':  valor_siva,
        })

    # ── Vendas COORDENADOR: PT* mensalidades em servicos com Venda de preenchido ──
    pt_vendas_por_prof = {}   # prof → list
    for s in (servicos or []):
        vd  = (s.get('Venda de') or '').strip()
        if not vd:
            continue
        cod = (s.get('Código') or '').strip()
        if not cod.startswith('PT'):
            continue
        # Usar Data Conversão para determinar trimestre
        if _conv_trimestre(s.get('Data Conversão') or s.get('Data Marcação/Início')) != trimestre:
            continue
        try:
            valor_total = float(s.get('Valor total a Cobrar') or 0)
            valor_siva  = round(valor_total / 1.23, 2) if valor_total else 0.0
        except Exception:
            valor_siva = 0.0
        pt_vendas_por_prof.setdefault(vd, []).append({
            'tipo':        'PT Mensalidade',
            'cliente':     s.get('Cliente', ''),
            'servico':     s.get('Serviço', ''),
            'codigo':      cod,
            'data':        s.get('Data Conversão') or s.get('Data Marcação/Início', ''),
            'valor_total': valor_total,
            'valor_siva':  valor_siva,
        })

    # ── Clean via falhas ──────────────────────────────────────────────
    resumo_falhas = calcular_resumo_trimestral(
        falhas_log, niveis_sancao, dados_colaboradores, trimestre
    )
    clean_por_prof = {r['Professor']: (r['Clean'] == 'Sim') for r in resumo_falhas}

    # ── Lista de Treinadores e Coordenadores ─────────────────────────
    profs = []
    for c in dados_colaboradores:
        cargo = c.get('Cargo', '')
        if cargo in ('Treinador', 'Coordenador'):
            profs.append(c.get('Nome Oficial', ''))

    resultado = []
    for prof in profs:
        if not prof:
            continue
        colab = colab_map.get(prof, {})
        cargo = colab.get('Cargo', '')
        if cargo not in ('Treinador', 'Coordenador'):
            continue

        try:
            cond = float(colab.get('Condições') or colab.get('Condicoes') or 0.65)
        except Exception:
            cond = 0.65 if cargo == 'Treinador' else 0.70

        train  = train_por_prof.get(prof, 0.0)
        clean  = clean_por_prof.get(prof, True)

        if cargo == 'Treinador':
            itens_venda = aval_vendas_por_prof.get(prof, [])
            vendas      = round(sum(v['valor_siva'] for v in itens_venda), 2)
            # Treinador: Clean E Vendas ≥ 750€
            elegivel    = clean and vendas >= 750.0
            tipo_venda  = 'Avaliações Lab'
            min_vendas  = 750.0
        else:  # Coordenador
            itens_venda = pt_vendas_por_prof.get(prof, [])
            vendas      = round(sum(v['valor_siva'] for v in itens_venda), 2)
            # Coordenador: Clean E vendas > 1 (superior a 1)
            elegivel    = clean and vendas > 1.0
            tipo_venda  = 'PT Mensalidades'
            min_vendas  = 1.0

        # Bónus = Train × (5% / Condições)
        if elegivel and cond > 0 and train > 0:
            bonus = round(train * (0.05 / cond), 2)
        else:
            bonus = 0.0

        resultado.append({
            'Professor':     prof,
            'Cargo':         cargo,
            'Condições':     cond,
            'Clean':         'Sim' if clean else 'Não',
            'Tipo Venda':    tipo_venda,
            'Vendas':        vendas,
            'Min Vendas':    min_vendas,
            'Train':         train,
            'Elegível':      'Sim' if elegivel else 'Não',
            'Bónus':         bonus,
            'DetalheVendas': itens_venda,
        })

    resultado.sort(key=lambda r: (-r['Bónus'], r['Cargo'], r['Professor']))
    return resultado


def angariacoes_pt(servicos, dados_colaboradores):
    """
    Analisa serviços PT e DUO — identifica angariação própria vs HOP.

    Regras:
    - 'Venda de' = 'Técnico Responsável' → Própria → comissão HOP normal
    - 'Venda de' preenchido mas diferente → Referência → comissão HOP normal
    - 'Venda de' vazio → HOP angariou → +10% comissão HOP no 1.º mês COMPLETO

    Mês completo: Data Marcação/Início no dia 1 → mês 1 é completo.
                  Data noutro dia → mês 1 é parcial → taxa só no mês 2.
    """
    colab_cond = {}
    for c in dados_colaboradores:
        nome = c.get('Nome Oficial', '')
        try:
            cond = float(c.get('Condições') or c.get('Condicoes') or 0)
        except Exception:
            cond = 0.65
        if nome:
            colab_cond[nome] = cond

    resultado = []
    for s in servicos:
        cod = (s.get('Código') or '').strip()
        if not (cod.startswith('PT') or cod.startswith('DUO')):
            continue

        vd   = (s.get('Venda de') or '').strip()
        tec  = (s.get('Técnico Responsável') or '').strip()
        cond = colab_cond.get(tec, 0.65)

        # Angariação tipo
        if vd and (vd == tec):
            tipo = 'Própria'
        elif vd:
            tipo = 'Referência'
        else:
            tipo = 'HOP'

        # Mês de início — determinar se é parcial
        data_inicio = parse_date(s.get('Data Marcação/Início') or s.get('Data Conversão'))
        if data_inicio and data_inicio.day == 1:
            mes_parcial = False
            mes_ang_label = 'Mês 1'
        elif data_inicio:
            mes_parcial = True
            mes_ang_label = 'Mês 2 (1.º mês completo)'
        else:
            mes_parcial = False
            mes_ang_label = 'Mês 1'

        # Comissão HOP no mês da angariação
        hop_normal  = round((1 - cond) * 100, 0)
        hop_ang_m   = round((1 - cond) * 100 + 10, 0) if tipo == 'HOP' else hop_normal

        resultado.append({
            'Código':              cod,
            'Cliente':             s.get('Cliente', ''),
            'Serviço':             s.get('Serviço', ''),
            'Treinador':           tec,
            'Venda de':            vd or '—',
            'Data Início':         data_inicio.isoformat() if data_inicio else None,
            'Mês Parcial?':        'Sim' if mes_parcial else 'Não',
            'Mês Angariação':      mes_ang_label if tipo == 'HOP' else '—',
            'Tipo Angariação':     tipo,
            'HOP % normal':        hop_normal,
            'HOP % mês angariação': hop_ang_m,
        })

    resultado.sort(key=lambda r: (r['Data Início'] or ''), reverse=True)
    return resultado


# ─────────────────────────────────────────────
# DISPATCHER
# ─────────────────────────────────────────────
def enrich(collection, data, all_data):
    if collection == 'clientes':
        return enrich_clientes(
            data,
            all_data.get('conversoes', []),
            all_data.get('log_comercial', []),
            all_data.get('motor2026', []),
            all_data.get('servicos', []),
        )
    if collection == 'motor2026':
        return enrich_motor2026(data, all_data.get('log_contratos', []))
    if collection == 'log_contratos':
        return enrich_log_contratos(data)
    if collection == 'pipeline':
        return enrich_pipeline(data, all_data.get('log_comercial', []), all_data.get('conversoes', []))
    if collection == 'conversoes':
        return enrich_conversoes(data)
    if collection == 'avaliacoes':
        return enrich_avaliacoes(data)
    if collection == 'log_comercial':
        return enrich_log_comercial(data)
    if collection in ('pag_clientes_2026', 'pag_clientes_2025'):
        return enrich_pagamentos(data)
    if collection == 'servicos':
        return enrich_servicos(data, all_data.get('log_operacional', []), all_data.get('precario_publico', []))
    if collection == 'falhas_sancoes':
        return enrich_falhas_sancoes(
            data,
            all_data.get('catalogo_faltas', []),
            all_data.get('niveis_sancao', []),
            all_data.get('dados_colaboradores', []),
        )
    if collection == 'ciclos':
        return enrich_ciclos(data, all_data.get('servicos', []))
    if collection == 'parceiros':
        return enrich_parceiros(data, all_data.get('clientes', []))
    if collection == 'totais_pagamentos':
        return enrich_totais_pagamentos(
            data,
            all_data.get('pagamentos_treinadores', []),
            all_data.get('dados_colaboradores', []),
        )
    return data
