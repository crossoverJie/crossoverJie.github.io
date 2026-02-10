---
title: 别再傻等了，给 Claude Code 装个通知铃铛
date: 2026/02/09 14:00:00
categories:
  - AI
tags:
  - AI
  - Skills
  - Claude
  - Hooks
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/e61e86a0_cover.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/e61e86a0_cover.png
---
# 背景

最近用 Claude Code、Copilot CLI 这类 AI Agent 工具的时候，有一个挺烦人的问题：让 AI 在后台跑任务，我总是会忍不住去查看他的执行状态，有时候比较复杂的任务可能会耗时十来分钟，每次来回切换非常浪费时间。

更惨的是有时候 AI 需要我授权某个操作（比如执行 shell 命令），我没注意到，它就一直卡在那里等。

所以我一直想找一个靠谱的通知方案。

灵感来源于播客「[枫言枫语](https://justinyan.me/post/6623)」，主播自力提到可以用 Hook 来实现 Agent 通知。

不过一开始我偷了个懒，让 AI 自己给方案。AI 给出的方案很"AI"：在 `~/.claude/CLAUDE.md` 里加一段系统提示词，指示 LLM 任务完成后用 `afplay` 播放一个提示音。

```markdown
## Task Completion Sound
When you complete a task, play a sound:
afplay /System/Library/Sounds/Glass.aiff
```

测试了几次发现这玩意不靠谱——有时候响，有时候不响，完全看 LLM 心情。

最终我还是回到了 Hook 方案，用各平台的 Hooks 系统实现确定性触发，并封装成了一个可复用的 [SKILL](https://github.com/crossoverJie/skills)。

最终的效果如下：

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260210161908.png)





<!--more-->

# 问题分析

为什么 LLM 提示词方案不靠谱？主要三个原因：

1. **LLM 不会 100% 遵循附带操作类指令**：LLM 对"生成文本"以外的操作指令（比如"运行 bash 命令"）本来就不太可靠，它可能觉得当前场景"不需要"播放声音就跳过了
2. **上下文压缩会丢失指令**：长对话中，系统会自动压缩上下文，提示词的优先级会被降低甚至直接丢掉
3. **LLM 对触发时机的判定不一致**：什么算"任务完成"？LLM 每次的理解可能都不一样，导致触发行为不稳定

本质上，这是一个"软提示" vs "硬触发"的问题。用提示词去控制 LLM 行为，就像是"拜托你帮我做一件事"；而用 Hooks 就是"当这个事件发生时，自动执行这段代码"——确定性完全不同。

| 对比项 | 提示词方案 | Hooks 方案 |
|-------|-----------|-----------|
| 触发可靠性 | 不确定，取决于 LLM 判断 | 确定性 100% 触发 |
| 上下文影响 | 长对话会被压缩丢失 | 不受上下文影响 |
| 配置方式 | Markdown 文本 | JSON 配置 + 脚本 |
| 可扩展性 | 基本不可扩展 | 支持多平台、多渠道 |
| 维护成本 | 每次换模型可能要调提示词 | 一次配置，持续生效 |

有点类似于现在的 LLM 和 Agent 的区别，Agent 是干活的，大模型是负责思考的。

确定的事情还是要交给确定的 Agent 去做。
# agent-notifier 介绍

基于以上分析，我开发了 [agent-notifier](https://github.com/crossoverJie/skills/tree/main/skills/agent-notifier) 这个 SKILL，用 Hooks 实现确定性通知。

## 功能概览

支持的 AI Agent 平台：

| 平台 | Hook 机制 | 触发事件 |
|------|----------|---------|
| Claude Code | settings.json hooks | `Notification`（idle_prompt, permission_prompt） |
| GitHub Copilot CLI | hooks.json | `sessionEnd`, `postToolUse` |
| Cursor | hooks.json | `stop`, `afterFileEdit` |
| Codex（OpenAI） | notify setting | `agent-turn-complete` |
| Aider | CLI flag | `--notifications-command` |

支持的通知渠道：

| 渠道 | 默认状态 | 说明 |
|-----|---------|------|
| Sound | 启用 | macOS 用 `afplay`，Linux 用 `paplay`/`aplay` |
| macOS 通知中心 | 启用 | 通过 `osascript` 弹出系统通知 |
| Telegram | 禁用 | 需要 Bot Token + Chat ID |
| Email | 禁用 | SMTP 发送 |
| Slack | 禁用 | Incoming Webhook |
| Discord | 禁用 | Webhook URL |

## 架构设计

核心思路是**统一事件模型 + 并发多渠道分发**：

```
各平台 Hook 触发
       ↓
  stdin JSON 输入（各平台格式不同）
       ↓
  notify.py 解析为统一事件：{platform, event, message}
       ↓
  读取 notify-config.json 配置
       ↓
  ThreadPoolExecutor 并发分发到所有启用的渠道
```

每个平台传过来的 JSON 格式不一样，比如 Claude Code 是 `{"notification_type": "idle_prompt", ...}`，Copilot CLI 是 `{"hook_event_name": "sessionEnd", ...}`。`notify.py` 会把这些不同的格式统一解析成 `{platform, event, message}` 三元组，然后根据配置分发到各个通知渠道。

> 一个关键设计：单个渠道发送失败不影响其他渠道。比如 Telegram 网络超时了，Sound 和 macOS 通知该响还是响。错误信息只输出到 stderr，不会中断流程。

## 核心设计决策：纯标准库、零依赖

整个 `notify.py` 只用了 Python 标准库，没有任何 `pip` 依赖：

- HTTP 请求用 `urllib.request`（发 Telegram、Slack、Discord）
- 邮件用 `smtplib`
- 播放声音用 `subprocess` 调系统命令
- 并发用 `concurrent.futures`

这意味着只要机器上有 Python，拿来就能用，不需要 `pip install` 任何东西。

# 开发过程

整个 SKILL 的开发也是和 AI 对话完成的，下面分阶段回顾。

## 阶段一：核心通知脚本 notify.py

这是最核心的部分，负责三件事：

1. **解析输入**：从 stdin 读取各平台传过来的 JSON，识别平台类型和事件
2. **统一事件模型**：不管哪个平台，统一解析为 `{platform, event, message}`
3. **多渠道发送**：并发调用所有启用的通知渠道

比如 Claude Code 的 Hook 会通过 stdin 传入：

```json
{"notification_type": "idle_prompt", "message": "Claude is waiting for your input"}
```

脚本解析后生成通知：**"✅ Task completed — waiting for your input"**，然后同时发到 Sound、macOS 通知中心、Telegram 等所有启用的渠道。

## 阶段二：配置与安装

光有核心脚本还不够，还需要让用户能方便地配置和安装。所以又搞了两个文件：

**notify-config.json**：配置模板，定义了所有渠道的开关和参数。默认只启用 Sound 和 macOS 通知，Telegram、Email 这些需要手动启用并填入凭据。

**setup.py**：交互式安装脚本，运行后会：
1. 自动检测你装了哪些 AI Agent 平台
2. 引导你配置通知渠道（要不要 Telegram？Bot Token 是什么？）
3. 自动在对应平台写入 Hook 配置
4. 发一条测试通知验证配置

## 阶段三：集成测试

代码写完了，关键是跑起来验证。

首先在 Claude Code 的 `~/.claude/settings.json` 里配置 Hook：

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/skills/agent-notifier/notify.py"
          }
        ]
      }
    ]
  }
}
```

然后手动测试：

```bash
# 模拟任务完成通知
echo '{"notification_type":"idle_prompt","message":"test"}' | python3 notify.py

