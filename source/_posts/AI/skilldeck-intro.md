---
title: 全程用 Claude Code 搓了一个 macOS 原生应用：SkillDeck
date: 2026/02/24 23:00:00
categories:
  - AI
tags:
  - AI
  - Skills
  - Claude
  - macOS
  - SwiftUI
banner_img: https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/1aa3d539_cover.png
index_img: https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/1aa3d539_cover.png
---
# 背景

最近在同时用多个 AI coding agent的过程中，Skills 管理起来比较麻烦，

我日常在 Claude Code、Codex、Copilot CLI 之间切换，每个 Agent 的 Skills 存放在不同的目录下（`~/.claude/skills/`、`~/.agents/skills/`、`~/.gemini/skills/`、`~/.copilot/skills/`），安装一个 Skill 的流程大概是这样的：

1. 找到 Skill 的 GitHub 仓库
2. `git clone` 到本地
3. 手动创建 symlink 到对应 Agent 的 Skills 目录
4. 如果要装到多个 Agent，以上步骤重复 N 遍

卸载的时候也一样繁琐：删目录、清 symlink，漏了哪步就会留下残留。

当然也可以用命令行工具安装：

```bash
npx skills add https://github.com/github/awesome-copilot --skill git-commit
```

但这也只是解决了安装的问题，对所有 Agent 的 Skills 缺乏统一的可视化管理——装了哪些 Skill、哪些有更新、哪些该删掉，全靠自己记。

