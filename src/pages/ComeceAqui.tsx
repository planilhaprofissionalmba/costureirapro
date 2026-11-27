import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Download } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { APP_NAME, BRAND, YOUTUBE_COMECE_AQUI, linkWhatsAppInteresse } from '../lib/brand'
import { PRIMEIRO_DIA, TELAS_MANUAL } from '../lib/manual'
import { useInstallApp } from '../lib/install'
import { applyInstallResult } from '../lib/installFlow'
import { useToast } from '../lib/toast'
import { primeiroNome } from '../lib/format'

function GuiaCard({ title, badge, children }: { title: string; badge?: boolean; children: ReactNode }) {
  return (
    <article className={`oficial-card${badge ? ' oficial-card--inicio' : ''}`}>
      {badge ? <span className="nav-badge">INÍCIO</span> : null}
      <header className="oficial-card-head">
        <BookOpen size={18} strokeWidth={2} aria-hidden />
        <h2 className="oficial-card-title">{title}</h2>
      </header>
      <div className="oficial-card-body">{children}</div>
    </article>
  )
}

function Q({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="oficial-q">{title}</h3>
      <div className="oficial-q-body">{children}</div>
    </>
  )
}

function Lista({ itens }: { itens: string[] }) {
  return itens.length > 1 ? (
    <ol>
      {itens.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  ) : (
    <p>{itens[0]}</p>
  )
}

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.replace('/', '')}`
    const id = u.searchParams.get('v')
    return id ? `https://www.youtube.com/embed/${id}` : null
  } catch {
    return null
  }
}

