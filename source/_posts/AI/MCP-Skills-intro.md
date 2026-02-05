---
title: 从 Function Call 到 MCP-> SKILLS：AI Agent 能力扩展的演进之路
date: 2026/02/03 17:56:51
categories:
  - AI
tags:
  - AI
  - MCP
  - Claude
banner_img: https://s2.loli.net/2026/02/04/C3D8KlakTS91sMG.png
index_img: https://s2.loli.net/2026/02/04/C3D8KlakTS91sMG.png
---
# 背景

最近 Claude 的 SKILLS 很火，忍不住也来体验了一下，发现确实是有些东西的；但也发现身边的一些同事对这些新出的概念总是很懵逼，所以便有了这篇文章。

从最早的 Function Call，到 MCP 协议，再到如今的 Agent Skills。

本文将从技术演进的角度，带你理解这些概念之间的关系，以及它们如何让 AI 从一个"只会说话的聊天机器人"变成真正能"动手做事"的智能助手。

<!--more-->


再开始之前还是要澄清下大模型和 Agent 的关系，今天刷到一个[视频](<【【闪客】名词诈骗！一口气拆穿Skill/MCP/RAG/Agent/OpenClaw底层逻辑】 【精准空降到 00:13】 https://www.bilibili.com/video/BV1ojfDBSEPv/?share_source=copy_web&vd_source=358858ab808efe832b0dda9dbc4701da&t=13>)觉得讲的非常浅显易懂：

所谓智能体就是把非智能的部分整合在一起，也就是说大模型帮我们做模糊自然语言的理解与决策，然后然后交给 agent 去调用一些非智能化的能力，比如：
- 把 word 转换成 PDF
- 编译运行代码
- 调用飞书的推送接口，把一些内容推送给你的机器人。
> 这些能力可能是需要编码完成的，也可能是第三方提供的 API，不管是哪种都是一些确定的东西。

让大模型摆脱了只能在网页里做一个 chatbot，从而进化到可以真正干具体事情的能力（以往我们需要手动去复制大模型给的代码到本地进行编译运行，这些重复机械的步骤直接交给 agent 来运行）

比如现在流行的 claude code 他可以帮你修改代码，直接运行代码获取结果，充当你和大模型沟通的桥梁。

而最近大火的 [openclaw](https://github.com/openclaw/openclaw/) 本质上也是一个 agent，只是相比于 claude code 多了 gui 界面，对接更多的工具（各种 IM），本质上他们没有任何区别。
# 发展历史

## Function Call：让大模型学会"使用工具"

在 Function Call 出现之前，大模型只能做一件事：**生成文本**。你问它天气，它只能根据训练数据猜测；你让它查数据库，它只能编造一个"看起来合理"的答案。

2023 年，OpenAI 发布了 [Function Calling](https://platform.openai.com/docs/guides/function-calling) 功能，这是大模型能力扩展的第一个里程碑。

**核心思路**：告诉大模型"你有哪些工具可以用"，当它判断需要使用工具时，输出一个结构化的 JSON 调用请求，由外部程序执行后再把结果返回给模型。

```json
{
  "name": "get_weather",
  "arguments": {
    "location": "北京",
    "unit": "celsius"
  }
}
```

**局限性**：
- 每个应用都要自己定义和实现工具
- 工具之间没有统一标准，无法复用
- 工具定义需要全部放在 System Prompt 里，token 消耗大

## MCP：建立统一的"工具接口标准"

2024 年，Anthropic 发布了 **[MCP (Model Context Protocol)](https://www.anthropic.com/news/model-context-protocol)**，可以把它理解为 AI 工具的 RPC 协议。

**解决的核心问题**：让不同开发者写的工具，AI 都能听得懂、用得上。

| 对比维度 | Function Call | MCP |
|---------|--------------|-----|
| 定义方式 | 每个应用自己定义 | 统一协议标准 |
| 工具发现 | 静态配置 | 动态发现 |
| 生态复用 | 难以复用 | 一次开发，处处可用 |
| 跨模型支持 | 绑定特定模型 | 开放标准，多模型支持 |

**MCP 的工作流程**：

```
MCP Client (Claude)                MCP Server (如数据库读取器)
     │                                  │
     │  1. 连接并发送 list_tools        │
     │ ──────────────────────────────▶  │
     │                                  │
     │  2. 返回工具列表                 │
     │  (query_db, search_files...)     │
     │ ◀──────────────────────────────  │
     │                                  │
     │  3. 用户提问，Claude 决定调用    │
     │     call_tool: query_db          │
     │ ──────────────────────────────▶  │
     │                                  │ ← 执行 SQL 查询
     │  4. 返回执行结果                 │
     │ ◀──────────────────────────────  │
     │                                  │
     ▼
Claude 整合结果，组织成回答
```

## Agent Skills：从"工具"到"技能包"

2025 年 10 月，Anthropic 发布了 **[Agent Skills](https://www.anthropic.com/news/skills)**，这是在 MCP 基础上的进一步抽象。

**时间线**：

| 时间          | 事件                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| 2025年10月9日  | [Anthropic 发布 Plugins 系统](https://www.anthropic.com/news/claude-code-plugins)                                        |
| 2025年10月16日 | [Anthropic 发布 Agent Skills](https://www.anthropic.com/news/skills)                                                   |
| 2025年10月16日 | [Agent Skills 作为开放标准发布](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) |


**Skills 是什么**：
> "Skills are organized folders of instructions, scripts, and resources that agents can discover and load dynamically to perform better at specific tasks."

可以把 Skills 理解为"分类后的系统提示词"，但它比传统的 System Prompt 更智能——**按需加载，而不是全量加载**。

| 维度 | 传统系统提示词 | Agent Skills |
|------|--------------|-------------|
| 加载方式 | 全量加载：每次对话都要发一遍 | 按需调用：只加载需要的技能 |
| Token 消耗 | 高：Prompt 长度随功能增多而爆炸 | 低：结合 Prompt Caching 降低成本 |
| 复杂度上限 | 低：Prompt 太长会"注意力失焦" | 高：每个技能独立，互不干扰 |
| 执行能力 | 仅限"说话" | 可关联 Tool Use，真正执行操作 |

**Skills 的本质：提示词工程的进化**

说到底，Skills 的本质还是前几年流行的**提示词工程（Prompt Engineering）**。

回想一下 2023 年 ChatGPT 刚火的时候，网上到处都是"万能提示词模板"、"让 AI 效率翻倍的 prompt 技巧"。那时候大家都在研究怎么写出更好的 System Prompt，让 AI 扮演各种角色：翻译官、程序员、文案专家...

Skills 做的事情本质上没变——**还是在告诉 AI "你是谁、你能做什么、你应该怎么做"**。


说的更好理解一点：可以把自己日常的一些固定流程固化为一个 SKILLS，比如我写博客需要为一篇文章配一个封面图，我之前的流程是：
- 写好文章后根据文章的内容想一个标题
- 根据这个标题去网上照一张合适的图
- 把图片上传到图床
- 然后把图床链接贴到博客的顶部
  
这些流程其实都是机械化的毫无智能而言，但是每次做法都是一样的；所以我将这些流程写到一个 SKILL.md 文档里。

让 AI 给我总结文章标题、生成配图、上传图床、然后粘贴到文章顶部。

这样我写好文章后，只需要对 Claude Code/Codex 这类 agent 说：把 /xx/xx/blog.md 配图。

之后 AI 就会自动加载我在 `SKILL.md` 里定义的流程进行处理。

同理，我们日常工作中这些繁琐的流程都可以抽象为一个个的 `SKILL`，想想是不是可玩性非常强。

区别在于：
- **以前**：把所有提示词塞进一个巨大的 System Prompt，不管用不用得上都要带着
- **现在**：把提示词拆分成独立的 Skill 文件，AI 自己判断什么时候需要加载哪个

所以如果你之前积累了很多好用的提示词模板，现在可以直接把它们改造成 Skills——加上 frontmatter 元数据，放到 `~/.claude/skills/` 目录下，就能让 Claude 按需调用了。


# 现状

## Skills 与 MCP 的关系

用一个类比来说明：
- **MCP是 RPC 接口协议"**
- **Skills 是"接口实现里的一个个具体的函数（函数的抽象级别需要定义好，不然维护性也不强）"**

它们不是互相替代的关系，而是"协议"与"实现"的关系。一个 "GitHub Skill" 内部就是通过 MCP 协议去和 GitHub 服务器通讯的。

## Skills 的两阶段加载机制

这是 Skills 设计中很精妙的部分——**不会导致 token 激增**。

| 阶段 | 加载内容 | Token 消耗 |
|------|---------|-----------|
| 启动时 | 只加载元数据（name + description） | ~30-100 tokens/skill |
| 匹配后 | 加载完整 skill 内容 | 视 skill 大小而定 |

**工作原理**：

```
用户请求 → Claude 匹配 skill descriptions → 只注入相关 skill 的完整内容
```

以 Obsidian skills 为例：
- **启动时**：只加载 `obsidian-markdown`、`obsidian-bases` 的 name 和 description（约 100-300 tokens）
- **当你说** "帮我创建一个 Obsidian 笔记"：才加载 `obsidian-markdown` 的完整内容
- **如果不涉及 Obsidian**：完整内容永远不会加载

## 匹配逻辑：完全由大模型决定

这里我其实有一个问题：谁来判断是否需要加载某个 Skill？

**答案是：完全由大模型决定，不是客户端**。

任何需要做模糊语义判断的地方都是大模型来处理、Agent 只做具体确定的事情。

```
Claude Code 客户端                    大模型
     │                                  │
     │  所有 skills 元数据              │
     │  (name + description)            │
     │ ──────────────────────────────▶  │
     │                                  │ ← 模型阅读、理解、判断
     │                                  │
     │  调用 Skill 工具                 │
     │ ◀──────────────────────────────  │
     │                                  │
     │  注入完整 SKILL.md 内容          │
     │ ──────────────────────────────▶  │
```

客户端做的事：收集元数据、打包发送、执行工具调用。

客户端**不做**的事：没有关键词匹配、没有正则、没有向量嵌入、没有意图分类器。

> 客户端做的越轻越能体现 AI 的特点，也跟通用。

由于完全依赖模型判断，存在不可靠性。skills 有可能没有被自动激活，模型会直接跳过它们，这就是大模型的概率问题，如果确定要使用某个 SKILL，可以用一下方案：
1. 直接使用 /skill-name 强制使用
2. 关键规则放在 **CLAUDE.md** 中（始终在上下文里）
3. 设置 `disable-model-invocation: true` 改为手动调用

## Skills 的安装方式

目前有两种安装方式：

| 特性   | `/plugin` 命令安装                                  | 手动复制到 `~/.claude/skills` |
| ---- | ----------------------------------------------- | ------------------------ |
| 版本追踪 | 有                                               | 无                        |
| 自动更新 | `/plugin update`                                | 手动                       |
| 来源记录 | 有                                               | 无                        |
| 适用场景 | 第三方/远程 skill                                    | 本地开发/简单使用                |
| 开放标准 | Claude Code 专属（但一些其他 agent 也兼容读取了 cc 的目录来实现兼容性） | Agent Skills 标准实现        |

`~/.claude/skills` 目录是 Agent Skills 开放标准的本地实现。Agent Skills 已发布为开放标准（[agentskills.io](https://agentskills.io)），不仅 Claude Code 支持，OpenAI Codex CLI 等其他工具也可以使用。

## Skills 的存储层级

Skills 的存储架构类似于 Java 生态中的依赖管理体系，分为三个层级：

```
┌─────────────────────────────────────────────────────────────────┐
│                    公共云端层 (Public Hub)                        │
│         类似 Maven Central / npm registry                        │
│         未来可能的 Anthropic Skills Hub                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    企业私服层 (Enterprise Hub)                    │
│         类似 Nexus 私服 / npm private registry                   │
│         公司内部的 MCP Server，统一管理员工通用技能                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    本地层 (Local)                                 │
│         类似本地 .m2 目录 / node_modules                          │
│         ~/.claude/skills/ 或项目内 .claude/skills/               │
└─────────────────────────────────────────────────────────────────┘
```

| 层级 | 类比 Java 生态 | Skills 对应 | 适用场景 |
|------|--------------|------------|---------|
| 本地层 | `~/.m2/repository` | `~/.claude/skills/` | 个人开发的私有 Skills、本地调试 |
| 企业私服层 | Nexus/Artifactory 私服 | 企业 MCP Hub | 公司内部通用 Skills，如审批流、内部系统对接 |
| 公共云端层 | Maven Central | 未来的 Skills Hub | 社区贡献的通用 Skills，如 GitHub、Slack 集成 |

**查找优先级**：与 Maven 依赖解析类似，Skills 也遵循"就近原则"——本地 > 企业私服 > 公共 Hub。当同名 Skill 存在于多个层级时，优先使用本地版本。

# 未来

## 三阶段演进

基于当前的发展趋势，我认为 AI Agent 的能力扩展可能会经历三个阶段：

### 第一阶段：手动时代（现在）
用户需要手动配置 MCP Server、安装 Skills，感知强烈，门槛高。

### 第二阶段：发现时代（近未来）
通过 MCP 自动发现。可能会出现类似 npm 或 Docker Hub 的 **Skill Registry**：
- 配置文件里写：`"skills": ["@github/search", "@linear/issue-manager"]`
- 启动时自动去地址获取 SKILLS，通过 MCP 协议下载技能定义
- 用户知道 AI 有这些能力，但不需要管背后代码

### 第三阶段：隐形时代（终极目标）
这是最值得期待的阶段：**Skills 彻底消失，变成大模型的"潜意识"**。

1. **海量技能池**：云端存在数百万个 MCP 服务
2. **意图识别与自动路由**：Claude 自动分析任务并拆解步骤
3. **即时加载**：毫秒级自动调用对应 Skill，无需用户干预

**未来的 AI 就像"电力"**：100 年前你需要了解发电机的原理；现在你只需要插上插头。未来的大模型也会进化到——你只要说出需求，它会自动在后台调动千千万万个你从未听说过的"Skills"去帮你达成。

## 安全与信任

当 Skills 变得越来越自动化，安全问题会变得尤为重要：

| 层级 | 存储位置 | 适用场景 |
|------|---------|---------|
| 本地/私有层 | 本地电脑或公司内网 | 敏感业务逻辑、本地硬件交互 |
| 企业中台层 | 公司 MCP Hub | 统一管理员工通用技能 |
| 公共云端层 | 类似 App Store | 第三方开发者贡献的通用 Skills |

公共仓库里的 Skill 需要经过：权限声明、运行时沙箱、代码审计与签名。这需要一个有信用背书的大厂（如 Anthropic，Google 等）来提供官方的审核与分发平台。

# 总结

从 Function Call 到 MCP 再到 Agent Skills，AI 能力扩展的演进遵循着一个清晰的流程：

1. **Function Call**：让大模型学会使用工具，但每个应用各自为战
2. **MCP**：建立统一的工具接口标准，实现生态复用
3. **Agent Skills**：在 MCP 基础上进一步抽象，实现按需加载、token 优化

这个演进过程的本质是：**让 AI 从一个"什么都懂一点但包袱很重"的聊天机器人，变成一个可以根据任务场景，随时调用不同工具来实现需求的关键，比如最近大热的 [OpenClaw](https://github.com/openclaw/openclaw/) **

随着大模型的持续进步，这些基础设施最终会变得"隐形"——用户不再需要知道 Skills 的存在，只需要表达意图，AI 就能自动调用合适的能力来完成任务。

这才是 AI Agent 的终极形态。


最后接着写这篇文章的过程，我也编写了几个 [SKILLS](https://github.com/crossoverJie/skills)可以用于我在写文章的过程中自动生成文章的封面然后上传到图床。

有类似需求的朋友可以试用下。

> 当然这个 SKILLS 也是一行代码没写，全部交给 AI 生成的，感兴趣的再下一篇分享下相关流程。


#Blog
