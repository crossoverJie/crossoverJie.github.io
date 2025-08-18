---
title: 【译】Apache Pulsar 3.2.0 发布
date: 2024/02/27 10:37:24
categories:
  - 翻译
tags:
- Pulsar
---
[原文链接](https://pulsar.apache.org/blog/2024/02/12/announcing-apache-pulsar-3-2/)

Pulsar3.2.0 于 2024-02-05 发布，提供了一些新特性和修复了一些 bug ，共有 57 位开发者提交了 88 次 commit。

以下是一些关键特性介绍.
<!--more-->
# 速率限制

在 3.2 中对速率限制做了重构：
[PIP-322 Pulsar Rate Limiting Refactoring](https://github.com/apache/pulsar/blob/master/pip/pip-322.md).

速率限制器是 Pulsar 服务质量（Qos）保证的重要渠道，主要解决了以下问题：
- 速率限制器的高 CPU 负载
- 大量的锁竞争会影响 `Netty IO` 线程，从而增加其他 topic 的发送延迟
- 更好的代码封装

# Topic 压缩时会删除 Null-key 消息

Pulsar 支持 [Topic 压缩](https://pulsar.apache.org/docs/3.2.x/concepts-topic-compaction/)，在 3.2 之前的版本中 topic 压缩时会保留 Null key 的消息。

从 3.2.0 开始将会修改默认行为，默认不会保留，这可以减少存储。如果想要恢复以前的策略可以在 broker.conf 中新增配置：
```properties
topicCompactionRetainNullKey=true
```
具体信息请参考：[PIP-318](https://github.com/apache/pulsar/blob/master/pip/pip-318.md).

# WebSocket 的新特性
- 支持多个 topic 消费：[PIP-307](https://github.com/apache/pulsar/blob/master/pip/pip_307.md).
- 端对端加密 [PIP-290](https://github.com/apache/pulsar/blob/master/pip/pip-290.md).

# CLI 的用户体验改进

- [CLI 可以配置内存限制](https://github.com/apache/pulsar/pull/20663)
- [允许通过正则或者是文件批量删除 topic](https://github.com/apache/pulsar/pull/21664)
- [通过 `pulsar-admin clusters list` 可以打印当前使用的 cluster](https://github.com/apache/pulsar/pull/20614)

# 构建系统的改进
3.2.0 中引入了PIP-326: [Bill of Materials(BOM)](https://github.com/apache/pulsar/blob/master/pip/pip-326.md) 来简化依赖管理。

# 参与其中

Pulsar 是发展最快的开源项目之一，被 Apache 基金会评选为参与度前五的项目，社区欢迎对开源、消息系统、streaming 感兴趣的参与贡献🎉，可以通过以下资源与社区保持联系：

- 阅读贡献手册  [Apache Pulsar Contribution Guide](https://pulsar.apache.org/contribute/) 开始你的第一个贡献。
- 访问 [Pulsar GitHub repository](https://github.com/apache/pulsar), 关注 [@apache_pulsar](https://twitter.com/apache_pulsar) 的 Twitter/X , 加入 slack 社区 [Pulsar community on Slack](https://apache-pulsar.slack.com/).

🔗参考链接：
- https://github.com/apache/pulsar/blob/master/pip/pip-318.md
- https://pulsar.apache.org/docs/3.2.x/concepts-topic-compaction/
- https://github.com/apache/pulsar/blob/master/pip/pip-322.md
- https://github.com/apache/pulsar/blob/master/pip/pip_307.md
- https://github.com/apache/pulsar/blob/master/pip/pip-290.md
- https://github.com/apache/pulsar/pull/20663
- https://github.com/apache/pulsar/pull/20614
- https://github.com/apache/pulsar/blob/master/pip/pip-326.md
- https://pulsar.apache.org/contribute/