# 模拟权限请求通知
echo '{"notification_type":"permission_prompt","message":"needs permission"}' | python3 notify.py
```

Sound 和 macOS 通知都正常。接着启用 Telegram，配好 Bot Token 和 Chat ID，再跑一次——Telegram 也收到了消息。

最后让 Claude Code 执行一个真实任务，然后等它跑完。果然，任务结束后 Telegram 弹出通知，Sound 也响了，搞定。

## 阶段四：修 bug 改文案

实际使用中发现一个问题：`idle_prompt` 的通知消息是 "Claude is waiting for your input"，但这个消息不够直观——我更想知道的是"任务完成了"，而不是"在等你输入"。

虽然本质上 `idle_prompt` 就是任务完成后等待输入的信号，但消息文案会影响用户感知。于是改成了：

- `idle_prompt` → **"✅ Task completed — waiting for your input"**
- `permission_prompt` → **"🔐 Permission required"**

改完之后再测，Telegram 消息一目了然，不用再猜它到底是什么状态了。

# 总结

这次开发最核心的观点就一句话：**Hooks > 提示词**。

凡是需要确定性执行的操作，都不应该用提示词去"请求"LLM 来做，而是应该用平台提供的 Hook 机制来保证。提示词适合控制生成内容的风格和方向，但不适合控制"是否执行某个操作"这类二元决策。

另外，对话式开发的体验依然很好。从最初的想法到最终可用的 SKILL，整个过程就是不断对话、测试、修复的循环。像 Telegram 消息文案不够直观这种问题，也是在实测中才发现的。

感兴趣的可以去 [GitHub 仓库](https://github.com/crossoverJie/skills) 看看源码，`agent-notifier` 在 `skills/agent-notifier/` 目录下。


#Blog
