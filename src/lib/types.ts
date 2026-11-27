export type SessionUser = {
  accountId: string
  email: string
  fullName?: string | null
  role?: string | null
  /** Calculado no servidor (factory_admins / ADMIN_EMAILS). A Edge valida de novo em toda ação. */
  isAdmin?: boolean
  termsAcceptedAt?: string | null
  passwordChangedAt?: string | null
  licenseStatus?: string | null
  plan?: string | null
  licenseExpiresAt?: string | null
  licenseCreatedAt?: string | null
  /** Token opaco de sessão (crachá) — nunca JWT. */
  accessToken: string
}

export type StatusOrdem = 'recebida' | 'em_andamento' | 'aguardando_prova' | 'pronta' | 'entregue' | 'cancelada'

export type Cliente = {
  id: string
  account_id: string
  nome_completo: string
  cpf: string | null
  telefone: string | null
  email: string | null
  data_nascimento: string | null
  cep: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  como_conheceu: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
}

export type Medida = {
  id: string
  account_id: string
  cliente_id: string
  data_medida: string
  busto: number | null
  cintura: number | null
  quadril: number | null
  ombro: number | null
  pescoco: number | null
  braco: number | null
  manga: number | null
  comprimento_blusa: number | null
  comprimento_saia: number | null
  comprimento_calca: number | null
  gancho: number | null
  coxa: number | null
  joelho: number | null
  barra: number | null
  observacoes: string | null
}

export type Servico = {
  id: string
  account_id: string
  nome: string
  tipo_servico: string
  tipo_peca: string | null
  preco: number
  prazo_dias: number
  ativo: boolean
}

export type Ordem = {
  id: string
  account_id: string
  numero: number
  cliente_id: string
  data_recebimento: string
  data_prova: string | null
  data_entrega: string
  hora_entrega: string | null
  data_entregue: string | null
  status: StatusOrdem
  urgente: boolean
  desconto: number
  observacoes: string | null
}

export type OrdemResumo = Ordem & {
  cliente_nome: string
  cliente_telefone: string | null
  cliente_bairro: string | null
  cliente_cidade: string | null
  qtd_pecas: number
  total_itens: number
  valor_total: number
  valor_pago: number
  saldo: number
  resumo_pecas: string | null
}

export type OrdemItem = {
  id: string
  account_id: string
  ordem_id: string
  tipo_peca: string
  tipo_servico: string
  descricao: string | null
  cor: string | null
  quantidade: number
  valor_unitario: number
  concluido: boolean
}

export type Produto = {
  id: string
  account_id: string
  nome: string
  categoria: string
  unidade: string
  cor: string | null
  estoque_atual: number
  estoque_minimo: number
  custo_medio: number
  ativo: boolean
  observacoes: string | null
}

export type Movimento = {
  id: string
  account_id: string
  produto_id: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  custo_unitario: number | null
  data_movimento: string
  compra_id: string | null
  ordem_id: string | null
  observacao: string | null
  created_at: string
}

export type Compra = {
  id: string
  account_id: string
  fornecedor: string | null
  data_compra: string
  valor_total: number
  forma_pagamento: string | null
  observacoes: string | null
}

export type Lancamento = {
  id: string
  account_id: string
  tipo: 'entrada' | 'saida'
  status: 'pago' | 'pendente'
  categoria: string
  descricao: string
  valor: number
  data_lancamento: string
  data_vencimento: string | null
  forma_pagamento: string | null
  cliente_id: string | null
  ordem_id: string | null
  compra_id: string | null
  observacoes: string | null
}

export type Compromisso = {
  id: string
  account_id: string
  titulo: string
  tipo: string
  data_compromisso: string
  hora_inicio: string | null
  hora_fim: string | null
  local: string | null
  cliente_id: string | null
  ordem_id: string | null
  observacoes: string | null
  concluido: boolean
}

export type Preferencias = {
  id: string
  account_id: string
  nome_atelie: string | null
  telefone_atelie: string | null
  endereco_atelie: string | null
  chave_pix: string | null
  prazo_padrao_dias: number
  msg_pronta: string | null
  msg_lembrete: string | null
  msg_cobranca: string | null
  msg_prova: string | null
}

export type EnvioWhatsapp = {
  id: string
  account_id: string
  cliente_id: string | null
  ordem_id: string | null
  tipo: string
  mensagem: string
  enviado_em: string
}
