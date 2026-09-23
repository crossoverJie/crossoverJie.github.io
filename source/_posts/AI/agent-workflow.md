---
title: 我的 Agent 工作流：终端折腾了一圈，又回到了 Warp
date: 2026/09/23 16:20:05
categories:
  - AI
  - Agent
tags:
  - Blog
  - AI
  - Terminal
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923173350922.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923173350922.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923173350922.png)

# 背景

之前写过几篇关于我用 Agent 的流程和工具的文章，主要是这几篇：

- [AI Coding Agent 时代，我自己最常用的 4 个终端工具](https://crossoverjie.top/2026/06/22/AI/terminal-tools-for-ai-coding-agent/)
- [从 Warp 换到 cmux：一个更适合 AI Agent 的终端](https://crossoverjie.top/2026/06/17/AI/cmux-introduce/)
- [我的 Claude Code 常用 SKILLS 和工具](https://crossoverjie.top/2026/06/29/AI/claudecode-skills-tools/)

这几篇更多讲的是具体的工具，这次我想聊聊终端。我大部分的工作时间都在终端里跟 Agent 打交道，最近又折腾了一轮，中途还换过几次终端。

<!--more-->

---

# 终端

我的终端使用历史大概是这样的：

```text
iTerm2 → Warp → cmux → otty → Warp
```

刚工作那会用 Windows，主力是 xshell，换到 macOS 之后自然就是 iTerm2，用了很多年。后来 Warp 出来，block 和现代文本编辑器用上就回不去了。但 Warp 这些年越迭代越重，还加了一堆我用不上的 AI 功能。

当初因为觉得 Warp 功能重，于是换到了 [cmux](https://cmux.com/) 这个集成了 Agent 通知管理的 terminal。我常同时开 N 个 Agent 干活，谁完成了、谁在等我的响应，它的侧边栏和 pane 上都有提示，具体可以看[那篇介绍](https://crossoverjie.top/2026/06/17/AI/cmux-introduce/)。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923164931464.png)

后面又发现一个类似的 [otty](https://otty.sh/)，是知名的 markdown 编辑器 [typora](https://typora.io/) 团队做的终端。功能和 cmux 几乎类似，但是好处是颜值高很多。颜值确实是第一生产力，于是用了一段时间。

因为我的最终目的是尽量将工作都在终端里完成，所以也配合了一些命令行工具：

| 工具                                                  | 用途              |
| --------------------------------------------------- | --------------- |
| [Yazi](https://github.com/sxyazi/yazi)              | 管理项目，查看和编辑文件    |
| [Lazygit](https://github.com/jesseduffield/lazygit) | 操作 git          |
| [bat](https://github.com/sharkdp/bat)               | 快速查看代码，替代 `cat` |


markdown 文件没有装单独的命令行来查看，这几个终端都支持直接在 terminal 里渲染。一些重的编辑就使用 VSCode。

刚开始使用都没啥问题，后面还是发现了一些痒点。

比如 otty 偶尔会出 bug，毕竟新做的终端，可靠性还是差一点，我就切回 cmux 将就用着。但是依然需要使用一些命令行工具，比如刚才提到的 yazi，由于以前也没养成 Vim 或者 Neovim 的使用习惯，导致用起来很不顺手，大量的操作还是要换到 VSCode 里去实现。

而且 otty 和 cmux 的命令编辑都没有完全做好，比如我非常习惯使用 shift+<-> 剪头来选择文本，然后就可以直接修改命令了。

但是这个功能他们都没有做好，基本属于不可用的状态。

而 Warp 的命令行输入栏真的就和 mac 上任何一个文本输入框一样，非常符合直觉。

后面 [Warp](https://github.com/warpdotdev/warp) 开源后又研究了一段时间 Warp，发现以上的所有功能 Warp 都集成了：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923171406395.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923170819089.png)
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923170857941.png)
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260923171320064.png)


- 左侧可以看到文件导航，点击就可以查看和简单的编辑
- 右上角还可以直接看 git diff
- 甚至可以直接在设置将 Warp 的 AI 关闭，之前我就是觉得这个功能非常影响使用

于是我现在所有的工作基本上都靠 Warp 实现。

# 总结

兜兜转转绕了一圈，终端还是回到了 Warp。

当初换出去是嫌它重，现在换回来，是因为发现自己真正在意的那些能力，文件导航、git diff、顺手的编辑，他都有了，基本上不用再来回切换 App，不用再自己拼一堆命令行工具，稳定性也非常高，很少会触发 bug。

