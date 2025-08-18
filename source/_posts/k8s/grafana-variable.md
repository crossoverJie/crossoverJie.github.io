---
title: Grafana 变量转义处理
date: 2023/06/26 08:08:08 
categories: 
- cloudnative
tags: 
- Grafana
---

Grafana 是一款强大的可视化工具，不止是用于 Prometheus 做数据源，还可以集成数据库、日志等作为数据源整体使用。

最近我在配置一个监控面板，其中的数据由 Prometheus 和 MySQL 组成；简单来说就是一个指标的查询条件是从数据库中来的。

<!--more-->

```
pulsar_subscription_back_log_no_delayed{topic=~"$topic",subscription=~"$subscription"}
```

其中的 topic 数据是从  MySQL 中来的，其实就是在 Grafana 声明一个变量，从数据库返回了一个列表。

![](https://s2.loli.net/2023/06/25/OE37acurFIQjVNH.png)

因为我们的查询条件是 `topic=~"$topic"`是正则匹配，所以理论上应该把所有的 `topic` 关联的数据都查询出来。

![](https://s2.loli.net/2023/06/25/WMetKBAvg24hzZk.png)

但实际情况是任何数据都查不到。

查看发出去的原始请求后才发现问题出在哪里：

![](https://s2.loli.net/2023/06/25/AUXs9lnHoYMQjhO.png)

原来是选择所有 topic 后 grafana 会~~~~自动对参数转义，这个我查了好多资料包括咨询 ChatGPT 都没有得到解决。

经过多次测试，发现只要开启多选 grafana 就会自动转义。
![](https://s2.loli.net/2023/06/25/ao51AysPEeiTQNr.png)

最后我只能想到一个不需要生成多行记录的办法：将所有数据合并成一条记录。

![](https://s2.loli.net/2023/06/25/o7Xaf3NKD1rystn.png)

这样的话就只会生成一条数据，其中包含了所有的 topic，也就避免了被转义。

> SQL 中的 CONCAT 函数其实我也不知道怎么使用，还是 ChatGPT 告诉我的。

![](https://s2.loli.net/2023/06/25/InPYWyiqAL1xRfK.png)

最后便能完美的查询出数据了。

有碰到类似问题的朋友可以尝试这个方法，我估计用到这个场景的并不多，不然 ChatGPT 也不会不知道。

