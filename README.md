# ⚡ Weaviate Manager

A modern, lightweight visual management console for [Weaviate](https://weaviate.io/) vector databases. Browse collections, inspect objects, run GraphQL queries, and perform multimodal searches — all from your browser.

**English** · [中文](#中文说明)

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)
![Ant Design](https://img.shields.io/badge/AntDesign-6-1677ff?logo=antdesign)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **🔌 One-click connection** — point to any Weaviate instance (local or remote, with optional API key)
- **📚 Collection browser** — explore schema, list classes, view object counts
- **📊 Data browser** — paginated table view with inline edit / delete / multi-select
- **🔎 Dual-mode search** — BM25 keyword search + semantic near-text search
- **🖼️ Multimodal search** — text→image and image→image retrieval for vectorized media
- **🧰 GraphQL editor** — Monaco-powered editor with class-aware query templates
- **📥 CSV import / export** — bulk data ingestion and extraction
- **🌐 Bilingual UI** — Chinese / English, switchable in one click

## 📸 Screenshots

<!-- Replace with your own screenshots -->
<p align="center">
  <img src="./docs/screenshot-browse.png" alt="Data browser" width="48%" />
  <img src="./docs/screenshot-graphql.png" alt="GraphQL editor" width="48%" />
</p>

## 🚀 Quick Start

### 1. Start a Weaviate instance

The easiest way is via Docker:

```bash
docker run -d -p 8080:8080 -p 50051:50051 \
  -e ENABLE_MODULES='text2vec-openai,multi2vec-clip' \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED='true' \
  -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
  --name weaviate semitechnologies/weaviate:latest
```

Or use [Weaviate Cloud](https://console.weaviate.cloud/) — just paste the endpoint URL.

### 2. Run the manager

```bash
# Clone
git clone https://github.com/<your-username>/weaviate-manager.git
cd weaviate-manager

# Install
npm install

# Dev server (http://localhost:5173)
npm run dev

# Production build
npm run build
npm run preview
```

The default connection URL is `http://localhost:8080` — change it in the sidebar after launch.

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| UI framework | React 19 + TypeScript 6 |
| Build tool | Vite 8 |
| UI library | Ant Design 6 |
| State management | Zustand 5 |
| Code editor | Monaco Editor (bundled locally) |
| Weaviate client | weaviate-ts-client |
| Linter | oxlint |

## 📁 Project Structure

```
src/
├── components/
│   ├── Connection/       # Weaviate connection panel
│   ├── Collections/      # Collection list sidebar
│   ├── DataView/         # Table, search, GraphQL, multimodal, CSV
│   └── Layout/           # Main app shell
├── i18n/                 # Bilingual messages (zh / en)
├── services/             # Weaviate API wrapper
├── stores/               # Zustand stores
├── App.tsx
└── main.tsx
```

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check + build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

## 🤝 Contributing

Issues and PRs welcome! For major changes, please open an issue first to discuss what you'd like to change.

## 📄 License

MIT © [Your Name]

---

<a id="中文说明"></a>
## 🇨🇳 中文说明

Weaviate Manager 是一个现代化的 Weaviate 向量数据库可视化管理工具，浏览器直接访问。

**核心功能**：连接管理、集合浏览、对象增删改查、BM25/语义搜索、多模态检索、GraphQL 编辑器、CSV 导入导出、中英双语。

**快速启动**：

```bash
git clone https://github.com/<your-username>/weaviate-manager.git
cd weaviate-manager
npm install
npm run dev
```

打开 <http://localhost:5173>，在左侧输入 Weaviate 地址（默认 `http://localhost:8080`）点击连接即可。
