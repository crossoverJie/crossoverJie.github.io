---
title: 实战：如何编写一个 OpenTelemetry Extensions
date: 2024/04/15 14:14:54
categories:
  - OB
tags:
- OpenTelemetry
---

# 前言
前段时间我们从 `SkyWalking` 切换到了 `OpenTelemetry` ，与此同时之前使用 SkyWalking 编写的插件也得转移到 OpenTelemetry 体系下。

我也写了相关介绍文章：
实战：[如何优雅的从 SkyWalking 切换到 OpenTelemetry](https://juejin.cn/post/7341669201010262053)

好在 OpenTelemetry 社区也提供了 Extensions 的扩展开发，我们可以不用去修改社区发行版：`opentelemetry-javaagent.jar` 的源码也可以扩展其中的能力。

比如可以：
- 修改一些 trace，某些 span 不想记录等。
- 新增 metrics

<!--more-->

这次我准备编写的插件也是和 metrics 有关的，因为 pulsar 的 Java sdk 中并没有暴露客户端的一些监控指标，所以我需要在插件中拦截到一些关键函数，然后执行暴露出指标。

截止到本文编写的时候， Pulsar 社区也已经将 `Java-client` [集成](https://github.com/apache/pulsar/pull/22178)了 OpenTelemetry，后续正式发版后我这个插件也可以光荣退休了。

---

由于 OpenTelemetry 社区还处于高速发展阶段，我在中文社区没有找到类似的参考文章（甚至英文社区也没有，只有一些 example 代码，或者是只有去社区成熟插件里去参考代码）

其中也踩了不少坑，所以觉得非常有必要分享出来帮助大家减少遇到同类问题的机会。


# 开发流程

OpenTelemetry extension 的写法其实和 `skywalking` 相似，都是用的 [bytebuddy](https://bytebuddy.net/#/)这个字节码增强库，只是在一些 API 上有一些区别。

## 创建项目

首先需要创建一个 Java 项目，这里我直接参考了官方的示例，使用了 gradle 进行管理（理论上 maven 也是可以的，只是要找到在 gradle 使用的 maven 插件）。


这里贴一下简化版的 `build.gradle` 文件：

```gradle
plugins {
    id 'java'
    id "com.github.johnrengelman.shadow" version "8.1.1"
    id "com.diffplug.spotless" version "6.24.0"
}

group = 'com.xx.otel.extensions'
version = '1.0.0'

ext {
    versions = [
            // this line is managed by .github/scripts/update-sdk-version.sh
            opentelemetrySdk           : "1.34.1",

            // these lines are managed by .github/scripts/update-version.sh
            opentelemetryJavaagent     : "2.1.0-SNAPSHOT",
            opentelemetryJavaagentAlpha: "2.1.0-alpha-SNAPSHOT",

            junit                      : "5.10.1"
    ]

    deps = [
    // 自动生成服务发现 service 文件
            autoservice: dependencies.create(group: 'com.google.auto.service', name: 'auto-service', version: '1.1.1')
    ]
}

repositories {
    mavenLocal()
    maven { url "https://maven.aliyun.com/repository/public" }
    mavenCentral()
}

configurations {
    otel
}


dependencies {

    implementation(platform("io.opentelemetry:opentelemetry-bom:${versions.opentelemetrySdk}"))

    /*
    Interfaces and SPIs that we implement. We use `compileOnly` dependency because during
    runtime all necessary classes are provided by javaagent itself.
     */
    compileOnly 'io.opentelemetry:opentelemetry-sdk-extension-autoconfigure-spi:1.34.1'
    compileOnly 'io.opentelemetry.instrumentation:opentelemetry-instrumentation-api:1.32.0'
    compileOnly 'io.opentelemetry.javaagent:opentelemetry-javaagent-extension-api:1.32.0-alpha'

    //Provides @AutoService annotation that makes registration of our SPI implementations much easier
    compileOnly deps.autoservice
    annotationProcessor deps.autoservice

    // https://mvnrepository.com/artifact/org.apache.pulsar/pulsar-client
    compileOnly 'org.apache.pulsar:pulsar-client:2.8.0'

}

test {
    useJUnitPlatform()
}
```

然后便是要创建  javaagent 的一个核心类：
```java
@AutoService(InstrumentationModule.class)  
public class PulsarInstrumentationModule extends InstrumentationModule {
    public PulsarInstrumentationModule() {
        super("pulsar-client-metrics", "pulsar-client-metrics-2.8.0");
    }	
}
```

在这个类中定义我们插件的名称，同时使用 `@AutoService` 注解可以在打包的时候帮我们在 `META-INF/services/`目录下生成 SPI 服务发现的文件：
![](https://s2.loli.net/2024/03/10/krqEn7lsIQbKJh6.png)
> 这是一个 Google 的插件，本质是插件是使用 SPI 的方式进行开发的。

关于 SPI 以前也写过一篇文章，不熟的朋友可以用作参考：
- [Java SPI 的原理与应用](https://crossoverjie.top/2020/02/24/wheel/cicada8-spi/)

## 创建 Instrumentation

之后就需要创建自己的 Instrumentation，这里可以把它理解为自己的拦截器，需要配置对哪个类的哪个函数进行拦截：

```java
public class ProducerCreateImplInstrumentation implements TypeInstrumentation {

    @Override
    public ElementMatcher<TypeDescription> typeMatcher() {
        return named("org.apache.pulsar.client.impl.ProducerBuilderImpl");
    }
    @Override
    public void transform(TypeTransformer transformer) {
        transformer.applyAdviceToMethod(
                isMethod()
                        .and(named("createAsync")),
                ProducerCreateImplInstrumentation.class.getName() + "$ProducerCreateImplConstructorAdvice");
    }
```

比如这就是对 `ProducerBuilderImpl` 类的 createAsync 创建函数进行拦截，拦截之后的逻辑写在了 `ProducerCreateImplConstructorAdvice` 类中。

值得注意的是对一些继承和实现类的拦截方式是不相同的：

```java
@Override  
public ElementMatcher<TypeDescription> typeMatcher() {  
    return extendsClass(named(ENHANCE_CLASS));  
    // return implementsInterface(named(ENHANCE_CLASS));
}
```

从这两个函数名称就能看出，分别是针对继承和实现类进行拦截的。

> 这里的 API 比 SkyWalking 的更易读一些。

之后需要把我们自定义的 Instrumentation 注册到刚才的 PulsarInstrumentationModule 类中：

```java
    @Override
    public List<TypeInstrumentation> typeInstrumentations() {
        return Arrays.asList(
                new ProducerCreateImplInstrumentation(),
                new ProducerCloseImplInstrumentation(),
                );
    }

```
有多个的话也都得进行注册。

## 编写切面代码

之后便是编写我们自定义的切面逻辑了，也就是刚才自定义的 `ProducerCreateImplConstructorAdvice` 类：

```java
    public static class ProducerCreateImplConstructorAdvice {

        @Advice.OnMethodEnter(suppress = Throwable.class)
        public static void onEnter() {
            // inert your code
            MetricsRegistration.registerProducer();
        }

        @Advice.OnMethodExit(suppress = Throwable.class)
        public static void after(
                @Advice.Return CompletableFuture<Producer> completableFuture) {
            try {
                Producer producer = completableFuture.get();
                CollectionHelper.PRODUCER_COLLECTION.addObject(producer);
            } catch (Throwable e) {
                System.err.println(e.getMessage());
            }
        }
    }
```

可以看得出来其实就是两个核心的注解：
-  `@Advice.OnMethodEnter` 切面函数调用之前
- `@Advice.OnMethodExit` 切面函数调用之后

还可以在 `@Advice.OnMethodExit`的函数中使用 `@Advice.Return`获得函数调用的返回值。

当然也可以使用 `@Advice.This` 来获取切面的调用对象。

## 编写自定义 metrics

因为我这个插件的主要目的是暴露一些自定义的 metrics，所以需要使用到 `io.opentelemetry.api.metrics` 这个包：

这里以 Producer 生产者为例，整体流程如下：
- 创建生产者的时候将生产者对象存储起来
- OpenTelemetry 框架会每隔一段时间回调一个自定义的函数
- 在这个函数中遍历所有的 producer 获取它的监控指标，然后暴露出去。

注册函数：

```java
public static void registerObservers() {  
    Meter meter = MetricsRegistration.getMeter();  
  
    meter.gaugeBuilder("pulsar_producer_num_msg_send")  
            .setDescription("The number of messages published in the last interval")  
            .ofLongs()  
            .buildWithCallback(  
                    r -> recordProducerMetrics(r, ProducerStats::getNumMsgsSent));
```

---

```java
private static void recordProducerMetrics(ObservableLongMeasurement observableLongMeasurement, Function<ProducerStats, Long> getter) {  
    for (Producer producer : CollectionHelper.PRODUCER_COLLECTION.list()) {  
        ProducerStats stats = producer.getStats();  
        String topic = producer.getTopic();  
        if (topic.endsWith(RetryMessageUtil.RETRY_GROUP_TOPIC_SUFFIX)) {  
            continue;  
        }        observableLongMeasurement.record(getter.apply(stats),  
                Attributes.of(PRODUCER_NAME, producer.getProducerName(), TOPIC, topic));  
    }}
```

回调函数，在这个函数中遍历所有的生产者，然后读取它的监控指标。

这样就完成了一个自定义指标的暴露，使用的时候只需要加载这个插件即可：

```shell
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.javaagent.extensions=ext.jar
     -jar myapp.jar
```

`-Dotel.javaagent.extensions=/extensions`
当然也可以指定一个目录，该目录下所有的 jar 都会被作为 extensions 被加入进来。

## 打包

使用 `./gradlew build` 打包，之后可以在`build/libs/`目录下找到生成物。

当然也可以将 extension 直接打包到 `opentelemetry-javaagent.jar`中，这样就可以不用指定 `-Dotel.javaagent.extensions`参数了。

具体可以在 gradle 中加入以下 task：

```java
task extendedAgent(type: Jar) {
  dependsOn(configurations.otel)
  archiveFileName = "opentelemetry-javaagent.jar"
  from zipTree(configurations.otel.singleFile)
  from(tasks.shadowJar.archiveFile) {
    into "extensions"
  }
  //Preserve MANIFEST.MF file from the upstream javaagent
  doFirst {
    manifest.from(
      zipTree(configurations.otel.singleFile).matching {
        include 'META-INF/MANIFEST.MF'
      }.singleFile
    )
  }
}
```

具体可以参考这里的配置：
[https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/examples/extension/build.gradle#L125](https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/examples/extension/build.gradle#L125)
# 踩坑

看起来这个开发过程挺简单的，但其中的坑还是不少。
## NoClassDefFoundError

首先第一个就是我在调试过程中出现 `NoClassDefFoundError` 的异常。

但我把打包好的 extension 解压后明明是可以看到这个类的。

![](https://s2.loli.net/2024/03/10/oyfEm27Tz5IJCnF.png)

排查一段时间后没啥头绪，我就从头仔细阅读了开发文档：
![](https://s2.loli.net/2024/03/10/sLbS7Hum5TUz1VD.png)

发现我们需要重写 `getAdditionalHelperClassNames`函数，用于将我们外部的一些工具类加入到应用的 class loader 中，不然在应用在运行的时候就会报 `NoClassDefFoundError` 的错误。

因为是字节码增强的关系，所以很多日常开发觉得很常见的地方都不行了，比如：
- 如果切面类是一个内部类的时候，必须使用静态函数
- 只能包含静态函数
- 不能包含任何字段，常量。
- 不能使用任何外部类，如果要使用就得使用 `getAdditionalHelperClassNames` 额外加入到 class loader 中（这一条就是我遇到的问题）
- 所有的函数必须使用 `@Advice` 注解

以上的内容其实在文档中都有写：
![](https://s2.loli.net/2024/03/10/1bXg6CMZYaUmdsu.png)

所以还是得仔细阅读文档。
## 缺少异常日志

其实上述的异常刚开始都没有打印出来，只有一个现象就是程序没有正常运行。

因为没有日志也不知道如何排查，也怀疑是不是运行过程中报错了，所以就尝试把`@Advice` 注解的函数全部 try catch ，果然打印了上述的异常日志。

![](https://s2.loli.net/2024/03/10/RMZbpyvkVc9qmJL.png)

之后我注意到了注解的这个参数，原来在默认情况下是不会打印任何日志的，需要手动打开。

比如这样：`@Advice.OnMethodExit(suppress = Throwable.class)`

## 调试日志

最后就是调试功能了，因为我这个插件的是把指标发送到 OpenTelemetry-collector ，再由它发往 `VictoriaMetrics/Prometheus`；由于整个链路比较长，我想看到最终生成的指标是否正常的干扰条件太多了。

好在 OpenTelemetry 提供了多种 metrics.exporter 的输出方式：

- -Dotel.metrics.exporter=otlp (default)，默认通过 otlp 协议输出到 collector 中。
- -Dotel.metrics.exporter=logging，以 stdout 的方式输出到控制台，主要用于调试
- -Dotel.metrics.exporter=logging-otlp
- -Dotel.metrics.exporter=prometheus，以 Prometheus 的方式输出，还可以配置端口，这样也可以让 Prometheus 进行远程采集，同样的也可以在本地调试。

采用哪种方式可以根据环境情况自行选择。

# Opentelemetry-operator 配置 extension

最近在使用 `opentelemetry-operator`注入 agent 的时候发现 operator 目前并不支持配置 extension，所以在社区也提交了一个[草案](https://github.com/open-telemetry/opentelemetry-operator/issues/1758#issuecomment-1982159356)，下周会尝试提交一个 PR 来新增这个特性。

> 这个需求我在 issue 列表中找到了好几个，时间也挺久远了，不太确定为什么社区还为实现。

目前 operator 只支持在自定义镜像中配置 `javaagent.jar`，无法配置 extension：

> 这个原理在之前的[文章](https://juejin.cn/post/7341669201010262053#heading-9)中有提到。

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: my-instrumentation
spec:
  java:
    image: your-customized-auto-instrumentation-image:java
```

我的目的是可以在自定义镜像中把 extension 也复制进去，类似于这样：

```dockerfile
FROM busybox

ADD open-telemetry/opentelemetry-javaagent.jar /javaagent.jar

# Copy extensions to specify a path.
ADD open-telemetry/ext-1.0.0.jar /ext-1.0.0.jar

RUN chmod -R go+r /javaagent.jar
RUN chmod -R go+r /ext-1.0.0.jar
```

然后在 CRD 中配置这个 `extension` 的路径：

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: my-instrumentation
spec:
  java:
    image: custom-image:1.0.0
    extensions: /ext-1.0.0.jar
    env:
    # If extension.jar already exists in the container, you can only specify a specific path with this environment variable.
      - name: OTEL_EXTENSIONS_DIR
        value: /custom-dir
```

这样 operator 在拿到 extension 的路径时，就可以在环境变量中加入 `-Dotel.javaagent.extensions=${java.extensions}` 参数，从而实现自定义 extension 的目的。
# 总结

整个过程其实并不复杂，只是由于目前用的人还不算多，所以也很少有人写教程或者文章，相信用不了多久就会慢慢普及。

这里有一些官方的 [example](https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/examples/extension#extensions-examples)可以参考。


参考链接：
- https://github.com/apache/pulsar/pull/22178
- https://opentelemetry.io/docs/languages/java/automatic/extensions/
- https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/examples/extension#extensions-examples
- https://github.com/open-telemetry/opentelemetry-operator/issues/1758#issuecomment-1982159356