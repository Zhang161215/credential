# 凭证提取系统 v2

基于 Next.js 16 + React 19 + SQLite 的会员账号兑换平台。用户用卡密充值点数，再用点数兑换 JSON 账号凭证；支持单个兑换和批量兑换（自动打包 ZIP 下载）。

## 功能

- 用户注册 / 登录（独立 user_session cookie，HMAC-SHA256 签名）
- 卡密面值充值（卡密一次性使用）
- 点数兑换账号（单个直接下载 JSON / 批量打包 ZIP）
- 用户操作流水（充值 / 兑换 / 管理员调整）
- 管理后台：凭证管理、卡密管理、用户管理、系统设置、仪表盘
- 公开实时统计（库存、最近 5 分钟兑换数）

## 技术栈

- **运行时**：Next.js 16 (App Router, Turbopack)
- **数据层**：better-sqlite3（WAL 模式 + 外键约束）
- **认证**：bcryptjs + HMAC-SHA256 签名 cookie
- **UI**：shadcn/ui + Tailwind CSS v4 + lucide-react
- **打包**：jszip（服务端流式打包）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env.local
# 编辑 .env.local，至少修改 ADMIN_SECRET（生产环境必须）

# 3. 启动开发服务
npm run dev
```

访问入口：

- 前台首页：http://localhost:3000/
- 管理后台：http://localhost:3000/admin/login

首次登录管理员账号默认 `admin / admin123456`（来自 `ADMIN_INIT_PASSWORD`）。

## 使用流程

1. 管理员登录 → 凭证管理页上传 JSON 账号 → 卡密管理页生成带面值的卡密 → 设置兑换价格
2. 用户访问首页 → 注册账号 → 输入卡密充值点数 → 选择数量兑换账号
3. 单个兑换返回 JSON 文件，2 个及以上自动打包成 ZIP 下载（单次最多 50）

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/{register,login,logout}` | 用户认证 |
| GET | `/api/auth/me` | 当前用户余额 |
| POST | `/api/recharge` | 卡密充值 |
| POST | `/api/redeem` | 单个兑换 |
| POST | `/api/redeem/batch` | 批量兑换 ZIP |
| GET | `/api/transactions` | 用户操作记录 |
| GET | `/api/stats` | 公开实时统计 |
| GET | `/api/settings` | 公开设置（公告 / 价格 / 联系方式） |
| `*` | `/api/admin/*` | 管理后台接口（admin_session） |

## 数据库

启动时自动建表，存放在 `data/credential.db`（WAL）。重置数据库直接删除该目录下的 `*.db*` 文件即可。

## 部署

```bash
npm run build
ADMIN_SECRET=$(openssl rand -hex 32) npm start
```

## 安全注意

- 生产环境务必设置强随机的 `ADMIN_SECRET`，否则 cookie 签名会被预测
- 首次启动后建议立即在数据库中修改 admin 密码，或使用 `ADMIN_INIT_PASSWORD` 一开始就设强密码
- `.env.local` 与 `data/*.db*` 已在 `.gitignore` 中，不会提交到代码仓库
