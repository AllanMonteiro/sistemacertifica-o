# FSC Manager

Sistema web completo para gerenciamento de conformidade em múltiplos programas de certificação (FSC, PFC, Onça Pintada e Carbono), com foco em auditoria anual, evidências, demandas de correção e rastreabilidade.

## Stack

- Backend: FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2 + JWT + RBAC
- Banco: PostgreSQL 16
- Storage de evidências: MinIO (S3 compatível)
- Frontend: React + Vite + TypeScript
- Orquestração: Docker Compose

## Estrutura

```text
fsc-manager/
  docker-compose.yml
  api/
  web/
```

## Subir ambiente

1. Suba os containers:

```bash
docker compose up --build
```

2. Rodar migrações manualmente (se necessário):

```bash
docker compose exec api alembic upgrade head
```

> A imagem da API já executa `alembic upgrade head` automaticamente no startup.

## Acessos

- API FastAPI: `http://localhost:8001`
- Swagger: `http://localhost:8001/docs`
- Frontend Web: `http://localhost:5173/`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Deploy gratuito (Render)

Este repositório já inclui:

- `render.yaml` (API + Web)
- `api/.env.render.example` (variáveis do backend)
- `web/.env.production.example` (URL da API no frontend)

### 1. Crie serviços gratuitos externos

- Banco PostgreSQL gratuito: Neon ou Supabase.
- Storage S3 compatível gratuito: Cloudflare R2 (recomendado) ou outro S3 compatível.

### 2. Suba o código no GitHub

Publique a pasta `fsc-manager` como raiz do repositório.

### 3. Crie o deploy no Render com Blueprint

1. No Render, clique em `New +` -> `Blueprint`.
2. Conecte o repositório.
3. O Render lerá o arquivo `render.yaml` e criará:
   - `sistema-certificacoes-api` (Web Service)
   - `sistema-certificacoes-web` (Static Site)

### 4. Configure variáveis da API no Render

Preencha no serviço `sistema-certificacoes-api`:

- `DATABASE_URL` = URL do PostgreSQL (com driver `postgresql+psycopg://...`)
- `JWT_SECRET` = chave forte
- `CORS_ORIGINS` = `https://SEU_WEB.onrender.com,http://localhost:5173`
- `S3_ENDPOINT` = endpoint S3 (ex.: Cloudflare R2)
- `S3_ACCESS_KEY` = chave de acesso S3
- `S3_SECRET_KEY` = segredo S3
- `S3_BUCKET` = `evidencias`
- `S3_REGION` = `auto` (R2) ou região do seu provedor
- `S3_STRICT_STARTUP` = `false`

### 5. Configure variável do Web no Render

No serviço `sistema-certificacoes-web`:

- `VITE_API_BASE_URL` = `https://SEU_BACKEND.onrender.com/api`

### 6. Acesse após deploy

- API: `https://SEU_BACKEND.onrender.com/docs`
- Web: `https://SEU_WEB.onrender.com`

> No plano gratuito, o backend pode "hibernar" após inatividade e demorar alguns segundos na primeira requisição.

## Credencial inicial (seed)

Usuário ADMIN criado automaticamente no startup:

- Email: `admin@local`
- Senha: `admin123`

## Funcionalidades principais

- Programas de certificação (`FSC`, `PFC`, `Onça Pintada`, `Carbono`)
- Cadastro de `Princípios -> Critérios -> Indicadores` por programa
- Auditoria por ano (`AuditoriaAno`) com `year` único por programa
- Avaliação por indicador + ano com `Status de Conformidade`
- Regras de negócio obrigatórias para `Não se Aplica` e `NC Menor/Maior`
- Demandas vinculadas às avaliações
- Evidências (arquivo/link/texto), com upload para MinIO
- Log de Auditoria com histórico de mudanças
- Cronograma de ajuste (Gantt) para NC Menor, NC Maior e Oportunidade de Melhoria
- Configurações da empresa (nome e logo)
- RBAC por perfis: `ADMIN`, `GESTOR`, `AUDITOR`, `RESPONSAVEL`
- Relatórios:
  - Resumo por status
  - Resumo de conformidade por certificação/ano
  - Avaliações sem evidências
  - Demandas atrasadas
  - NC por princípio
  - Cronograma de não conformidades (base Gantt)

## Endpoints base

- Programas: `/api/programas-certificacao`
- Configurações: `/api/configuracoes` e `/api/configuracoes/logo-upload`
- Auth: `/api/auth/*`
- Cadastros, Auditorias, Avaliações, Evidências, Demandas, Logs: `/api/*`
- Relatórios: `/api/reports/*`
  - `/api/reports/resumo-conformidade-por-certificacao?year=&programa_id=`
  - `/api/reports/cronograma-nc?programa_id=&auditoria_id=&incluir_concluidas=`

## Observações

- O bucket S3 `evidencias` é criado automaticamente no startup da API.
- Tipos de evidência padrão são semeados automaticamente se a tabela estiver vazia.
- A API agora aceita múltiplas origens CORS em `CORS_ORIGINS` (separadas por vírgula).
