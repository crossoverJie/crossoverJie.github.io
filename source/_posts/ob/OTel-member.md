---
title: 一年时间从小白成为 OpenTelemetry Member 有感
date: 2025/04/15 17:40:37
banner_img: https://s2.loli.net/2025/08/15/nwDGebNT9B17QOf.png
index_img: https://s2.loli.net/2025/08/15/nwDGebNT9B17QOf.png
categories:
  - OpenTelemetry
tags:
  - OpenTelemetry
---
![](https://s2.loli.net/2025/04/15/5mCgyLhDGfvXojx.jpg)
![](https://s2.loli.net/2025/04/16/KdHYWrMjm5qXlsw.png)
前段时间申请成为了 OpenTelemetry 的 Member 通过了，算是完成了一个阶段性目标；从 24 年的 2 月份的第一个 issue 到现在刚好一年的时间。

<!--more-->

---

![](https://s2.loli.net/2025/04/15/rVMBdSCNvt4Wu6l.jpg)

这事也挺突然的，源自于年初我发了一个 24 年的年终总结，提到了希望在今年争取成为 Member，然后[谭总](https://github.com/JaredTan95)就提醒我可以自己去申请，只要找到两个 `sponsors` 支持就可以了。

> 我之前不知道这个 Member 是自己申请的，没注意看社区的文档（之前的 `Apache` 社区都是邀请制）。


![](https://s2.loli.net/2025/04/16/LsOdlTzYXP7pUrb.jpg)

于是我提交了相关的 [issue](https://github.com/open-telemetry/community/issues/2642)，列举了自己做的一些贡献（PR 和 issue），也找到了之前经常帮我 review 的[Rao](https://github.com/steverao) 哥作为 sponsor.

不出意外，没等两天就收到了邀请。
# 参与社区


OpenTelemetry 作为和厂商无关的可观测标准，非常开放和包容，也是我参与过的社区最多元的开源项目，几乎每个子项目都有上百人参与，他们都来自于不同的公司和个人，在这样的背景下社区自然就会更佳和谐，很难出现某个公司或者个人主导项目的发，风险自然也会小很多。


![](https://s2.loli.net/2025/04/16/3BzuCehpcf4Ek2j.png)



OTel 的技术栈主要是可以分为下面三个部分：
- 客户端：负责上报可观测数据（Trace、Metrics、Logs）
- OTel collector：处理客户端上报的数据
- 数据存储：存储日志、指标、trace 等数据

以上每个模块都是 OpenTelemetry 非常重要的组成部分，大家可以都挑感兴趣的部分去参与。

作为一个可观测标准，客户端自然就需要支持大部分的技术栈，所以我们常用的语言和技术栈都有对应的实现：
![](https://s2.loli.net/2024/04/16/zWAVoHaZORI83js.png)

这一部分的工作量也非常大，靠个人实现和维护肯定不现实，所以社区非常欢迎大家都来做贡献。

---

![](https://s2.loli.net/2025/04/16/IzJl4feYQoZ1iKH.png)

![](https://s2.loli.net/2025/04/16/gqwplH3s7NGOvnI.png)

拿我常用的 Java 来说目前支持了这些框架和库，但依然没有支持全，我们可以在这里的 [issue](https://github.com/open-telemetry/opentelemetry-java-instrumentation/issues?q=sort%3Aupdated-desc+state%3Aopen+label%3A%22contribution+welcome%22) 列表里找到社区需要大家贡献的内容。

## SIG 小组

社区也准备许多兴趣小组（[SIG](https://github.com/open-telemetry/community#special-interest-groups)）来解决特定领域的问题：
![](https://s2.loli.net/2025/04/16/3yDvJUBHj2KwNnk.png)


![](https://s2.loli.net/2025/04/16/vHGnjZPdtR9yauI.png)

大家也可以订阅日历参与周会，基本上每个兴趣小组都会定期组织，拿 Java 的来说就是每周四的 UTC+8 的早上九点都会举行。



![](https://s2.loli.net/2025/04/15/EvgYrcqA36mwf8e.png)
![](https://s2.loli.net/2025/04/15/pxw6dDBaZLW4hRc.png)

之前参加过两次，都是 zoom 的线上会议（老外的习惯是开摄像头），如果自己口语尚可的话和社区主要的 maintainer 直接沟通效率会高很多。

当然如果不能开口的话， zoom 也是实时字幕的功能，理解起来问题也不是很大。


![](https://s2.loli.net/2025/04/16/pSDJUFRe6fwy4ct.png)

如果以可以成为 Member 的角度，目前我看了一些申请，提交了两个或以上的 PR 应该都可以申请通过，前提是线下提前和你找的 sponsor 达成一致就可以了。

> 带着这个目的也挺好的，做开源项目往往就是靠爱发电，有这个 Member 的身份也可以作为正向激励，鼓励继续参与。


# 总结
当然成为 Member 只是第一步，随着社区参与的深入度后面还有[其他的角色](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#membership-levels)：
![](https://s2.loli.net/2025/04/16/ebtp5I9wByNYmkd.png)

比如 triager 可以分配 issue、approver 可以批准代码、maintainer 就是某个模块的具体负责人了，后面就再接再厉吧。