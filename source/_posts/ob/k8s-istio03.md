---
title: k8s实战-Istio 网关
date: 2023/11/13 22:07:18
categories:
  - k8s
tags:
- Istio
---
在上一期 [k8s-服务网格实战-配置 Mesh](https://crossoverjie.top/2023/11/07/ob/k8s-Istio02/) 中讲解了如何配置集群内的 Mesh 请求，Istio 同样也可以处理集群外部流量，也就是我们常见的网关。
![image.png](https://s2.loli.net/2023/11/14/TSCmnecrjHKfLzi.png)
<!--more-->

其实和之前讲到的[k8s入门到实战-使用Ingress](https://crossoverjie.top/2023/09/15/ob/k8s-Ingress/) `Ingress` 作用类似，都是将内部服务暴露出去的方法。

只是使用 `Istio-gateway` 会更加灵活。
![image.png](https://s2.loli.net/2023/11/14/hVFUTLB2CHjeRuM.png)

这里有一张功能对比图，可以明显的看出 `Istio-gateway` 支持的功能会更多，如果是一个中大型企业并且已经用上 Istio 后还是更推荐是有 `Istio-gateway`，使用同一个控制面就可以管理内外网流量。


## 创建 Gateway
开始之前首先是创建一个 `Istio-Gateway` 的资源：

```yaml
apiVersion: networking.istio.io/v1alpha3  
kind: Gateway  
metadata:  
  name: istio-ingress-gateway  
  namespace: default  
spec:  
  servers:  
    - port:  
        number: 80  
        name: http  
        protocol: HTTP  
      hosts:  
        - 'www.service1.io'  
  selector:  
    app: istio-ingressgateway #与现有的 gateway 关联  
    istio: ingressgateway
```

其中的 `selector` 选择器中匹配的 label 与我们安装 `Istio` 时候自带的 `gateway` 关联即可。

```shell
# 查看 gateway 的 label
k get pod -n istio-system
NAME                                    READY   STATUS
istio-ingressgateway-649f75b6b9-klljw   1/1     Running

k describe pod istio-ingressgateway-649f75b6b9-klljw -n istio-system |grep Labels
Labels:           app=istio-ingressgateway
```

![image.png](https://s2.loli.net/2023/10/26/3JXneYvyqI4WTgt.png)

> 这个 `Gateway` 在我们第一次安装 `Istio` 的时候就会安装这个组件。

---
这个配置的含义是网关会代理通过 `www.service1.io` 这个域名访问的所有请求。

之后需要使用刚才的 gateway 与我们的服务的 service 进行绑定，这时就需要使用到 `VirtualService`：

```yaml
apiVersion: networking.istio.io/v1alpha3  
kind: VirtualService  
metadata:  
  name: k8s-combat-istio-http-vs  
spec:  
  gateways:  
    - istio-ingress-gateway # 绑定刚才创建的 gateway 名称 
  hosts:  
    - www.service1.io
http:
- name: default  
  route:  
    - destination:  
        host: k8s-combat-service-istio-mesh  #service 名称
        port:  
          number: 8081  
        subset: v1
```
这个和我们之前讲到的 Mesh 内部流量时所使用到的 `VirtualService` 配置是一样的。

这里的含义也是通过 `www.service1.io` 以及 `istio-ingress-gateway` 网关的流量会进入这个虚拟服务，但所有的请求都会进入 `subset: v1` 这个分组。

这个的分组信息在上一节可以查询到：
```yaml
apiVersion: networking.istio.io/v1alpha3  
kind: DestinationRule  
metadata:  
  name: k8s-combat-service-ds  
spec:  
  host: k8s-combat-service-istio-mesh  
  subsets:  
    - name: v1  
      labels:  
        app: k8s-combat-service-v1  
    - name: v2  
      labels:  
        app: k8s-combat-service-v2
```

之后我们访问这个域名即可拿到响应，同时我们打开 `k8s-combat-service-istio-mesh` service 的 Pod 查看日志，会发现所有的请求都进入了 v1, 如果不需要这个限制条件，将 `subset: v1` 删除即可。

```bash
curl  http://www.service1.io/ping
```

> 本地需要配置下 host: `127.0.0.1 www.service1.io`
 
![image.png](https://s2.loli.net/2023/11/13/ksR9FbdWMEhlLBQ.png)

还有一点，我们需要拿到 `gateway` 的外部IP，才能将 IP 和刚才的域名`www.service1.io` 进行绑定（host，或者是域名管理台）。

如果使用的是 `docker-desktop` 自带的 `kubernetes` 集群时候直接使用 `127.0.0.1` 即可，默认就会绑定上。

如果使用的是 `minikube` 安装的，那需要使用 `minikube tunnel` 手动为 service 为`LoadBalancer` 类型的绑定一个本地 IP，具体可以参考文档：
https://minikube.sigs.k8s.io/docs/tasks/loadbalancer

> 如果是生产环境使用，云服务厂商会自动绑定一个外网 IP。

## 原理
![image.png](https://s2.loli.net/2023/11/14/4yBEDZOcsWKxLpg.png)

这个的访问请求的流程和之前讲到的 `kubernetes Ingress` 流程是类似的，只是 gateway 是通过 `VirtualService` 来路由的 service，同时在这个 `VirtualService` 中可以自定义许多的路由规则。

# 总结
服务网格 `Istio` 基本上讲完了，后续还有关于 `Telemetry` 相关的 `trace`、`log`、`metrics` 会在运维章节更新，也会和 Istio 有所关联。
感兴趣的朋友可以持续关注。

本文的所有源码在这里可以访问：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)

#Blog #Istio 
