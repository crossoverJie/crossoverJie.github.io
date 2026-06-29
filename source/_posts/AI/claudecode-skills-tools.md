---
title: 我的 Claude Code 常用 SKILLS 和工具
date: 2026/06/29
categories:
  - AI
tags:
  - AI
  - Claude
  - Skills
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629162029387.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629162029387.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629162029387.png)

# 背景

已经高强度的使用 claude code 大半年的时间了，积累了不少好用的 SKILLS 和工具，今天来整理一下分享给大家。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629113441276.png)

我安装了大约 70 几个 SKILLS，但常用的其实也不太多，下面介绍一些我个人觉得效果不错的。推荐使用我开发的 [skilldeck](https://github.com/crossoverJie/SkillDeck) 来管理本地的 SKILLS：

```shell
brew tap crossoverJie/skilldeck && brew install --cask skilldeck
xattr -cr /Applications/SkillDeck.app
```

<!--more-->

---

# 常用 SKILLS

## 个人相关

### [agent-notifier](https://github.com/crossoverJie/skills/blob/main/skills/agent-notifier/SKILL.md)

这是我自己做的一个 SKILL，主要用于 Agent 完成任务和等待任务时发出通知。虽然现在一些 terminal 已经支持通知了，比如 [cmux](https://cmux.com/)、[otty](https://otty.sh/)，但是它们都不能推送 IM，后面它们支持之后也就不再需要这个 SKILL 了。

### [kami](https://github.com/tw93/kami)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629160457783.png)


可以用于生成一切页面，包括网页、landing page、简历、PPT 等都可以帮你实现，同时它的 SKILL 编写过程也值得参考。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260628233037.png)
> [skilldeck](https://crossoverjie.top/SkillDeck/) 的项目主页

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260628233137.png)
> 我的独立 [app](https://crossoverjie.top/MeowCareIndex/) 的项目首页

整体来看页面都很和谐，配色属于我的审美。

### [ponytail](https://github.com/DietrichGebert/ponytail)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629160519787.png)


主要就是为了：`懒`，避免 AI 做过度设计、尽量简化代码。

它的核心原则：

1. 这东西真的需要存在吗？推测性的需求 → 跳过 (YAGNI)
2. 代码库里已经有了？复用已有的 helper/util/type
3. 标准库能做？用它
4. 原生平台特性覆盖？`<input type="date">` 胜过 picker 库
5. 已安装的依赖能解决？用它，绝不为几行代码能搞定的事加新依赖
6. 能一行搞定？一行
7. 以上都不行 → 写最小可用代码

三个强度可选：

| 级别 | 行为 |
|------|------|
| lite | 按要求做，但会告诉你更懒的替代方案 |
| full | 强制执行梯子，标准库优先，最短 diff（默认） |
| ultra | YAGNI 极端主义，能删不加，先挑战需求本身 |

什么时候不能懒：

- 信任边界的输入校验
- 防止数据丢失的错误处理
- 安全措施、无障碍基础
- 用户明确要求的功能

### [skilldeck](https://github.com/crossoverJie/SkillDeck/blob/main/skills/skilldeck/SKILL.md)

![259](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629160600529.png)
配合我开发的 skilldeck 可视化 SKILLS 工具使用，可以在 Agent 里管理 SKILLS，同时数据也兼容 skilldeck，这样就也可以使用 skilldeck 的 GUI 能力。

### [web-access](https://github.com/eze-is/web-access)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260629160628014.png)


web-access 是一个联网操作技能，让你能通过 Claude Code 访问和操作网页内容。

核心能力：

| 能力 | 说明 |
|------|------|
| 搜索引擎 | WebSearch 搜索关键词，快速获取摘要和链接 |
| 网页抓取 | WebFetch / curl / Jina 读取已知 URL 的内容 |
| 浏览器 CDP | 直连你的 Chrome/Edge 浏览器，携带登录态操作页面 |
| 本地历史检索 | 搜索你浏览器的书签和历史记录 |

浏览器 CDP 模式是它的亮点，通过 CDP Proxy 直连你日常使用的浏览器，天然携带登录态，无需额外登录。可以：

- 创建新 tab 访问页面
- 执行 JS 读取/操控 DOM
- 点击、滚动、填写表单
- 截图捕获页面/视频帧
- 提取图片、视频等媒体资源

所有操作在后台 tab 进行，不影响你现有的浏览状态。

## 工作相关

### [generate-wiki](https://github.com/crossoverJie/skills/blob/main/skills/generate-grpc-java-wiki/SKILL.md)

这是我在工作中沉淀下来的 SKILL，可以一键将自己的 Java + gRPC 项目生成一个静态 wiki 页面。

> 但要注意，这不是一个通用的方案，最好是 fork 过去根据自己的项目进行定制。

### [starrocks-upgrade](https://github.com/crossoverJie/skills/tree/main/skills/starrocks-upgrade)

我在维护公司内部的 StarRocks 的时候，版本升级时往往拿不准对现有集群的影响，于是有了这个 SKILL。它可以在你升级之前通过源码对比不同版本之间的差异，给出风险点，具体使用过程和原理可以参考[这篇文章](https://crossoverjie.top/2026/06/14/starrocks/StarRocks-upgrade-skill-principle/)。

> 同理，类似的软件版本升级都可以做一个 SKILL 工具。

---

# 常用工具

## TUI

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images57fe7ccd5051c0373b25ca7212749ca9.png)

使用 `/tui fullscreen` 可以开启全屏模式，这样就可以使用鼠标来移动光标了，用起来更像是一个现代的文本编辑器，再也不用键盘方向键来移动光标了。同时也支持选中复制。

`/tui` 命令首次引入版本是 v2.1.110（2026年4月15日），但 fullscreen 渲染模式本身在更早的 v2.1.90 就已经存在了。

版本演进：

| 版本 | 日期 | 内容 |
|------|------|------|
| v2.1.90 | 2026-04-01 | fullscreen scrollback 和 fullscreen mode 修复 |
| v2.1.92 | 2026-04-04 | fullscreen mode 滚动问题修复 |
| v2.1.110 | 2026-04-15 | /tui 命令正式发布 |

`/tui fullscreen` 的特性：

- 无闪烁渲染 (flicker-free)
- 更低内存占用
- 鼠标支持（点击选择菜单，Cmd+点击打开 URL）
- 选中即复制

## statusLine

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260628230309.png)

`statusLine` 是 Claude Code 原生提供的**终端底部自定义状态栏接口**。它不是一个固定样式的功能，而是允许你通过 JSON 传给脚本，脚本把想显示的文本输出到 stdout，Claude Code 再将结果显示在输入框下方、内置 footer 徽章上方。

使用方式很简单，直接输入 `/statusline`，用自然语言描述你想展示什么，例如"显示模型、当前目录、上下文百分比和进度条"。

你的 `statusline.sh` 可以自行组合：模型、当前目录、Git 分支、dirty 状态、上下文百分比、累计成本等。

当然你还可以直接使用 [claude-hud](https://github.com/jarrodwatts/claude-hud)，它是基于 `statusLine` 接口做的现成插件，替你实现并维护一套更完整的 statusLine 脚本和配置。示例：

```
[Opus] │ my-project git:(main*)
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25%
```

还可选展示：

```
◐ Edit: auth.ts | ✓ Read ×3 | ✓ Grep ×2
◐ explore [haiku]: Finding auth code
▸ Fix authentication bug (2/5)
```

除了模型、目录、Git、上下文和额度，它还能从本地 transcript JSONL 中解析出工具活动、运行中的 subagent 与 Todo 进度，有些东西的。

---

# 总结

以上就是我目前常用的 SKILLS 和工具，SKILLS 这块主要分为个人和工作两类。个人相关的主要是提升日常开发体验，比如通知、页面生成、代码简化；工作相关的则更偏向特定场景，比如 wiki 生成、版本升级风险评估。

工具方面，TUI 的全屏模式让 Claude Code 的交互体验提升了一个档次，statusLine 则让终端底部的信息展示更加灵活。这些看似小的改进，用久了真的回不去。

如果你也有好用的 SKILLS 或工具推荐，欢迎交流。
