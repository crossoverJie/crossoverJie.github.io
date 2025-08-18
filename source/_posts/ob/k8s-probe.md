---
title: k8s入门到实战-应用探针
date: 2023/11/25 23:20:13
categories:
  - OB
tags:
---
![Probe.png](https://s2.loli.net/2023/11/26/5uwvC1TrsjMYDZF.png)

今天进入 `kubernetes` 的运维部分（并不是运维 `kubernetes`，而是运维应用），其实日常我们大部分使用 `kubernetes` 的功能就是以往运维的工作，现在云原生将运维和研发关系变得更紧密了。
<!--more-->

今天主要讲解 `Probe` 探针相关的功能，探针最实用的功能就是可以控制应用优雅上线。

# 就绪探针
举个例子，当我们的 service 关联了多个 Pod 的时候，其中一个 Pod 正在重启但还没达到可以对外提供服务的状态，这时候如果有流量进入。

那这个请求肯定就会出现异常，从而导致问题，所以我们需要一个和 `kubernetes` 沟通的渠道，告诉它什么时候可以将流量放进来。
![image.png](https://s2.loli.net/2023/11/26/StHngQR4K9vCxjf.png)
比如如图所示的情况，红色 `Pod` 在未就绪的时候就不会有流量。

使用就绪探针就可以达到类似的效果：
```yaml
readinessProbe:  
  failureThreshold: 3  
  httpGet:  
    path: /ping  
    port: 8081  
    scheme: HTTP  
  periodSeconds: 3  
  successThreshold: 1  
  timeoutSeconds: 1
```
这个配置也很直接：
- 配置一个 HTTP 的 ping 接口
- 每三秒检测一次
- 失败 3 次则认为检测失败
- 成功一次就认为检测成功

> 但没有配置就绪探针时，一旦 Pod 的 `Endpoint` 加入到 service 中(Pod 进入 `Running` 状态)，请求就有可能被转发过来，所以配置就绪探针是非常有必要的。

# 启动探针
而启动探针往往是和就绪探针搭配干活的，如果我们一个 Pod 启动时间过长，比如超过上面配置的失败检测次数，此时 Pod 就会被 kubernetes 重启，这样可能会进入无限重启的循环。

所以启动探针可以先检测一次是否已经启动，直到启动成功后才会做后续的检测。
```yaml
startupProbe:  
  failureThreshold: 30  
  httpGet:  
    path: /ping  
    port: 8081  
    scheme: HTTP  
  periodSeconds: 5  
  successThreshold: 1  
  timeoutSeconds: 1
```

> 我这里两个检测接口是同一个，具体得根据自己是实际业务进行配置；
> 比如应用端口启动之后并不代表业务已经就绪了，可能某些基础数据还没加载到内存中，这个时候就需要自己写其他的接口来配置就绪探针了。


![image.png](https://s2.loli.net/2023/11/26/AskpbIJiBovPGZ7.png)

所有关于探针相关的日志都可以在 Pod 的事件中查看，比如如果一个应用在启动的过程中频繁重启，那就可以看看是不是某个探针检测失败了。

# 存活探针

存活探针往往是用于保证应用高可用的，虽然 kubernetes 可以在 Pod 退出后自动重启，比如 `Pod OOM`；但应用假死他是检测不出来的。

为了保证这种情况下 Pod 也能被自动重启，就可以配合存活探针使用：
```yaml
livenessProbe:  
  failureThreshold: 3  
  httpGet:  
    path: /ping  
    port: 8081  
    scheme: HTTP  
  periodSeconds: 3  
  successThreshold: 1  
  timeoutSeconds: 1
```

一旦接口响应失败，kubernetes 就会尝试重启。

![image.png](https://s2.loli.net/2023/11/26/khZlsDHLyX2WOxT.png)

# 总结
![image.png](https://s2.loli.net/2023/11/26/jRqSIbk4HmnsTWl.png)

以上探针配置最好是可以在研效平台可视化配置，这样维护起来也比较简单。

探针是维护应用健康的必要手段，强烈推荐大家都进行配置。

本文的所有源码在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)
#Blog 