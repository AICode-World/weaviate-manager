# ⚡ Weaviate Manager

A modern, lightweight visual management console for [Weaviate](https://weaviate.io/) vector databases. Browse collections, inspect objects, run GraphQL queries, and perform multimodal searches — all from your browser.

**English** · [中文](#中文说明)

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)
![Ant Design](https://img.shields.io/badge/AntDesign-6-1677ff?logo=antdesign)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🔌 Connection & Cluster Management

- **Multi-cluster support** — save and switch between multiple Weaviate instances (local, cloud, staging, prod, etc.)
- **One-click connection** — point to any Weaviate instance with optional API key authentication
- **Quick switcher** — popover-based cluster switcher in the sidebar for fast context changes
- **Connection status** — real-time connection state indicator with collection count

### 📊 Dashboard

- **Overview stats** — total objects, collections, vector dimensions, estimated storage
- **Size distribution chart** — pie chart of collection sizes
- **Top collections** — bar chart of the largest collections
- **Storage trend** — track storage growth over time

### 📚 Collection & Schema

- **Collection browser** — explore schema, list classes, view object counts
- **Schema viewer** — inspect collection properties, vectorizers, and data types
- **Create / edit collections** — define properties and vectorizer configuration
- **Empty state guidance** — helpful prompts when no collections exist

### 🗂️ Data Management

- **Data browser** — paginated table view with inline edit / delete / multi-select
- **CSV import / export** — bulk data ingestion and extraction (with BOM for Excel compatibility)
- **Selective export** — export only selected rows, with validation

### 🔎 Search & Query

- **Dual-mode search** — BM25 keyword search + semantic near-text search
- **🖼️ Multimodal search** — text→image and image→image retrieval for vectorized media
- **🧰 GraphQL editor** — Monaco-powered editor with class-aware query templates
- **Query history** — save, favorite, search, and reuse past queries
- **Paginated results** — server-side cursor pagination for large datasets

### 🎨 UI / UX

- **🌐 Bilingual UI** — Chinese / English, switchable in one click
- **Dark / Light / System** — theme modes with smooth transitions
- **Brand color picker** — 5 preset colors (blue, green, purple, orange, pink)
- **Responsive sidebar** — collapsible sidebar with auto-collapse on small screens
- **Onboarding tour** — first-time user guidance (replayable)

## 📸 Screenshots

<!-- Replace with your own screenshots -->
<p align="center">
  <img src="./docs/screenshot-dashboard.png" alt="Dashboard" width="48%" />
  <img src="./docs/screenshot-browse.png" alt="Data browser" width="48%" />
  <img src="./docs/screenshot-graphql.png" alt="GraphQL editor" width="48%" />
  <img src="./docs/screenshot-multimodal.png" alt="Multimodal search" width="48%" />
</p>

## 🚀 Quick Start

### Option 1: Docker Compose — full stack in one command (recommended)

The fastest way to get both Weaviate and the Manager running locally:

```bash
git clone https://github.com/AICode-World/weaviate-manager.git
cd weaviate-manager
docker compose up -d
```

Then open <http://localhost:3000>. The manager is pre-configured to connect to Weaviate at `http://weaviate:8080` (the internal Docker network name) — no setup needed.

**What's running:**

| Service | Port | Notes |
|---|---|---|
| Weaviate | `8080` (REST/GraphQL), `50051` (gRPC) | Anonymous access, no modules enabled |
| Weaviate Manager | `3000` | UI — connects to Weaviate automatically |

To enable vectorization modules (OpenAI, CLIP, etc.), edit the `ENABLE_MODULES` section in `docker-compose.yml` — it has inline comments for each option.

### Option 2: Manager image only — connect to an existing Weaviate

If you already have Weaviate running (locally, in the cloud, or elsewhere), pull just the manager:

```bash
docker run -d -p 3000:80 \
  --name weaviate-manager \
  ghcr.io/aicode-world/weaviate-manager:latest
```

Open <http://localhost:3000> and enter your Weaviate URL in the "Connections" dialog.

> **Note:** Your Weaviate instance must allow CORS from the manager's origin. See [CORS Configuration](#-cors-configuration) below. On [Weaviate Cloud](https://console.weaviate.cloud/) CORS is enabled by default — just paste the endpoint URL and API key.

### Option 3: From source (for development)

```bash
git clone https://github.com/AICode-World/weaviate-manager.git
cd weaviate-manager

npm install
npm run dev         # dev server with HMR at http://localhost:5173

# or, for a production preview:
npm run build
npm run preview
```

The default connection URL is `http://localhost:8080` — change it via the "Connections" button in the sidebar after launch.

## 🔒 CORS Configuration

Weaviate Manager runs entirely in the browser, so your Weaviate instance must allow cross-origin requests (CORS).

### Docker / Docker Compose

Set the `CORS_ALLOWED_ORIGINS` environment variable:

```bash
docker run -d -p 8080:8080 \
  -e CORS_ALLOWED_ORIGINS='*' \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED='true' \
  --name weaviate semitechnologies/weaviate:latest
```

Or in `docker-compose.yml`:

```yaml
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    ports:
      - "8080:8080"
    environment:
      CORS_ALLOWED_ORIGINS: '*'  # or 'https://your-domain.com'
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
```

### Weaviate Cloud (WCD)

CORS is enabled by default — no additional configuration needed. Just paste your endpoint URL and API key.

### Self-hosted / Kubernetes

Add to your deployment manifest:

```yaml
env:
  - name: CORS_ALLOWED_ORIGINS
    value: '*'
```

### Troubleshooting

**CORS errors in the browser console?**

1. Verify your Weaviate instance has `CORS_ALLOWED_ORIGINS` set
2. If using a proxy/load balancer, ensure it forwards the `Origin` header
3. For local development, use `http://localhost:5173` (Vite dev server) as an allowed origin

## 🚀 Deployment

### Static Hosting (Recommended)

```bash
npm run build
# Upload the dist/ folder to any static host:
```

| Platform | Guide |
|---|---|
| **Vercel** | `npm run build` → drag `dist/` into Vercel dashboard |
| **GitHub Pages** | Use the GitHub Actions workflow (`.github/workflows/deploy.yml`) |
| **Netlify** | Drag `dist/` folder, set build command to `npm run build` |
| **Nginx** | Copy `dist/` to your server, point root to it |

### Environment Variables (Optional)

Create a `.env` file in the project root:

```bash
# Preset default Weaviate connection (optional)
VITE_DEFAULT_WEAVIATE_URL=http://localhost:8080
VITE_DEFAULT_API_KEY=

# Custom app title (optional)
VITE_APP_TITLE=Weaviate Manager
```

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| UI framework | React 19 + TypeScript 6 |
| Build tool | Vite 8 |
| UI library | Ant Design 6 |
| State management | Zustand 5 |
| Code editor | Monaco Editor (bundled locally) |
| Charts | @ant-design/charts |
| Weaviate client | weaviate-ts-client 2.x |
| Linter | oxlint |

## 📁 Project Structure

```
src/
├── components/
│   ├── Common/           # Shared components (EmptyState)
│   ├── Connection/       # Cluster management & connection UI
│   ├── Collections/      # Collection list sidebar
│   ├── DataView/         # Table, search, GraphQL, multimodal, CSV
│   ├── Layout/           # Main app shell with responsive sidebar
│   ├── Onboarding/       # First-use tour
│   └── Schema/           # Schema viewer & editor
├── i18n/                 # Bilingual messages (zh / en, 180+ keys)
├── pages/                # Route-level pages (Dashboard, DataPage)
├── services/             # Weaviate API wrapper
├── stores/               # Zustand stores (app state, query history)
├── utils/                # Utilities (crypto, error handling)
├── App.tsx               # Root with theme + i18n providers
└── main.tsx              # Entry point
```

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check + build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

## 🔧 Configuration

### Environment

Basic usage requires no configuration — all settings are managed via the UI. For preset defaults, you can optionally use the environment variables listed in the [Deployment](#deployment) section above.

### Persistence

The app stores the following in `localStorage`:

- **Cluster configs** — saved Weaviate connections with **AES-256 encrypted** API keys (`weaviate_clusters`)
- **Theme preferences** — mode and color (`weaviate_theme_prefs`)
- **UI preferences** — sidebar state (`weaviate_ui_prefs`)
- **Query history** — past GraphQL / search queries (`weaviate_query_history`)

## 🤝 Contributing

Issues and PRs welcome! For major changes, please open an issue first to discuss what you'd like to change.

## 📄 License

MIT © [Yan]

---

<a id="中文说明"></a>
## 🇨🇳 中文说明

Weaviate Manager 是一个现代化的 Weaviate 向量数据库可视化管理工具，浏览器直接访问。

### 核心功能

**连接与集群管理**
- 多集群支持 — 保存并切换多个 Weaviate 实例（本地、云端、测试、生产等）
- 一键连接 — 支持 API Key 认证
- 快速切换 — 侧边栏 Popover 快速切换集群
- 连接状态 — 实时显示连接状态和集合数量

**仪表盘**
- 概览统计 — 对象总数、集合数、向量维度、预估存储
- 分布图表 — 集合大小饼图、Top 集合柱状图
- 存储趋势 — 跟踪存储增长

**集合与 Schema**
- 集合浏览 — 查看 schema、属性、对象数量
- Schema 查看 — 检查属性类型、向量化配置
- 创建/编辑集合 — 定义属性和向量化器

**数据管理**
- 数据浏览 — 分页表格，支持行内编辑/删除/多选
- CSV 导入/导出 — 批量数据导入导出（支持 Excel BOM）
- 选择性导出 — 仅导出选中行

**搜索与查询**
- 双模式搜索 — BM25 关键词 + 语义 nearText
- 多模态搜索 — 文搜图、图搜图
- GraphQL 编辑器 — Monaco 编辑器，支持类感知模板
- 查询历史 — 保存、收藏、搜索、重用历史查询
- 分页结果 — 服务端游标分页

**UI / UX**
- 中英双语 — 一键切换
- 主题模式 — 亮色/暗色/跟随系统，平滑过渡
- 品牌色 — 5 种预设颜色
- 响应式侧边栏 — 小屏自动收起
- 入门引导 — 首次使用引导（可重放）

### 快速启动

**方式一：Docker Compose 一键启动（推荐）**

```bash
git clone https://github.com/AICode-World/weaviate-manager.git
cd weaviate-manager
docker compose up -d
```

打开 <http://localhost:3000>，Manager 已预配置连接 Weaviate（内部地址 `http://weaviate:8080`），无需任何设置。

| 服务 | 端口 | 说明 |
|---|---|---|
| Weaviate | `8080`（REST/GraphQL）、`50051`（gRPC） | 匿名访问，未启用任何向量化模块 |
| Weaviate Manager | `3000` | 管理界面，自动连接 Weaviate |

如需启用向量化模块（OpenAI、CLIP 等），编辑 `docker-compose.yml` 中的 `ENABLE_MODULES`，内有详细注释。

**方式二：单独运行 Manager（连接已有的 Weaviate）**

如果你已有 Weaviate 实例（本地、云端或自建），只拉 Manager 镜像：

```bash
docker run -d -p 3000:80 \
  --name weaviate-manager \
  ghcr.io/aicode-world/weaviate-manager:latest
```

打开 <http://localhost:3000>，在"连接管理"里填入 Weaviate 地址。

> 提示：Weaviate 实例需允许 Manager 来源的 CORS 请求，详见下方 [CORS 配置](#-cors-配置)。[Weaviate Cloud](https://console.weaviate.cloud/) 默认已开启 CORS，直接粘贴 endpoint 和 API key 即可。

**方式三：源码启动（开发使用）**

```bash
git clone https://github.com/AICode-World/weaviate-manager.git
cd weaviate-manager
npm install
npm run dev         # 开发服务器，http://localhost:5173

# 或构建生产版本预览：
npm run build
npm run preview
```

默认连接地址 `http://localhost:8080`，启动后在侧边栏"连接管理"中修改。

### 技术栈

React 19 + TypeScript 6 + Vite 8 + Ant Design 6 + Zustand 5 + Monaco Editor + weaviate-ts-client
