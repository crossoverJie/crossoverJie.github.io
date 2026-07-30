---
title: MCP大版本发布：无状态核心、破坏性变更，以及它到底省不省 token
date: 2026/07/30
categories:
  - AI
tags:
  - AI
  - MCP
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260730163724674.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260730163724674.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260730163724674.png)

# 背景

最近 MCP 又发大版本了，[MCP 2026-07-28 规范](https://modelcontextprotocol.io/specification/2026-07-28/)。算下来这已经是第五个版本，也是改动最大的一次。

重点是以下内容：
- 这次到底改了什么?
- 社区怎么看?
- 旧版的痛点它堵了多少?
- 以及那个老生常谈的问题"MCP 是不是很浪费 token"新版是否有优化？

> 原文是 Anthropic 的 [Bringing MCP 2026-07-28 to Claude](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)，发布说明在 [modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28/)。

---

## 一、无状态核心，这次最大的改动

MCP 的[月 SDK 下载量](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)今年已经破了 **4 亿次**，增长了 4 倍，基本坐稳了"AI Agent 接外部工具"的事实标准。
这次 2026-07-28 最大的区别是，是把协议核心从"双向有状态"改成了"请求/响应"的无状态模型。

说白了，以前 MCP 要靠 `initialize` 握手 + `Mcp-Session-Id` 把客户端和服务端绑在一个会话上。这带来一个很现实的麻烦：你想横向扩展远程 MCP 服务，就得上 sticky session、共享会话存储，或者专门搞个网关来解析 JSON 路由，部署成本一下就上去了。

无状态化之后，server 可以像普通 HTTP 服务一样直接丢到 Serverless / 边缘节点上，构建和扩展都简单不少。对做基础设施的人来说，这点比加什么新 feature 都实在。

配套的还有两块：

- **标准化扩展**：[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)（在对话里直接渲染交互式 UI）和 [Tasks](https://modelcontextprotocol.io/extensions/tasks/overview)（长耗时任务）被纳入版本化扩展框架。以后想加能力不用动核心协议，走扩展就行。
- **授权强化**：对齐生产级的 OAuth 2.0 / OIDC，能直接对接 Entra、Okta 这些企业身份系统，不用再搞变通方案。

Claude 这边也在跟着落地，[连接器目录](https://claude.ai/directory/connectors)已经收了超过 **950 个 MCP server**，每天几百万人用。除了上面说的 [Apps](https://claude.com/blog/interactive-tools-in-claude) 和[企业托管认证](https://claude.com/blog/enterprise-managed-auth)，还推了[开发者可观测性仪表盘](https://claude.com/blog/observability-for-developers-building-connectors)，以及一个研究预览性质的 [MCP 隧道](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview)——把 Claude 连到私有网络里的 server，不用把内网服务暴露到公网。

---

## 二、社区态度：方向正确，代价不小

我翻了一圈技术社区，主流对无状态化是认可的，觉得这是 MCP 走向生产级部署的必经之路。能像普通 HTTP 服务一样水平扩展、部署到 Serverless，大家觉得这步走对了。Figma 在测试期就基于新规范在搭，原话大意是"用的人越多，我们的无状态架构越能跟着扩"。

但吐槽也不少，集中在一件事上：**破坏性变更（Breaking Changes）**。

这次一口气改了大概 6 处协议行为：

- `initialize` 握手没了；
- `Mcp-Session-Id` 被移除；
- 几个核心能力被废弃（`resources/list`、`prompts/list`、`sampling` 部分）；
- OAuth 要求显著收紧。

已经在跑远程 MCP server 的团队，得把"有状态会话"改造成"无状态 + 显式状态句柄"。网上一下冒出大量"迁移实战 / 避坑指南"，本身就说明落地的阵痛是真实的。OAuth 收紧虽然更安全，但旧实现基本得重写认证逻辑，这个工作量不少团队是避不开的。

> 社区情绪大概是这样：方向对，代价不小。无状态化大家服，但一次性塞进来这么多 breaking change，尤其是 OAuth 这块，怨言挺多。

---

## 三、旧版的痛点，新版堵了多少

我顺手把旧版 MCP 被人诟病的地方和新版对照了一下，做个表：

| # | 旧版被诟病的问题 | 新版（2026-07-28）的优化 | 解决程度 |
|---|---|---|---|
| 1 | 有状态会话，难水平扩展，得上网关/共享存储 | 无状态核心，移除握手和 Session，改成请求/响应 + 显式状态句柄 | ✅ 根本解决 |
| 2 | 认证混乱，协议层几乎无安全要求，常见"裸奔"部署 | OAuth 2.1 + PKCE 强制，要求 `/.well-known/oauth-authorization-server` 元数据端点 | ✅ 大幅改进 |
| 3 | 传输层不统一，旧 SSE 远程部署困难 | Streamable HTTP 取代 SSE 成为标准远程传输 | ✅ 解决 |
| 4 | 概念过载，`resources/prompts/sampling` 增加复杂度 | 废弃 3 个核心原语，能力交给扩展机制 | ✅ 简化 |
| 5 | 缺乏可观测性，排障靠自研埋点 | Claude 侧推连接器开发者可观测性仪表盘 | ⚠️ 仅 Claude 侧 |
| 6 | 远程接入要暴露公网，要防火墙/白名单 | MCP 隧道（研究预览）免公网暴露接入 | ⚠️ 研究预览 |

架构类的老问题（扩展性、认证、传输、复杂度）新版基本都堵上了。但安全这块要泼点冷水：协议层"明确不在协议层强制安全"，鉴权授权全靠各团队自己实现。新版靠 OAuth 2.1 / PKCE 部分缓解，但工具投毒（恶意指令藏在工具描述里）、提示注入、Rug Pull 这类 **AI 语义层攻击，规范从根上防不了**。之前出过的 [CVE-2025-49596](https://nvd.nist.gov/vuln/detail/CVE-2025-49596)（MCP Inspector 未授权 RCE，CVSS 9.4）就是血的教训，这些还得靠网关、最小权限、供应链扫描、AI 检测做纵深防御。

> 所以准确的说法是：新版把"架构类"问题堵了，但"协议不强制安全 + AI 语义攻击"这类根因只是缓解，不是根治。

---

## 四、被吐槽"浪费 token"，新版到底管不管？


MCP 一直被人吐槽"工具定义全量灌进 context，还没说话就把窗口撑爆"。具体有两层膨胀：

- **Tool Definition Bloat（最严重）**：客户端一连接，就把所有工具定义（名字、描述、输入输出 JSON Schema）一把塞进上下文。企业场景 20 个 server × 20 个工具 = 400 个定义，光工具定义就能吃掉 10 万+ token。有开发者实测，连 7 个 server 还没输入就占了 67,300 token。
- **Tool Result Bloat**：多步工作流里大文件在工具间反复搬运，一份 5 万 token 的文档经"取回→注入→再塞进下一调用"能翻倍到近 10 万 token。

**但关键是：2026-07-28 规范本身并没有从协议层解决 token 浪费。** 它做的是无状态、OAuth、扩展框架，对 token 问题是中性甚至间接的。规范仍然要求 `tools/list` 返回全量工具目录，没有强制或提供"按需加载 / 分页 / 工具搜索"原语。

真正省 token 的，是规范之外、客户端和厂商层做的"渐进式披露（progressive disclosure）"机制，而且大多在 2026-07-28 之前就发了：

| 机制 | 发布方 / 时间 | 节省幅度 | 是否在新规范里 |
|---|---|---|---|
| [Tool Search](https://mcp.directory/blog/mcp-context-bloat-fix-2026-tool-search-code-mode-progressive-disclosure)（搜索后再加载，`defer_loading:true`） | Anthropic / 2025-11 | 约 **85%**，评测准确率反而升 | ❌ 客户端行为 |
| [Code Mode](https://mcp.directory/blog/mcp-context-bloat-fix-2026-tool-search-code-mode-progressive-disclosure)（大 API 包成 typed SDK + 沙箱） | Cloudflare / 2026-02 | 输入 token 降 **99.9%** | ❌ 产品特性 |
| [Code Execution with MCP](https://mcp.directory/blog/mcp-context-bloat-fix-2026-tool-search-code-mode-progressive-disclosure)（server 暴露为 TS 文件，只回最终结果） | Anthropic / 2025-11 | 降 **98.7%** | ❌ 客户端能力 |

[MCP.Directory 的梳理](https://mcp.directory/blog/mcp-context-bloat-fix-2026-tool-search-code-mode-progressive-disclosure)说得很直白：规范里对懒加载只字未提，客户端连上 server 就调 `tools/list` 拿全量目录拼进 system prompt，上面这些省 token 的手段全是客户端机制，不是协议变更。

所以结论要厘清：新版在 token 效率上是"顺带搭了便车"（核心概念面缩小、server 更轻量），但没从协议根上改。只要客户端不做渐进式披露，token 膨胀照旧。

---

## 五、CLI vs MCP：现在推荐用哪个？

最后聊个更落地的：MCP 和 CLI 到底怎么选。结论先放前面，这俩不是二选一替代，而是按"系统边界"分工的两种接口范式，生产环境大多 hybrid 一起用。

CLI（git / docker / kubectl / gh 这类）被推荐用于**本地、单用户、开发者向**的工具，相对 MCP 的好处很实在：

| 维度 | CLI 的好处 |
|---|---|
| Token 成本 | 不用每请求注入完整工具 schema，实测少 **4–32×** token |
| 模型熟悉度 | git/docker/gh 海量训练语料，模型天生会调 |
| 结构化输出 | `--json` + `jq` 直接拿 |
| 失败信号 | 退出码 + 报错文本，比 schema 错误好自我纠错 |
| 工作流压缩 | 一条命令藏复杂 pipeline，适合探索式迭代 |

[IBM 那篇对比](https://community.ibm.com/community/user/blogs/jia-qi/2026/04/08/mcp-vs-cli)给了一个我挺认同的心智模型：

- **MCP**：从预定义工具集里选，确定性、schema 驱动、一次性正确，"消除不确定性"。
- **CLI**：模型生成命令，靠"猜测→执行→观察→纠正"循环，"管理不确定性"。

不过 [Scale Labs 做过一个受控实验](https://labs.scale.com/blog/mcp-vs-cli)，打破了"CLI 一定更优"的神话——同一套后端工具在 50 个长程任务上 1:1 对比，结论是接口强弱取决于模型和任务，前沿模型基本抹平了差距。还有一条很关键：**别同时把两种接口都暴露给模型指望它自己选**，实验里模型几乎都退回用 MCP，只有显式路由（批量检索走 CLI、精准读写走 MCP）才可靠。

| 用 CLI | 用 MCP | 两者都用（最常见） |
|---|---|---|
| 本地、单用户 | 远程 SaaS、多租户 | 既写代码又跑业务 |
| 有成熟 CLI：git/docker/kubectl/gh | 无 CLI 的企业系统：Salesforce、SAP、Workday | Claude Code、Cursor 这类编码 Agent |
| 认证在本地 | OAuth/API key、需租户隔离 | 工具路由自动选 `gh` 或 MCP |
| 探索式、容错迭代 | 正确性优先、不可试错（支付/审批） | — |

给我的感觉是 CLI 适合个人、而 MCP 更适合企业使用。

