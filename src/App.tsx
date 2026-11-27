import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastHost } from './components/ToastHost'
import { LandingPage } from './pages/Landing'
import { LoginPage } from './pages/Login'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import { ComeceAquiPage } from './pages/ComeceAqui'
import { TermosPage } from './pages/Termos'
import { LgpdPage } from './pages/Lgpd'
import { DashboardPage } from './pages/Dashboard'
import { ConfigPage } from './pages/Config'
import { AdminAcessosPage } from './pages/AdminAcessos'
import { AgendaPage } from './pages/Agenda'
import { CosturasPage } from './pages/Costuras'
import { CosturaFormPage } from './pages/CosturaForm'
import { ReciboPage } from './pages/Recibo'
import { ClientesPage } from './pages/Clientes'
import { ClienteFormPage } from './pages/ClienteForm'
import { EstoquePage } from './pages/Estoque'
import { ComprasPage } from './pages/Compras'
import { CaixaPage } from './pages/Caixa'
import { PendenciasPage } from './pages/Pendencias'
import { MensagensPage } from './pages/Mensagens'
import { ServicosPage } from './pages/Servicos'

/** URLs antigas de cadastro → /login (mantém o registration-token do e-mail). */
function PrimeiroAcessoRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.has('registration-token')) params.set('primeiro', '1')
  return <Navigate to={`/login?${params.toString()}`} replace />
}

/** 1º acesso → Comece Aqui; demais → Painel. */
function AppHomeRedirect() {
  const { appHomePath } = useAuth()
  return <Navigate to={appHomePath.replace(/^\/app\//, '')} replace />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ToastHost />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/entrar" element={<Navigate to="/login" replace />} />
            <Route path="/cadastro" element={<PrimeiroAcessoRedirect />} />
            <Route path="/primeiro-acesso" element={<PrimeiroAcessoRedirect />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/termos" element={<TermosPage publica />} />
            <Route path="/lgpd" element={<LgpdPage publica />} />
            <Route path="/privacidade" element={<Navigate to="/lgpd" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<AppHomeRedirect />} />
                <Route path="comece-aqui" element={<ComeceAquiPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="costuras" element={<CosturasPage />} />
                <Route path="costuras/nova" element={<CosturaFormPage />} />
                <Route path="costuras/:id" element={<CosturaFormPage />} />
                <Route path="costuras/:id/recibo" element={<ReciboPage />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="clientes/nova" element={<ClienteFormPage />} />
                <Route path="clientes/:id" element={<ClienteFormPage />} />
                <Route path="mensagens" element={<MensagensPage />} />
                <Route path="servicos" element={<ServicosPage />} />
                <Route path="estoque" element={<EstoquePage />} />
                <Route path="compras" element={<ComprasPage />} />
                <Route path="caixa" element={<CaixaPage />} />
                <Route path="pendencias" element={<PendenciasPage />} />
                <Route path="alterar-senha" element={<Navigate to="/app/config#alterar-senha" replace />} />
                <Route path="config" element={<ConfigPage />} />
                <Route path="admin" element={<AdminAcessosPage />} />
                <Route path="termos" element={<TermosPage />} />
                <Route path="lgpd" element={<LgpdPage />} />
                <Route path="privacidade" element={<Navigate to="/app/lgpd" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