所以作为一个写过多年后端，但完全没碰过 Swift 和前端的人，我决定用 Claude Code 全程手搓一个 macOS 原生桌面应用来解决这个问题——这就是 [SkillDeck](https://github.com/crossoverJie/SkillDeck)。它不仅提供安装能力，还提供了统一的发现、更新、删除等全生命周期管理。

<!--more-->

# 核心功能

## 统一仪表盘

三栏布局的 macOS 原生界面：左边是 Agent 列表和筛选，中间是 Skill 列表，右边是详情。支持按名称、描述、作者搜索，还能按 Agent 过滤和排序。

> symlink 去重是一个比较实用的设计——同一个 Skill 通过 symlink 安装到多个 Agent 时，只会显示一次，不会在列表里看到重复项。

![Dashboard Overview](https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/images20260213123118.png)

## Skills 市场浏览

内置了 [skills.sh](https://skills.sh) 的排行榜浏览，支持 All Time、Trending、Hot 三种排序方式，还有搜索功能。看到喜欢的 Skill 可以直接一键安装，不用再手动 clone 了。

![Registry Browser](https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/images20260224114425.png)

## 安装与更新

从 GitHub 安装只需要输入仓库地址（支持 `owner/repo` 格式），SkillDeck 会自动 clone、扫描可用 Skills、创建 symlink、更新 lock 文件。

更新检测也是一键的：会对比本地和远程的 tree hash，有变更就显示橙色角标，点一下就能拉取最新代码。

![Install & Update](https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/images20260213122805.png)

## SKILL.md 编辑器

分栏设计：左边是表单 + Markdown 编辑区，右边是实时预览。改完 `Cmd+S` 保存，`Esc` 取消。

> 这个功能用的少，但也聊胜于无。

## Agent 分配

每个 Skill 的详情页有一组 toggle 开关，控制这个 Skill 安装到哪些 Agent。打开就自动创建 symlink，关掉就自动删除，不用再手动跑命令了。

这样也不用每个 Agent 都去安装 skill，只保留一份。

## 文件系统监听

SkillDeck 会自动监听 Skills 目录的变化，所以如果你从 CLI 侧做了什么操作（比如用 `claude skills add` 安装了新 Skill），GUI 这边会自动刷新，不需要手动点刷新按钮。

---

目前支持的 Agent 和对应的 Skills 目录：

| Agent | Skills 目录 | 检测方式 |
|-------|------------|---------|
| Claude Code | `~/.claude/skills/` | `claude` 二进制 + `~/.claude/` 目录 |
| Codex | `~/.agents/skills/`（共享） | `codex` 二进制 |
| Gemini CLI | `~/.gemini/skills/` | `gemini` 二进制 + `~/.gemini/` 目录 |
| Copilot CLI | `~/.copilot/skills/` | `gh` 二进制 |

# 开发过程

整个项目从第一行代码到现在，全程都是用 Claude Code 开发的。

我自己的技术背景是 Java/Go/Python，Swift 之前一行都没写过，SwiftUI 和 macOS 平台开发更是零经验。但这次的体验让我感触很深——**AI Coding 真的把跨语言开发的门槛拉低了很多**。

开发节奏基本上就是一个循环：

```
提需求 → AI 实现 → 我测试 → 发现问题 → AI 修复 → 再测试
```

跟之前[用 AI 搓 Skills](https://crossoverjie.top/2026/02/07/AI/create-skills/) 的流程差不多，但这次的复杂度高了不少——毕竟是一个完整的 macOS 桌面应用，涉及 UI 布局、文件系统操作、网络请求、并发处理等等。

我不需要先花几周系统学习 Swift 和 SwiftUI，遇到不懂的语法或 API 直接问 AI 就行。当然，这不代表可以完全当甩手掌柜——你得能看懂代码逻辑、能写清楚需求、能有效测试和反馈问题，AI 才能帮你持续推进。

> 说白了就是：你不需要会写 Swift，但你得会"验收"Swift 代码。能跑起来、功能正确、边界情况覆盖到，这些判断能力还是需要你自己具备的。

# AI Coding 小 Tips

这段时间用 Claude Code 开发积累了一些经验，分享几个我觉得比较实用的 tips。

## 1. 每个功能新开一个 context

不要在一个超长的对话里做所有事情。每个功能开一个新的 context 会更聚焦，AI 不容易被之前的上下文带偏。

完成一个功能后记得 commit，这样如果 AI 后续改错了什么，你可以很方便地回滚到之前的状态。

> 尽量不要使用 AI 来回滚，不然会有不好的事情发生，血的教训。
> 精确的回滚还是交给靠谱的 git 工具来实现。

## 2. 大量 token 总结的内容保存成文档

有时候让 AI 做了一大堆分析（比如梳理项目架构、分析某个复杂模块的实现），这些内容当下可能用不上，但后面很可能会再用到。

我的做法是让 AI 把分析结果整理成文档保存到项目的 memory 目录，下次开新 context 的时候直接加载这个文档，不用重新消耗 token 再分析一遍。

## 3. `claude --resume` 恢复历史会话

如果你中途关掉了某个对话，后面又想继续，可以用 `--resume` 恢复：

```bash
claude --resume "hotkey"
claude --resume "架构"
```

它会搜索历史 session 的内容，列出匹配的会话让你选择。不过搜索不是百分百精准，有时候需要换几个关键词试试。

## 4. Session 保留策略

Claude Code 默认 30 天自动清理历史 session，可以在 `~/.claude/settings.json` 里修改保留时间：

```json
{ "cleanupPeriodDays": 90 }
```

所以 `--resume` 只适合短期内继续某个对话，不适合当作长期知识存储。长期需要保留的内容还是整理成文档更靠谱。


我建议还是使用刚才的方案，将你觉得消耗 token 的结论存储到专门的文档里，后期你需要使用的时候直接加载即可。

而不需要存放到 Claude Code 的系统提示词里，这样可能会浪费 token。

## 5. 用 CLAUDE.md 约束 AI 的开发规范

这个我觉得是最重要的一条。

把开发规范写进 `CLAUDE.md`，AI 每次开新对话都会自动加载这些规则，就像给团队新人定 code review 规范一样。我在项目里定了这些规则：

- **Git 工作流**：代码改动必须新建分支，禁止直接提交到 main
- **测试要求**：每次代码修改都应包含对应的单元测试
- **提交确认**：AI 不能自动 commit/push，必须等我确认
- **PR 规范**：每个 PR 必须包含「Manual Verification Required」（人工验证清单）和「Regression Checklist」（回归测试清单）

> 这里有一个关键区分：**每个项目都通用的规则**（比如分支策略、测试要求），可以放到 `~/.claude/CLAUDE.md`（全局配置），所有项目自动生效，不用每个项目重复写。**项目特有的规范**才放到项目根目录的 `CLAUDE.md` 里。

# 总结

SkillDeck 解决的核心痛点就一个：**让多个 AI Agent 的 Skills 管理更直观易用**。从安装、更新、分配到删除，全部在一个 GUI 里搞定。

全程用 Claude Code 开发这个项目的感受是：跨语言开发的门槛被 AI 大幅拉低了。我一行 Swift 都不会写，但靠着 AI 辅助，从零产出了一个完整的 macOS 原生应用。当然前提是你得有基本的软件工程能力——需求拆解、测试验证、问题排查这些还是得自己来。

项目开源，MIT 协议，欢迎 star/issue/PR：[GitHub](https://github.com/crossoverJie/SkillDeck) | [项目主页](https://crossoverjie.top/SkillDeck/)

安装方式：

```bash
brew tap crossoverJie/skilldeck && brew install --cask skilldeck
```

#Blog
