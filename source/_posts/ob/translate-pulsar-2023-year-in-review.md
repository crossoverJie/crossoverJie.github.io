---
title: 【译】Apache Pulsar 2023 年度回顾
date: 2024/01/26 10:37:24
categories:
  - 翻译
tags:
- Pulsar
---
[原文链接](https://pulsar.apache.org/blog/2024/01/12/pulsar-2023-year-in-review/)
前两天 Pulsar 社区发布了 2023 年年度回顾，去年我也花了一些时间参与社区，所以其中一些内容感受挺明显的，以下就是对一些重点内容的提炼。

<!--more-->

2023 年是一个重要的里程碑，参与[主仓库](https://github.com/apache/pulsar)贡献的开发者达到了 600 位。
自从 Pulsar 从 2018 毕业成为 Apache 顶级项目至今一共又 12K+ 的代码提交次数、639 位贡献者、12.2k star、3.5k fork、10k+ 的 slack 用户。

# 2023 高光时刻
## 第一个 LTS 3.0 里程碑版本
![](https://s2.loli.net/2024/01/26/BRvYSLPOnxoQ614.png)
社区发布 Apache Pulsar 3.0，这是第一个长期支持 （LTS） 版本，从 Pulsar 3.0 开始，可以满足不同用户对稳定性和新功能的需求，同时减轻维护历史版本的负担。

以往的版本发布周期很短，一般是 3～4 个月，为了可以跟上社区新版，往往需要不停的升级，对维护中的负担较大。

今后的维护时间表如上图，以稳定为主的团队可以选择 LTS 版本，追求新功能的团队可以选择 feature 版本。

## 新的官方网站
[https://pulsar.apache.org/](https://pulsar.apache.org/)官方网站得到了新的设计。

## Pulsar Admin Go Library
提供了 Pulsar Admin Go 的客户端，方便 Go 用户管理 Pulsar 资源

## 使用 OTel 增强 Pulsar 的可观测系统
[PIP-264](https://github.com/apache/pulsar/blob/master/pip/pip-264.md) 提案已经获得了社区批准开始开发，它将解决 topic 数量达到 50k~100M 的可观测性问题。
同时 Pulsar 社区已经为 OpenTelemetry 提交了两个特性 [Near-zero memory allocations](https://github.com/open-telemetry/opentelemetry-java/issues/5105) [metric filtering upon collection](https://github.com/open-telemetry/opentelemetry-java/issues/6107) 已经作为了 OpenTelemetry 的规范。


# 主要事件回顾
2023 年，Pulsar 社区在全球范围内举办了一系列活动。
- [Pulsar Summit Europe 2023](https://streamnative.io/blog/pulsar-virtual-summit-europe-2023-key-takeaways)
- [CommunityOverCode Asia 2023](https://pulsar.apache.org/blog/2023/08/28/pulsar-sessions-in-communityovercode-aisa-2023/)
- [CommunityOverCode NA 2023](https://communityovercode.org/past-sessions/community-over-code-na-2023/)
- [Pulsar Summit NA 2023](https://streamnative.io/blog/pulsar-summit-north-america-2023-a-deep-dive-into-the-on-demand-summit-videos)

#  社区成长
没有贡献者社区很难发展，2023年加入了许多新面孔。
- 639 位贡献者
- 13.4k Github star
- 3.5k fork
- 新增 8 位 Committers
- 新增 6 位 PMC
- 10k+ slack 用户
- 20M+ docker pulls

# 项目发布
2023年，社区发布了两个 major version 和 12 个 minor version 版本；最大的里程碑依然是发布了首个 LTS 版本 [Pulsar3.0](https://pulsar.apache.org/blog/2023/05/02/announcing-apache-pulsar-3-0/)。
超过了 140 个贡献者提交了大约 1500 次提交。

同时也带来了一些重要的特性，比如新版本的[负载均衡器](https://github.com/apache/pulsar/issues/16691)，[大规模的延时消息支持](https://github.com/apache/pulsar/issues/16763)。

更新了以下一些客户端：
- [Pulsar C++ Client 3.4.2](https://github.com/apache/pulsar-client-cpp/releases/tag/v3.4.2)
- [Pulsar Go Client 0.11.1](https://github.com/apache/pulsar-client-go/releases/tag/v0.11.1)
- [Pulsar Node.js Client 1.9.0](https://github.com/apache/pulsar-client-node/releases/tag/v1.9.0)
- [Pulsar Python Client 3.3.0](https://github.com/apache/pulsar-client-python/releases/tag/v3.3.0)
- [Pulsar Manager 0.4.0](https://github.com/apache/pulsar-manager/releases/tag/v0.4.0)
- [Pulsar Helm Chart 3.1.0](https://github.com/apache/pulsar-helm-chart/releases/tag/pulsar-3.1.0)
- [Pulsar dotnet Client 3.1.1](https://github.com/apache/pulsar-dotpulsar/blob/master/CHANGELOG.md#311---2023-12-11)
- [Reactive Client for Apache Pulsar 0.1.0](https://github.com/apache/pulsar-client-reactive/releases/tag/v0.5.1)

# 生态系统
2023 年Pulsar 社区也与多个开源项目进行了集成：
- [Quarkus Extension for Apache Pulsar](https://quarkus.io/guides/pulsar)，通过事件驱动在 Quarkus 使用 Pulsar。
- [Spring for Apache Pulsar](https://spring.io/blog/2023/11/21/spring-for-apache-pulsar-1-0-0-goes-ga/) 提供了 PulsarTemplate 用于生产消息，PulsarListener 注解可以方便的消费消息，在 spring 生态下更容易集成 Pulsar
- [Oxia](https://github.com/streamnative/oxia):可以使用 Oxia 提到 zookeeper 从而突破 Pulsar 支持 1M topic 的限制。

# 2024年计划

## OTel
继续推进使用 OpenTelemetry 替换现有的可观测性系统

## 限流重构
[PIP-322 Pulsar Rate Limiting Refactoring](https://github.com/apache/pulsar/blob/master/pip/pip-322.md)限流重构已经被合并，将在 3.2 版本中发布。


## 移除 Pulsar SQL 模块
将 SQL 模块移除后有效的减少了镜像大小以及构建时间。

## 事件
2024 年将会继续举办活动，包括 Pulsar Summit North America 和 Pulsar Summit APAC。[在这里可以查看以往的活动](https://youtube.com/playlist?list=PLqRma1oIkcWhOZ6W-g4D_3JNxJzYnwLNX&si=o6G-fRcNgW9zqHGa)。

🔗参考链接：
- https://youtube.com/playlist?list=PLqRma1oIkcWhOZ6W-g4D_3JNxJzYnwLNX&si=o6G-fRcNgW9zqHGa
- https://github.com/apache/pulsar/wiki/Community-Meetings
- https://pulsar.apache.org/blog/2024/01/12/pulsar-2023-year-in-review/