export function ComeceAquiPage() {
  const { markFirstAccessDone, user } = useAuth()
  const { install } = useInstallApp()
  const { push } = useToast()
  const embed = YOUTUBE_COMECE_AQUI ? youtubeEmbed(YOUTUBE_COMECE_AQUI) : null

  useEffect(() => {
    markFirstAccessDone()
  }, [markFirstAccessDone])

  async function onInstall() {
    applyInstallResult(await install(), push)
  }

  return (
    <div className="oficial-page">
      <h1 className="oficial-page-title">Comece Aqui</h1>
      <p className="oficial-page-sub">
        Você não precisa saber de tecnologia. Este texto é o manual do {APP_NAME}. Leia com calma e siga os passos na
        ordem. Cada tela explica o que é, como funciona, como criar, como editar, como salvar e onde olhar o resumo.
      </p>

      <GuiaCard title="Bem-vindo" badge>
        <p>
          {user?.fullName ? `Olá, ${primeiroNome(user.fullName)}! ` : 'Olá! '}O {APP_NAME} é o caderno do seu ateliê dentro do
          celular. Nele você anota as <strong>costuras que recebe</strong> (cada peça e o que modificar), a{' '}
          <strong>data de entrega</strong>, as <strong>clientes</strong> com CPF e medidas, a <strong>agenda</strong>, o{' '}
          <strong>estoque</strong> de linha, agulha e óleo, as <strong>compras</strong> e o <strong>caixa</strong> — e avisa as
          clientes pelo <strong>WhatsApp</strong> com a mensagem pronta.
        </p>
        <p>
          <strong>Você não precisa saber de tecnologia. Siga os passos na ordem.</strong> Tudo o que você salva fica guardado
          com segurança e aparece em qualquer aparelho em que você entrar com o seu e-mail e senha.
        </p>
      </GuiaCard>

      <GuiaCard title="Como abrir o menu">
        <p>
          No alto da tela, à esquerda, ficam os <strong>três risquinhos (☰)</strong> e a palavra <strong>MENU</strong>, com o
          aviso <em>Toque no ícone ☰ para navegar</em>. Eles aparecem no celular e no computador.
        </p>
        <ol>
          <li>No celular: toque no ☰. O menu abre do lado. Toque no nome da tela que quer abrir. Para fechar, toque no X ou fora do menu.</li>
          <li>No computador: basta encostar o mouse no ☰ (ou na beirada esquerda da tela) e o menu abre sozinho. Tire o mouse e ele fecha.</li>
        </ol>
        <p>Os nomes do menu são:</p>
        <ul>
          <li>Comece Aqui (este manual) · Painel (resumo)</li>
          <li>Agenda · Costuras · Clientes · Mensagens WhatsApp · Tabela de preços</li>
          <li>Estoque · Compras</li>
          <li>Caixa · Pendências</li>
          <li>Alterar Senha (abre Configurações na caixa de senha) · Configurações</li>
          <li>Termos de Uso · Privacidade / LGPD</li>
          <li>Instalar App · Sair (botão dourado no fim)</li>
        </ul>
      </GuiaCard>

      <GuiaCard title="Ordem do primeiro dia">
        <ol>
          {PRIMEIRO_DIA.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p>
          Pronto! A partir daí, o seu dia a dia é: <strong>receber costura → marcar como pronta → avisar → registrar o
          pagamento</strong>. O resumo de tudo fica no <Link to="/app/dashboard">Painel</Link>.
        </p>
      </GuiaCard>

      {embed ? (
        <GuiaCard title="Vídeo de orientação">
          <div className="landing-video-frame">
            <iframe src={embed} title={`Vídeo ${APP_NAME}`} allowFullScreen />
          </div>
          <p>O vídeo ajuda, mas o passo a passo escrito continua valendo.</p>
        </GuiaCard>
      ) : null}

      {TELAS_MANUAL.map((t) => (
        <GuiaCard key={t.titulo} title={t.titulo}>
          <Q title="O que é">
            <p>{t.oQueE}</p>
          </Q>
          <Q title="Para que serve">
            <p>{t.paraQueServe}</p>
          </Q>
          <Q title="Como abre">
            <p>
              {t.comoAbre}{' '}
              {t.rota ? (
                <Link to={t.rota}>Abrir agora</Link>
              ) : null}
            </p>
          </Q>
          <Q title="Como funciona">
            <Lista itens={t.comoFunciona} />
          </Q>
          <Q title="Como cria">
            <Lista itens={t.comoCria} />
          </Q>
          <Q title="Como edita">
            <Lista itens={t.comoEdita} />
          </Q>
          <Q title="Como salva">
            <p>{t.comoSalva}</p>
          </Q>
          <Q title="Onde olha o resumo">
            <p>{t.ondeResumo}</p>
          </Q>
        </GuiaCard>
      ))}

      <GuiaCard title="Instalar o app no celular ou no computador">
        <p>Assim o {APP_NAME} abre como aplicativo, sem digitar o endereço toda vez.</p>
        <ol>
          <li>Toque no botão abaixo: a instalação abre na hora. Confirme em Instalar.</li>
          <li>No iPhone e no iPad, a Apple não permite instalar por botão: no Safari toque em Compartilhar → Adicionar à Tela de Início.</li>
        </ol>
        <button className="btn btn-primary" type="button" onClick={onInstall}>
          <Download size={16} /> Instalar App
        </button>
      </GuiaCard>

      <GuiaCard title="Onde olhar o resumo — lembrete">
        <p>
          O resumo geral é o <Link to="/app/dashboard">Painel</Link>: entregas de hoje, atrasadas, prontas para avisar, clientes
          devendo, dinheiro do mês, estoque acabando e os gráficos. As listas completas ficam em{' '}
          <Link to="/app/costuras">Costuras</Link>, <Link to="/app/clientes">Clientes</Link>, <Link to="/app/caixa">Caixa</Link> e{' '}
          <Link to="/app/pendencias">Pendências</Link>. Depois de salvar uma costura ou cliente, o app volta ao Painel.
        </p>
      </GuiaCard>

      <GuiaCard title="Dúvidas / Suporte">
        <p>
          Site:{' '}
          <a href={BRAND.site} target="_blank" rel="noreferrer">
            planilhaprofissional.com
          </a>
        </p>
        <p>
          E-mail: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        </p>
        <p>
          WhatsApp:{' '}
          <a href={linkWhatsAppInteresse()} target="_blank" rel="noreferrer">
            {BRAND.whatsappDisplay}
          </a>
        </p>
      </GuiaCard>
    </div>
  )
}
