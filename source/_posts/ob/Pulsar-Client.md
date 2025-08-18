---
title: 从 Pulsar Client 的原理到它的监控面板
date: 2023/08/03 11:47:52
categories: 
- Pulsar
tags: 
- Metrics
---
![image.png](https://s2.loli.net/2023/08/02/GipDPSlbycQxqFd.png)

#Blog #Pulsar 

# 背景

前段时间业务团队偶尔会碰到一些 Pulsar 使用的问题，比如消息阻塞不消费了、生产者消息发送缓慢等各种问题。

虽然我们有个监控页面可以根据 topic 维度查看他的发送状态，比如速率、流量、消费状态等信息。

<!--more-->

![image.png](https://s2.loli.net/2023/08/02/UNZVawH4QYSu3Ko.png)


但也有几个问题：
- 无法在应用维度查看他所依赖的所有  topic 的各种状态。
- 监控的信息还不够，比如发送/消费延迟、发送/消费失败等数据。

总之就是缺少一个全局的监控视角，通过这些指标可以很方便的分析出当时的运行情况。


基于这个需求经过一段时间的折腾，现在已经上线使用几个月，目前比较稳定，效果图如下：
![image.png](https://s2.loli.net/2023/08/02/byv4RDZnruSjo9h.png)
![image.png](https://s2.loli.net/2023/08/02/TtufOpwHB86PFhK.png)
![image.png](https://s2.loli.net/2023/08/02/d21IaNzbFQpnrkA.png)

现在就可以在每个应用的监控面板里看到自己使用了哪些 topic，分别的生产消费情况如何。


# 核心流程

要实现这些功能就得在应用的 `metrics` 中加入相关的监控信息，但官方的 Java client 是没有暴露出这些指标的。

![image.png](https://s2.loli.net/2023/08/02/DlfkQo1Lmt8J7Iq.png)

> 但 pulsar-client-go 是自带了这些指标的

由于 `SDK` 不支持所以只能自己想办法实现了，为此其实有两种实现方案：
- 魔改 `Java client`，在需要监控的地方手动埋点指标。
- 由于我们使用了 `SkyWalking`，所以可以编写插件，以 `agent` 的方式获取数据、埋点指标。

不过第一种方案有以下一些问题：
- 需要自己维护一个代码分支，还需要定期和官方保持一致，难免会出现代码冲突。
- 需要推动业务方进行依赖升级，线上有着几百个应用，推动起来时间太慢。

第二种方案的好处就不言而喻了：
- 升级无感知，只需要在我们的基础镜像中加上插件即可。
- Java client 的版本也更容易统一。

## Client 原理

但其实不管是哪种方案我们都得熟悉 Java Client 的实现原理，才能知道哪些数据是我们需要重点关注的，可以帮助我们更好的定位问题。

![image.png](https://s2.loli.net/2023/08/02/vweWVR8fkJgrSMI.png)
![image.png](https://s2.loli.net/2023/08/02/S2DNUb768rJRMLm.png)
![image.png](https://s2.loli.net/2023/08/02/8Byvq4LXtACoIg5.png)

> 本文重点不在于此，具体代码就不仔细分析了。

从上图可以看出，如果我们想要监控消费是否存在阻塞的情况，这几个内部队列是需要重点监控的，一旦他们出现堆积，那就会出现消费阻塞。

其实这些数据都可以通过
```java
org.apache.pulsar.client.api.ProducerStats
org.apache.pulsar.client.api.ConsumerStats
```
这两个接口获取到生产者和消费者的大部分指标，只是这里还有一个小插曲。

那就是在获取消费者队列大小的时候，获取到的数据一直为空。

最终经过源码排查，原来是我们大量使用的 `messageListener` 在获取队列大小时有 bug，导致获取到的数据一直都为 0.

相关的 issue 和 PR 可以在这两个链接查看，问题原因和修复过程都有具体描述：
https://github.com/apache/pulsar/issues/20076
https://github.com/apache/pulsar/pull/20245

> 但这个修复得在新版本才能使用，就导致我们现在的监控页面一直显示为空。

# 开发 SkyWalking 插件

然后就是开发一个 `SkyWalking` 的插件了，其实直接使用 SW 开发插件是上手 `Java-Agent` 比较快的方式。

`SW` 的 SDK 封装了许多 `agent` 原生接口，使得开发起来非常容易；当然缺点也有，就是得集成整个 `SW` 的 `agent`。


这里我简单介绍下这个插件的运行流程：
![image.png](https://s2.loli.net/2023/08/02/tW8QSqdU1yZf25A.png)
- 在创建和删除 consumer 的时候维护 consumerPool
- 启动一个定时任务，定期从这些 consumer 中获取指标数据。
![image.png](https://s2.loli.net/2023/08/02/ndhi3yH7CzS9FLA.png)
![image.png](https://s2.loli.net/2023/08/02/WtZNTClh8Y3wj1F.png)

> 当消费多分区 topic 时，为了能唯一标志一个 consumer，所以给每个消费者都加了一个 hashcode 的 label。


因为我们所有的 Java 技术栈都是使用的 `Prometheus` 的包来生成 `metrics` ，所以该插件也是使用该包生成的数据。
```xml
<dependency>  
  <groupId>io.prometheus</groupId>  
  <artifactId>simpleclient</artifactId>  
  <version>0.12.0</version>  
  <scope>provided</scope>  
</dependency>
```

为了兼容一些特殊 Java 应用没有该包时会启动报错，所以在初始化插件的时候需要检测当前 `classpath` 下是否存在该依赖。

![image.png](https://s2.loli.net/2023/08/02/IBwdhH9b1tc8aoE.png)

这些功能 SW 已经封装好了，对我们来说也是开箱即用。

> 其实 SW 插件自己也是支持 metrics 的，由于我们只是使用了它的 trace 功能，所以这里就没有使用它的 API。

关于开发一个 SW 插件的流程也比较简单，可以参考官方文档或者是一些现成的插件源码。
https://skywalking.apache.org/docs/skywalking-java/next/en/setup/service-agent/java-agent/java-plugin-development-guide/

# 总结
有了这个监控面板后，对于 Pulsar 客户端内部的一些运行情况就不再是黑盒了，还可以基于此做一些报警，比如消费堆积、发送延迟过大等。

当然仅仅只有这个面板依然是不够的，后续我们又开发了可以通过 `messageId` 查询它的整个生命周期，包括：
- 生产者、消费者信息
- 消息生产时间
- 推送时间
- ack 时间等

![image.png](https://s2.loli.net/2023/08/02/H7pjinzQ5EWR2tF.png)

同时借助与 Pulsar-SQL 的能力，还能以列表的形式展示当前 topic 的消息列表。
![image.png](https://s2.loli.net/2023/08/02/l9uvSnqAOxfPer7.png)
当然在实现这两个功能的同时也踩了不少坑，提了几个 PR ，后面在抽时间做具体的分享。
