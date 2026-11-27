import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { APP_NAME, BRAND, TEXTOS_LEGAIS_ATUALIZADOS } from '../lib/brand'

function TermosCard({ title, children }: { title: string; children: React.ReactNode }) {
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
export function TermosPage({ publica = false }: { publica?: boolean }) {
  // X06: links internos ficam na mesma versão (dentro do app quando logado)
  const base = publica ? '' : '/app'
  const { ano, mesAno } = TEXTOS_LEGAIS_ATUALIZADOS

  return (
    <>
    <div className="oficial-page">
      <h1 className="oficial-page-title">Termos de Uso e Licença</h1>
      <p className="oficial-page-sub">
        Regras de licença e uso do {APP_NAME}. A privacidade (LGPD) está em{' '}
        <Link to={`${base}/lgpd`}>página separada</Link>.
      </p>

      <TermosCard title="Aceite dos termos">
        <p>
          Ao acessar, instalar ou usar o {APP_NAME}, você declara ter lido e concordado com estes Termos de Uso e com a{' '}
          <Link to={`${base}/lgpd`}>Política de Privacidade / LGPD</Link> (página separada no app). Se não concordar,{' '}
          <strong>não utilize</strong> o produto.
        </p>
      </TermosCard>

      <TermosCard title="O que é o produto">
        <p>
          O {APP_NAME} é um aplicativo web instalável (PWA) da Planilha Profissional (planilhaprofissional.com),
          disponibilizado conforme o plano ou a licença adquiridos na Hotmart ou em canal oficial autorizado.
        </p>
      </TermosCard>

      <TermosCard title="Licença de uso — não exclusiva">
        <p>
          É concedida ao comprador/titular da conta uma licença <strong>não exclusiva</strong>, pessoal e
          intransferível (salvo disposição comercial específica no plano Enterprise). Não transfere propriedade
          intelectual. O acesso fica vinculado ao e-mail liberado, com senha própria deste aplicativo.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permite</th>
                <th>Proíbe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Uso pessoal ou conforme o plano contratado</td>
                <td>Revenda, redistribuição ou sublicenciamento</td>
              </tr>
              <tr>
                <td>Uso no número de dispositivos/usuários do plano</td>
                <td>Compartilhar login fora do permitido</td>
              </tr>
              <tr>
                <td>Atualizações incluídas no plano</td>
                <td>Engenharia reversa ou cópia do código</td>
              </tr>
              <tr>
                <td>Backup dos próprios dados inseridos</td>
                <td>Remover marcas ou créditos do desenvolvedor</td>
              </tr>
            </tbody>
          </table>
      </div>
      </TermosCard>

      <TermosCard title="Restrições de uso">
        <p>É expressamente proibido:</p>
        <ol>
          <li>Revender, alugar, sublicenciar, redistribuir ou disponibilizar o acesso a terceiros sem autorização escrita</li>
          <li>Compartilhar login ou credenciais fora do permitido no plano</li>
          <li>Publicar link de ativação, credenciais ou o produto em sites públicos sem autorização</li>
          <li>Copiar, clonar, modificar ou replicar o software para distribuição</li>
          <li>Copiar código, layout, marca, prompts da fábrica ou metodologia</li>
          <li>Engenharia reversa ou cópia do código</li>
          <li>Remover marcas, créditos, rodapé ou avisos de propriedade intelectual</li>
          <li>Usar o produto para fins ilegais ou que violem direitos de terceiros</li>
          <li>Tentar acessar áreas, dados ou contas de outros clientes ou de outros apps</li>
          <li>Burlar limites do plano (por exemplo, multi-usuário sem contratar)</li>
          <li>Acessar o serviço de forma automática ou abusiva (scraping, ataque, sobrecarga)</li>
          <li>Uso comercial em consultoria sem licença específica</li>
          <li>Comercializar, registrar ou explorar o projeto além do escopo da licença</li>
        </ol>
      </TermosCard>

      <TermosCard title="Planos e pagamento">
        <ul>
          <li>O acesso às funcionalidades depende do plano ativo (Trial, Básico, Profissional, Premium ou o plano/licença liberados na compra)</li>
          <li>Pagamento e renovação via Hotmart (ou canal indicado na compra)</li>
          <li>Cancelamento segue regras da plataforma de pagamento e destes termos</li>
          <li>Downgrade ou cancelamento pode restringir funcionalidades imediatamente após a confirmação</li>
        </ul>
      </TermosCard>

      <TermosCard title="Propriedade intelectual">
        <ul>
          <li>Os dados inseridos pelo usuário continuam dele, nos termos da LGPD</li>
          <li>
            Todo o software, layout, textos padrão, marca Planilha Profissional e materiais do app são da Planilha
            Profissional ou de seus licenciadores
          </li>
          <li>Código, layout, marca, prompts, paleta e método do app são da Planilha Profissional</li>
          <li>O usuário não pode comercializar, sublicenciar, copiar ou registrar o projeto ou material derivado</li>
          <li>Melhorias do software pertencem à Planilha Profissional; o conteúdo que o usuário cadastrou não</li>
          <li>
            Informações do serviço devem ser usadas só para o fim da licença; divulgação a terceiros só com autorização
            ou exigência legal
          </li>
        </ul>
      </TermosCard>

      <TermosCard title="Disponibilidade e limitações">
        <ul>
          <li>O serviço é prestado &quot;como está&quot;, com esforços razoáveis de disponibilidade</li>
          <li>Manutenções programadas podem ocorrer, com aviso prévio quando possível</li>
          <li>
            Decisões operacionais: esta ferramenta é um auxílio organizacional. A Planilha Profissional não se
            responsabiliza por decisões administrativas ou comerciais tomadas com base nos dados aqui inseridos
          </li>
          <li>
            Erros de preenchimento: a precisão dos resultados depende integralmente da corretude dos dados inseridos pelo
            usuário
          </li>
          <li>Não substitui assessoria profissional (contábil, fiscal, jurídica ou da área do app) sem validação adequada</li>
        </ul>
      </TermosCard>

      <TermosCard title="Sanções por descumprimento">
        <p>
          Em caso de violação destes termos, podemos, sem prejuízo de medidas legais: suspender ou encerrar o acesso;
          bloquear IP ou dispositivo em caso de abuso; bloquear atualizações e produtos futuros; cancelar a licença sem
          reembolso; comunicar autoridades quando a lei exigir; cobrar perdas e danos. Cabem ainda as medidas da Lei nº
          9.610/98 e outras sanções da legislação brasileira.
        </p>
      </TermosCard>

      <TermosCard title="Alterações dos termos">
        <p>
          A Planilha Profissional pode atualizar funcionalidades, termos e este aplicativo a qualquer momento. A versão
          vigente está nesta página (aba <strong>Termos de Uso</strong>). Uso continuado após alteração relevante implica
          ciência da nova versão.
        </p>
      </TermosCard>

      <TermosCard title="Foro e legislação">
        <p>
          Aplica-se a legislação brasileira. Foro: comarca do domicílio do consumidor, nos termos do Código de Defesa do
          Consumidor, quando aplicável.
        </p>
      </TermosCard>

      <TermosCard title="Contato">
        <p>
          <strong>Planilha Profissional</strong> ·{' '}
          <a href={BRAND.site} target="_blank" rel="noreferrer">
            planilhaprofissional.com
          </a>{' '}
          · <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> · WhatsApp {BRAND.whatsappDisplay}
        </p>
      </TermosCard>

      <TermosCard title="Suporte">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Canal</th>
                <th>Contato</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>E-mail</td>
                <td>
                  <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
                </td>
              </tr>
              <tr>
                <td>WhatsApp</td>
                <td>{BRAND.whatsappDisplay}</td>
              </tr>
            </tbody>
          </table>
      </div>
        <p>
          O suporte cobre dúvidas de uso e problemas técnicos dentro do escopo do plano contratado. Também: consultar o
          Comece Aqui e estes termos; instalar o PWA.
        </p>
      </TermosCard>

      <p className="oficial-closing">Licença não exclusiva · Uso pessoal · Proibida revenda e redistribuição</p>
      <p className="oficial-copy">
        © {ano} Planilha Profissional · {APP_NAME} · planilhaprofissional.com · Atualizado em {mesAno}
      </p>
      <p className="oficial-copy">
        <Link to={`${base}/lgpd`}>Privacidade / LGPD</Link>
        {' · '}
        <Link to="/app/comece-aqui">Comece aqui</Link>
      </p>
    </div>
    {publica ? <Footer compact interesse /> : null}
    </>
  )
}
