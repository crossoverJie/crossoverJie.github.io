---
title: 在多语言的分布式系统中如何传递 Trace 信息
date: 2025/08/13 17:06:46
banner_img: https://s2.loli.net/2025/08/13/WmCMGO9q4rk3EAR.png
index_img: https://s2.loli.net/2025/08/15/JGUlLi6WoOQMREp.png
categories:
  - OpenSource
  - OpenTelemetry
tags:
  - OpenSource
---
# 背景

![](https://s2.loli.net/2025/08/12/Q5fC3TugZ9dRvie.png)
![](https://s2.loli.net/2025/08/12/pczbVE7qHTaOXLk.png)
![](https://s2.loli.net/2025/08/12/XO2tqwaUPTGhvMI.png)

前段时间有朋友问我关于 `spring cloud` 的应用在调用到 Go 的 API 之后出现 Trace 没有串联起来的问题。

完整的调用流程如下：

```
┌──────┐             
│Client│             
└┬─────┘             
┌▽──────────────────┐
│SpringCloud GateWay│
└┬──────────────────┘
┌▽──────────────┐    
│SpringBoot(app)│    
└┬──────────────┘    
┌▽──────────┐        
│Feign(http)│        
└┬──────────┘        
┌▽─────┐             
│Go Gin│             
└──────┘             
```

<!--more-->
# 根因

在解决这个问题之前想要搞清楚 Trace 是如何跨语言以及跨应用传递的。

其实也可以类比为在分布式系统中如何传递上下文；既然要传递数据那就涉及到系统之间的调用，也就是我们常说的 `RPC`（remote procedure call)。

提到 PRC 我们常见的一般有两种协议：
- 基于 HTTP 协议，简单易读，兼容性好
- 基于 TCP 的私有协议，高效性能更佳


基于 TCP 私有协议的又诞生出许多流行的框架，比如：
- Dubbo
- Thrift
- gRPC(基于 HTTP2,严格来说不算私有协议)
- 基于 MQ 实现的 RPC（生产消费者模式，本质上这些 MQ 都是私有协议，比如 RocketMQ、Pulsar 等）


但我们需要在 RPC 调用的过程中在上下文里包含 Trace 时，通常都是将 TraceId 作为元数据进行传递。

对于 HTTP 来说就是 header、而其余的私有 TCP 协议通常也会提供一个元数据的结构用于存放一些非业务数据。
![](https://s2.loli.net/2025/08/13/WmCMGO9q4rk3EAR.png)
![](https://s2.loli.net/2025/08/13/VCfuBXTWQ9KSjFq.png)

![](https://s2.loli.net/2025/08/13/SsItGoNAjKOdYeX.png)

比如在 OpenTelemetry-Go 的 sdk 中，会在一次 RPC 中对 Trace 数据进行埋点。

最终也是使用 `metadata metadata.MD` 来获取上下文。


---

> 在 Pulsar 中是将 TraceId 存放在 properties 中，也相当于是元数据。

```
┌──────┐
│Client│
└┬─────┘
┌▽─────┐
│Pulsar│
└┬─────┘
┌▽───┐  
│gRPC│  
└────┘  
```


```go
func (s *server) SayHello(ctx context.Context, in *pb.HelloRequest) (*pb.HelloReply, error) {  
    defer apiCounter.Add(ctx, 1)  
    md, _ := metadata.FromIncomingContext(ctx)  
    log.Printf("Received: %v, md: %v", in.GetName(), md)  
    name, _ := os.Hostname()  
    span := trace.SpanFromContext(ctx)  
    span.SetAttributes(attribute.String("request.name", in.Name))  
    s.span(ctx)  
    return &pb.HelloReply{Message: fmt.Sprintf("hostname:%s, in:%s, md:%v", name, in.Name, md)}, nil  
}
```

![](https://s2.loli.net/2025/08/13/3slym1JNSuUIaMv.png)
![](https://s2.loli.net/2025/08/13/Bo9jh4Y2Xk7UiRL.png)

在这样一次调用中如果我们将 `Pulsar` 的 `properties` 和 `gRPC` meta 打印出来将会看到 `TraceID` 是如何进行传递的。
# 解决

回到这个问题本身，`Trace` 在 Gin Server 端没有关联起来，明显就是 Gin 没有接收到上游的 TraceId，导致它认为是新的一次调用，从而会创建一个 Trace。

解决起来也很容易，只需要在启动 Gin 的时候传入一个 OTEL 提供的拦截器，在这个拦截器中 OTEL 的 sdk 会自动从 HTTP header 里解析出 TraceId 然后塞入到当前的 context 中，这样两个进程的 Trace 就可以关联起来了。

相关代码如下：

```go
	r := gin.New()
	r.Use(otelgin.Middleware("my-server"))
```

> 由于 Go 没有提供类似于 Java 的 javaagent 扩展，这类原本可以全自动打桩的代码都需要硬编码实现。


在这个 `otelgin` 实现的 `Middleware` 里会使用 HTTP header 来传输 context。

![](https://s2.loli.net/2025/08/13/CPjqJMG16kBDovu.png)
![](https://s2.loli.net/2025/08/13/MiLFjUSBcCye7fb.png)
![](https://s2.loli.net/2025/08/13/8OYmXLl2gxqpKHt.png)

> 本质上是操作 HTTP header 查询和写入 Trace
![](https://s2.loli.net/2025/08/13/FTGKkeifSL3IUys.png)

会首先获取上游的 TraceID，这里的 `traceparentHeader` 也就是我们刚才看到的 `traceparent`。

如果获取到了就会解析里面的 `TraceID`，并生成当前的 `Context`，这样这个 context 就会一直往后传递了。

> 流程与上文提到 gRPC 类似。
![image.png](https://s2.loli.net/2025/08/13/WR1yX75C2Fmuk6r.png)

这是目前 otel-go-sdk 支持的[自动打桩框架](https://github.com/open-telemetry/opentelemetry-go-contrib/tree/main/instrumentation)，目前看来还不太多，但常用的也都支持了。


# 总结

如何跨进程调的 Trace 信息都是通过网络传递的，只是对于不同的协议传输的细节也各不相同，但原理都是类似的。

![](https://s2.loli.net/2025/08/13/g1eaAzMXFjDkfU8.png)

关键就是上面这两张图，进程 1 在调用进程 2 的时候将信息写入进去，进程 2 在收到请求的时候解析出 Trace，这两个步骤缺一不可。
#Blog 