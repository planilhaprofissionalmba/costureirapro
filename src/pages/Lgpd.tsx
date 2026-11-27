import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { APP_NAME, BRAND, TEXTOS_LEGAIS_ATUALIZADOS } from '../lib/brand'

function LgpdCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="oficial-card">
      <header className="oficial-card-head">
        <FileText size={18} strokeWidth={2} aria-hidden />
        <h2 className="oficial-card-title">{title}</h2>
      </header>
      <div className="oficial-card-body">{children}</div>
    </article>
  )
}

/** publica = aberta sem login (link do Login/Primeiro acesso): mostra o rodapé oficial. */
export function LgpdPage({ publica = false }: { publica?: boolean }) {
  // X06: links internos ficam na mesma versão (dentro do app quando logado)
  const base = publica ? '' : '/app'
  const { ano, mesAno } = TEXTOS_LEGAIS_ATUALIZADOS

  return (
    <>
    <div className="oficial-page">
      <h1 className="oficial-page-title">Privacidade / LGPD</h1>
      <p className="oficial-page-sub">
        Como o {APP_NAME} trata seus dados (Lei nº 13.709/2018). Os{' '}
        <Link to={`${base}/termos`}>Termos de Uso</Link> estão em página separada.
      </p>

      <LgpdCard title="Quem somos">
        <p>
          O {APP_NAME} é um produto digital da <strong>Planilha Profissional</strong> (planilhaprofissional.com),
          desenvolvido para uso pessoal ou empresarial conforme o plano adquirido.
        </p>
        <p>
          Contato do encarregado / suporte: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> · WhatsApp{' '}
          {BRAND.whatsappDisplay}.
        </p>
      </LgpdCard>

      <LgpdCard title="Dados que coletamos">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dado</th>
                <th>Finalidade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Nome e e-mail</td>
                <td>Cadastro, login e suporte</td>
              </tr>
              <tr>
                <td>Dados informados no app</td>
                <td>Prestação do serviço contratado</td>
              </tr>
              <tr>
                <td>IP e dispositivo</td>
                <td>Segurança, auditoria e melhoria técnica</td>
              </tr>
              <tr>
                <td>Dados de compra (Hotmart)</td>
                <td>Liberação de plano e suporte</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Não vendemos seus dados a terceiros para marketing.</p>
      </LgpdCard>

      <LgpdCard title="Base legal (LGPD — Lei nº 13.709/2018)">
        <ul>
          <li>
            <strong>Execução de contrato</strong> — prestação do serviço adquirido
          </li>
          <li>
            <strong>Legítimo interesse</strong> — segurança, auditoria e melhoria do produto
          </li>
          <li>
            <strong>Consentimento</strong> — quando aplicável (ex.: comunicações opcionais)
          </li>
        </ul>
      </LgpdCard>

      <LgpdCard title="Como usamos seus dados">
        <ul>
          <li>Operar o app e suas funcionalidades</li>
          <li>Autenticar usuários e proteger contas</li>
          <li>Registrar auditoria de alterações (logs de segurança)</li>
          <li>Cumprir obrigações legais</li>
          <li>Prestar suporte técnico</li>
        </ul>
      </LgpdCard>

      <LgpdCard title="Compartilhamento">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Função</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Banco de dados e autenticação</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Hospedagem do aplicativo</td>
              </tr>
              <tr>
                <td>Hotmart</td>
                <td>Pagamento e gestão de assinatura</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Todos operam sob contratos e padrões de segurança compatíveis com a LGPD.</p>
      </LgpdCard>

      <LgpdCard title="Retenção e segurança">
        <ul>
          <li>Dados mantidos enquanto a conta estiver ativa ou conforme exigência legal</li>
          <li>Logs de auditoria: retenção mínima de 12 meses</li>
          <li>Senhas armazenadas somente como hash (bcrypt ou argon2) — nunca em texto puro</li>
          <li>Acesso restrito por perfil (Administrador, Operador, Cliente) e regras de acesso no banco de dados</li>
          <li>Cada conta acessa só os próprios dados</li>
        </ul>
      </LgpdCard>

      <LgpdCard title="Seus direitos (titular dos dados)">
        <p>Você pode solicitar:</p>
        <ul>
          <li>Confirmação e acesso aos dados</li>
          <li>Correção de dados incompletos ou desatualizados</li>
          <li>Anonimização, bloqueio ou eliminação (quando aplicável)</li>
          <li>Portabilidade</li>
          <li>Revogação de consentimento</li>
          <li>Informação sobre compartilhamento</li>
        </ul>
        <p>
          Como solicitar: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> ou WhatsApp{' '}
          {BRAND.whatsappDisplay}. Resposta em prazo razoável conforme a LGPD.
        </p>
      </LgpdCard>

      <LgpdCard title="Cookies e tecnologias similares">
        <p>
          O app pode usar armazenamento local e cookies de sessão para login, preferências e funcionamento do aplicativo
          instalável (PWA). Não utilizamos cookies de rastreamento publicitário de terceiros sem consentimento.
        </p>
      </LgpdCard>

      <LgpdCard title="Limitação de responsabilidade">
        <p>
          Esta ferramenta é um auxílio organizacional. A Planilha Profissional não se responsabiliza por decisões
          administrativas ou comerciais tomadas com base nos dados aqui inseridos. A precisão dos resultados depende da
          corretude dos dados inseridos pelo usuário. O app é fornecido &quot;como está&quot; e não substitui assessoria
          contábil, fiscal ou jurídica. Os dados inseridos pelo usuário continuam dele. Código, layout, marca, prompts e
          método do app são da Planilha Profissional.
        </p>
      </LgpdCard>

      <LgpdCard title="Alterações nesta política">
        <p>
          Esta política pode ser atualizada. A versão vigente está nesta página (aba <strong>Privacidade / LGPD</strong>
          ). Uso continuado após alteração relevante implica ciência da nova versão.
        </p>
      </LgpdCard>

      <p className="oficial-copy">
        © {ano} Planilha Profissional · {APP_NAME} · planilhaprofissional.com · Atualizado em {mesAno}
      </p>
      <p className="oficial-copy">
        <Link to={`${base}/termos`}>Termos de Uso</Link>
        {' · '}
        <Link to="/app/comece-aqui">Comece aqui</Link>
      </p>
    </div>
    {publica ? <Footer compact interesse /> : null}
    </>
  )
}
