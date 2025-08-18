---
title: k8s入门到实战--跨服务调用
date: 2023/09/05 21:13:28
categories: 
- k8s
tags: 
- Go
---

![service.png](https://s2.loli.net/2023/09/05/GbZ1vKQNHY32wzD.png)

# 背景

在做传统业务开发的时候，当我们的服务提供方有多个实例时，往往我们需要将对方的服务列表保存在本地，然后采用一定的算法进行调用；当服务提供方的列表变化时还得及时通知调用方。

<!--more-->

```yaml
student:  
   url:     
   - 192.168.1.1:8081     
   - 192.168.1.2:8081
```

这样自然是对双方都带来不少的负担，所以后续推出的服务调用框架都会想办法解决这个问题。

以 `spring cloud` 为例：
![image.png](https://s2.loli.net/2023/09/06/IW1jaidQ25Xk9u4.png)

服务提供方会向一个服务注册中心注册自己的服务（名称、IP等信息），客户端每次调用的时候会向服务注册中心获取一个节点信息，然后发起调用。

但当我们切换到 `k8s` 后，这些基础设施都交给了 `k8s` 处理了，所以 `k8s` 自然得有一个组件来解决服务注册和调用的问题。

也就是我们今天重点介绍的 `service`。


# service

在介绍 `service` 之前我先调整了源码：
```go
func main() {  
   http.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {  
      name, _ := os.Hostname()  
      log.Printf("%s ping", name)  
      fmt.Fprint(w, "pong")  
   })  
   http.HandleFunc("/service", func(w http.ResponseWriter, r *http.Request) {  
      resp, err := http.Get("http://k8s-combat-service:8081/ping")  
      if err != nil {  
         log.Println(err)  
         fmt.Fprint(w, err)  
         return  
      }  
      fmt.Fprint(w, resp.Status)  
   })  
  
   http.ListenAndServe(":8081", nil)  
}
```
新增了一个 `/service` 的接口，这个接口会通过 service 的方式调用服务提供者的服务，然后重新打包。

```shell
make docker
```

同时也新增了一个 `deployment-service.yaml`:
```yaml
apiVersion: apps/v1  
kind: Deployment  
metadata:  
  labels:  
    app: k8s-combat-service # 通过标签选择关联  
  name: k8s-combat-service  
spec:  
  replicas: 1  
  selector:  
    matchLabels:  
      app: k8s-combat-service  
  template:  
    metadata:  
      labels:  
        app: k8s-combat-service  
    spec:  
      containers:  
        - name: k8s-combat-service  
          image: crossoverjie/k8s-combat:v1  
          imagePullPolicy: Always  
          resources:  
            limits:  
              cpu: "1"  
              memory: 100Mi  
            requests:  
              cpu: "0.1"  
              memory: 10Mi  
---  
apiVersion: v1  
kind: Service  
metadata:  
  name: k8s-combat-service  
spec:  
  selector:  
    app: k8s-combat-service # 通过标签选择关联  
  type: ClusterIP  
  ports:  
    - port: 8081        # 本 Service 的端口  
      targetPort: 8081  # 容器端口  
      name: app
```

使用相同的镜像部署一个新的 deployment，名称为 `k8s-combat-service`，重点是新增了一个`kind: Service` 的对象。

这个就是用于声明 `service` 的组件，在这个组件中也是使用 `selector` 标签和 `deployment` 进行了关联。

也就是说这个 `service` 用于服务于名称等于 `k8s-combat-service` 的 `deployment`。

下面的两个端口也很好理解，一个是代理的端口， 另一个是  service 自身提供出去的端口。

至于 `type: ClusterIP` 是用于声明不同类型的 `service`，除此之外的类型还有：
- [`NodePort`](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport)
- [`LoadBalancer`](https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer)
- [`ExternalName`](https://kubernetes.io/docs/concepts/services-networking/service/#externalname)
等类型，默认是 `ClusterIP`，现在不用纠结这几种类型的作用，后续我们在讲到 `Ingress` 的时候会具体介绍。

## 负载测试
我们先分别将这两个 `deployment` 部署好：
```shell
k apply -f deployment/deployment.yaml
k apply -f deployment/deployment-service.yaml

❯ k get pod
NAME                                  READY   STATUS    RESTARTS   AGE
k8s-combat-7867bfb596-67p5m           1/1     Running   0          3h22m
k8s-combat-service-5b77f59bf7-zpqwt   1/1     Running   0          3h22m
```

由于我新增了一个 `/service` 的接口，用于在 `k8s-combat` 中通过 `service` 调用 `k8s-combat-service` 的接口。

```go
resp, err := http.Get("http://k8s-combat-service:8081/ping")
```

其中 `k8s-combat-service` 服务的域名就是他的服务名称。
> 如果是跨 namespace 调用时，需要指定一个完整名称，在后续的章节会演示。



我们整个的调用流程如下：
![image.png](https://s2.loli.net/2023/09/06/i12pR3DjC6wnIXQ.png)

相信大家也看得出来相对于 `spring cloud` 这类微服务框架提供的客户端负载方式，`service` 是一种服务端负载，有点类似于 `Nginx` 的反向代理。

为了更直观的验证这个流程，此时我将 `k8s-combat-service` 的副本数增加到 2：
```yaml
spec:  
  replicas: 2
```

只需要再次执行：
```shell
❯ k apply -f deployment/deployment-service.yaml
deployment.apps/k8s-combat-service configured
service/k8s-combat-service unchanged
```

![image.png](https://s2.loli.net/2023/09/06/ZC8UrjEz6ia1Qgo.png)

> 不管我们对 `deployment` 的做了什么变更，都只需要 `apply` 这个 `yaml`  文件即可， k8s 会自动将当前的 `deployment` 调整为我们预期的状态（比如这里的副本数量增加为 2）；这也就是 `k8s` 中常说的**声明式 API**。


可以看到此时 `k8s-combat-service` 的副本数已经变为两个了。
如果我们此时查看这个 `service` 的描述时：

```shell
❯ k describe svc k8s-combat-service |grep Endpoints
Endpoints:         192.168.130.133:8081,192.168.130.29:8081
```
会发现它已经代理了这两个 `Pod` 的 IP。


![image.png](https://s2.loli.net/2023/09/06/HbjyEcnaeCK6uMJ.png)
此时我进入了 `k8s-combat-7867bfb596-67p5m` 的容器：

```shell
k exec -it k8s-combat-7867bfb596-67p5m bash
curl http://127.0.0.1:8081/service
```

并执行两次 `/service` 接口，发现请求会轮训进入 `k8s-combat-service` 的代理的 IP 中。

由于 `k8s service` 是基于 `TCP/UDP` 的四层负载，所以在 `http1.1`  中是可以做到请求级的负载均衡，但如果是类似于 `gRPC` 这类长链接就无法做到请求级的负载均衡。

换句话说 `service` 只支持连接级别的负载。

如果要支持 `gRPC`，就得使用 Istio 这类服务网格，相关内容会在后续章节详解。


# 总结
总的来说 `k8s service` 提供了简易的服务注册发现和负载均衡功能，当我们只提供 http 服务时是完全够用的。


相关的源码和 yaml 资源文件都存在这里：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)