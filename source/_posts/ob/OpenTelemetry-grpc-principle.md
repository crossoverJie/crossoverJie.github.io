---
title: OpenTelemetry 实战：gRPC 监控的实现原理
date: 2024/08/29 14:50:33
categories:
  - OB
  - OpenTelemetry
tags:
  - OpenTelemetry
---


# 前言

![](https://s2.loli.net/2024/07/29/uUTYr8lziEABk4d.png)

最近在给 `opentelemetry-java-instrumentation` 提交了一个 [PR](https://github.com/open-telemetry/opentelemetry-java-instrumentation/pull/11833)，是关于给 gRPC 新增四个 metrics：
- `rpc.client.request.size`: 客户端请求包大小
- `rpc.client.response.size`：客户端收到的响应包大小
- `rpc.server.request.size`：服务端收到的请求包大小
- `rpc.server.response.size`：服务端响应的请求包大小

这个 PR 的主要目的就是能够在指标监控中拿到 `RPC` 请求的包大小，而这里的关键就是如何才能拿到这些包的大小。

<!--more-->

首先支持的是 `gRPC`（目前在云原生领域使用的最多），其余的 RPC 理论上也是可以支持的：
![](https://s2.loli.net/2024/07/29/efGYRktoK8IESzP.png)

在实现的过程中我也比较好奇 `OpenTelemetry` 框架是如何给 `gRPC` 请求创建 `span` 调用链的，如下图所示：
![image.png](https://s2.loli.net/2024/07/15/skNmSDJaPfHh3GB.png)
![image.png](https://s2.loli.net/2024/07/15/xoG2finOmFlDReE.png)
> 这是一个 gRPC 远程调用，java-demo 是 gRPC 的客户端，k8s-combat 是 gRPC 的服务端

在开始之前我们可以根据 `OpenTelemetry` 的运行原理大概猜测下它的实现过程。

首先我们应用可以创建这些链路信息的前提是：使用了 `OpenTelemetry` 提供的 `javaagent`，这个 agent 的原理是在运行时使用了 [byte-buddy](https://github.com/raphw/byte-buddy) 增强了我们应用的字节码，在这些字节码中代理业务逻辑，从而可以在不影响业务的前提下增强我们的代码（只要就是创建 span、metrics 等数据）
> Spring 的一些代理逻辑也是这样实现的


# gRPC 增强原理
而在工程实现上，我们最好是不能对业务代码进行增强，而是要找到这些框架提供的扩展接口。

拿 `gRPC` 来说，我们可以使用它所提供的 `io.grpc.ClientInterceptor` 和 `io.grpc.ServerInterceptor` 接口来增强代码。

打开 `io.opentelemetry.instrumentation.grpc.v1_6.TracingClientInterceptor` 类我们可以看到它就是实现了 `io.grpc.ClientInterceptor`：
![](https://s2.loli.net/2024/07/29/dVaESmoXIwJC6Li.png)

而其中最关键的就是要实现 `io.grpc.ClientInterceptor#interceptCall` 函数：

```java
@Override  
public <REQUEST, RESPONSE> ClientCall<REQUEST, RESPONSE> interceptCall(  
    MethodDescriptor<REQUEST, RESPONSE> method, CallOptions callOptions, Channel next) {  
  GrpcRequest request = new GrpcRequest(method, null, null, next.authority());  
  Context parentContext = Context.current();  
  if (!instrumenter.shouldStart(parentContext, request)) {  
    return next.newCall(method, callOptions);  
  }  
  Context context = instrumenter.start(parentContext, request);  
  ClientCall<REQUEST, RESPONSE> result;  
  try (Scope ignored = context.makeCurrent()) {  
    try {  
      // call other interceptors  
      result = next.newCall(method, callOptions);  
    } catch (Throwable e) {  
      instrumenter.end(context, request, Status.UNKNOWN, e);  
      throw e;  
    }  }  
  return new TracingClientCall<>(result, parentContext, context, request);  
}
```

这个接口是 `gRPC` 提供的拦截器接口，对于 `gRPC` 客户端来说就是在发起真正的网络调用前后会执行的方法。

所以在这个接口中我们就可以实现创建 span 获取包大小等逻辑。

## 使用 byte-buddy 增强代码
不过有一个问题是我们实现的 `io.grpc.ClientInterceptor` 类需要加入到拦截器中才可以使用：

```java
var managedChannel = ManagedChannelBuilder.forAddress(host, port) .intercept(new TracingClientInterceptor()) // 加入拦截器
.usePlaintext()
.build();
```

但在 `javaagent` 中是没法给业务代码中加上这样的代码的。

此时就需要 [byte-buddy](https://bytebuddy.net/#/) 登场了，它可以动态修改字节码从而实现类似于修改源码的效果。

在 `io.opentelemetry.javaagent.instrumentation.grpc.v1_6.GrpcClientBuilderBuildInstr umentation`  类里可以看到 `OpenTelemetry` 是如何使用 `byte-buddy` 的。


```java
  @Override
  public ElementMatcher<TypeDescription> typeMatcher() {
    return extendsClass(named("io.grpc.ManagedChannelBuilder"))
        .and(declaresField(named("interceptors")));
  }

  @Override
  public void transform(TypeTransformer transformer) {
    transformer.applyAdviceToMethod(
        isMethod().and(named("build")),
        GrpcClientBuilderBuildInstrumentation.class.getName() + "$AddInterceptorAdvice");
  }

  @SuppressWarnings("unused")
  public static class AddInterceptorAdvice {

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void addInterceptor(
        @Advice.This ManagedChannelBuilder<?> builder,
        @Advice.FieldValue("interceptors") List<ClientInterceptor> interceptors) {
      VirtualField<ManagedChannelBuilder<?>, Boolean> instrumented =
          VirtualField.find(ManagedChannelBuilder.class, Boolean.class);
      if (!Boolean.TRUE.equals(instrumented.get(builder))) {
        interceptors.add(0, GrpcSingletons.CLIENT_INTERCEPTOR);
        instrumented.set(builder, true);
      }
    }
  }
```

从这里的源码可以看出，使用了 `byte-buddy` 拦截了 `io.grpc.ManagedChannelBuilder#intercept(java.util.List<io.grpc.ClientInterceptor>)` 函数。

> io.opentelemetry.javaagent.extension.matcher.AgentElementMatchers#extendsClass/ isMethod 等函数都是 byte-buddy 库提供的函数。

而这个函数正好就是我们需要在业务代码里加入拦截器的地方。

```java
interceptors.add(0, GrpcSingletons.CLIENT_INTERCEPTOR);
GrpcSingletons.CLIENT_INTERCEPTOR = new TracingClientInterceptor(clientInstrumenter, propagators);
```
通过这行代码可以手动将 `OpenTelemetry` 里的 `TracingClientInterceptor` 加入到拦截器列表中，并且作为第一个拦截器。


而这里的：
```java
extendsClass(named("io.grpc.ManagedChannelBuilder"))
        .and(declaresField(named("interceptors")))
```

通过函数的名称也可以看出是为了找到 继承了`io.grpc.ManagedChannelBuilder` 类中存在成员变量 `interceptors` 的类。

```java
transformer.applyAdviceToMethod(  
    isMethod().and(named("build")),  
    GrpcClientBuilderBuildInstrumentation.class.getName() + "$AddInterceptorAdvice");
```
然后在调用 `build` 函数后就会进入自定义的 `AddInterceptorAdvice` 类，从而就可以拦截到添加拦截器的逻辑，然后把自定义的拦截器加入其中。

# 获取 span 的 attribute

![](https://s2.loli.net/2024/07/29/dawSY4uQGmJo6qi.png)

我们在 gRPC 的链路中还可以看到这个请求的具体属性，比如：
- gRPC 服务提供的 IP 端口。
- 请求的响应码
- 请求的 service 和 method
- 线程等信息。
> 这些信息在问题排查过程中都是至关重要的。

可以看到这里新的 `attribute` 主要是分为了三类：
- `net.*` 是网络相关的属性
- `rpc.*` 是和 grpc 相关的属性
- `thread.*` 是线程相关的属性

所以理论上我们在设计 API 时最好可以将这些不同分组的属性解耦开，如果是 MQ 相关的可能还有一些 topic 等数据，所以各个属性之间是互不影响的。

带着这个思路我们来看看 gRPC 这里是如何实现的。
```java
clientInstrumenterBuilder
	.setSpanStatusExtractor(GrpcSpanStatusExtractor.CLIENT)
	.addAttributesExtractors(additionalExtractors)
        .addAttributesExtractor(RpcClientAttributesExtractor.create(rpcAttributesGetter))
        .addAttributesExtractor(ServerAttributesExtractor.create(netClientAttributesGetter))
        .addAttributesExtractor(NetworkAttributesExtractor.create(netClientAttributesGetter))
```

`OpenTelemetry` 会提供一个 `io.opentelemetry.instrumentation.api.instrumenter.InstrumenterBuilder#addAttributesExtractor`构建器函数，用于存放自定义的属性解析器。

从这里的源码可以看出分别传入了网络相关、RPC 相关的解析器；正好也就对应了图中的那些属性，也满足了我们刚才提到的解耦特性。

而每一个自定义属性解析器都需要实现接口 `io.opentelemetry.instrumentation.api.instrumenter.AttributesExtractor`
```java
public interface AttributesExtractor<REQUEST, RESPONSE> {
}
```

这里我们以 `GrpcRpcAttributesGetter` 为例。

```java
enum GrpcRpcAttributesGetter implements RpcAttributesGetter<GrpcRequest> {
  INSTANCE;

  @Override
  public String getSystem(GrpcRequest request) {
    return "grpc";
  }

  @Override
  @Nullable
  public String getService(GrpcRequest request) {
    String fullMethodName = request.getMethod().getFullMethodName();
    int slashIndex = fullMethodName.lastIndexOf('/');
    if (slashIndex == -1) {
      return null;
    }
    return fullMethodName.substring(0, slashIndex);
  }
```

可以看到 system 是写死的 `grpc`，也就是对于到页面上的 `rpc.system` 属性。


而这里的 `getService` 函数则是拿来获取 `rpc.service` 属性的，可以看到它是通过 `gRPC` `的method` 信息来获取 `service` 的。

---


```java
public interface RpcAttributesGetter<REQUEST> {  
  
  @Nullable  
  String getService(REQUEST request);
}
```
而这里 `REQUEST` 其实是一个泛型，在 gRPC 里是 `GrpcRequest`，在其他 RPC 里这是对应的 RPC 的数据。

这个 `GrpcRequest` 是在我们自定义的拦截器中创建并传递的。
![](https://s2.loli.net/2024/07/29/46mOv7XMoT81Bxl.png)

而我这里需要的请求包大小也是在拦截中获取到数据然后写入进 GrpcRequest。

![](https://s2.loli.net/2024/07/29/A1zk79tVOr3DxnQ.png)


```java
static <T> Long getBodySize(T message) {  
  if (message instanceof MessageLite) {  
    return (long) ((MessageLite) message).getSerializedSize();  
  } else {  
    // Message is not a protobuf message  
    return null;  
  }}
```

这样就可以实现不同的 RPC 中获取自己的 `attribute`，同时每一组 `attribute` 也都是隔离的，互相解耦。

# 自定义 metrics
每个插件自定义 Metrics 的逻辑也是类似的，需要由框架层面提供 API 接口：

```java
public InstrumenterBuilder<REQUEST, RESPONSE> addOperationMetrics(OperationMetrics factory) {  
  operationMetrics.add(requireNonNull(factory, "operationMetrics"));  
  return this;  
}
// 客户端的 metrics
.addOperationMetrics(RpcClientMetrics.get());

// 服务端的 metrics
.addOperationMetrics(RpcServerMetrics.get());
```

之后也会在框架层面回调这些自定义的 `OperationMetrics`:

```java
    if (operationListeners.length != 0) {
      // operation listeners run after span start, so that they have access to the current span
      // for capturing exemplars
      long startNanos = getNanos(startTime);
      for (int i = 0; i < operationListeners.length; i++) {
        context = operationListeners[i].onStart(context, attributes, startNanos);
      }
    }

	if (operationListeners.length != 0) {  
	  long endNanos = getNanos(endTime);  
	  for (int i = operationListeners.length - 1; i >= 0; i--) {  
	    operationListeners[i].onEnd(context, attributes, endNanos);  
	  }
	}
```
这其中最关键的就是两个函数 onStart 和 onEnd，分别会在当前这个 span 的开始和结束时进行回调。

所以通常的做法是在 `onStart` 函数中初始化数据，然后在 `onEnd` 结束时统计结果，最终可以拿到 metrics 所需要的数据。

以这个 `rpc.client.duration` 客户端的请求耗时指标为例：
```java
@Override  
public Context onStart(Context context, Attributes startAttributes, long startNanos) {  
  return context.with(  
      RPC_CLIENT_REQUEST_METRICS_STATE,  
      new AutoValue_RpcClientMetrics_State(startAttributes, startNanos));  
}

@Override  
public void onEnd(Context context, Attributes endAttributes, long endNanos) {  
  State state = context.get(RPC_CLIENT_REQUEST_METRICS_STATE);
	Attributes attributes = state.startAttributes().toBuilder().putAll(endAttributes).build();  
	clientDurationHistogram.record(  
	    (endNanos - state.startTimeNanos()) / NANOS_PER_MS, attributes, context);
}
```

在开始时记录下当前的时间，结束时获取当前时间和结束时间的差值正好就是这个 span 的执行时间，也就是 rpc client 的处理时间。

在 `OpenTelemetry` 中绝大多数的请求时间都是这么记录的。


# Golang 增强
而在 `Golang` 中因为没有 [byte-buddy](https://bytebuddy.net/#/) 这种魔法库的存在，不可以直接修改源码，所以通常的做法还是得硬编码才行。

还是以 `gRPC` 为例，我们在创建 gRPC server 时就得指定一个 `OpenTelemetry` 提供的函数。

```go
s := grpc.NewServer(  
    grpc.StatsHandler(otelgrpc.NewServerHandler()),  
)
```
![](https://s2.loli.net/2024/07/29/RP9LWQVKSOF1d4Z.png)

 在这个 SDK 中也会实现刚才在 Java 里类似的逻辑，限于篇幅具体逻辑就不细讲了。

# 总结

以上就是 `gRPC` 在 `OpenTelemetry` 中的具体实现，主要就是在找到需要增强框架是否有提供扩展的接口，如果有就直接使用该接口进行埋点。

如果没有那就需要查看源码，找到核心逻辑，再使用 `byte-buddy` 进行埋点。

![](https://s2.loli.net/2024/07/30/h1uvr3EjA9fGmzR.png)

比如 Pulsar 并没有在客户端提供一些扩展接口，只能找到它的核心函数进行埋点。

而在具体埋点过程中 `OpenTelemetry` 提供了许多解耦的 API，方便我们实现埋点所需要的业务逻辑，也会在后续的文章继续分析 `OpenTelemetry` 的一些设计原理和核心 API 的使用。

这部分 API 的设计我觉得是 `OpenTelemetry` 中最值得学习的地方。

参考链接：
- https://bytebuddy.net/#/
- https://opentelemetry.io/docs/specs/semconv/rpc/rpc-metrics/#metric-rpcserverrequestsize