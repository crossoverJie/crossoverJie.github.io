---
title: 深入理解 StarRocks 的元数据管理
date: 2024/11/11 18:44:37
categories:
  - StarRocks
tags:
- StarRocks
---

# 背景

最近在排查 `starrocks` 线上的一个告警日志：

![](https://s2.loli.net/2024/09/26/QtMIBdmL7OciVJa.png)


每隔一段时间都会打印 `base-table` 也就是物化视图的基表被删除了，但其实表还在，也没人去删除；我们就怀疑是否真的表被删除了（可能是 bug）。

与此同时还有物化视图 inactive 的日志，也怀疑如果视图是 inactive 之后会导致业务使用有问题。

为了确认这个日志是否对使用影响，就得需要搞清楚它出现的原因；于是我就着手从日志打印的地方开始排查。

<!--more-->

# 问题排查

![](https://s2.loli.net/2024/09/26/2T4sGfw1YC63EuP.png)
从这个代码可以看出，是在查询表的信息的时候没有查到，从而导致日志打印 base-table 被 dropped 了。

而我查询了几天的 `drop table` 的日志，依然没有找到可能是程序 bug 导致被删除的痕迹。

> 好在 starrocks 的日志打印非常详细，包含了线程名称、类+方法名称，还有具体的代码函数，很容易就定位日志输出的地方。


## 元数据

只是为何会调用到这里还需要阅读源码从而找到原因，在开始之前需要先了解一下 starrocks 元数据的一些基本概念。

> 其实在这篇文章：[StarRocks 元数据管理及 FE 高可用机制](https://xie.infoq.cn/article/6f2f9f56916f0eb2fdb6b001a)中已经有全面的介绍，只是这篇文章有点早了，和现在最新的代码不太匹配。

在 StarRocks 元数据中会保存 Database、Table 等信息。

这些数据定期保存在 `fe/meta` 目录中。
![](https://s2.loli.net/2024/09/27/3C4GaXM5BlWmNIw.png)

StarRocks 对元数据的每一次操作（增删改查数据库、表、物化视图）都会生成 editLog 的操作日志。

![image.png](https://s2.loli.net/2024/09/27/5hbDBHGwtarE8fj.png)

> 新建数据库、修改表名称等

当 StarRocks 的 FE 集群部署时，会由 leader 的 FE 启动一个 checkpoint 线程，定时扫描当前的元数据是否需要生成一个 `image.${JournalId}` 的文件。

![](https://s2.loli.net/2024/09/20/lQCkBnNWIZ4GwuV.png)
> 其实就是判断当前日志数量是否达到上限（默认是 5w）生成一次。



具体的流程如下：
![](https://s2.loli.net/2024/09/27/zgy6ZaQ7b1ceWkm.png)

- 判断当前是否需要将日志生成 image
- 加载当前 image 里的元数据到内存
- 从 bdb 中读取最新的 Journal，然后进行重放（replay）：其实就是更新刚才加载到内存中的元数据。
- 基于内存中的元数据重新生成一份 image 文件
- 删除历史的 image 文件
- 将生成的 image 文件名称通知 FE 的 follower 节点，让他们下载到本地，从而可以实现 image 同步。

![](https://s2.loli.net/2024/09/27/Hd1NRzgfSy2xECW.png)
![](https://s2.loli.net/2024/09/27/QiTHLpOfJ19oAam.png)

> 通知 follower 下载 image。



## 元数据同步流程

完整的流程图如下图：
![](https://i.imgur.com/txqTt0U.png)

在这个流程图有一个关键 `loadImage` 流程：
![](https://s2.loli.net/2024/09/27/MoWjm8SKsgx2GXh.png)

他会读取 image 这个文件里的数据，然后反序列化后加载到内存里，主要就是恢复数据库和表。

还会对每个表调用一次 `onReload()` 函数，而这个函数会只 MV(`MATERIALIZED VIEWS`) 生效。


这个函数正好就是在文初提到的这个函数 `com.starrocks.catalog.MaterializedView#onReloadImpl`：
![](https://s2.loli.net/2024/09/26/2T4sGfw1YC63EuP.png)

从他的实现来看就是判断视图所依赖的基表是否存在，如果有一个不存在就会将当前基表置为 inactive。

如果碰到视图的基表也是视图，那就递归再 reload 一次。

## 复现问题

既然知晓了这个加载流程，再结合源码应该不难看出这里的问题所在了。

![](https://s2.loli.net/2024/09/27/MoWjm8SKsgx2GXh.png)
从这里的加载数据库可以看出端倪，如果我的视图和基表不在同一个数据库里，此时先加载视图是不是就会出现问题？

加载视图的时候会判断基表是否存在，而此时基表所在的数据库还没加载到内存里，自然就会查询不到从而出现那个日志。

我之前一直在本地模拟，因为都是在同一个数据库里的基表和视图，所以一直不能复现。

只要将基表和视图分开在不同的数据库中，让视图先于数据库前加载就会触发这个日志。
# 修复问题

要修复这个问题也很简单，只要等到所有的数据库都表都加载完毕后再去 reload 物化视图就可以了。

当我回到 main 分支准备着手修改时，发现这个问题已经被修复了：
https://github.com/StarRocks/starrocks/pull/51002

![](https://s2.loli.net/2024/09/27/pzWPnoF2MIji9Kw.png)

修复过程也很简单，就是 reload 时跳过了 MV，等到所有的数据都加载完之后会在 `com.starrocks.server.GlobalStateMgr#postLoadImage` 手动加载 `MV`。

![](https://s2.loli.net/2024/09/27/7JCLyU6umlRnqvE.png)

这个 PR 修复的问题也是我一开始提到的，会打印许多令人误解的日志。

到这里就可以解释文章开头的那个问题了：打印的这个 base-table 被删除的日志对业务来说没有影响，只是一个 bug 导致出现了这个日志。

额外提一句，这个日志也比较迷，没有打印数据库名称，如果有数据库名称的话可能会更快定位到这个问题。

参考文章：
- https://xie.infoq.cn/article/6f2f9f56916f0eb2fdb6b001a
- https://github.com/StarRocks/starrocks/pull/51002