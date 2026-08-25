---
title: 我做了一个 比 openclaw/workbuddy 更适合自己的用 Agent
date: 2026/08/25
categories:
  - AI
tags:
  - AI
  - Agent
  - botler-agent
  - pi
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825180457245.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825180457245.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825180457245.png)

# 背景

上一篇 [微信零碎记录饮食-交给Agent](https://crossoverjie.top/2026/08/11/AI/%E5%BE%AE%E4%BF%A1%E9%9B%B6%E7%A2%8E%E8%AE%B0%E5%BD%95%E9%A5%AE%E9%A3%9F-%E4%BA%A4%E7%BB%99Agent/) 里提到：CC 的 loop 周期开不久，隔一阵就要重建一个；openclaw、workbuddy 又太重，我那台老 Mac 跑着吃力。所以当时说，后续考虑基于 pi 自己定制一个 Agent。

最近把这事落地了，做了一个轻量的个人 Agent 框架，起名 [botler-agent](https://github.com/crossoverJie/botler-agent)（bot + butler，当数据管家用）。

它的使用效果如下图：
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825164732457.png)

后台页面：
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825164848622.png)

这篇文章就当介绍，顺便说说我在设计上的取舍。

## 它到底是个啥

botler-agent 是一个轻量的个人 Agent 框架：从 Telegram / 飞书 / 微信（iLink）收消息，在数据目录 `DATA_ROOT` 下的各子项目里自主完成短任务，再把结果发回来。另外还有定时任务、本地 WebUI、健康监控这几个可选模块。

整个框架不做任何和业务相关的事情，只干三件事：

- 管好可操作的目录白名单
- 给 Agent 五个工具：read / write / edit / run / schedule
- 写完校验 JSON 合法，有改动自动 git commit（主要是用作数据备份）

具体的业务规则，全部交给每个数据子项目根目录下的 `AGENTS.md` 去描述。Agent 动手之前先读它，读完了才知道这个项目的数据长什么样、该怎么写。

加一个新的数据项目，就是建个目录、写一份 `AGENTS.md`，框架源码一行都不用改；反过来改业务规则，也只需要改那个目录下的 `AGENTS.md`，不用去动框架。框架和业务彻底解耦。

> 框架定「能碰哪儿、能用什么工具」，业务定「具体怎么记」，两边互不干扰。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825165131161.png)

比如我现在运行的有六个项目，分别是拿来记录：
- 车辆维护保养事项
- 饮食记录
- 日常记录
- 财务记账数据
- 我的英语学习数据
- 旅行数据，照片、感受等

可以看的出来这些都是一些非常具体的垂直业务数据，目前这是我高强度使用了一周之后发现需要关心的数据。

