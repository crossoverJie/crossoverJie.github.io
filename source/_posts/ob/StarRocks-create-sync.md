---
title: StarRocks 物化视图创建与刷新全流程解析
date: 2025/06/27 17:34:15
banner_img: https://s2.loli.net/2025/08/15/nla4tJZvHQY9edb.png
index_img: https://s2.loli.net/2025/08/15/nla4tJZvHQY9edb.png
categories:
  - OB
tags:
  - StarRocks
---
最近在为 StarRocks 的物化视图增加[多表达式支持](https://github.com/StarRocks/starrocks/pull/60035)的能力，于是便把物化视图（MV）的创建刷新流程完成的捋了一遍。

之前也写过一篇：[StarRocks 物化视图刷新流程和原理](https://crossoverjie.top/2024/11/18/ob/StarRocks-MV-refresh-Principle/)，主要分析了刷新的流程，以及刷新的条件。

这次从头开始，从 MV 的创建开始来看看 StarRocks 是如何管理物化视图的。

# 创建物化视图

```sql
CREATE
MATERIALIZED VIEW mv_test99
REFRESH ASYNC EVERY(INTERVAL 60 MINUTE)
PARTITION BY p_time
PROPERTIES (
"partition_refresh_number" = "1"
)
AS
select date_trunc("day", a.datekey) as p_time, sum(a.v1) as value
from par_tbl1 a
group by p_time, a.item_id
```

<!--more-->

创建物化视图的时候首先会进入这个函数：`com.starrocks.sql.analyzer.MaterializedViewAnalyzer.MaterializedViewAnalyzerVisitor#visitCreateMaterializedViewStatement`

![](https://s2.loli.net/2025/07/01/UNapLOkBosmY95F.png)

> 其实就是将我们的创建语句结构化为一个 `CreateMaterializedViewStatement` 对象，这个过程是使用 ANTLR 实现的。


这个函数负责对创建物化视图的 SQL 语句进行语义分析、和基本的校验。

比如：
- 分区表达式是否正确
- 基表、数据库这些的格是否正确

![](https://s2.loli.net/2025/07/01/9hXceIt5E6LauAK.png)

> 校验分区分区表达式的各种信息。

然后会进入函数：`com.starrocks.server.LocalMetastore#createMaterializedView()`

这个函数的主要作用如下：

1. **检查数据库和物化视图是否存在**。
2. **初始化物化视图的基本信息**：
   - 获取物化视图的列定义（schema）
   - 验证列定义的合法性
   - 初始化物化视图的属性（如分区信息）。

3. **处理刷新策略**：
   - 根据刷新类型（如 `ASYNC`、`SYNC`、`MANUAL` 或 `INCREMENTAL`）设置刷新方案。
   - 对于异步刷新，设置刷新间隔、开始时间等，并进行参数校验。

4. **创建物化视图对象**：
   - 根据运行模式（存算分离和存算一体）创建不同类型的物化视图对象
   - 设置物化视图的索引、排序键、注释、基础表信息等。

5. **处理分区逻辑**：
   - 如果物化视图是非分区的，创建单一分区并设置相关属性。
   - 如果是分区的，解析分区表达式并生成分区映射关系

6. **绑定存储卷**：
   - 如果物化视图是云原生类型，绑定存储卷。
![](https://s2.loli.net/2025/07/01/8B45JZMejnPmLNG.png)


## 序列化关键数据

对于一些核心数据，比如分区表达式、原始的创建 SQL 等，需要再重启的时候可以再次加载到内存里供后续使用时；

就需要将这些数据序列化到元数据里。

这些数据定期保存在 `fe/meta` 目录中。
![](https://s2.loli.net/2024/09/27/3C4GaXM5BlWmNIw.png)

我们需要序列化的字段需要使用 `@SerializedName`注解。

```java
@SerializedName(value = "partitionExprMaps")  
private Map<ExpressionSerializedObject, ExpressionSerializedObject> serializedPartitionExprMaps;
```

同时在 `com.starrocks.catalog.MaterializedView#gsonPreProcess/gsonPostProcess` 这两个函数中将数据序列化和反序列化。

### 元数据的同步与加载

当 StarRocks 的 FE 集群部署时，会由 leader 的 FE 启动一个 checkpoint 线程，定时扫描当前的元数据是否需要生成一个 `image.${JournalId}` 的文件。

![](https://s2.loli.net/2024/09/20/lQCkBnNWIZ4GwuV.png)
> 其实就是判断当前日志数量是否达到上限（默认是 5w）生成一次。


具体的流程如下：
![](https://s2.loli.net/2024/09/27/zgy6ZaQ7b1ceWkm.png)
![](https://s2.loli.net/2024/09/27/QiTHLpOfJ19oAam.png)

![](https://i.imgur.com/txqTt0U.png)

更多元数据同步和加载流程可以查看我之前的文章：[深入理解 StarRocks 的元数据管理](https://crossoverjie.top/2024/11/11/ob/StarRocks-meta/)
# 刷新物化视图

创建完成后会立即触发一次 MV 的刷新逻辑。
## 同步分区

![](https://s2.loli.net/2025/07/01/RiFufPw3bOa8H9T.png)
刷新 MV 的时候有一个很重要的步骤：**同步 MV 和基表的分区**。

> 这个步骤在每次刷新的时候都会做，只是如果基表分区和 MV 相比没有变化的话就会跳过。


这里我们以常用的 `Range` 分区为例，核心的函数为：`com.starrocks.scheduler.mv.MVPCTRefreshRangePartitioner#syncAddOrDropPartitions`

它的主要作用是同步物化视图的分区，添加、删除分区来保持 MV 的分区与基础表的分区一致；核心流程：

1. **计算分区差异**：根据指定的分区范围，计算物化视图与基础表之间的分区差异。
2. 同步分区：
	1. **删除旧分区**：删除物化视图中与基础表不再匹配的分区。
	2. **添加新分区**：根据计算出的差异，添加新的分区到物化视图。


![](https://s2.loli.net/2025/07/01/oi8tkKVCebH4Q5E.png)


分区同步完成之后就可以计算需要刷新的分区了：
![image.png](https://s2.loli.net/2024/11/14/QljDLmRrx97EIK6.png)

以上内容再结合之前的两篇文章：
- [StarRocks 物化视图刷新流程和原理](https://crossoverjie.top/2024/11/18/ob/StarRocks-MV-refresh-Principle/)
- [深入理解 StarRocks 的元数据管理](https://crossoverjie.top/2024/11/11/ob/StarRocks-meta/)

就可以将整个物化视图的创建与刷新的核心流程掌握了。

#StarRocks #Blog 