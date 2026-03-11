---
title: SkillDeck 支持 OpenClaw 了，顺便聊聊小龙虾
date: 2026/03/11 22:00:00
categories:
  - AI
tags:
  - AI
  - Skills
  - OpenClaw
  - SkillDeck
banner_img: https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/51a6a34e_cover.png
index_img: https://jsd.cdn.zzko.cn/gh/crossoverJie/images@main/images/51a6a34e_cover.png
---
# 背景

最近 OpenClaw 突然爆火，我的 [SkillDeck](https://github.com/crossoverJie/SkillDeck) 也乘热打铁支持了 OpenClaw 的 Skills 管理和 ClawHub 市场浏览安装功能。

这篇文章一方面介绍下 SkillDeck [的更新内容](https://github.com/crossoverJie/SkillDeck/releases/tag/v0.0.14)，另一方面也聊聊我对 OpenClaw 这波热度的一些看法。

安装命令：
```shell
brew tap crossoverJie/skilldeck && brew install --cask skilldeck
```
<!--more-->
# 更新日志

## 支持更多 Agent

SkillDeck 现在一共支持了 **10 个** AI coding agent，新增了以下几个：

| Agent | Skills 目录 | 检测方式 |
|-------|------------|---------|
| Antigravity | `~/.gemini/antigravity/skills/` | antigravity 二进制 |
| Cursor | `~/.cursor/skills/` | cursor 二进制 |
| Kiro | `~/.kiro/skills/` | kiro 二进制 |
| CodeBuddy | `~/.codebuddy/skills/` | codebuddy 二进制 |
| OpenClaw | `~/.openclaw/skills/` | openclaw 二进制 |

加上之前就支持的 Claude Code、Codex、Gemini CLI、Copilot CLI、OpenCode，完整列表可以看：[Supported Agents](https://github.com/crossoverJie/SkillDeck#supported-agents)

<!-- 截图占位：SkillDeck 多 Agent 侧边栏截图 -->
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260311110446.png)



## 支持 ClawHub 市场

这次比较大的更新是集成了 [ClawHub](https://github.com/crossoverJie/SkillDeck/pull/27) 市场，可以直接在 SkillDeck 里浏览、搜索、安装 ClawHub 上的 Skills，不需要再手动 clone 或者用命令行装了。

主要功能：
- 侧边栏新增 ClawHub 入口，支持浏览和搜索
- 支持排序和筛选
- 一键安装到 OpenClaw 的 Skills 目录
- 安装时自动创建 symlink，不依赖 `clawhub` CLI

<!-- 截图占位：ClawHub 市场浏览页截图 -->
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260311110402.png)


> ClawHub 有 API 频率限制，如果触发了限流会自动降级为仅安装 SKILL.md 文件的模式，不影响基本使用。

# OpenClaw 爆火背后的

OpenClaw 最近的热度确实夸张，但仔细想想，这波热度背后的推手其实挺有意思的：

1. **自媒体传播焦虑**：每个科技自媒体都怕错过热点，一窝蜂涌上来输出「你还不知道 OpenClaw？」「不会用 OpenClaw 你就要被淘汰了」这类内容，焦虑感拉满。
2. **AI 公司需要卖 token**：OpenClaw 本质上是个疯狂消耗 token 的应用，每一次操作都在调大模型，AI 公司巴不得你 24 小时挂着跑。
3. **云厂商卖服务器**：OpenClaw 需要部署、需要算力，云厂商的推广文章比谁都积极。
4. **甚至苹果还要卖 Mac mini**：当然这是臆想，但你看各种「用 Mac mini 搭建 OpenClaw 私有部署」的教程确实很多。

网友们也是有才，发了不少梗图：

<!-- 梗图占位 -->
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260311110541.png)


<!-- 梗图占位 -->
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260311110554.png)


# 我理解的 OpenClaw

其实 OpenClaw 并不是什么全新的东西，之前昙花一现的豆包手机电脑版就是类似的思路——帮你自动化操作各种 app，本质上还是想解决人类「懒」的问题。

比如：
- 每天自动帮我在某个 app 签到
- 帮我每天写日报
- 自动查询某些网站帮我做信息汇总

这些说白了就是自动化功能，再结合 AI 可以理解我们模糊的语义，让你不用写精确的代码也能完成任务。并不是什么新奇的东西。



但其实很多人压根不知道自己装一个 openclaw 可以解决什么问题，大部分都是带着锤子找钉子，想着这么强一个工具我先装上，后面说不定就能拿来赚钱。

有这类需求的大概率在 openclaw 出现之前就自己写工具或者借助第三方实现了，如果等到现在都没有，那大概率你是没这个需求的。

目前为止 openclaw 最大的问题还是**权限过大**。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images6512d75ea640e5596579e05b0c0c2d41.png)

> 远程让 openclaw 拍照

现在网上已经有很多安全问题的案例了，比如很多人开了公网端口导致自己的电脑直接裸奔，任何人只要拿到了入口就可以让 OpenClaw 把电脑里的文件发出来，甚至拍照、录像都可以。

所以理想的方案还是之前苹果想做的那一套：各个 app 之间通过标准的 AI 可以识别的接口协议进行通信，而不是现在通过模拟点击、执行 shell 命令来绕过所有的权限校验。

只是这条路会影响这些 app 厂商的商业逻辑——用户不需要再打开他的 app 就可以进行消费，采集不到用户数据、用户也看不了广告等。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260311135859.png)

昨天还流行了一下午的`抽象提示词攻击`；在微信电脑版上根本不能直接发红包，也不能输入密码。

至于未来如何这还需要大厂之间继续进行博弈。

# 总结

我们不要过度关注现在 AI 带来的热度，就像去年初爆火的 DeepSeek，在现在养龙虾的热潮下已经没多少人讨论了；我认为到明年小龙虾也没啥人会继续讨论。

我们还是需要透过现象看本质，小龙虾背后依然是一个 AI Agent，和我们现在使用的 Claude Code、Codex 这些没有本质区别；只是它接入了很多 IM 通道，让普通人通过一个聊天窗口就可以指挥大模型去做很多具体的事情，让这个门槛看似降低了很多。

> 现在 Claude Code 已经更新了 loop 模式和 cron 模式，已经可以执行许多循环任务和主动执行任务，和 OpenClaw 更没什么区别了。

而且 OpenClaw 的代码复杂，接入的渠道很多，我们都知道代码量越多系统越复杂理论上出 bug 的几率也越大；所以之前也流行自己去裁剪自己的小龙虾，去掉一些不需要的渠道和代码。

归根结底，工具是拿来用的，不是拿来追的。与其焦虑「我是不是又错过了什么」，不如想想自己到底需要解决什么问题，再选合适的工具。
