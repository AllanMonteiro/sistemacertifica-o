import { Navigate, Route, Routes } from 'react-router-dom';

import { Auditoria } from './api';
import Avaliacoes from './pages/Avaliacoes';
import Auditorias from './pages/Auditorias';
import Cadastros from './pages/Cadastros';
import Calendario from './pages/Calendario';
import Configuracoes from './pages/Configuracoes';
import Cronograma from './pages/Cronograma';
import Dashboard from './pages/Dashboard';
import Demandas from './pages/Demandas';
import DetalheAvaliacao from './pages/DetalheAvaliacao';
import Direcionadores from './pages/Direcionadores';
import Login from './pages/Login';

type Props = {
  token: string | null;
  onLogin: (token: string) => Promise<void>;
  auditorias: Auditoria[];
  programaId: number | null;
  auditoriaId: number | null;
  setAuditoriaId: (id: number | null) => void;
  selecionarContextoRelatorio: (programaId: number, year: number) => Promise<void>;
  refreshAuditorias: () => Promise<void>;
  refreshConfiguracaoNoHeader: () => Promise<void>;
};

type ProtectedProps = {
  token: string | null;
  children: JSX.Element;
};

function ProtectedRoute({ token, children }: ProtectedProps) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRoutes({
  token,
  onLogin,
  auditorias,
  programaId,
  auditoriaId,
  setAuditoriaId,
  selecionarContextoRelatorio,
  refreshAuditorias,
  refreshConfiguracaoNoHeader,
}: Props) {
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login onLogin={onLogin} />} />

      <Route
        path="/"
        element={
          <ProtectedRoute token={token}>
            <Dashboard
              programaId={programaId}
              auditoriaId={auditoriaId}
              selecionarContextoRelatorio={selecionarContextoRelatorio}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/auditorias"
        element={
          <ProtectedRoute token={token}>
            <Auditorias
              auditorias={auditorias}
              programaId={programaId}
              auditoriaId={auditoriaId}
              setAuditoriaId={setAuditoriaId}
              refreshAuditorias={refreshAuditorias}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cadastros"
        element={
          <ProtectedRoute token={token}>
            <Cadastros
              programaId={programaId}
              auditoriaId={auditoriaId}
              selecionarContextoRelatorio={selecionarContextoRelatorio}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/avaliacoes"
        element={
          <ProtectedRoute token={token}>
            <Avaliacoes programaId={programaId} auditoriaId={auditoriaId} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/avaliacoes/:id"
        element={
          <ProtectedRoute token={token}>
            <DetalheAvaliacao />
          </ProtectedRoute>
        }
      />

      <Route
        path="/demandas"
        element={
          <ProtectedRoute token={token}>
            <Demandas programaId={programaId} auditoriaId={auditoriaId} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cronograma"
        element={
          <ProtectedRoute token={token}>
            <Cronograma programaId={programaId} auditoriaId={auditoriaId} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendario"
        element={
          <ProtectedRoute token={token}>
            <Calendario programaId={programaId} auditoriaId={auditoriaId} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/direcionadores"
        element={
          <ProtectedRoute token={token}>
            <Direcionadores programaId={programaId} auditoriaId={auditoriaId} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute token={token}>
            <Configuracoes refreshConfiguracaoNoHeader={refreshConfiguracaoNoHeader} />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
    </Routes>
  );
}
