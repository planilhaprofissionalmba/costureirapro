import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Download,
  HeartHandshake,
  Package,
  Printer,
  Scissors,
  ShieldCheck,
  Users,
  Wallet,
  MessageCircle,
  ShoppingCart,
  UserPlus,
  LayoutDashboard,
  Plus,
  Minus,
} from "lucide-react";
import {
  APP_NAME,
  APP_SLOGAN,
  BRAND,
  PRECO,
  YOUTUBE_LANDING,
  linkCompra,
  linkWhatsAppInteresse,
  linkWhatsAppTeste,
} from "../lib/brand";
import { BrandLockup } from "../components/BrandLockup";
import { FactoryPitch } from "../components/FactoryPitch";
import { Footer } from "../components/Footer";
import { useInstallApp } from "../lib/install";
import { applyInstallResult } from "../lib/installFlow";
import { useToast } from "../lib/toast";

const caracteristicas = [
  {
    titulo: "Agenda do ateliê",
    texto: "Entregas, provas de roupa, compromissos e pagamentos num calendário só. Abra e veja o seu dia.",
    icon: CalendarDays,
  },
  {
    titulo: "Costuras recebidas",
    texto: "Anote cada peça, o que modificar, o valor e a data de entrega. Nada de papelzinho perdido.",
    icon: Scissors,
  },
  {
    titulo: "Clientes com CPF e medidas",
    texto: "Puxe o contato do celular, complete o cadastro e guarde as medidas. CPF evita cliente repetida.",
    icon: Users,
  },
  {
    titulo: "Aviso pelo WhatsApp",
    texto: "Peça pronta, lembrete de entrega, prova e cobrança: a mensagem já sai escrita, é só enviar.",
    icon: MessageCircle,
  },
  {
    titulo: "Estoque e compras",
    texto: "Linha, agulha, óleo de máquina, zíper… saiba o que tem, o que usou e o que precisa comprar.",
    icon: Package,
  },
  {
    titulo: "Caixa e quem não pagou",
    texto: "Entradas, saídas, pagamentos agendados e a lista de clientes devendo, com botão de cobrar.",
    icon: Wallet,
  },
];

const diferenciais = [
  {
    titulo: "Feito para quem não é de tecnologia",
    texto: "Botões grandes, palavras simples e um manual passo a passo dentro do app.",
    icon: HeartHandshake,
  },
  {
    titulo: "Gráficos que mostram o caminho",
    texto: "Suas 10 melhores clientes, de onde elas vêm e quais peças mais chegam para ajuste e reforma.",
    icon: BarChart3,
  },
  {
    titulo: "Recibo com canhoto",
    texto: "Imprima ou salve em PDF o comprovante da costura, com via do ateliê e via da cliente.",
    icon: Printer,
  },
  {
    titulo: "Seus dados protegidos",
    texto: "Login próprio, autenticador no celular e cópia de segurança automática várias vezes por dia.",
    icon: ShieldCheck,
  },
];

const comoFunciona = [
  {
    titulo: "Compre ou receba a liberação",
    texto: "A licença chega no e-mail da compra ou pela liberação manual da desenvolvedora.",
    icon: ShoppingCart,
  },
  {
    titulo: "Crie sua senha (Primeiro acesso)",
    texto: "Use o mesmo e-mail, confirme pelo link, cadastre o autenticador e aceite os Termos / LGPD.",
    icon: UserPlus,
  },
  {
    titulo: `Use o ${APP_NAME}`,
    texto: "Abra o menu ☰, cadastre clientes, receba costuras e veja o resumo no Painel.",
    icon: LayoutDashboard,
  },
];

const faqItems = [
  {
    q: "Posso testar antes de comprar?",
    a: (
      <>
        Sim. Peça 7 dias grátis pelo{" "}
        <a href={linkWhatsAppTeste()} target="_blank" rel="noreferrer">
          WhatsApp
        </a>{" "}
        com o e-mail que vai usar. Liberamos o acesso e você cria a senha em Primeiro acesso.
      </>
    ),
  },
  {
    q: "Como funciona o acesso após a compra?",
    a: `A licença libera no e-mail da compra. Depois use Primeiro acesso no ${APP_NAME} para criar a senha e o autenticador.`,
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Cada conta vê só os próprios dados, com senha e sessão deste app, e há cópia de segurança automática. Detalhes em Privacidade / LGPD.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não é obrigatório. Funciona no navegador. Se quiser, toque em Instalar App e ele fica na tela do celular como um aplicativo.",
  },
  {
    q: "Funciona no celular?",
    a: `Sim. O ${APP_NAME} foi pensado primeiro para o celular, e também funciona no computador e no tablet.`,
  },
  {
    q: "Consigo mandar mensagem pelo WhatsApp para a cliente?",
    a: "Sim. O app abre o WhatsApp da cliente com a mensagem pronta (peça pronta, lembrete, prova ou cobrança). Você só confere e envia.",
  },
  {
    q: "Tenho direito a atualizações?",
    a: "Sim, enquanto sua licença estiver ativa conforme o plano adquirido.",
  },
];

