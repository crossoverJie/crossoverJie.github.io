---
title: 持续剖析超级增强：将 Trace/ Span 和 Profile 整合打通
Date: 2025-11-26 T17:24:00
categories:
  - OB
  - OpenTelemetry
tags:
  - OpenTelemetry
banner_img: https://s2.loli.net/2025/11/25/nPdSi97fwrvZY8M.png
index_img: https://s2.loli.net/2025/11/25/nPdSi97fwrvZY8M.png
---
> 最近在做持续剖析 Profile 与链路系统打通的工作，就查到了 grafana 在 24 年初写的这篇文章；觉得比较有参考意义，在这里分享给大家。


原文链接：[https://grafana.com/blog/2024/02/06/combining-tracing-and-profiling-for-enhanced-observability-introducing-span-profiles/](https://grafana.com/blog/2024/02/06/combining-tracing-and-profiling-for-enhanced-observability-introducing-span-profiles/)


在当今复杂的数据环境中，连续剖析（continuous profiling）已成为获取应用资源使用情况细粒度洞察的关键。Grafana Labs 现通过在 [Grafana 10.3](/blog/2024/01/23/grafana-10.3-release-canvas-panel-updates-multi-stack-data-sources-and-more/) 中引入 Span Profiles 功能，将这工作持续推进。

Span Profiles 代表着剖析方法学上的一次重大转变，它让我们能够对追踪（tracing）和剖析（profiling）数据进行更深入的联合分析。传统的连续剖析是在固定时间区间内提供全局系统视角；相比之下，Span Profiles 可以对应用内部特定执行作用域（execution scope）进行更聚焦的分析，例如单个请求或某个特定的 trace span 分析它的 Profile。

这一转变带来了更精细的性能视角：通过将剖析数据与 trace 直接关联，帮助我们更全面地理解应用行为。由此，工程团队可以更高效地识别并解决性能瓶颈。

![image.png](https://s2.loli.net/2025/11/25/nPdSi97fwrvZY8M.png)

在我们于 Grafana Labs 内部采用这一集成的 “trace-to-profile” 方法的第一个月中，CPU 利用率提升了 4 倍，对对象存储的 API 调用减少了 3 倍，同时还降低了成本（详见下文）——因此，我们非常高兴能向社区推出这一特性！

---

## 与 Grafana Trace 视图集成：无缝体验

借助 Span Profiles，你可以在执行作用域**内部**挖掘具体的性能细节。比如，以前你只知道某个 span 花了 400ms，现在则能进一步了解：在这 400ms 里**具体是哪部分代码**在运行；从而更快的知道性能瓶颈

![image.png](https://s2.loli.net/2025/11/25/cC9VkwNpOSXqd8v.png)

> 使用 Span Profiles 的 flamegraph 截图。

这种有针对性的方式，让你可以比以往更细粒度地剖析性能指标。通过聚焦于单个请求或单个 trace span，Span Profiles 为你提供了一扇直接洞察应用性能关键部分的窗口。

Span Profiles 与 Grafana [trace 视图](/docs/grafana/latest/explore/trace-integration/?pg=blog&plcmt=body-txt/#trace-view) 的集成，为用户带来无缝体验：你可以轻松地从高层级的 trace 概览，切换到对某个具体 trace span 进行深入分析。

引入 Span Profiles 不仅是一次技术上的飞跃，同时也有非常可观的业务和投资回报（ROI）价值。

通过帮助团队更快地识别并解决性能问题，Span Profiles 减少了排障所需的时间和资源投入。这种效率的提升带来显著的成本节约，让 Span Profiles 成为既能优化应用性能，又能降低运维成本的有力工具。

---

## Grafana Labs 内部的真实案例

为了更直观地展示 Span Profiles 的业务价值，下面是我们在 Grafana Labs 内部使用该特性的一个实际案例。

几个月前，[Grafana Pyroscope](/oss/pyroscope/https://grafana.com/oss/pyroscope/) 团队（Pyroscope 是支撑 [Grafana Cloud Profiles](https://grafana.com/products/cloud/profiles-for-continuous-profiling/) 的开源连续剖析数据库）在数据库架构中新增了 [compactor 组件](https://grafana.com/docs/pyroscope/latest/reference-pyroscope-architecture/components/compactor/?pg=blog&plcmt=body-txt)，带来了显著的性能和成本收益。

compactor 会通过合并多个 block 来提升查询性能，并减少长期存储的使用。它在为每个租户将多个 block 压缩成单个优化 block 的过程中扮演关键角色，这不仅降低了存储成本，也加快了查询速度。

![](https://s2.loli.net/2025/11/25/KB2n4rPfl657XdY.png)


> compactor 组件结构图。

然而，压缩过程本身非常复杂——包括竖向压缩、横向压缩以及拆分与合并（split-and-merge）策略等多个阶段——这些都带来了一些挑战，尤其是与性能瓶颈相关的挑战。例如，在密集的压缩操作期间，CPU 和内存使用可能会出现明显峰值，存储 IO 需求也会显著增加，从而可能影响整体系统稳定性。此外，在拥有大量租户的大规模集群中，管理和优化这些大规模压缩任务所需的资源也非常复杂。而这正是 Span Profiles 功能展现其独特优势的地方。

通过对每一次压缩运行进行详细剖析，Span Profiles 能够在 trace 视图中直接提供按函数维度划分的 CPU 使用情况。这种与 trace 视图相结合的细节信息至关重要：它不仅能指出压缩过程的哪个阶段出现了瓶颈，还能告诉你每一次压缩影响到了哪些用户。

![](https://s2.loli.net/2025/11/25/xdWDUFrKRZO3h7q.png)


> 展示不同压缩操作对用户影响的 flamegraph。

例如，我们发现由于符号信息的影响，一级（level 1）压缩是一个主要瓶颈；同时，我们也识别出每次运行中存在过度的 block 同步问题。有了这些数据，我们随之对压缩算法做出了有针对性的调整。**改动带来的效果立竿见影：压缩时间减少了 4 倍，对对象存储的 API 调用量减少了 3 倍。**

![](https://s2.loli.net/2025/11/25/EoS4wz6rinK5aAN.png)

> 对象存储 API 调用量下降的仪表板截图。

如果只看 GET 请求的减少，节省就已经非常可观。以 Google Cloud Storage Class B/GET 的费用来计算，这些调整每月大约节省了 8,000 美元（计算方式为：0.0004 美元/次 GET 请求 \* 每分钟节省 400 次请求 \* 60 分钟 \* 24 小时 \* 31 天）。

Span Profiles 功能为应用剖析翻开了新篇章。通过在特定执行作用域上提供详细洞察，它彻底改变了性能问题的识别与解决方式。

---

## 如何开始使用 Span Profiles

Span Profiles 目前已经在 [Grafana Cloud](/docs/grafana-cloud/?pg=blog&plcmt=body-txt) 和 [Grafana 10.3](/docs/grafana/latest/whatsnew/whats-new-in-v10-3/?pg=blog&plcmt=body-txt) 中提供。想要进一步了解这一特性，你可以参考我们的[技术文档](/docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/#trace-to-profiles)，以及以下入门资源：

- [配置 Pyroscope 以发送剖析数据](/docs/pyroscope/latest/configure-client/?pg=blog&plcmt=body-txt)  
- 配置客户端包以将 trace 与 profile 关联：  
  - [Go](https://github.com/grafana/otel-profiling-go)  
  - [Ruby](https://github.com/grafana/otel-profiling-ruby)  
  - [Java](https://github.com/grafana/otel-profiling-java)  
- [配置 Tempo 以发现已关联的 traces 和 profiles](/docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/?pg=blog&plcmt=body-txt)

更多关于 Span Profile 的具体使用案例会在继续更新。


#Blog 