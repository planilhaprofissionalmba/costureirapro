import type { OrdemResumo, Preferencias, StatusOrdem } from './types'
import { formatDateBR, formatHora, moeda, primeiroNome, telefoneWhatsApp } from './format'

/** Listas de escolha (ordem A→Z nas telas). A costureira pode digitar outra opção. */
export const TIPOS_PECA = [
  'Bermuda', 'Blazer', 'Blusa', 'Calça', 'Calça jeans', 'Camisa', 'Camiseta', 'Casaco', 'Cortina',
  'Jaqueta', 'Lençol', 'Macacão', 'Saia', 'Short', 'Toalha', 'Uniforme', 'Vestido', 'Vestido de festa',
  'Vestido de noiva', 'Outra peça',
]

export const TIPOS_SERVICO = [
  'Ajuste', 'Barra', 'Bordado', 'Conserto', 'Confecção (peça nova)', 'Customização', 'Reforma',
  'Troca de zíper', 'Pregar botão', 'Outro serviço',
]

export const CATEGORIAS_PRODUTO = [
  'Agulha', 'Aviamento', 'Botão', 'Elástico', 'Entretela', 'Linha', 'Óleo de máquina', 'Tecido', 'Viés',
  'Zíper', 'Outros',
]

export const UNIDADES = ['un', 'carretel', 'cone', 'caixa', 'pacote', 'metro', 'cm', 'ml', 'litro', 'rolo']

export const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Outro']

export const CATEGORIAS_ENTRADA = ['Costura / serviço', 'Sinal (adiantamento)', 'Venda de produto', 'Outros recebimentos']
export const CATEGORIAS_SAIDA = [
  'Compra de material', 'Manutenção de máquina', 'Aluguel', 'Energia / água', 'Internet / telefone',
  'Transporte', 'Impostos / MEI', 'Embalagens', 'Outras despesas',
]

export const TIPOS_COMPROMISSO = ['Compromisso', 'Prova de roupa', 'Entrega', 'Buscar peça', 'Compra de material', 'Pagamento', 'Recebimento', 'Outro']

export const COMO_CONHECEU = ['Indicação', 'Instagram', 'WhatsApp', 'Facebook', 'Vizinhança', 'Google', 'Outro']

export const STATUS_ORDEM: { value: StatusOrdem; label: string; tom: string }[] = [
  { value: 'recebida', label: 'Recebida', tom: 'neutro' },
  { value: 'em_andamento', label: 'Costurando', tom: 'info' },
  { value: 'aguardando_prova', label: 'Aguardando prova', tom: 'alerta' },
  { value: 'pronta', label: 'Pronta para entregar', tom: 'ok' },
  { value: 'entregue', label: 'Entregue', tom: 'apagado' },
  { value: 'cancelada', label: 'Cancelada', tom: 'apagado' },
]

export function rotuloStatus(status: string): string {
  return STATUS_ORDEM.find((s) => s.value === status)?.label || status
}

export function tomStatus(status: string): string {
  return STATUS_ORDEM.find((s) => s.value === status)?.tom || 'neutro'
}

export function ordemAberta(status: string) {
  return status !== 'entregue' && status !== 'cancelada'
}

export const MENSAGENS_PADRAO = {
  msg_pronta:
    'Olá, {nome}! Aqui é do {atelie}. Sua costura nº {numero} ({pecas}) está PRONTA. Pode vir buscar quando quiser. {saldo_texto}',
  msg_lembrete:
    'Olá, {nome}! Passando para lembrar que a entrega da sua costura nº {numero} está marcada para {data_entrega}. Qualquer dúvida me chame. {atelie}',
  msg_cobranca:
    'Olá, {nome}! Tudo bem? Ficou em aberto o valor de {saldo} da costura nº {numero}. Pode pagar por Pix: {pix}. Obrigada! {atelie}',
  msg_prova:
    'Olá, {nome}! Sua prova de roupa da costura nº {numero} está marcada para {data_prova}. Te espero! {atelie}',
} as const

export type TipoMensagem = 'pronta' | 'lembrete' | 'cobranca' | 'prova' | 'livre'

export const ROTULO_MENSAGEM: Record<TipoMensagem, string> = {
  pronta: 'Peça pronta',
  lembrete: 'Lembrete de entrega',
  cobranca: 'Cobrança',
  prova: 'Lembrete de prova',
  livre: 'Mensagem livre',
}

export function modeloMensagem(tipo: TipoMensagem, prefs: Preferencias | null): string {
  if (tipo === 'livre') return 'Olá, {nome}! '
  const chave = `msg_${tipo}` as keyof typeof MENSAGENS_PADRAO
  return (prefs?.[chave] as string | null) || MENSAGENS_PADRAO[chave]
}

/** Troca {nome}, {numero}, {saldo}… pelos dados da costura. */
export function montarMensagem(modelo: string, o: Partial<OrdemResumo> & { cliente_nome?: string }, prefs: Preferencias | null): string {
  const saldo = Number(o.saldo || 0)
  const mapa: Record<string, string> = {
    nome: primeiroNome(o.cliente_nome),
    numero: String(o.numero ?? ''),
    pecas: o.resumo_pecas || 'suas peças',
    data_entrega: o.data_entrega ? `${formatDateBR(o.data_entrega)}${o.hora_entrega ? ` às ${formatHora(o.hora_entrega)}` : ''}` : '',
    data_prova: o.data_prova ? formatDateBR(o.data_prova) : '',
    valor_total: moeda(o.valor_total),
    saldo: moeda(saldo),
    saldo_texto: saldo > 0 ? `Valor a pagar: ${moeda(saldo)}.` : 'Já está tudo pago. Obrigada!',
    pix: prefs?.chave_pix || '(peça a chave Pix)',
    atelie: prefs?.nome_atelie || 'seu ateliê',
  }
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => (k in mapa ? mapa[k] : `{${k}}`)).replace(/\s+/g, ' ').trim()
}

export function linkWhatsCliente(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = telefoneWhatsApp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
