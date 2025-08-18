---
title: 从 Dapper 到 OpenTelemetry：分布式追踪的演进之旅
date: 2024/06/06 00:55:16
categories:
  - OB
  - OpenTelemetry
tags:
 - OpenTelemetry
---


在之前写过两篇比较系统的关于 OpenTelemetry 的文章：
- [OpenTelemetry 实践指南：历史、架构与基本概念](https://juejin.cn/post/7358450927110357026)
- [实操 OpenTelemetry：通过 Demo 掌握微服务监控的艺术](https://juejin.cn/post/7360216766373068837)

从基本概念到如何部署 demo 实战了解 OpenTelemetry，从那个 demo 中也可以得知整个 OpenTelemetry 体系的复杂性，包含了太多的组件和概念。

为了能更清晰的了解每个关键组件的作用以及原理，我打算分为几期来讲解 OpenTelemetry 的三个核心组件：
- Trace
- Metrics
- Logs

首先以 Trace 讲起。

<!--more-->
# Trace

开始之前还是先复习一下 Trace 的历史背景。

如今现代的分布式追踪的起源源自于 Google 在 2010 年发布的一篇论文：
- [Dapper, a Large-Scale Distributed Systems Tracing Infrastructure](https://static.googleusercontent.com/media/research.google.com/zh-CN//archive/papers/dapper-2010-1.pdf)

在这篇论文中提出了分布式追踪的几个核心概念：
- Trace
- Span
	- Span 的一些基础数据结构
- 可视化追踪以及展示

之后 Twitter 受到了 Dapper 的启发开源了现在我们熟知的 [Zipkin](https://zipkin.io/)，包含了存储和可视化 UI 展示我们的追踪链路。

Uber 也在 2015 年开源了 [Jaeger](https://www.jaegertracing.io/) 项目，它的功能和 Zipkin 类似，但目前我们用的较多的还是 Jaeger；现在已经成为 CNCF 的托管项目。

之后陆续出现过 **OpenTracing** 和 **OpenCensus** 项目，他们都企图统一分布式追踪这一领域。

直到 `OpenTelemetry` 的出现整合了以上两个项目，并且逐渐成为可观测领域的标准。

> 更多历史背景可以参考之前的文章：[OpenTelemetry 实践指南：历史、架构与基本概念](https://juejin.cn/post/7358450927110357026)

![](https://s2.loli.net/2024/05/05/ljQ6yNhKzn3b1c9.png)

![](https://s2.loli.net/2024/05/05/NOEbTamR67x83nS.png)

这里我们结合 Dapper 论文中的资料进行分析，在这个调用中用户发起了一次请求，内部系统经历了 4 次 RPC 调用。

从第二张图会看到一些关键信息：
- spanName
- parentId
- spanId

parentId 很好理解，主要是定义调用的主次关系；要注意的是并行调用时 parentId 是同一个。

spanId 在可以理解为每一个独立的操作，在这里就是一次 RPC 调用；同理一次数据库操作、消息的收发都是一个 span。

> span 的更多内容在后文继续讲解。

# Span
![](https://s2.loli.net/2024/05/05/wyzLpbhYkjOUFav.png)
当我们把某一个具体的 span 放大会看到更加详细的信息，其中最关键的如下：
- traceId
- spanName
- spanId
- parentId
- 开始时间
- 结束时间

由于一个完整的 trace 链路由 N 个 span 组成，所以这个链路必须得有一个唯一的 traceId 将这些 span 串联起来。
这样才可以在可视化的时候更好的展示链路信息。

以上的这些字段很容易理解，都是一些必须的信息。


在 Dapper 论文中使用 Annotations 来存放 span 的属性，也就是刚才那些字段，当然也可以自定义存放一些数据，比如图中的 `"foo"`。

## OpenTelemetry 中的 Span

OpenTelemetry 的 trace 自然也是基于 Dapper 的，只是额外做了一些优化，比如在刚才那些字段的基础上新增了一些概念：

```json
{
  "name": "/v1/sys/health",
  "context": {
    "trace_id": "7bba9f33312b3dbb8b2c2c62bb7abe2d",
    "span_id": "086e83747d0e381e"
  },
  "parent_id": "",
  "start_time": "2021-10-22 16:04:01.209458162 +0000 UTC",
  "end_time": "2021-10-22 16:04:01.209514132 +0000 UTC",
  "status_code": "STATUS_CODE_OK",
  "status_message": "",
  "attributes": {
    "net.transport": "IP.TCP",
    "net.peer.ip": "172.17.0.1",
    "net.peer.port": "51820",
    "net.host.ip": "10.177.2.152",
    "net.host.port": "26040",
    "http.method": "GET",
    "http.target": "/v1/sys/health",
    "http.server_name": "mortar-gateway",
    "http.route": "/v1/sys/health",
    "http.user_agent": "Consul Health Check",
    "http.scheme": "http",
    "http.host": "10.177.2.152:26040",
    "http.flavor": "1.1"
  },
  "events": [
    {
      "name": "",
      "message": "OK",
      "timestamp": "2021-10-22 16:04:01.209512872 +0000 UTC"
    }
  ]
}

```

以这个 JSON 为例，新增了：
- [ ] `Span Context`
	- `Span` 的上下文，存放的都是不可变的数据，因为每个 Span 之间是存在关联关系的，这些关联关系都是存放在 context 中，主要就是 trace_id, span_id.
- `Attributes`: 可以理解为 Dapper 中的 Annotations，存放的是我们自定义的键值对，通常是由我们常用第三方开源 Instrumentation 内置的一些属性。
- `Span Events`: Span 的一些关键事件。

![](https://s2.loli.net/2024/05/05/3C49thIJOZTuf82.png)
比如我们常用的 Redis 客户端 lettuce，它就会自己记录一些 Attributes。

---

如果有多个 span 存在依赖关系：
```
        [Span A]  ←←←(the root span)
            |
     +------+------+
     |             |
 [Span B]      [Span C] ←←←(Span C is a `child` of Span A)
     |             |
 [Span D]      +---+-------+
               |           |
           [Span E]    [Span F]
```

大部分的可视化工具都是以时间线的方式进行展示：

```
––|–––––––|–––––––|–––––––|–––––––|–––––––|–––––––|–––––––|–> time

 [Span A···················································]
   [Span B··········································]
      [Span D······································]
    [Span C····················································]
         [Span E·······]        [Span F··]
```

这些和 Dapper 中描述的概念没有本质区别。

---
### Span Status
Span 还内置了一些 Status：

- `Unset`
- `Error`
- `Ok`

默认情况下是 Unset，出现错误时则是 Error，一切正常时则是 Ok。

![](https://s2.loli.net/2024/05/05/glkIuxbFDBcai36.png)
通过可视化页面很容易得知某个 trace 中 span 的异常情况，点进去后可以看到具体的异常 span 以及它的错误日志。


### Span Kind
最后是 Span 的类型：

- Client
- Server
- Internal
- Producer
- Consumer

![](https://s2.loli.net/2024/05/05/rMjV9qsveNEKORW.png)

Client 和 Server 非常好理解，比如我们有一个 gRPC 接口，调用方的 Span 是 client，而服务端的 Span 自然就是 Server。

Internal 则是内部组件调用产生的 Span，这类 Span 相对会少一些。

Producer 和 Consumer 一般指的是发起异步调用时的 Span，我们常见的就是往消息队列里生产和消费消息。

通过这几种类型的 Span 也可以了解到什么情况下会创建 Span，通常是以下几种场景：
- RPC 调用
- 数据库（Redis、MySQL、Mongo 等等）操作
- 生产和消费消息
- 有意义的内部调用

通常在一个函数内部再调用其他的本地函数是不用创建 span 的，不然这个链路会非常的长。


## Annotations

当然也有一些特殊情况，比如我的某个内部函数非常重要，需要单独关心它的调用时长。

此时我们就可以使用 Annotations 来单独创建自己的 Span。

> 这个 Annotations 和 Dapper 中的不是同一个，只是 Java 中的注解。

```java
@Override  
public void sayHello(HelloRequest request, StreamObserver<HelloReply> responseObserver) {  
    Executors.newFixedThreadPool(1).execute(() -> {  
        myMethod(request.getName());  
    });    
    
    HelloReply reply = HelloReply.newBuilder()  
            .setMessage("Hello ==> " + request.getName())  
            .build();  
    responseObserver.onNext(reply);  
    responseObserver.onCompleted();  
}  
  
@SneakyThrows  
@WithSpan  
public void myMethod(@SpanAttribute("request.name") String name) {  
    TimeUnit.SECONDS.sleep(1);  
    log.info("myMethod:{}", name);  
}
```

以这段代码为例，这是一个 gRPC 的服务端接口，在这个接口中调用了一个函数 `myMethod`，默认情况下并不会为它单独创建一个 Span。

但如果我们想单独记录它，就可以使用 `@WithSpan` 这个注解，同时也可以使用  `@SpanAttribute` 来自定义 attribute。


最终的效果如下：
![](https://s2.loli.net/2024/05/05/aBd1ubsS2kxMzGf.png)
此时就会单独为这个函数创建一个 Span。

> 需要单独引入一个依赖:

```xml
<dependencies>
  <dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-instrumentation-annotations</artifactId>
    <version>2.3.0</version>
  </dependency>
</dependencies>
```
# Context Propagation

上下文传播也是 Trace 中非常重要的概念，刚才提到了每个 Span 都有自己不可变的上下文，那么后续的 Span 如何和上游的 Span 进行关联呢？

这里有两种情况：
- 同一进程
- 垮进程

## 同一进程
同一个进程也分为两种情况：
- 单线程
- 多线程

单线程的比较好处理，我们只需要把数据写入 `ThreadLocal` 中就可以做到线程隔离。

```java
private static final ThreadLocal<Context> THREAD_LOCAL_STORAGE = new ThreadLocal<>();

@Override  
@Nullable  
public Context current() {  
  return THREAD_LOCAL_STORAGE.get();  
}
```

这点我们可以通过源码 `io.opentelemetry.context.ThreadLocalContextStorage`看到具体的实现过程。

而如果是多线程时：

```java
Executors.newFixedThreadPool(1).execute(() -> {  
    myMethod(request.getName());  
});
```

则需要对使用的线程池进行单独处理，将父线程中 threadlocal 中的数据拷贝出来进行传递，比如有阿里提供的 `TransmittableThreadLocal`，可以提供对线程池的支持。

## 跨进程
而如果是垮进程的场景，就需要将 context 的信息进行序列化传递。

如果是 gRPC 调用会将信息存放到 metadata 中。

HTTP 调用则是存放在 header 中。

消息队列，比如 Pulsar 也可以将数据存放在消息中的 header 中进行传递。

数据一旦跨进程传输成功后，就和单进程一样的处理方式了。
## Baggage

![](https://s2.loli.net/2024/05/05/3c6LNtIbSkpQlRU.png)

有时候我们需要通过垮 Span 传递信息，比如如上图所示：
我们需要在 serverB 中拿到 serverA 中收到的一个请求参数： `http://127.0.0.1:8181/request\?name\=1232`

![](https://s2.loli.net/2024/05/05/hISQNv91KP85WFC.png)

这个数据默认会作为 span 的 attribute ，但只会存在于第一个 span。

如果我们想要在后续的 span 中也能拿到这个数据，甚至是垮进程也能获取到。

那就需要使用 `Baggage` 这个对象了。

它的使用也很简单：

```java
@RequestMapping("/request")  
public String request(@RequestParam String name) {  
	// 写入
    Baggage.current().toBuilder().  
          put("request.name", name).build()  
          .storeInContext(Context.current()).makeCurrent();
}         

// 获取
String value = Baggage.current().getEntryValue("request.name");  
log.info("request.name: {}", value);
```

只要是属于同一个 trace 的调用就可以直接获取到数据。
![](https://s2.loli.net/2024/05/05/Lz1hY8pflRebANx.png)


> traceId 也是垮 Span 传递的。

而它的原理也是通过往 context 中写入数据实现的：

```java
@Immutable  
class BaggageContextKey {  
  static final ContextKey<Baggage> KEY = ContextKey.named("opentelemetry-baggage-key");  
  
  private BaggageContextKey() {}  
}
```

![](https://s2.loli.net/2024/05/05/vIHtBxGATKOg13l.png)
而这个 context 是通过一个 entries 数据存储数据的，不管是在内部还是外部的跨进程调用，OpenTelemetry 都会将 context 通过 `Context Propagation` 传递出去。


# 总结
Trace 这部分的内容我觉得比 Metrics 和 Logs 更加复杂一些，毕竟多了一些数据结构；现在的内容也只是冰山一角，现在也在做 trace 的一些定制化开发，后续有新的进展会接着更新。

参考链接：
- https://static.googleusercontent.com/media/research.google.com/zh-CN//archive/papers/dapper-2010-1.pdf
- https://opentelemetry.io/docs/languages/java/automatic/annotations/
- https://opentelemetry.io/docs/specs/otel/overview/#tracing-signal
- https://opentelemetry.io/docs/concepts/context-propagation/
- https://opentelemetry.io/docs/concepts/observability-primer/#distributed-traces
- https://tech.meituan.com/2023/04/20/traceid-google-dapper-mtrace.html