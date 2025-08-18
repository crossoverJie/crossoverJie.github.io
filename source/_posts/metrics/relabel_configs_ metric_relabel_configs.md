---
title: 从源码彻底理解 Prometheus/VictoriaMetrics 中的 relabel_configs/metric_relabel_configs 配置
date: 2023/03/13 08:08:08 
categories: 
- metrics
tags: 
- K8s
- Prometheus
- VictoriaMetrics
---


![](https://s2.loli.net/2023/03/11/Xxp5yNTH1ASBk3Z.png)
# 背景
最近接手维护了公司的指标监控系统，之后踩到坑就没站起来过。。
![](https://s2.loli.net/2023/03/11/UwBJ28ZafziRsQS.png)

<!--more-->

本次问题的起因是我们配置了一些指标的删除策略没有生效：

```yaml
      - action: drop_metrics
        regex: "^envoy_.*|^url\_\_\_\_.*|istio_request_bytes_sum"
```

与这两个容易引起误解的配置`relabel_configs/metric_relabel_configs`有关。

他们都是对抓取的数据进行重命名、过滤、新增、删除等操作，但应用场景却完全不同。

> 我们使用了 VictoriaMetrics 替换了 Prometheus，VM 完全兼容 Prometheus ，所以本文也对 Prometheus 同样适用。


# 理解错误1

![image.png](https://s2.loli.net/2023/03/12/9oYRlCGTZaNuc5j.png)
但这里其实是有一个错误理解的，我是通过 VM 的服务发现页面的指标响应页面查询指标的，打开之后确实能搜到需要被删除的相关指标。

但其实即便是真的删除了数据这个页面也会有数据存在，删除的数据只是不会写入 VM 的时序数据库中。

> 这一点是在后续查源码时才发现；后面我配置对了依然在这里查看数据，发现还是没有删除，这个错误理解浪费了不少时间😂。

# 理解错误2

为了解决问题，通过 `drop metrics` 这类关键字在 VM 的官方文档中查询，最终找到一篇文章。
[https://www.robustperception.io/dropping-metrics-at-scrape-time-with-prometheus/](https://www.robustperception.io/dropping-metrics-at-scrape-time-with-prometheus/)
![](https://s2.loli.net/2023/03/12/oRQKnf7u6j3Ulq5.png)

按照这里的介绍，将删除的配置加入到 `metric_relabel_configs` 配置下，经过测试确实有效。

不过为啥将同样的配置：

```yaml
  relabel_configs:
      - action: drop_metrics
        regex: "^envoy_.*|^url\_\_\_\_.*|istio_request_bytes_sum"
```

加入到 `relabel_configs` 未能生效呢？

估计确实容易令人误导，在文档中也找到了相关的解释：
[https://www.robustperception.io/relabel_configs-vs-metric_relabel_configs/](https://www.robustperception.io/relabel_configs-vs-metric_relabel_configs/)
![](https://s2.loli.net/2023/03/12/xyaqKjkf85YZzeA.png)
这篇文章主要是表达几个重点：
- `relabel_configs` 用于配置哪个目标需要被抓取，发生在指标抓取之前。
- `metric_relabel_configs` 发生在指标抓取之后，写入存储之前。
- 如果其中一个没生效，就换一个（这句话很容易让人犯迷糊）

但说实话当时我看到这里还是一脸懵，为了彻底了解两则的区别还是看源码来的直接。


## 阅读源码理解本质原因

### metric_relabel_configs

```yaml
  metric_relabel_configs:
      - action: drop_metrics
        regex: "^envoy_.*|^url\_\_\_\_.*|istio_request_bytes_sum"
```
首先看下`metric_relabel_configs`配置生效的原因。

![](https://s2.loli.net/2023/03/12/dWA4a3kzGPIxFEX.png)

`metric_relabel_configs` 配置的整体流程如上图：

- 启动 VM 时加载配置到内存
- 根据配置的抓取间隔时间(`scrape_interval`)抓取数据，拿到的每一条数据都需要通过 `metric_relabel_configs` 的应用。
- 针对于这里的 `drop_metrics` 来说，就是判断是否需要删除掉所有的 `Label`。
- 如果可以匹配删除，那就不会写入存储。


其中的关键代码如下：
![](https://s2.loli.net/2023/03/12/ZlIKFDbhLVpx8Om.png)

这里还有一个小细节，源码里判断的 `action` 是 `drop`，而我们配置的是 `drop_metrics`，其实 `drop_metrics` 也是 drop 的一个封装而已。

![](https://s2.loli.net/2023/03/12/2kQ9rSBsJ3IuAwm.png)
在解析配置的时候会进行转换。

与这个写法是等价的：
```yaml
      - source_labels: [ __name__ ]
        regex: "^envoy_.*|^url\_\_\_\_.*|istio_request_bytes_sum"
        action: drop
```

### relabel_configs

然后来看看 `relabel_configs` 没有按照预期生效的原因。

![](https://s2.loli.net/2023/03/12/itlzeXC8DNhpQf4.png)

其实核心的应用配置就是同一份代码，只是触发点不一样。

`relabel_configs` 是在应用启动的时候根据我们配置的抓取目标的数据当做数据源，所以这里的 `action: drop` 删除的是抓取目标，而不是真正的抓取数据。
![](https://s2.loli.net/2023/03/12/qXbwjh5e3uRds4z.png)

而且它的目的是在应用启动的时候，用于生成抓取目标的任务，**只会运行一次**。

假设我这里改写为：

```yaml
  relabel_configs:
      - source_labels: [ __address__ ]
        regex: '192.xx.xx.xx:443'
        action: drop
```
![](https://s2.loli.net/2023/03/12/SfJnMP547ltQohW.png)
那么我这个抓取任务就会被删除掉，而不是删除这个指标了。

因此之前我在这里配置的是一些业务指标 `regex: "^envoy_.*|^url\_\_\_\_.*|istio_request_bytes_sum"`，在所有元数据里自然是没有任何一个可以匹配了，所以也就无事发生。
> 元数据都是以 `__` 开头。

----

其实 VM 也有提供一个 Debug 页面用于调试 `relabel_configs`，但如果知道怎么用这个调试页面其实也理解了他的运行原理😂
![](https://s2.loli.net/2023/03/12/q8KAwpOsBMIEXT3.png)


# 总结

https://www.robustperception.io/relabelling-can-discard-targets-timeseries-and-alerts/ 

![](https://s2.loli.net/2023/03/12/lJsntMyoCruRYi7.png)
后面我查到这篇文章也有相关解释，理解了两者的区别后再看这里的分析会更加容易理解。

总的来说：
- `relabel_configs` 用于对抓取目标元数据的增删改；如果删除后连后续的抓取任务也会被取消。
- `metric_relabel_configs` 用于对抓取到的数据增删改，对于不需要的业务指标可以在这里配置。

也就是前文讲到的 `relabel_configs` 应用于指标抓取前，`metric_relabel_configs` 应用于指标抓取后。
