---
title: 在 kubernetes 环境中实现 gRPC 负载均衡
date: 2023/10/16 15:55:50
categories:
  - OB
  - k8s
tags:
- gRPC
---
![Istio-grpc-lb.png](https://s2.loli.net/2023/10/16/wJiKvMAaWUyOCpX.png)

# 前言

前段时间写过一篇 `gRPC` 的入门文章，在最后还留了一个坑没有填：
![image.png](https://s2.loli.net/2023/10/16/41I2RZXeQanFgdB.png)
也就是 `gRPC` 的负载均衡问题，因为当时的业务请求量不算大，再加上公司没有对 Istio 这类服务网格比较熟悉的大牛，所以我们也就一直拖着没有解决，依然只是使用了 kubernetes 的 service 进行负载，好在也没有出什么问题。

<!--more-->

由于现在换了公司后也需要维护公司的服务网格服务，结合公司内部对 Istio 的使用现在终于不再停留在理论阶段了。

所以也终有机会将这个坑填了。

# gRPC 负载均衡

## 负载不均衡

### 原理
先来回顾下背景，为什么会有 `gRPC` 负载不均衡的问题。
由于 `gRPC` 是基于 HTTP/2 协议的，所以客户端和服务端会保持长链接，一旦链接建立成功后就会一直使用这个连接处理后续的请求。


![image.png](https://s2.loli.net/2023/10/16/NxJqPM49vAgEBtX.png)

除非我们每次请求之后都新建一个连接，这显然是不合理的。

所以要解决 `gRPC` 的负载均衡通常有两种方案：
- 服务端负载均衡
- 客户端负载均衡
在 `gRPC` 这个场景服务端负载均衡不是很合适，所有的请求都需要经过一个负载均衡器，这样它就成为整个系统的瓶颈，所以更推荐使用客户端负载均衡。

客户端负载均衡目前也有两种方案，最常见也是传统方案。
![image.png](https://s2.loli.net/2023/10/16/x31gJLImRlfXa9i.png)
这里以 Dubbo 的调用过程为例，调用的时候需要从服务注册中心获取到提供者的节点信息，然后在客户端本地根据一定的负载均衡算法得出一个节点然后发起请求。

换成 `gRPC` 也是类似的，这里以 `go-zero` 负载均衡的原理为例：
![image.png](https://s2.loli.net/2023/10/16/PLnyAKsmDZQRoeh.png)

gRPC 官方库也提供了对应的负载均衡接口，但我们依然需要自己维护服务列表然后在客户端编写负载均衡算法，这里有个官方 demo:

[https://github.com/grpc/grpc-go/blob/87eb5b7502493f758e76c4d09430c0049a81a557/examples/features/load_balancing/client/main.go](https://github.com/grpc/grpc-go/blob/87eb5b7502493f758e76c4d09430c0049a81a557/examples/features/load_balancing/client/main.go)

但切换到 kubernetes 环境中时再使用以上的方式就不够优雅了，因为我们使用 kubernetes 的目的就是不想再额外的维护这个客户端包，这部分能力最好是由 kubernetes 自己就能提供。

但遗憾的是 kubernetes 提供的 service 只是基于 L4 的负载，所以我们每次请求的时候都只能将请求发往同一个 Provider 节点。

### 测试
这里我写了一个小程序来验证负载不均衡的示例：
```go
// Create gRPC server
go func() {  
   var port = ":50051"  
   lis, err := net.Listen("tcp", port)  
   if err != nil {  
      log.Fatalf("failed to listen: %v", err)  
   }  
   s := grpc.NewServer()  
   pb.RegisterGreeterServer(s, &server{})  
   if err := s.Serve(lis); err != nil {  
      log.Fatalf("failed to serve: %v", err)  
   } else {  
      log.Printf("served on %s \n", port)  
   }  
}()
// server is used to implement helloworld.GreeterServer.  
type server struct {  
   pb.UnimplementedGreeterServer  
}  
  
// SayHello implements helloworld.GreeterServer  
func (s *server) SayHello(ctx context.Context, in *pb.HelloRequest) (*pb.HelloReply, error) {  
   log.Printf("Received: %v", in.GetName())  
   name, _ := os.Hostname()  
   // Return hostname of Server
   return &pb.HelloReply{Message: fmt.Sprintf("hostname:%s, in:%s", name, in.Name)}, nil  
}
```

使用同一个 gRPC 连接发起一次 gRPC 请求，服务端会返回它的 `hostname`
```go
var (  
   once sync.Once  
   c    pb.GreeterClient  
)  
http.HandleFunc("/grpc_client", func(w http.ResponseWriter, r *http.Request) {  
   once.Do(func() {  
      service := r.URL.Query().Get("name")  
      conn, err := grpc.Dial(fmt.Sprintf("%s:50051", service), grpc.WithInsecure(), grpc.WithBlock())  
      if err != nil {  
         log.Fatalf("did not connect: %v", err)  
      }  
      c = pb.NewGreeterClient(conn)  
   })  
  
   // Contact the server and print out its response.  
   name := "world"  
   ctx, cancel := context.WithTimeout(context.Background(), time.Second)  
   defer cancel()  
   g, err := c.SayHello(ctx, &pb.HelloRequest{Name: name})  
   if err != nil {  
      log.Fatalf("could not greet: %v", err)  
   }  
   fmt.Fprint(w, fmt.Sprintf("Greeting: %s", g.GetMessage()))  
})
```

创建一个 service 用于给 `gRPC` 提供域名：
```yaml
apiVersion: v1  
kind: Service  
metadata:  
  name: native-tools-2
spec:  
  selector:  
    app: native-tools-2
  ports:  
    - name: http  
      port: 8081  
      targetPort: 8081  
    - name: grpc  
      port: 50051  
      targetPort: 50051
```
同时将我们的 gRPC server 部署三个节点，再部署了一个客户端节点：

```bash
❯ k get pod
NAME                                READY   STATUS    RESTARTS
native-tools-2-d6c454689-52wgd      1/1     Running   0              
native-tools-2-d6c454689-67rx4      1/1     Running   0              
native-tools-2-d6c454689-zpwxt      1/1     Running   0              
native-tools-65c5bd87fc-2fsmc       2/2     Running   0             
```


我们进入客户端节点执行多次 grpc 请求：
```bash
k exec -it native-tools-65c5bd87fc-2fsmc bash
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
Greeting: hostname:native-tools-2-d6c454689-zpwxt, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
```
会发现每次请求的都是同一个节点 `native-tools-2-d6c454689-zpwxt`，这也就证明了在 kubernetes 中直接使用 gRPC 负载是不均衡的，一旦连接建立后就只能将请求发往那个节点。
## 使用 Istio
Istio 可以拿来解决这个问题，我们换到一个注入了 Istio 的 namespace 下还是同样的 代码，同样的 service 资源进行测试。

> 关于开启 namespace 的 Istio 注入会在后续更新，现在感兴趣的可以查看下官方文档：
> [https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/](https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/)

```shell
Greeting: hostname:native-tools-2-5fbf46cf54-5m7dl, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-xprjz, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-5m7dl, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-5m7dl, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-xprjz, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-xprjz, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-5m7dl, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-5m7dl, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-nz8h5, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2

Greeting: hostname:native-tools-2-5fbf46cf54-nz8h5, in:worldistio-proxy@n:/$ curl http://127.0.0.1:8081/grpc_client?name=native-tools-2
```
可以发现同样的请求已经被负载到了多个 server 后端，这样我们就可以不再单独维护一个客户端 SDK 的情况下实现了负载均衡。

## 原理
其实本质上 Istio 也是客户端负载均衡的一种实现。
![image.png](https://s2.loli.net/2023/10/16/XOU1TGtvm7PeJ8o.png)
以 Istio 的架构图为例：
- 每一个 Pod 下会新增一个 `Proxy` 的 `container`，所有的流量入口和出口都会经过它。
- 它会从控制平面 `Istiod` 中拿到服务的注册信息，也就是 `kubernetes` 中的 service。
- 发生请求时由 proxy 容器中的 `Envoy` 进行最终的负载请求。

可以在使用了 Istio 的 Pod 中查看到具体的容器：
```bash
❯ k get pod native-tools-2-5fbf46cf54-5m7dl -n istio-test-2 -o json | jq '.spec.containers[].name'
"istio-proxy"
"native-tools-2"
```

可以发现这里存在一个 `istio-proxy` 的容器，也就是我们常说的 `sidecar`，这样我们就可以把原本的 SDK 里的功能全部交给 Istio 去处理。

# 总结

当然 Istio 的功能远不止于此，比如：
- 统一网关，处理东西、南北向流量。
- 灰度发布
- 流量控制
- 接口粒度的超时配置
- 自动重试等

这次只是一个开胃菜，更多关于 `Istio` 的内容会在后续更新，比如会从如何在 `kubernetes` 集群中安装 `Istio` 讲起，带大家一步步使用好 `Istio`。

本文相关源码：
[https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)


<sub>参考链接：</sub>
- https://istio.io/latest/docs/setup/getting-started/
- https://segmentfault.com/a/1190000042295402
- https://go-zero.dev/docs/tutorials/service/governance/lb