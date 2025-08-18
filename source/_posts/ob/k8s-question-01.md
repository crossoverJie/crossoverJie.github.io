---
title: k8s 常见面试题 01
date: 2023/08/17 22:33:43
categories: 
- Interview
tags: 
- k8s
---
![](https://s2.loli.net/2023/08/17/hnWciw54ml6oPdg.jpg)

前段时间在这个视频中分享了 [https://github.com/bregman-arie/devops-exercises](https://github.com/bregman-arie/devops-exercises) 这个知识仓库。

<iframe src="//player.bilibili.com/player.html?aid=532004472&bvid=BV1Wu411n7U7&cid=1227759877&page=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>

这次继续分享里面的内容，本次主要以 k8s 相关的问题为主。

<!--more-->

## k8s 是什么，为什么企业选择使用它
k8s 是一个开源应用，给用户提供了管理、部署、扩展容器的能力，以下几个例子更容易理解：
- 你可以将容器运行在不同的机器或节点中，并且可以将一些变化同步给这些容器，简单来说我们只需要编写 `yaml` 文件，告诉 `k8s` 我的预期是什么，其中同步变化的过程全部都交给 k8s 去完成。
> 其实就是我们常说的声明式 API
- 第二个特点刚才已经提到了，它可以帮我们一键管理多个容器，同步所有的变更。
- 可以根据当前的负载调整应用的副本数，负载高就新创建几个应用实例，低就降低几个，这个可以手动或自动完成。

## 什么时候使用或者不使用 k8s
- 如果主要还是使用物理机这种低级别的基础设施的话，不太建议使用 `k8s`，这种情况通常是比较传统的业务，没有必要使用 `k8s`。
- 第二种情况是如果是小团队，或者容器规模较小时也不建议使用，除非你想使用 k8s 的滚动发布和自扩容能力，
>不过这些功能运维自己写工具也能实现。

## k8s 有哪些特性
- 是自我修复，`k8s` 对容器有着健康检测，比如使用启动探针、存活探针等，或者是容器 `OOM` 后也会重启应用尝试修复。
- 自带负载均衡，使用 `service` 可以将流量自动负载到后续 Pod 中，如果 Pod 提供的是 http 服务这个够用了，但如果是 grpc 这样的长链接，就需要使用 istio 这类服务网格，他可以识别出协议类型，从而做到请求级别的负载均衡。
-  `Operator` 自动运维能力：k8s 可以根据应用的运行情况自动调整当前集群的 Pod 数量、存储等，拿 `Pulsar` 举例，当流量激增后自动新增 `broker`，磁盘不足时自动扩容等。
- 滚动更新能力：当我们发版或者是回滚版本的时候，k8s 会等待新的容器启动之后才会将流量切回来，同时逐步停止老的实例。
- 水平扩展能力：可以灵活的新增或者是减少副本的数量，当然也可以自动控制。
- 数据加密：使用 `secret` 可以保存一些敏感的配置或者文件。

## k8s 有着哪些对象
这个就是考察我们对 `k8s` 是否是熟悉了，常用的有：
- Pod
- Service
- ReplicationController
- DaemonSet
- namespace
- ConfigMap
这个其实知道没有太多作用，主要还是得知道在不同场景如何使用不同的组件。

## 哪些字段是必须的
这个问题我也觉得意义不大，只要写过 `yaml` 就会知道了，`metadata, kind, apiVersion`

```yaml
apiVersion: apps/v1  
kind: Deployment  
metadata:  
  labels:  
    app: app
  name: app
```

## kubectl 是什么
其实就是一个 k8s 的 命令行客户端。

## 当你部署应用的时候哪些对象用的比较多
- 第一个肯定是 `deployment`，这应该是最常见的部署方式。
- `service`: 可以将流量负载到 Pod 中。
- `Ingress`: 如果需要从集群外访问 Pod 就得需要 `Ingress` 然后 配合域名访问。

## 为什么没有 `k get containers` 这个命令
这个问题主要是看对 `Pod` 的理解，因为在 `k8s` 中 `Pod` 就是最小的单位了，如果想要访问容器可以在 Pod 中访问。

我们可以加上 `-c` 参数进入具体的容器。
```
kubectl exec -it app -c istio-proxy
```

## 你认为使用使用 k8s 的最佳实践是什么
这个主要是看日常使用时有没有遇到什么坑了：
- 第一个就是要验证 `yaml` 内容是否正确，这个确实很重要，一旦执行错了后果很严重，比如使用 helm 的时候最好岂容 `dry-run` 和 `debug`，先看看生成的 `yaml` 是否是预期想要的。
> helm upgrade app --dry-run --debug
- 第二个限制资源的使用，比如 CPU 和 内存，这个也很重要，如果不设置一旦应用出现 bug 可能导致整个 k8s 集群都受到影响。
- 为 Pod，deployment 指定标签，用于分组。

```yaml
# 资源限制
resources:  
  limits:  
    cpu: 200m  
    memory: 200Mi  
  requests:  
    cpu: 100m  
    memory: 100Mi
```

> 参考来源：https://github.com/bregman-arie/devops-exercises/blob/master/topics/kubernetes/README.md#kubernetes-101

后续部分内容也有出视频版，强烈建议大家关注我的 B 站或者是视频号：
![image.png](https://s2.loli.net/2023/08/17/joO3wpCAEMtY2yW.jpg)
![image.png](https://s2.loli.net/2023/08/17/2gcNDC4M3x91Sbh.jpg)


#Blog #K8s 
