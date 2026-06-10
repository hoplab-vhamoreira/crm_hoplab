# Regras de Compliance — SpeechCraft

## Princípio legal estruturante (NÃO-NEGOCIÁVEL)

A app **não é um dispositivo médico** (MDR UE 2017/745). Mantém-se fora enquanto:

1. O juízo clínico é sempre humano — o TF define, avalia e corrige.
2. A app só executa, regista, lembra, comunica e motiva.
3. A gamificação premia adesão e hábito, **nunca acerto clínico**.
4. Sem reivindicações médicas em UI ou marketing.

## VERDE — pode construir

- Plano de treino: visualizar (não alterar)
- Lembretes / notificações push
- Biblioteca de modelagem (vídeos + textos)
- Registo de adesão (auto-reporte do utente)
- Gravar + enviar vídeo ao TF (captar + transmitir, nunca analisar)
- Gamificação por conclusão e regularidade
- Câmara como espelho / gravação (sem julgamento automático)
- Mensagens com o TF
- Sugestões de atividades (material educativo genérico)
- Histórico descritivo (factual, sem interpretação clínica)

## VERMELHO — nunca construir nesta app

- Detetar se o exercício foi feito corretamente
- Detetar erros de pronúncia ou de movimento
- Pontuar qualidade clínica da fala, voz ou articulação
- Gerar correções ou feedback clínico automático
- Análise por visão computacional com finalidade de avaliação
- Qualquer texto que afirme diagnosticar, tratar ou corrigir
- Substituir a consulta ou o juízo do terapeuta

## Atalhos de feedback do TF

**Regra:** os atalhos são sempre o conjunto fixo do terapeuta — a app nunca filtra,
ordena, destaca ou pré-seleciona com base no conteúdo do vídeo.

- VERDE: conjunto fixo, organizado por categoria neutra, curado pelo TF antecipadamente
- VERMELHO: a app sugerir/pré-selecionar com base no que "viu" no exercício

## RGPD (dados de saúde — categoria especial)

- Consentimento explícito e granular, com versão + timestamp registados
- Consentimento parental para perfis de criança
- Vídeos eliminados após revisão / prazo configurável
- Exportação e direito ao apagamento implementados na app
- Toda a infraestrutura em UE/EEE (Supabase Frankfurt)
- Audit log de todos os acessos sensíveis
