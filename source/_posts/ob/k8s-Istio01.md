---
title: k8s-服务网格实战-入门Istio
date: 2023/10/31 22:30:46
categories:
  - k8s
tags:
- Istio
---
![istio-01.png](https://s2.loli.net/2023/10/31/QChAqoOVcxbP4tU.png)

# 背景
终于进入大家都比较感兴趣的服务网格系列了，在前面已经讲解了：
- 如何部署应用到 `kubernetes`
- 服务之间如何调用
- 如何通过域名访问我们的服务
- 如何使用 `kubernetes` 自带的配置 `ConfigMap`

基本上已经够我们开发一般规模的 web 应用了；但在企业中往往有着复杂的应用调用关系，应用与应用之间的请求也需要进行管理。
比如常见的限流、降级、trace、监控、负载均衡等功能。

在我们使用 `kubernetes` 之前往往都是由微服务框架来解决这些问题，比如 Dubbo、SpringCloud 都有对应的功能。

但当我们上了 `kubernetes` 之后这些事情就应该交给一个专门的云原生组件来解决，也就是本次会讲到的 `Istio`，它是目前使用最为广泛的服务网格解决方案。

<!--more-->
![image.png](https://s2.loli.net/2023/10/31/CtJsogSyPD7cjEW.png)
官方对于 Istio 的解释比较简洁，落到具体的功能点也就是刚才提到的：
- 限流降级
- 路由转发、负载均衡
- 入口网关、`TLS安全认证`
- 灰度发布等

![image.png](https://s2.loli.net/2023/10/31/aXnNZhu91m7V2Tw.png)

再结合官方的架构图可知：Istio 分为控制面 `control plane` 和数据面 `data plane`。

控制面可以理解为 Istio 自身的管理功能：
- 比如服务注册发现
- 管理配置数据面所需要的网络规则等

而数据面可以简单的把他理解为由 `Envoy` 代理的我们的业务应用，我们应用中所有的流量进出都会经过 `Envoy` 代理。

所以它可以实现负载均衡、熔断保护、认证授权等功能。
# 安装
首先安装 Istio 命令行工具
> 这里的前提是有一个 kubernetes 运行环境

Linux 使用：
```shell
curl -L https://istio.io/downloadIstio | sh -
```

Mac 可以使用 brew：
```shell
brew install istioctl
```

其他环境可以下载 Istio 后配置环境变量：
```shell
export PATH=$PWD/bin:$PATH
```

之后我们可以使用 `install` 命令安装控制面。
> 这里默认使用的是 `kubectl` 所配置的 `kubernetes` 集群
```bash
istioctl install --set profile=demo -y
```
![](https://s2.loli.net/2023/10/30/DLOeRGrA7gNC1Xa.png)
这个的 `profile` 还有以下不同的值，为了演示我们使用 `demo` 即可。
![image.png](https://s2.loli.net/2023/10/26/3JXneYvyqI4WTgt.png)
# 使用
```bash
# 开启 default 命名空间自动注入
$ k label namespace default istio-injection=enabled

$ k describe ns default
Name:         default
Labels:       istio-injection=enabled
              kubernetes.io/metadata.name=default
Annotations:  <none>
Status:       Active
No resource quota.
No LimitRange resource.
```
之后我们为 `namespace` 打上 `label`，使得 Istio 控制面知道哪个 `namespace` 下的 `Pod` 会自动注入 `sidecar`。

这里我们为 default 这个命名空间打开自动注入 `sidecar`，然后在这里部署我们之前使用到的 [deployment-istio.yaml](https://github.com/crossoverJie/k8s-combat/blob/main/deployment/deployment-istio.yaml)
```bash
$ k apply -f deployment/deployment-istio.yaml

$ k get pod
NAME                                  READY   STATUS    RESTARTS
k8s-combat-service-5bfd78856f-8zjjf   2/2     Running   0          
k8s-combat-service-5bfd78856f-mblqd   2/2     Running   0          
k8s-combat-service-5bfd78856f-wlc8z   2/2     Running   0       
```
此时会看到每个Pod 有两个 container（其中一个就是 istio-proxy sidecar），也就是之前做 [gRPC 负载均衡](https://crossoverjie.top/2023/10/16/ob/k8s-grpc-lb/)测试时的代码。

![image.png](https://s2.loli.net/2023/10/31/js1Gz5yVCNLep9W.png)
还是进行负载均衡测试，效果是一样的，说明 `Istio` 起作用了。

此时我们再观察 `sidecar` 的日志时，会看到刚才我们所发出和接受到的流量：
```bash
$ k logs -f k8s-combat-service-5bfd78856f-wlc8z -c istio-proxy

[2023-10-31T14:52:14.279Z] "POST /helloworld.Greeter/SayHello HTTP/2" 200 - via_upstream - "-" 12 61 14 9 "-" "grpc-go/1.58.3" "6d293d32-af96-9f87-a8e4-6665632f7236" "k8s-combat-service:50051" "172.17.0.9:50051" inbound|50051|| 127.0.0.6:42051 172.17.0.9:50051 172.17.0.9:40804 outbound_.50051_._.k8s-combat-service.default.svc.cluster.local default
[2023-10-31T14:52:14.246Z] "POST /helloworld.Greeter/SayHello HTTP/2" 200 - via_upstream - "-" 12 61 58 39 "-" "grpc-go/1.58.3" "6d293d32-af96-9f87-a8e4-6665632f7236" "k8s-combat-service:50051" "172.17.0.9:50051" outbound|50051||k8s-combat-service.default.svc.cluster.local 172.17.0.9:40804 10.101.204.13:50051 172.17.0.9:54012 - default
[2023-10-31T14:52:15.659Z] "POST /helloworld.Greeter/SayHello HTTP/2" 200 - via_upstream - "-" 12 61 35 34 "-" "grpc-go/1.58.3" "ed8ab4f2-384d-98da-81b7-d4466eaf0207" "k8s-combat-service:50051" "172.17.0.10:50051" outbound|50051||k8s-combat-service.default.svc.cluster.local 172.17.0.9:39800 10.101.204.13:50051 172.17.0.9:54012 - default
[2023-10-31T14:52:16.524Z] "POST /helloworld.Greeter/SayHello HTTP/2" 200 - via_upstream - "-" 12 61 28 26 "-" "grpc-go/1.58.3" "67a22028-dfb3-92ca-aa23-573660b30dd4" "k8s-combat-service:50051" "172.17.0.8:50051" outbound|50051||k8s-combat-service.default.svc.cluster.local 172.17.0.9:44580 10.101.204.13:50051 172.17.0.9:54012 - default
[2023-10-31T14:52:16.680Z] "POST /helloworld.Greeter/SayHello HTTP/2" 200 - via_upstream - "-" 12 61 2 2 "-" "grpc-go/1.58.3" "b4761d9f-7e4c-9f2c-b06f-64a028faa5bc" "k8s-combat-service:50051" "172.17.0.10:50051" outbound|50051||k8s-combat-service.default.svc.cluster.local 172.17.0.9:39800 10.101.204.13:50051 172.17.0.9:54012 - default
```

# 总结
本期的内容比较简单，主要和安装配置相关，下一期更新如何配置内部服务调用的超时、限流等功能。

其实目前大部分操作都是偏运维的，即便是后续的超时配置等功能都只是编写 yaml 资源。

但在生产使用时，我们会给开发者提供一个管理台的可视化页面，可供他们自己灵活配置这些原本需要在 `yaml` 中配置的功能。

![image.png](https://s2.loli.net/2023/10/31/B3TiC9rJwPbGVHQ.png)
其实各大云平台厂商都有提供类似的能力，比如阿里云的 EDAS 等。

本文的所有源码在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)

#Blog #Istio 
