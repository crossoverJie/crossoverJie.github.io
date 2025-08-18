---
title: 日志与追踪的完美融合：OpenTelemetry MDC 实践指南 
date: 2024/09/05 14:50:33
categories:
  - OB
  - OpenTelemetry
tags:
 - OpenTelemetry
---


# 前言

在前面两篇实战文章中：
- [OpenTelemetry 实战：从零实现分布式链路追踪](https://juejin.cn/post/7391744486979076146)
- [OpenTelemetry 实战：从零实现应用指标监控](https://juejin.cn/post/7394395254566846475)

覆盖了可观测中的指标追踪和 `metrics` 监控，下面理应开始第三部分：**日志**。

但在开始日志之前还是要先将链路追踪和日志结合起来看看应用实际使用的实践。

通常我们排查问题的方式是先查询异常日志，判断是否是当前系统的问题。

如果不是，则在日志中捞出 `trace_id` 再到链路查询系统中查询链路，看看具体是哪个系统的问题，然后再做具体的排查。


类似于这样：
![](https://s2.loli.net/2024/08/05/mP97tShHKrGXge2.png)
日志中会打印 `trace_id` 和 `span_id`。

> 如果日志系统做的比较完善的话，还可以直接点击 `trace_id` 跳转到链路系统里直接查询链路信息。

<!--more-->

# MDC
这里的日志里关联 trace 信息的做法有个专有名词：MDC:(Mapped Diagnostic Context)。

简单来说就是用于排查问题的上下文信息，通常是由键值对组成，类似于这样的数据：
```json
{  
  "timestamp" : "2024-08-05 17:27:31.097",  
  "level" : "INFO",  
  "thread" : "http-nio-9191-exec-1",  
  "mdc" : {  
    "trace_id" : "26242f945af80b044a60226af00211fb",  
    "trace_flags" : "01",  
    "span_id" : "3a7842b3e28ed5c8"  
  },  
  "logger" : "com.example.demo.DemoApplication",  
  "message" : "request: name: \"1232\"\n",  
  "context" : "default"  
}
```
在 Java 中的 Log4j 和 Logback 都有提供对应的实现。

如果我们使用了 OpenTelemetry 提供的 `javaagent` 再配合 `logback` 或者 `Log4j` 时就会自动具备打印 `MDC` 的能力：

```shell
java -javaagent:/Users/chenjie/Downloads/blog-img/demo/opentelemetry-javaagent-2.4.0-SNAPSHOT.jar xx.jar
```

比如我们只需要这样配置这样一个JSON 输出的 logback 即可：

```xml
<appender name="PROJECT_LOG" class="ch.qos.logback.core.rolling.RollingFileAppender">  
    <file>${PATH}/demo.log</file>  
  
    <rollingPolicy class="ch.qos.logback.core.rolling.FixedWindowRollingPolicy">  
        <fileNamePattern>${PATH}/demo_%i.log</fileNamePattern>  
        <maxIndex>1</maxIndex>  
    </rollingPolicy>  
  
    <triggeringPolicy class="ch.qos.logback.core.rolling.SizeBasedTriggeringPolicy">  
        <maxFileSize>100MB</maxFileSize>  
    </triggeringPolicy>  
  
    <layout class="ch.qos.logback.contrib.json.classic.JsonLayout">  
        <jsonFormatter  
                class="ch.qos.logback.contrib.jackson.JacksonJsonFormatter">  
            <prettyPrint>true</prettyPrint>  
        </jsonFormatter>  
        <timestampFormat>yyyy-MM-dd' 'HH:mm:ss.SSS</timestampFormat>  
    </layout>  
  
</appender>  
  
<root level="INFO">  
    <appender-ref ref="STDOUT"/>  
    <appender-ref ref="PROJECT_LOG"/>  
</root>
```

![](https://s2.loli.net/2024/08/05/ba195iyS2hgnOVx.png)

就会在日志文件中输出 `JSON` 格式的日志，并且带上 `MDC` 的信息。

# 自动 MDC 的原理
我也比较好奇 OpenTelemetry 是如何自动写入 MDC 信息的，这里以 `logback` 为例。


```java
@Override  
public ElementMatcher<TypeDescription> typeMatcher() {  
  return implementsInterface(named("ch.qos.logback.classic.spi.ILoggingEvent"));  
}  
  
@Override  
public void transform(TypeTransformer transformer) {  
  transformer.applyAdviceToMethod(  
      isMethod()  
          .and(isPublic())  
          .and(namedOneOf("getMDCPropertyMap", "getMdc"))  
          .and(takesArguments(0)),  
      LoggingEventInstrumentation.class.getName() + "$GetMdcAdvice");  
}
```

会在调用 `ch.qos.logback.classic.spi.ILoggingEvent.getMDCPropertyMap()/getMdc()` 这两个函数中进行埋点。

> 这些逻辑都是写在 javaagent 中的。

```java
public Map<String, String> getMDCPropertyMap() {  
    // populate mdcPropertyMap if null  
    if (mdcPropertyMap == null) {  
        MDCAdapter mdc = MDC.getMDCAdapter();  
        if (mdc instanceof LogbackMDCAdapter)  
            mdcPropertyMap = ((LogbackMDCAdapter) mdc).getPropertyMap();  
        else  
            mdcPropertyMap = mdc.getCopyOfContextMap();  
    }    
    // mdcPropertyMap still null, use emptyMap()  
    if (mdcPropertyMap == null)  
        mdcPropertyMap = Collections.emptyMap();  
  
    return mdcPropertyMap;  
}
```

这个函数其实默认情况下会返回一个 logback 内置 MDC 的 map 数据（这里的数据我们可以自定义配置）。

而这里要做的就是将 trace 的上下文信息写入这个 mdcPropertyMap 中。

以下是 OpenTelemetry agent 中的源码：
```java
Map<String, String> spanContextData = new HashMap<>();  
  
SpanContext spanContext = Java8BytecodeBridge.spanFromContext(context).getSpanContext();  
  
if (spanContext.isValid()) {  
  spanContextData.put(traceIdKey(), spanContext.getTraceId());  
  spanContextData.put(spanIdKey(), spanContext.getSpanId());  
  spanContextData.put(traceFlagsKey(), spanContext.getTraceFlags().asHex());  
}  
spanContextData.putAll(ConfiguredResourceAttributesHolder.getResourceAttributes());  
  
if (LogbackSingletons.addBaggage()) {  
  Baggage baggage = Java8BytecodeBridge.baggageFromContext(context);  
  
  // using a lambda here does not play nicely with instrumentation bytecode process  
  // (Java 6 related errors are observed) so relying on for loop instead  for (Map.Entry<String, BaggageEntry> entry : baggage.asMap().entrySet()) {  
    spanContextData.put(  
        // prefix all baggage values to avoid clashes with existing context  
        "baggage." + entry.getKey(), entry.getValue().getValue());  
  }}  
  
if (contextData == null) {  
  contextData = spanContextData;  
} else {  
  contextData = new UnionMap<>(contextData, spanContextData);  
}
```

这就是核心的写入逻辑，从这个代码中也可以看出直接从上线文中获取的 span 的 context，而我们所需要的 `trace_id/span_id`  都是存放在 context 中的，只需要 get 出来然后写入进 map 中即可。


从源码里还得知，只要我们开启 `-Dotel.instrumentation.logback-mdc.add-baggage=true` 配置还可以将 baggage 中的数据也写入到 MDC 中。

而得易于 OpenTelemetry 中的 trace 是可以跨线程传输的，所以即便是我们在多线程里打印日志时 MDC 数据依然可以准确无误的传递。

## MDC 的原理

```java
public static final String MDC_ATTR_NAME = "mdc";
```

![](https://s2.loli.net/2024/08/05/e7PIASyowDGO1sQ.png)

在 `logback` 的实现中是会调用刚才的 `getMDCPropertyMap()` 然后写入到一个 key 为 `mdc` 的 `map` 里，最终可以写入到文件或者控制台。

这样整个原理就可以串起来了。

## 自定义日志 数据
提到可以自定义 MDC 数据其实也是有使用场景的，比如我们的业务系统经常有类似的需求，需要在日志中打印一些常用业务数据：
- userId、userName
- 客户端 IP等信息时

此时我们就可以创建一个 `Layout` 类来继承 `ch.qos.logback.contrib.json.classic.JsonLayout`:

```java
public class CustomJsonLayout extends JsonLayout {
    public CustomJsonLayout() {
    }

    protected void addCustomDataToJsonMap(Map<String, Object> map, ILoggingEvent event) {
        map.put("user_name", context.getProperty("userName"));
        map.put("user_id", context.getProperty("userId"));
        map.put("trace_id", TraceContext.traceId());
    }
}


public class CustomJsonLayoutEncoder extends LayoutWrappingEncoder<ILoggingEvent> {  
    public CustomJsonLayoutEncoder() {  
    }  
    public void start() {  
        CustomJsonLayout jsonLayout = new CustomJsonLayout();  
        jsonLayout.setContext(this.context);  
        jsonLayout.setIncludeContextName(false);  
        jsonLayout.setAppendLineSeparator(true);  
        jsonLayout.setJsonFormatter(new JacksonJsonFormatter());  
        jsonLayout.start();  
        super.setCharset(StandardCharsets.UTF_8);  
        super.setLayout(jsonLayout);  
        super.start();  
    }}
```

> 这里的 trace_id 是之前使用 skywalking 的时候由 skywalking 提供的函数：org.apache.skywalking.apm.toolkit.trace.TraceContext#traceId

接着只需要在 `logback.xml` 中配置这个 `CustomJsonLayoutEncoder` 就可以按照我们自定义的数据输出日志了：

```xml
<appender name="PROJECT_LOG" class="ch.qos.logback.core.rolling.RollingFileAppender">  
    <file>${PATH}/app.log</file>  
  
    <rollingPolicy class="ch.qos.logback.core.rolling.FixedWindowRollingPolicy">  
        <fileNamePattern>${PATH}/app_%i.log</fileNamePattern>  
        <maxIndex>1</maxIndex>  
    </rollingPolicy>  
  
    <triggeringPolicy class="ch.qos.logback.core.rolling.SizeBasedTriggeringPolicy">  
        <maxFileSize>100MB</maxFileSize>  
    </triggeringPolicy>  
  
    <encoder class="xx.CustomJsonLayoutEncoder"/>  
</appender>

<root level="INFO">  
    <appender-ref ref="STDOUT"/>  
    <appender-ref ref="PROJECT_LOG"/>  
</root>
```

虽然这个功能也可以使用日志切面来打印，但还是没有直接在日志中输出更加方便，它可以直接和我们的日志关联在一起，只是多加了这几个字段而已。



##  Spring Boot 使用

`OpenTelemetry` 有给 springboot 应用提供一个 `spring-boot-starter` 包，用于在不使用  `javaagent` 的情况下也可以自动埋点。


```xml
<dependencies>
  <dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-spring-boot-starter</artifactId>
    <version>OPENTELEMETRY_VERSION</version>
  </dependency>
</dependencies>
```

但在早[期的版本](https://github.com/open-telemetry/opentelemetry-java-instrumentation/discussions/7653)中还不支持直接打印 MDC 日志：
![image.png](https://s2.loli.net/2024/08/05/aunR8ApiMEoeJ1O.png)

> 最新的版本已经支持


即便已经支持默认输出 MDC 后，我们依然可以自定义的内容，比如我们想修改一下 key 的名称，由 `trace_id` 修改为 `otel_trace_id` 等。



```xml
<appender name="OTEL" class="io.opentelemetry.instrumentation.logback.mdc.v1_0.OpenTelemetryAppender">
  <traceIdKey>otel_trace_id</traceIdKey>
  <spanIdKey>otel_span_id</spanIdKey>
  <traceFlagsKey>otel_trace_flags</traceFlagsKey>
</appender>
```

还是和之前类似，修改下 logback.xml 即可。

![image.png](https://s2.loli.net/2024/08/05/Y3zvfm6rUbxwtOK.png)
他的实现逻辑其实和之前的 auto instrument 中的类似，只不过使用的 API 不同而已。

auto instrument 是直接拦截代码逻辑修改 map 的返回值，而 `OpenTelemetryAppender` 是继承了 `ch.qos.logback.core.UnsynchronizedAppenderBase` 接口，从而获得了重写 `MDC` 的能力，但本质上都是一样的，没有太大区别。

不过使用它的前提是我们需要引入以下一个依赖：

```xml
<dependencies>
  <dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-logback-mdc-1.0</artifactId>
    <version>OPENTELEMETRY_VERSION</version>
  </dependency>
</dependencies>
```

如果不想修改 logback.yaml ，对于 `springboot` 来说还有更简单的方案，我们只需要使用以下配置即可自定义 MDC 数据：

```properties
logging.pattern.level = trace_id=%mdc{trace_id} span_id=%mdc{span_id} trace_flags=%mdc{trace_flags} %5p
```

这里的 key 也可以自定义，只要占位符没有取错即可。

> 使用这个的前提是需要加载  javaagent，因为这里的数据是 javaagent 里写进去的。


# 总结

以上就是关于 `MDC` 在 `OpenTelemetry` 中的使用，从使用和源码逻辑上都分析了一遍，希望对 `MDC` 和 `OpenTelemetry` 的理解更加深刻一些。

关于 MDC 相关的概念与使用还是很有用的，是日常排查问题必不可少的一个工具。