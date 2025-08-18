---
title: StarRocks 物化视图刷新流程和原理
date: 2024/11/18 22:35:25
categories:
  - StarRocks
tags:
- StarRocks
---

前段时间给 StarRocks 的物化视图新增了一个[特性](https://github.com/StarRocks/starrocks/pull/50926)，那也是我第一次接触 StarRocks，因为完全不熟悉这个数据库，所以很多东西都是从头开始了解概念。

为了能顺利的新增这个特性（具体内容可以见后文），我需要把整个物化视图的流程串联一遍，于是便有了这篇文章。

在开始之前简单了解下物化视图的基本概念：

![image.png](https://s2.loli.net/2024/11/13/TMAjuUsEZGJiFDS.png)

简单来说，视图和 MySQL 这类传统数据库的概念类似，也是用于解决大量消耗性能的 SQL 的，可以提前将这些数据查询好然后放在一张单独的表中，这样再查询的时候性能消耗就比较低了。

<!--more-->

# 刷新条件

为了保证视图数据的实时性，还需要在数据发生变化的时候能够及时刷新视图里的数据，目前有这几个地方会触发视图刷新：
![image.png](https://s2.loli.net/2024/11/13/vJFQBAyfus5ZwIT.png)

- 手动刷新视图，使用 `REFRESH MATERIALIZED VIEW order_mv;` 语句
- 将视图设置为 active 状态：`ALTER MATERIALIZED VIEW order_mv ACTIVE;`
- 基表数据发生变化时触发刷新。
	- ![image.png](https://s2.loli.net/2024/11/13/6QCojHZEJcUL4t2.png)
- truncate 基表时触发刷新：`truncate table trunc_db.t1;` 
- drop partition 时触发：`ALTER TABLE <tbl_name> DROP PARTITION(S) p0, p1 [, ...];`

这里的 truncate table  和 drop partition 目前的版本还存在 bug：当基表和物化视图不在一个数据库时不会触发自动刷新，目前已经修复了。

![image.png](https://s2.loli.net/2024/11/13/2wtZfnFTUbsHaY4.png)

- https://github.com/StarRocks/starrocks/pull/52618
- https://github.com/StarRocks/starrocks/pull/52295

# 刷新流程
![image.png](https://s2.loli.net/2024/11/14/QljDLmRrx97EIK6.png)


如图所示，当触发一次刷新之后主要就是需要计算出需要刷新的分区。

第一次触发刷新的时候是不会带上周期（比如时间范围），然后根据过滤计算出来的周期，默认情况下只会使用第一个周期（我们可以通过 `partition_refresh_number` 参数来调整单次刷新的分区数量）。

![](https://s2.loli.net/2024/11/14/3QFtkXRfvhCdNrS.png)


然后如果还有其余的周期，会将这些周期重新触发一次刷新任务（会带上刚才剩余的周期数据），这样进行递归执行。

![](https://s2.loli.net/2024/11/15/OqjuMl1LNkWh39g.png)

通过日志会看到返回的分区数据。

# 新增优化参数

我们在使用物化视图的时候，碰到一个场景：
```sql
CREATE TABLE IF NOT EXISTS test.par_tbl1
(
    datekey DATETIME,
    k1      INT,
    item_id STRING,
    v2      INT
)PRIMARY KEY (`datekey`,`k1`)
 PARTITION BY date_trunc('day', `datekey`);

 CREATE TABLE IF NOT EXISTS test.par_tbl2
(
    datekey DATETIME,
    k1      INT,
    item_id STRING,
    v2      INT
)PRIMARY KEY (`datekey`,`k1`)
 PARTITION BY date_trunc('day', `datekey`);

 CREATE TABLE IF NOT EXISTS test.par_tbl3
(
    datekey DATETIME,
    k1      INT,
    item_id STRING,
    v2      INT
)
 PRIMARY KEY (`datekey`,`k1`);
```

但我们有三张基表，其中 1 和 2 都是分区表，但是 3 是非分区表。

此时基于他们新建了一个物化视图：

```sql
CREATE
MATERIALIZED VIEW test.mv_test
REFRESH ASYNC
PARTITION BY a_time
PROPERTIES (
"excluded_trigger_tables" = "par_tbl3"
)
AS
select date_trunc("day", a.datekey) as a_time, date_trunc("day", b.datekey) as b_time,date_trunc("day", c.datekey) as c_time
from test.par_tbl1 a
         left join test.par_tbl2 b on a.datekey = b.datekey and a.k1 = b.k1
         left join test.par_tbl3 c on a.k1 = c.k1;
```



当我同时更新了分区表和非分区表的数据时：

```sql
UPDATE `par_tbl1` SET `v2` = 2 WHERE `datekey` = '2024-08-05 01:00:00' AND `k1` = 3;
UPDATE `par_tbl3` SET `item_id` = '3' WHERE `datekey` = '2024-10-01 01:00:00' AND `k1` = 3;
```

预期的结果是只有 `par_tbl1` 表里修改的数据会被同步到视图（`"excluded_trigger_tables" = "par_tbl3"`已经被设置为不会触发视图刷新），但实际情况是 `par_tbl1` 和 `par_tbl2` 表里所有的数据都会被刷新到物化视图中。

我们可以使用这个 SQL 查询无刷视图任务的运行状态：

```sql
SELECT * FROM information_schema.task_runs order by create_time desc;
```

这样就会造成资源损耗，如果这两张基表的数据非常大，本次刷新会非常耗时。

所以我们的需求是在这样的场景下也只刷新修改的数据。

因此我们在新建物化视图的时候新增了一个参数：

```sql
CREATE
MATERIALIZED VIEW test.mv_test
REFRESH ASYNC
PARTITION BY a_time
PROPERTIES (
"excluded_trigger_tables" = "par_tbl3",
"excluded_refresh_tables"="par_tbl3"
)
AS
select date_trunc("day", a.datekey) as a_time, date_trunc("day", b.datekey) as b_time,date_trunc("day", c.datekey) as c_time
from test.par_tbl1 a
         left join test.par_tbl2 b on a.datekey = b.datekey and a.k1 = b.k1
         left join test.par_tbl3 c on a.k1 = c.k1;
```

这样当在刷新数据的时候，会判断 `excluded_refresh_tables` 配置的表是否有发生数据变化，如果有的话则不能将当前计算出来的分区（1,2 两张表的全量数据）全部刷新，而是继续求一个交集，只计算基表发生变化的数据。

这样就可以避免 par_tbl1、par_tbl2 的数据全量刷新，而只刷新修改的数据。

这样的场景通常是在关联的基表中有一张字典表，通常数据量不大，所以也不需要分区的场景。

这样在创建物化视图的时候就可以使用这两个参数 `excluded_trigger_tables，excluded_refresh_tables` 将它排除掉了。

![](https://s2.loli.net/2024/11/15/lrGJEnRgyQDd2Pc.png)


整体的刷新逻辑并不复杂，主要就是几个不同的刷新入口以及刷新过程中计算分区的逻辑。

参考链接：
- https://docs.starrocks.io/zh/docs/using_starrocks/async_mv/Materialized_view/#%E7%90%86%E8%A7%A3-starrocks-%E7%89%A9%E5%8C%96%E8%A7%86%E5%9B%BE
- https://docs.starrocks.io/zh/docs/using_starrocks/async_mv/use_cases/data_modeling_with_materialized_views/#%E5%88%86%E5%8C%BA%E5%BB%BA%E6%A8%A1
- https://github.com/StarRocks/starrocks/pull/52295
- https://github.com/StarRocks/starrocks/pull/52618