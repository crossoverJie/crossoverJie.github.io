---
title: 从 Warp 换到 cmux：一个更适合 AI Agent 的终端
date: 2026/06/17 17:56:51
categories:
  - AI
tags:
  - AI
  - Terminal
  - cmux
  - Claude
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260617094853.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260617094853.png
---

# 背景

最近将终端从 Warp 切换到了 cmux，用了一段时间后，现在已经基本上满足我的所有需求，所以才有这篇安利的文章。

开始之前先回顾下自己的终端使用历史。刚开始工作那时候使用的是 Windows，用得最多的终端就是 xshell，后面切换到 macOS 之后自然就切换到了 mac 上用的最多的 iTerm2。
<!--more-->

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260617113149.png)

iTerm2 一直是我的主力终端，用了很多年，直到前些年 Warp 的出现。Warp 提供了 block 块、现代的文本编辑器（支持鼠标移动光标），用上之后就离不开它了。

但是随着这些年的迭代，Warp 功能越做越臃肿，加入了一些我完全不需要的 AI 功能。

加上近期频繁使用 Claude Code、Codex、OpenCode 这些 AI Agent，对终端的依赖性变得更高了。

原本我一开始是想自己做一个的——我其实就是想要一个简化版的 Warp，需要包含以下功能：

- Block 功能，特别是查看大量日志的时候非常有用
- 现代的文本编辑器，而不是每次都用方向键来移动光标
- AI Agent 的管理功能
  - Agent 完成时的通知、当前状态的查看
- 终端状态栏：显示当前路径、git status、git diff 等信息

我大概做了一周多的时间，达到了一个基本可用的版本，但很多细节都没做好。

受限于当时选择的技术栈 Tauri + Rust，一些体验上确实比不上 Swift 的原生开发效果。

于是就继续用 Warp，直到后面在社媒上看到了 cmux。

# cmux

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260617094853.png)

这是我目前使用 cmux 的截图。现在使用终端其实 90% 的时间都在和 Agent 打交道。

我会同时开启 N 个 Agent 来干活，其中又会将 Agent 按照业务进行分组，这时就得提到 cmux 的工作区和分屏功能了。

cmux 把结构分成 **Window → Workspace → Pane → Surface → Panel**。也就是说，一个工作区里可以有多个分屏，每个 Pane 里还能有多个 Surface，非常适合把主 Claude Code、测试命令、日志、浏览器、子 Agent 放在同一个 context 里。

而且 cmux 还集成了 Agent 通知——普通终端通知往往只告诉你「有进程需要输入」，但不知道是哪个 Agent、哪个项目、哪个分屏。cmux 的 Pane 会出现蓝色通知环，侧边栏 Tab 会亮起，还支持通知面板和 macOS 桌面通知。

> 通知的问题之前我写过一个 [SKILLS](https://github.com/crossoverJie/skills/blob/main/skills/agent-notifier/SKILL.md) 来解决，现在终端能原生通知就更好用了。

# 总结

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260617150722.png)

如果你是 macOS 用户，还在使用 Warp 甚至是 iTerm2、自带终端的 Coding Agent 重度用户，非常推荐你来试试 [cmux](https://github.com/manaflow-ai/cmux)，一定会有新的发现。