/** Faixa do teste grátis: abre o WhatsApp com o pedido de teste já escrito. */
function TesteGratis() {
  return (
    <p className="teste-gratis">
      <MessageCircle size={20} aria-hidden="true" />
      <strong>Teste grátis por 7 dias</strong>
      <span className="teste-gratis-dot" aria-hidden="true">•</span>
      <span>
        Sem cartão.{" "}
        <a href={linkWhatsAppTeste()} target="_blank" rel="noreferrer">
          Peça pelo WhatsApp
        </a>{" "}
        e liberamos seu acesso.
      </span>
    </p>
  );
}

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
    if (u.pathname.includes("/embed/")) return url;
    return null;
  } catch {
    return null;
  }
}

export function LandingPage() {
  const compra = linkCompra();
  const { install } = useInstallApp();
  const { push } = useToast();
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const embed = YOUTUBE_LANDING ? youtubeEmbed(YOUTUBE_LANDING) : null;

  async function onInstall() {
    const result = await install();
    applyInstallResult(result, push);
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <BrandLockup tone="dark" />
        <div className="landing-header-right">
          <nav className="landing-header-nav" aria-label="Seções da vitrine">
            <a className="landing-header-link" href="#funcionalidades">
              Funcionalidades
            </a>
            <a className="landing-header-link" href="#como-funciona">
              Como Funciona
            </a>
            <a className="landing-header-link" href="#planos">
              Preço
            </a>
            <a className="landing-header-link" href="#faq">
              FAQ
            </a>
          </nav>
          <nav className="landing-header-actions" aria-label="Acesso">
            <Link className="btn btn-ghost" to="/login" state={{ pedirSenha: true }}>
              Entrar
            </Link>
            <a
              className="btn btn-primary"
              href={compra}
              target="_blank"
              rel="noreferrer"
            >
              Comprar
            </a>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <FactoryPitch />
        <p className="landing-hero-slogan">{APP_SLOGAN}</p>
        <h1 className="landing-hero-title">Descubra para onde vai o seu tempo e o seu dinheiro na costura — e tenha tudo à mão.</h1>
        <p className="landing-hero-problem">
          Caderninho, papelzinho na peça e conversa perdida no WhatsApp: fica difícil
          lembrar quem buscar, o que ajustar e quem ainda não pagou.
        </p>
        <div className="landing-hero-band">
          <p className="landing-hero-solution">
            O {APP_NAME} organiza o seu ateliê no celular: agenda, costuras, clientes,
            estoque e caixa num lugar só — e avisa as clientes pelo WhatsApp com um toque.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <a
              className="btn btn-primary"
              href={compra}
              target="_blank"
              rel="noreferrer"
            >
              Comprar
            </a>
            <Link className="btn btn-ghost btn-ghost-gold" to="/login" state={{ pedirSenha: true }}>
              Entrar
            </Link>
          </div>
        </div>
        <TesteGratis />
      </section>

      {YOUTUBE_LANDING ? (
        <section className="landing-video">
          <h2 className="section-title">Veja como funciona</h2>
          {embed ? (
            <div className="landing-video-frame">
              <iframe
                src={embed}
                title={`Vídeo ${APP_NAME}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          <a
            className="btn btn-primary"
            href={YOUTUBE_LANDING}
            target="_blank"
            rel="noreferrer"
          >
            Assistir no YouTube
          </a>
        </section>
      ) : null}

      <section id="funcionalidades" className="landing-features">
        <h2>Tudo que você precisa no {APP_NAME}</h2>
        <p className="landing-section-lead">
          Do básico ao avançado — o que o app faz, em cards claros, para você
          usar no celular ou no computador.
        </p>
        <div className="landing-grid">
          {caracteristicas.map((b) => {
            const Icon = b.icon;
            return (
              <article key={b.titulo} className="card landing-card">
                <Icon
                  className="landing-benefit-icon"
                  size={22}
                  aria-hidden="true"
                />
                <h3 className="section-title">{b.titulo}</h3>
                <p>{b.texto}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="como-funciona" className="landing-features">
        <h2>Simples assim — em 3 passos</h2>
        <p className="landing-section-lead">
          Do primeiro acesso ao uso do dia a dia, sem precisar entender de
          tecnologia.
        </p>
        <div className="landing-grid landing-grid--3">
          {comoFunciona.map((passo, i) => {
            const Icon = passo.icon;
            return (
              <article key={passo.titulo} className="card landing-card">
                <p className="landing-step-num">Passo {i + 1}</p>
                <Icon
                  className="landing-benefit-icon"
                  size={22}
                  aria-hidden="true"
                />
                <h3 className="section-title">{passo.titulo}</h3>
                <p>{passo.texto}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-features">
        <h2>O que diferencia</h2>
        <div className="landing-grid landing-grid--4">
          {diferenciais.map((d) => {
            const Icon = d.icon;
            return (
              <article key={d.titulo} className="card landing-card">
                <Icon
                  className="landing-benefit-icon"
                  size={22}
                  aria-hidden="true"
                />
                <h3 className="section-title">{d.titulo}</h3>
                <p>{d.texto}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="planos" className="landing-deal">
        <h2 className="landing-deal-title">Valor de lançamento</h2>
        <p className="landing-price-old">De {PRECO.depoisLabel}</p>
        <p className="landing-price-now">Por {PRECO.lancamentoLabel}</p>
        <p className="landing-deal-urgency">
          Depois do lançamento o valor volta ao cheio ({PRECO.depoisLabel}).
        </p>
        <a
          className="btn btn-deal"
          href={compra}
          target="_blank"
          rel="noreferrer"
        >
          Comprar
        </a>
        <p className="landing-deal-note">
          Você paga na Hotmart. A licença libera sozinha no e-mail da compra.
        </p>
        <p className="landing-deal-trial">
          <a href={linkWhatsAppTeste()} target="_blank" rel="noreferrer">
            Prefere testar antes? 7 dias grátis pelo WhatsApp
          </a>
        </p>
        <p className="landing-deal-support">
          Dúvidas:{" "}
          <a href={linkWhatsAppInteresse()} target="_blank" rel="noreferrer">
            WhatsApp {BRAND.whatsappDisplay}
          </a>
          {" · "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        </p>
      </section>

      <section id="faq" className="landing-features landing-faq">
        <h2>Perguntas frequentes</h2>
        <p className="landing-section-lead">
          Respostas curtas, em português claro.
        </p>
        <div className="landing-faq-list">
          {faqItems.map((item, index) => {
            const open = faqOpen === index
            return (
              <article key={item.q} className={`card landing-card landing-faq-item${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="landing-faq-trigger"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${index}`}
                  id={`faq-trigger-${index}`}
                  onClick={() => setFaqOpen(open ? null : index)}
                >
                  <h3 className="section-title">{item.q}</h3>
                  <span className="landing-faq-icon" aria-hidden="true">
                    {open ? <Minus size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
                  </span>
                </button>
                {open ? (
                  <div
                    className="landing-faq-panel"
                    id={`faq-panel-${index}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${index}`}
                  >
                    <p>{item.a}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
          <article className="card landing-card">
            <h3 className="section-title">Suporte</h3>
            <p>
              Fale com o suporte:{" "}
              <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
              {" · "}
              <a
                href={linkWhatsAppInteresse()}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp {BRAND.whatsappDisplay}
              </a>
              {" · "}
              <a href={BRAND.site} target="_blank" rel="noreferrer">
                planilhaprofissional.com
              </a>
            </p>
          </article>
        </div>
      </section>

      <section className="landing-pwa-band">
        <h2 className="section-title">Instalar app (PWA)</h2>
        <p>
          Use o {APP_NAME} no computador e no celular, como um aplicativo da tela inicial.
        </p>
        <button className="btn btn-primary" type="button" onClick={onInstall}>
          <Download size={16} />
          Instalar App
        </button>
      </section>
      <Footer compact interesse />
    </div>
  );
}
