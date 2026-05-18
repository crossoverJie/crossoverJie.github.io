---
title: 手搓一个 Agent 驱动的项目 Wiki 生成方案
date: 2026-05-18
categories:
  - AI
  - 工程实践
tags:
  - AI
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/212beff6_01-cover-cc-generate-wiki.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/212beff6_01-cover-cc-generate-wiki.png
---

# 背景

最近我一直在折腾项目文档生成的事情。之前写过两篇关于 deepwiki 的文章：[deepwiki-rag-principle](https://crossoverjie.top/2025/12/25/AI/deepwiki-rag-principle/) 讲了 RAG 原理，[deepwiki-optimize-line-number](https://crossoverjie.top/2026/03/17/AI/deepwiki-optimize-line-number/) 聊了给代码加行号的优化。

经过几轮迭代，搞了两个优化：
- 代码加上行号前缀
- 基于 Proto 文件生成确定性目录

这两个优化背后其实是同一个思路：**把确定的东西明确告诉 AI，不确定的才让 AI 来发挥**。

| 类型 | 内容 | 处理方式 |
|------|------|----------|
| 确定的 | 代码行号 | 直接给 LLM 标注好 |
| 确定的 | gRPC 接口列表、目录结构 | 代码解析，不经过 LLM |
| 不确定的 | 函数功能解释 | 交给 LLM 归纳 |
| 不确定的 | 项目架构分析 | 交给 LLM 总结 |
| 不确定的 | 代码关联关系 | 交给 LLM 推理 |

LLM 擅长理解、归纳和总结，但精准计算和结构化数据生成这块确实不太行。分开处理，各取所长，效果就好很多了。

这些都是用开源的 deepwiki-open 来做的。

# 问题

虽然最终生成的内容效果还不错，但还有个让人头疼的问题：

> 需要为整个项目生成总结性的内容，比如项目架构、流程图、ER 图等。

这些数据得根据之前已经生成的内容来总结，但 deepwiki 的架构是每个页面独立生成的。而 ER 图这种，我们希望是基于已生成的内容再汇总生成。

在现有架构下实现这个比较困难，索性换个思路。

# 新方案

日常用 Claude Code（后面简称 CC）的时候发现，它可以精准定位到具体业务逻辑所在的代码片段，也能帮我们分析项目、提炼内容。

这不就是个完美的 Wiki 系统吗？直接让 CC 分析项目内容，生成静态页面，就能得到一个精准的 Wiki 了。

CC 也是通过一些内置 tools 来实现精准代码检索的，不需要 deepwiki 那种向量数据库，架构简单很多。

这里简单聊下 CC 的代码搜索原理。传统 RAG 方案会先把代码向量化存入数据库，然后通过语义相似度检索。但 CC 并没有走这条路，而是直接用了一套**工具驱动（Tool-based）**的检索机制：

| 工具 | 功能 | 使用场景 |
|------|------|----------|
| `Read` | 直接读取文件内容 | 已知文件路径时 |
| `Bash(grep)` | 基于正则匹配搜索代码 | 按关键字/符号查找 |
| `Bash(find)` | 遍历文件系统 | 发现文件、按模式筛选 |
| `LSP` | 语言服务器协议导航 | 跳转到定义、查找引用 |
| `Agent` | 子 Agent 并行搜索 | 大规模代码库分治检索 |

这种设计的巧妙之处在于：LLM 不依赖向量化后的"模糊记忆"，而是像人类开发者一样，通过**精确的工具调用**来定位代码。比如要找某个函数定义，CC 可能会先 `grep` 找到候选文件，再用 `Read` 精读确认，最后用 `LSP` 验证引用关系——整个过程是**确定性的、可解释的**。

> 想了解更多细节可以参考 Anthropic 官方文档：[Claude Code Overview](https://docs.anthropic.com/en/docs/claude-code/overview)

后续 repo 有更新，只需要让 CC 读取 git log 变更记录，自动更新修改的内容就行。

![CC Wiki 架构](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260518180243.png)

## 提炼 Skill

考虑内部项目众多，为了让其他项目也能复用这个能力，我把生成静态网站的过程写成了一个 Skill。其他项目只需要在 CC 里调用这个 Skill 即可。

目录结构大概长这样：

```
├── SKILL.md
├── skill.json
├── templates/
│   ├── page-architecture.md
│   ├── page-er.md
│   ├── page-features.md
│   └── page-service.md
└── wiki/
    ├── 01-系统架构.md
    ├── 02-核心功能.md
    ├── 03-ER图.md
    ├── index.html
    └── service/
        └── *.md
```

# 优缺点对比

## deepwiki

**优点：**
- 可以一键生成整个项目，生成过程中不需要人工干预

**缺点：**
- 无法精准调整某个页面
- 对于需要汇总已生成数据的需求，架构无法满足

## Claude Code 方案

**优点：**
- 可以精准调整每一个页面
- 数据可以做到非常精准

**缺点：**
- 无法一键生成结果，需要多轮对话调试
- 如果部署到服务器上，需要外部工具对 CC 进行管理

# 总结

其实这两个方案并不冲突，可以看成不同阶段的选择：

- 项目初期需要快速搭个文档框架 → deepwiki 一键生成
- 项目成熟需要精准可控的文档 → CC 方案慢慢打磨

CC 方案的核心优势在于**可控性**。虽然要多花点时间调试，但生成的内容质量确实更高，特别是涉及到跨文件关联分析的时候。

当然，CC 方案目前还不能完全自动化，这是最大的限制。不过随着 CC 生态的发展，相信后面会有更好的解法。让子弹飞一会。