我也讲这些 app [开源](https://github.com/crossoverJie/botler-agent-app/)了，可以直接下载使用，也可以贡献自己觉得有用的app。

## 五个工具，没有 bash

很多 Agent 框架一上来就是一大包工具，文件系统、shell、浏览器什么都有。botler 反过来精简下，只给五个：

| 工具 | 能干啥 | 限制 |
|---|---|---|
| read | 读文件 | 只能读白名单目录 |
| write | 写文件 | 保证序列化合法 JSON |
| edit | 改文件 | 只能改白名单目录 |
| run | 跑脚本 | 只限项目内已有的 python3/node 脚本 |
| schedule | 建定时任务 | 只写固定的 schedules.json |

`run` 和 `schedule` 是里面最容易被误会的两个，它们都不是任意 shell。`run` 只能执行已经在项目里的 `.py` / `.js` 脚本，解释器按扩展名固定，参数直传不经过 shell，超时 60 秒。`schedule` 没有文件路径参数，只能写死那一个 `schedules.json`。

这么设计的原因也简单：这东西是要长期挂在我机器上、还接了外部入口的，权限能少给就少给。Agent 万一一本正经地胡说八道，最多也就是把数据目录里的 JSON 写乱，碰不到你的其余私人数据。

## 一次任务怎么跑

```
微信 / 飞书 / Telegram
      │ 消息
      ▼
 Dispatcher（去重 + 串行队列）
      ▼
 Runner（两阶段：路由 → 执行）
      ├─ 路由：判断属于哪个子项目，拿不准就问用户
      ├─ 执行：只拼选中子项目的 AGENTS.md
      └─ 工具 read / write / edit / run / schedule
      ▼
 校验 JSON 合法（失败自愈重试）
      ▼
 git commit（有改动才提交）
      ▼
 回复用户（微信还会发图片）
```

我特别在意的点是省 token。通用助手式的 Agent 往往挂着一大坨 system prompt，跑一次烧一堆。botler 反着来：

- 每条消息都是一个**全新**的短命 Agent，没有跨任务记忆
- 路由阶段只用「项目名 + 摘要」的小提示词，判断这条消息属于哪个子项目
- 执行阶段才把选中的那个子项目的 `AGENTS.md` 拼进 system prompt

所以 `DATA_ROOT` 下有十个项目，跑一条消息也不会把十个项目的约定全塞进去，只加载被选中的那一个。多数任务一次下来，成本只有通用助手的零头。

路由判断不出来的时候，它会回一句「你说的是哪个项目」，让你说清楚，而不是瞎猜一个就写进去。

## 和同类比一比

| | botler-agent | 通用 Agent（OpenClaw / WorkBuddy） | Coding Agent（Claude Code / Codex） |
|---|---|---|---|
| 定位 | 轻量个人数据助手 | 通用任务自动化 | 代码库里的软件工程 |
| 安装体积 | 单个 tsx 进程，秒级安装 | 庞大安装包 | 依赖完整开发环境 |
| 内置工具 | 5 个受控工具 | 大而全 | 完整 shell + 文件系统 |
| 文件操作 | 白名单一级子目录 | 较开放 | 整个工作区 |
| 对机器的权限 | 很克制 | 较开放 | 高度开放 |
| 最擅长 | 日常记录、提醒 | 通用自动化 | 写码、重构、调试 |

OpenClaw、WorkBuddy 这类定位是「啥都能干」，功能复杂、安装包也大，对老机器不友好；CC、Codex 是干活的，但面向桌面、操作你整台电脑。botler 卡在中间，面向手机端的轻量记录，权限要求很低。

还有一类云聊天机器人（豆包、元宝这类），数据都存在它们的云端，是松散的非结构化聊天记录，长期维护、复用都不方便。botler 数据全落本地，你想什么时候整理成结构化数据都行。

想要做成任何的可视化页面也可以。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825173807518.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825173958431.png)


> 当然如果你不需要可视化页面，每次通过聊天获取数据也可以，但不管是哪种方式，原始数据都是结构化储存的，方便维护。


## 安全边界

安全这块我在 README 里单列了一节，挑几个重点：

- 应用和数据分离：框架代码和 `DATA_ROOT` 是两处位置，数据目录里只有被操作的项目，不含源码和密钥。
- 路径白名单：`safePath()` 只放行 `DATA_ROOT` 下的一级子目录，还做了前缀匹配和 realpath，防 `/agent2` 这种目录穿越和符号链接逃逸。
- 配置外置：system prompt、`.env`、providers.json 都放 `~/.botler-agent/`，换机器、换 clone 都能复用。

## 目前能干嘛

我给自己配的数据项目就是那套模板：`cook`（饮食记录）、`daily-log`（日常）、`ledger`（记账）、`travel`（旅行）。之前那篇减脂的链路，理论上能整个搬到 botler 上跑：微信发一句「吃了个馒头」，它自己查表算热量、写进 `intake.json`、commit，再回我一条通知。


![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825174119210.png)


数据更新之后，网页会直接托管到 GitHub，部署成功后会通过 telegram 通知，这样点击链接就可以查看了。

定时任务也能做：跟它说「每天早上八点提醒我喝水」，它用 `schedule` 工具写进 `schedules.json`，到点推回给我，深夜还会自动延后免打扰。

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825174426604.png)

![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260825174409417.png)


# 总结

现在还不算完善，有些东西要接着打磨，但满足我自己日常记录和提醒已经够用了。如果你也想要一个跑在自己机器上、接了微信/飞书、数据落本地的轻量 Agent，可以来 [botler-agent](https://github.com/crossoverJie/botler-agent) 看看。

我自己高强度用了一段时间，确实是能解决我日常的零碎记录，比如很多 app 主打的拍照识别热量、拍照记账、AI（自然语言）记账等需求都可以实现，而且数据是高度可控的，不再担心那些 app 突然哪一天就停止维护了，数据安全也有保证。

更多关于部署、比如飞书、telegram token 如何配置、大模型如何配置等内容可以查看 readme 有具体的说明，有任何疑问和建议也可以私发我消息。


