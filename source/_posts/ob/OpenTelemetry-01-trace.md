---
title: OpenTelemetry 实战：从零实现分布式链路追踪
date: 2024/08/20 14:53:35
categories:
  - OB
  - OpenTelemetry
tags:
  - OpenTelemetry
---


# 背景
之前写过一篇 [从 Dapper 到 OpenTelemetry：分布式追踪的演进之旅](https://crossoverjie.top/2024/06/06/ob/OpenTelemetry-trace-concept/)的文章，主要是从概念上讲解了 Trace 在 OpenTelemetry 的中的场景和使用。

也写过一篇 [实操 OpenTelemetry：通过 Demo 掌握微服务监控的艺术](https://crossoverjie.top/2024/05/26/ob/OTel-demo/)：如何从一个 demo 开始集成 OpenTelemetry。

但还是有不少小伙伴反馈说无法快速上手（可能也是这个 demo 的项目比较多），于是我准备从 0 开始从真实的代码一步步带大家集成 `OpenTelemetry`，因为 OpenTelemetry 本身是跨多种语言的，所以也会以两种语言为（Java、Golang）主进行讲解。

> 使用这两种语言主要是因为 Java 几乎全是自动埋点，而 Golang 因为语言特性，大部分都得硬编码埋点；覆盖到这两种场景后其他语言也是类似的，顶多只是 API 名称有些许区别。


在这个过程中也会穿插一些 OpenTelemetry 的原理，希望整个过程下来大家可以在项目中实际运用起来，同时也能知其所以然。

<!--more-->

# 项目结构
在这个过程中会涉及到以下项目：

| 名称                              | 作用                                                              | 语言     | 版本                                            |
| ------------------------------- | --------------------------------------------------------------- | ------ | --------------------------------------------- |
| java-demo                       | 发送 gRPC 请求的客户端                                                  | Java   | opentelemetry-agent: 2.4.0/SpringBoot: 2.7.14 |
| k8s-combat                      | 提供 gRPC 服务的服务端                                                  | Golang | go.opentelemetry.io/otel: 1.28/ Go: 1.22      |
| Jaeger                          | trace 存储的服务端以及 TraceUI 展示                                       | Golang | jaegertracing/all-in-one:1.56                 |
| opentelemetry-collector-contrib | OpenTelemetry 的 collector 服务端，用于收集 trace/metrics/logs 然后写入到远端存储 | Golang | otel/opentelemetry-collector-contrib:0.98.0   |

![image.png](https://s2.loli.net/2024/07/15/u4BYXOkztqyUoEK.png)

在开始之前我们先看看实际的效果，我们需要先把 collector 和 Jaeger 部署好：

```shell
docker run --rm -d --name jaeger \
  -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 14250:14250 \
  -p 14268:14268 \
  -p 14269:14269 \
  -p 9411:9411 \
  jaegertracing/all-in-one:1.56


docker run --rm -d -v $(pwd)/coll-config.yaml:/etc/otelcol-contrib/config.yaml --name coll \
-p 5318:4318 \
-p 5317:4317 \
otel/opentelemetry-collector-contrib:0.98.0
```

这里有一个 `coll-config` 的配置文件如下：
```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:
exporters:
  debug:
  otlp:
    endpoint: "127.0.0.1:4317"
    tls:
      insecure: true
processors:
  batch:
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp, debug]

```

重点是这里的 `endpoint: "127.0.0.1:4317"` 我们需要配置位 Jaeger 的 IP 和端口。

> 更多关于这里的配置会在后续单独的 collector 章节中讲解。

这两个服务都启动成功后再启动我们的 Java 客户端和  Go  服务端：

```shell
java -javaagent:opentelemetry-javaagent-2.4.0-SNAPSHOT.jar \
-Dotel.traces.exporter=otlp \
-Dotel.metrics.exporter=otlp \
-Dotel.logs.exporter=none \
-Dotel.service.name=demo \
-Dotel.exporter.otlp.protocol=grpc \
-Dotel.propagators=tracecontext,baggage \
-Dotel.exporter.otlp.endpoint=http://127.0.0.1:5317 \
      -jar target/demo-0.0.1-SNAPSHOT.jar

# Golang
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:5317
export OTEL_RESOURCE_ATTRIBUTES=service.name=k8s-combat
./k8s-combat
```

可以看到不管是 Java 还是 Golang 应用都是需要配置 `OTEL_EXPORTER_OTLP_ENDPOINT` 参数，也就是 `opentelemetry-collector-contrib` 的地址。

> 其余的一些配置在后面会讲到。

```shell
curl http://127.0.0.1:9191/request\?name\=1232
```
然后我们触发一下 Java 客户端的入口，就可以在 JaegerUI 中查询到刚才的链路了。
`http://localhost:16686/search`

![image.png](https://s2.loli.net/2024/07/15/skNmSDJaPfHh3GB.png)
![image.png](https://s2.loli.net/2024/07/15/xoG2finOmFlDReE.png)
这样整个 `trace` 链路就串起来了。
# Java 应用

下面来看看具体的应用代码里是如何编写的。

> Java 是基于 springboot 编写的，具体 springboot 的使用就不再赘述了。

因为我们应用是使用 gRPC 通信的，所以需要提供一个 `helloworld.proto` 的 pb 文件：

```proto
syntax = "proto3";  
  
option go_package = "google.golang.org/grpc/examples/helloworld/helloworld";  
option java_multiple_files = true;  
option java_package = "io.grpc.examples.helloworld";  
option java_outer_classname = "HelloWorldProto";  
  
package helloworld;  
  
// The greeting service definition.  
service Greeter {  
  // Sends a greeting  
  rpc SayHello (HelloRequest) returns (HelloReply) {}  
}  
  
// The request message containing the user's name.  
message HelloRequest {  
  string name = 1;  
}  
  
// The response message containing the greetings  
message HelloReply {  
  string message = 1;  
}
```

这个文件也没啥好说的，就定义了一个简单的 `SayHello` 接口。

```xml
<dependency>  
  <groupId>net.devh</groupId>  
  <artifactId>grpc-spring-boot-starter</artifactId>  
  <version>3.1.0.RELEASE</version>  
</dependency>  
  
<dependency>  
  <groupId>io.grpc</groupId>  
  <artifactId>grpc-stub</artifactId>  
  <version>${grpc.version}</version>  
</dependency>  
<dependency>  
  <groupId>io.grpc</groupId>  
  <artifactId>grpc-protobuf</artifactId>  
  <version>${grpc.version}</version>  
</dependency>
```

在 Java 中使用了 `grpc-spring-boot-starter` 这个库来处理 gRPC 的客户端和服务端请求。

```yaml
grpc:  
  server:  
    port: 9192  
  client:  
    greeter:  
      address: 'static://127.0.0.1:50051'  
      enableKeepAlive: true  
      keepAliveWithoutCalls: true  
      negotiationType: plaintext
```

然后我们定义了一个接口用于接收请求触发 `gRPC` 的调用：

```java
    @RequestMapping("/request")  
    public String request(@RequestParam String name) {  
       log.info("request: {}", request);    
       HelloReply abc = greeterStub.sayHello(io.grpc.examples.helloworld.HelloRequest.newBuilder().setName(request.getName()).build());   
       return abc.getMessage();  
    }
```

Java 应用的实现非常简单，和我们日常日常开发没有任何区别；唯一的区别就是在启动时需要加入一个 `javaagent`以及一些启动参数。

```shell
java -javaagent:opentelemetry-javaagent-2.4.0-SNAPSHOT.jar \
-Dotel.traces.exporter=otlp \
-Dotel.metrics.exporter=otlp \
-Dotel.logs.exporter=none \
-Dotel.service.name=demo \
-Dotel.exporter.otlp.protocol=grpc \
-Dotel.propagators=tracecontext,baggage \
-Dotel.exporter.otlp.endpoint=http://127.0.0.1:5317 \
      -jar target/demo-0.0.1-SNAPSHOT.jar
```

下面来仔细看看这些参数

| 名称                                                   | 作用                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| javaagent:opentelemetry-javaagent-2.4.0-SNAPSHOT.jar | 这个没啥好说的，指定一个 javaagent                                                                                                                                                                                                                                                                                                                                                                                                                             |
| otel.traces.exporter                                 | 指定 trace 以什么格式传输（默认是这里的 `otlp`)；当然还有其他的值：`logging/jaeger/zipkin` 等，我们这里使用 otlp 会将数据传输到 collector 中。                                                                                                                                                                                                                                                                                                                                                |
| otel.metrics.exporter                                | 同上，只是指定的是 metrics 的传输方式，我们在之后讲解指标的时候会用到。                                                                                                                                                                                                                                                                                                                                                                                                           |
| otel.service.name                                    | 定义在 trace 中的应用名称，springboot 会默认使用 `spring.application.name` 这个变量。                                                                                                                                                                                                                                                                                                                                                                                  |
| otel.exporter.otlp.protocol                          | 指定传输协议；除了 grpc 之外还有 `http/protobuf`，当然我们也可以根据 trace 和 metrics 分开指定：`otel.exporter.otlp.traces.protocol/otel.exporter.otlp.metrics.protocol`                                                                                                                                                                                                                                                                                                        |
| otel.propagators                                     | 指定我们跨服务传播上下文的时候使用哪种格式，默认是 [W3C Trace Context](https://www.w3.org/TR/trace-context/),[baggage](https://www.w3.org/TR/baggage/)，当然也有其他的- `"b3"`: [B3 Single](https://github.com/openzipkin/b3-propagation#single-header)，- `"xray"`: [AWS X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html#xray-concepts-tracingheader)，`"jaeger"`: [Jaeger](https://www.jaegertracing.io/docs/1.21/client-libraries/#propagation-format)等 |
| otel.exporter.otlp.endpoint                          | 指定 collector 的 endpoint                                                                                                                                                                                                                                                                                                                                                                                                                            |
更多细节的参数大家可以在这里找到：
[https://opentelemetry.io/docs/languages/java/configuration/](https://opentelemetry.io/docs/languages/java/configuration/)
# Golang 应用

接着我们来看看 Go 是如何集成 `OpenTelemetry` 的。

在创建好项目之后我们需要添加 `OpenTelemetry` 所提供的包：

```shell
go get "go.opentelemetry.io/otel" \
  "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc" \
  "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc" \
  "go.opentelemetry.io/otel/propagation" \
  "go.opentelemetry.io/otel/sdk/metric" \
  "go.opentelemetry.io/otel/sdk/resource" \
  "go.opentelemetry.io/otel/sdk/trace" \       "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"\
```

然后我们需要创建一个初始化 `tracer` 的函数：

```go
func initTracerProvider() *sdktrace.TracerProvider {
	ctx := context.Background()

	exporter, err := otlptracegrpc.New(ctx)
	if err != nil {
		log.Printf("new otlp trace grpc exporter failed: %v", err)
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(initResource()),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return tp
}
```

因为我们使用的是 `grpc` 协议上报 `otlp` 数据，所以这里使用的是 `exporter, err := otlptracegrpc.New(ctx)`  创建了一个 `exporter`。

`otel.SetTextMapPropagator()` 这个函数里配置数据和刚才 Java 里配置的 `-Dotel.propagators=tracecontext,baggage` 是一样的效果。


与此同时我们还需要提供一个 `initResource()` 的函数：
```go
func initResource() *sdkresource.Resource {
	initResourcesOnce.Do(func() {
		extraResources, _ := sdkresource.New(
			context.Background(),
			sdkresource.WithOS(),
			sdkresource.WithProcess(),
			sdkresource.WithContainer(),
			sdkresource.WithHost(),
		)
		resource, _ = sdkresource.Merge(
			sdkresource.Default(),
			extraResources,
		)
	})
	return resource
}
```

这个函数用来告诉 trace 需要暴露那些 resource，也就是我们在这里看到进程相关的属性：
![image.png](https://s2.loli.net/2024/07/15/Gveu4hNjWdYLiBo.png)
比如这里的 `sdkresource.WithOS(),` 就会显示 OS 的类型和描述。
```go
func WithOS() Option {  
    return WithDetectors(  
       osTypeDetector{},  
       osDescriptionDetector{},  
    )}
```

而 `sdkresource.WithProcess(),` 显示的数据就更多了。
```go
func WithProcess() Option {  
    return WithDetectors(  
       processPIDDetector{},  
       processExecutableNameDetector{},  
       processExecutablePathDetector{},  
       processCommandArgsDetector{},  
       processOwnerDetector{},  
       processRuntimeNameDetector{},  
       processRuntimeVersionDetector{},  
       processRuntimeDescriptionDetector{},  
    )}
```

> 以上这些代码在 Java 中都是由 agent 指定创建的。

---

```go
// Init OpenTelemetry start  
tp := initTracerProvider()  
defer func() {  
    if err := tp.Shutdown(context.Background()); err != nil {  
       log.Printf("Error shutting down tracer provider: %v", err)  
    }}()  
   
err := runtime.Start(runtime.WithMinimumReadMemStatsInterval(time.Second))  
if err != nil {  
    log.Err(err)  
}
tracer = tp.Tracer("k8s-combat")
// Init OpenTelemetry end
```

之后我们需要在 main 函数一开始就初始化 `traceProvider`。

对于 `grpc` 来说，`OpenTelemetry` 的 Go-SDK 提供了自动埋点，但我们也得手动配置一下：

```go
s := grpc.NewServer(  
    grpc.StatsHandler(otelgrpc.NewServerHandler()),  
)  
pb.RegisterGreeterServer(s, &server{})
```

使用 `grpc.StatsHandler(otelgrpc.NewServerHandler()),`  将 `OTel` 的 `serverHandle` 加入进去，这个 handle 会自动创建 `grpc` 服务端的 `span`。

> 对 trace/span 概念还有不了解的朋友可以查看这篇[文章](https://crossoverjie.top/2024/06/06/ob/OpenTelemetry-trace-concept/)。


```go
var port = ":50051"  
lis, err := net.Listen("tcp", port)  
if err != nil {  
    log.Fatal().Msgf("failed to listen: %v", err)  
}  
s := grpc.NewServer(  
    grpc.StatsHandler(otelgrpc.NewServerHandler()),  
)  
pb.RegisterGreeterServer(s, &server{})  
if err := s.Serve(lis); err != nil {  
    log.Fatal().Msgf("failed to serve: %v", err)  
} else {  
    log.Printf("served on %s \n", port)  
}
```

接着我们只需要启动这个 grpc 服务即可，就算完成了 Go 服务的集成。

从这里可以看出 Java 相对于 Go 来说会简单许多，只需要配置一个 agent 就可以不该一行代码支持目前市面上流行的绝大多数框架。
![](https://s2.loli.net/2024/04/17/kMDcrPwxJy4oZYe.png)


# 自定义  span 的 attribute
我们在看链路信息的时候其实看的最多的是某个 `span` 里的 `attribute` 数据（有些地方又称为 `tag`)
如下图所示：
![](https://s2.loli.net/2024/07/15/jrdkNCAZhi6UIvP.png)

这里会展示当前 `span` 的各种信息，但如果我们想要额外加一些自己关心的数据应该如何添加呢？

```proto
message HelloRequest {  
  string name = 1;  
}
```
比如我们想知道这个 grpc 接口里的 name 参数，如上图所示那样展示在 span 中。

好在 `OpenTelemetry` 已经考虑到类似的需求：

```go
span := trace.SpanFromContext(ctx)  
span.SetAttributes(attribute.String("request.name", in.Name))
```

我们使用 `span := trace.SpanFromContext(ctx)`  获取到当前的 span，然后调用 `SetAttributes` 就可以添加自定义的数据了。

> 对应的 Java 也有类似的函数。

除了新增 `attribute` 之外还可以新增 Event，Link 等数据，使用方式也是类似的。
```Go 
// AddEvent adds an event with the provided name and options.  
AddEvent(name string, options ...EventOption)  
  
// AddLink adds a link.  
// Adding links at span creation using WithLinks is preferred to calling AddLink  
// later, for contexts that are available during span creation, because head  
// sampling decisions can only consider information present during span creation.  
AddLink(link Link)
```


# 自定义新增 span

同理我们可能不局限于为某个 span 新增 attribute，也有可能想要新增一个新的 span 来记录关键的调用信息。

> 默认情况下只有 OpenTelemetry 实现过的组件的核心函数才会有 span，自己代码里的函数调用是不会创建span 的。


```go
func (s *server) span(ctx context.Context) {  
    ctx, span := tracer.Start(ctx, "hello-span")  
    defer span.End()  
    // do some work  
    log.Printf("create span")  
}
```

在  Go 中只需要手动 Start 一个 span 即可。

对应到 `Java` 稍微简单一些，只需要为函数添加一个注解即可。


```java
@WithSpan("span")  
public void span(@SpanAttribute("request.name") String name) {  
    TimeUnit.SECONDS.sleep(1);  
    log.info("span:{}", name);  
}
```

只不过得单独引入一个依赖：
```xml
<dependency>  
  <groupId>io.opentelemetry</groupId>  
  <artifactId>opentelemetry-api</artifactId>  
</dependency>  
  
<dependency>  
  <groupId>io.opentelemetry.instrumentation</groupId>  
  <artifactId>opentelemetry-instrumentation-annotations</artifactId>  
  <version>2.3.0</version>  
</dependency>
```


最终我们在 Jaeger UI 上看到的效果如下：

![](https://s2.loli.net/2024/07/15/1tLlYezQwInZWDX.png)


# 总结
![](https://s2.loli.net/2024/07/15/WXPp1MUkdHo4zam.png)

最后总结一下，OpenTelemetry 支持许多流行的语言，主要分为两类：是否支持自动埋点。

![](https://s2.loli.net/2024/07/15/fvu67rdoxtZkq5m.png)
> 这里 Go 也可以零代码埋点，是使用了 eBPF，本文暂不做介绍。

对于支持自动埋点的语言就很简单，只需要配置下 agent 即可；而原生的 Go 语言不支持自动埋点就得手动使用 OpenTelemetry 提供的 SDK 处理一些关键步骤；总体来说也不算复杂。

下一期会重点讲解如何使用 Metrics。

感兴趣的朋友可以在这里查看 Go 相关的源码：
- [https://github.com/crossoverJie/k8s-combat](https://github.com/crossoverJie/k8s-combat)



参考链接：
- https://opentelemetry.io/docs/languages/java/configuration/
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/supported-libraries.md
- https://crossoverjie.top/2024/06/06/ob/OpenTelemetry-trace-concept/