---
title: 注意：StarRocks 3.5.x 滚动升级触发 MV 全量刷新问题
date: 2026/07/24 08:00:00
categories:
  - StarRocks
tags:
  - StarRocks
banner_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260724112251196.png
index_img: https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260724112251196.png
---
![](https://cdn.jsdelivr.net/gh/crossoverJie/images@main/images/images20260724112251196.png)

# 背景

我们的 StarRocks 集群一直跑在 3.5 分支上，最近发现 [PR #57371](https://github.com/StarRocks/starrocks/pull/57371) 只 backport 到了 3.4，3.5 没收到，导致 MV 从 inactive 切到 active 的时候走的是 `force=true`，也就是全量刷新。

于是我手动把这个修复 cherry-pick 到了我们的 3.5 分支，改掉 `force=true` 的问题之后发了版。发版本身没问题，但发版触发了 FE 滚动重启，重启过程中集群突然被打满——所有分区的物化视图都在对全历史分区做全量刷新。

排查之后发现是三个因素凑到一起：3.5.15 引入的异步 MV reload + 未修复的 `force=true` 激活路径 + 滚动重启时的 Leader 切换。

## 时间线

- **16:01 - 17:01**：FE-2 上的周期刷新一直是 `forceRefresh=false`，只刷当天分区。
- **17:01 后**：FE-2 停止刷新，开始进入滚动重启窗口。
- **17:07:59**：FE-1 上的 `MVActiveChecker` 触发 `ALTER MATERIALIZED VIEW ... ACTIVE`，随后进入 `refreshMaterializedView(..., FORCE=true, ...)`。
- **17:09 - 17:15**：FE-1 持续把 `forceRefresh=true` 传播到后续 batch task，开始刷历史分区。

# 问题在哪

## 异步 MV reload（3.5.15 引入）

FE 重启加载 checkpoint 镜像时，`MaterializedView.onReload()` 先把所有 MV 设为 `active = false`，然后提交异步任务去检查基表可用性，检查通过再恢复 `active`。这个异步检查可能耗时几分钟，这期间 MV 都处于 inactive 状态。

## MVActiveChecker 补刀

`MVActiveChecker` 是一个后台守护线程，默认每 60 秒扫一次，看到 inactive 的 MV 就自动执行 `ALTER MATERIALIZED VIEW xxx ACTIVE`。重启后 grace-period map 是空的，没有任何退避，扫到就激活。

## force=true（3.5 分支的老代码）

`ALTER MATERIALIZED VIEW xxx ACTIVE` 的代码里，激活后会调用 `refreshMaterializedView(..., force=true, ...)`。3.5 分支切出来的时候，社区刚好有一个把 `force` 改为 `false` 的 PR 合入了 main 分支，但 3.5 没收到 backport。

最近社区也发现了这个问题，有客户现场出现了 MV 全量刷新导致数据同步出现延迟，然后才 backport 到 3.5.21 这个版本上。

[PR #76576](https://github.com/StarRocks/starrocks/pull/76576) 的说明里写得很清楚：

> since 3.5.15 the async MV reload on FE restart makes this a serious regression: during image load onReload() sets active = false first and restores it asynchronously, leaving a minutes-long window in which MVs are transiently inactive. MVActiveChecker picks them up and runs ALTER MATERIALIZED VIEW xxx ACTIVE, and the activation path calls refreshMaterializedView(..., force=true, ...) — so every FE leader restart triggers a FORCE full refresh of all async MVs.

所以触发链路是：

```
FE 重启 → async reload 设 active=false → MVActiveChecker 激活 
→ refreshMaterializedView(force=true) → 全量刷新
```

## 滚动重启放大

我们的 K8s 集群有 3 个 FE Pod，滚动更新逐个重启。每次当前 Leader 被重启，就会触发 failover，新 Leader 的 `MVActiveChecker` 再扫一遍所有 inactive 的 MV，又来一波全量刷新。也就是说，只要某一轮切换后的 Leader 还没拿到修复版代码，就可能再刷一波；实际波次数取决于 leader 切换路径和滚动顺序。

## 日志证据

日志里能看到 FE-2 先一直正常周期刷新，`forceRefresh=false`：

```text
2026-07-23 16:01:09  FE-2  forceRefresh=false
2026-07-23 16:16:11  FE-2  forceRefresh=false
2026-07-23 17:01:09  FE-2  forceRefresh=false
```

随后 FE-1 在 17:07:59 接管并触发自动激活：

```text
2026-07-23 17:07:59  MVActiveChecker Start to activate MV dws_trd_period_sales_offline_store
2026-07-23 17:07:59  LocalMetastore.executeRefreshMvTask() FORCE=true
2026-07-23 17:09:24  FE-1  forceRefresh=true
2026-07-23 17:15:54  FE-1  forceRefresh=true
```

这说明滚动重启窗口内，Leader 已经切到了 FE-1，且当时 FE-1 仍在执行未修复的激活逻辑。

## 代码位置

- `fe/fe-core/src/main/java/com/starrocks/scheduler/MVActiveChecker.java`
- `fe/fe-core/src/main/java/com/starrocks/alter/AlterMVJobExecutor.java`
- `fe/fe-core/src/main/java/com/starrocks/server/LocalMetastore.java`
- `fe/fe-core/src/main/java/com/starrocks/scheduler/PartitionBasedMvRefreshProcessor.java`

# 实际影响

我们集群里 MV 会做全历史分区全量刷新，CN 节点 CPU 打满，数据延迟数小时。

# 怎么规避

3.5.21 已经合了上面的 bugfix，`force=true` 改成了 `force=false`。但如果你在升级 **到** 3.5.21 或升级 **后** 还需要做 FE 重启，保险起见可以先关掉 `MVActiveChecker`：

```sql
ADMIN SET FRONTEND CONFIG ("enable_mv_automatic_active_check" = "false");
```

确认生效：

```sql
ADMIN SHOW FRONTEND CONFIG LIKE "%enable_mv_automatic_active_check%";
```

滚动重启全部完成后，确认集群稳定（Leader 不再切换、没有历史分区的刷新任务在跑），再打开：

```sql
ADMIN SET FRONTEND CONFIG ("enable_mv_automatic_active_check" = "true");
```

关闭期间不影响定时刷新和手动刷新，只影响"从 inactive 自动恢复 active"这一种场景，业务无感。

# 总结

这个问题本质上是三个因素碰到了一起：异步 reload 制造了 inactive 窗口、MVActiveChecker 在这个窗口里激活了 MV、激活路径又走的是 `force=true`。3.5.21 修了 `force=true`，但如果之后 FE 重启时异步 reload 还没完成，MVActiveChecker 仍可能先动手；只是刷新会变成增量，不再是全量。

所以升级前后的保险操作是：**先关掉自动激活，等全部 FE 滚动完成且 Leader 稳定后，再重新打开。**

参考链接：

- https://github.com/StarRocks/starrocks/pull/76576
- https://github.com/StarRocks/starrocks/pull/57371

额外再补充一下，现在 DS 感觉降智有点严重，整个问题的分析过程我分别交给了 DS v4 Pro 和 kimi2.7

kimi2.7 很快就定位到是滚动更新导致 leader 切换出现的问题，希望 DS 最近要发布的正式版