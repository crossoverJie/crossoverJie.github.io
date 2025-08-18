---
title: k8s入门到实战-滚动更新与优雅停机
date: 2023/11/29 14:40:10
categories:
  - OB
tags:
---

![rollout.png](https://s2.loli.net/2023/11/29/BPVLoC2UfX5Drv8.png)

当我们在生产环境发布应用时，必须要考虑到当前系统还有用户正在使用的情况，所以尽量需要做到不停机发版。

<!--more-->

所以在发布过程中理论上之前的 v1 版本依然存在，必须得等待 v2 版本启动成功后再删除历史的 v1 版本。
> 如果 v2 版本启动失败 v1 版本不会做任何操作，依然能对外提供服务。

# 滚动更新
![image.png](https://s2.loli.net/2023/11/29/stqYlaFwecvhouS.png)

这是我们预期中的发布流程，要在 kubernetes 使用该功能也非常简单，只需要在 spec 下配置相关策略即可：

```yaml
spec:
  strategy:
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
    type: RollingUpdate
```
这个配置的含义是：
- 使用滚动更新，当然还有 **Recreate** 用于删除旧版本的 Pod，我们基本不会用这个策略。
- `maxSurge`：滚动更新过程中可以最多超过预期 Pod 数量的百分比，当然也可以填整数。
- `maxUnavailable`：滚动更新过程中最大不可用 Pod 数量超过预期的百分比。

这样一旦我们更新了 Pod 的镜像时，kubernetes 就会先创建一个新版本的 Pod 等待他启动成功后再逐步更新剩下的 Pod。
![](https://s2.loli.net/2023/11/29/s52LOSvECPReUnT.png)

# 优雅停机
滚动升级过程中不可避免的又会碰到一个优雅停机的问题，毕竟是需要停掉老的 Pod。

这时我们需要注意两种情况：
- 停机过程中，已经进入 Pod 的请求需要执行完毕才能退出。
- 停机之后不能再有请求路由到已经停机的 Pod

第一个问题如果我们使用的是 `Go`，可以使用一个钩子来监听  `kubernetes` 发出的退出信号：
```go
quit := make(chan os.Signal)  
signal.Notify(quit, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT, syscall.SIGPIPE)  
go func() {  
    <-quit  
    log.Printf("quit signal received, exit \n")  
    os.Exit(0)  
}()
```
在这里执行对应的资源释放。

如果使用的是 `spring boot` 也有对应的配置：
```yaml
server: 
	shutdown: "graceful"
spring: 
	lifecycle: 
		timeout-per-shutdown-phase: "20s"	
```
当应用收到退出信号后，spring boot 将不会再接收新的请求，并等待现有的请求处理完毕。

但 kubernetes 也不会无限等待应用将 Pod 将任务执行完毕，我们可以在 Pod 中配置
```yaml
terminationGracePeriodSeconds: 30
```
来定义需要等待多长时间，这里是超过 30s 之后就会强行 kill Pod。
> 具体值大家可以根据实际情况配置

---
```yaml
spec:
  containers:
  - name: example-container
    image: example-image
    lifecycle:
      preStop:
        exec:
          command: ["sh", "-c", "sleep 10"]
```
同时我们也可以配置 `preStop` 做一个 sleep 来确保 `kubernetes` 将准备删除的 Pod 在 `Iptable` 中已经更新了之后再删除 `Pod`。

这样可以避免第二种情况：已经删除的 `Pod` 依然还有请求路由过来。
具体可以参考 `spring boot` 文档：
[https://docs.spring.io/spring-boot/docs/2.4.4/reference/htmlsingle/#cloud-deployment-kubernetes-container-lifecycle](https://docs.spring.io/spring-boot/docs/2.4.4/reference/htmlsingle/#cloud-deployment-kubernetes-container-lifecycle)

# 回滚
回滚其实也可以看作是升级的一种，只是升级到了历史版本，在 `kubernetes` 中回滚应用非常简单。
```shell
# 回滚到上一个版本
 k rollout undo deployment/abc
# 回滚到指定版本
k rollout undo daemonset/abc --to-revision=3
```
同时 kubernetes 也能保证是滚动回滚的。
# 优雅重启
在之前的 [如何优雅重启 kubernetes 的 Pod](https://crossoverjie.top/2023/10/19/ob/k8s-restart-pod/) 那篇文章中写过，如果想要优雅重启 Pod 也可以使用 rollout 命令，它也也可以保证是滚动重启。
```shell
k rollout restart deployment/nginx
```

使用 `kubernetes` 的滚动更新确实要比我们以往的传统运维简单许多，就几个命令的事情之前得写一些复杂的运维脚本才能实现。

本文的所有源码在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)
#Blog #K8s 
