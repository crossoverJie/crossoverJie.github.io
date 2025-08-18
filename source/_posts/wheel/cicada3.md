---
title: 「造个轮子」——cicada 设计一个配置模块
date: 2018/09/14 01:19:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2019/05/08/5cd1d143dc8ff.jpg)


# 前言

在前两次的 [cicada](https://github.com/TogetherOS/cicada) 版本中其实还不支持读取配置文件，比如对端口、路由的配置。

因此我按照自己的想法创建了一个 [issue](https://github.com/TogetherOS/cicada/issues/6) ，也收集到了一些很不错的建议。

![](https://i.loli.net/2019/05/08/5cd1d145eb213.jpg)

![](https://i.loli.net/2019/05/08/5cd1d14b5ec72.jpg)

最终其实还是按照我之前的想法来做了这个配置管理。

> 同时将 `cicada` 升级到了 `v1.0.2`。

<!--more--> 


# 目标

在做之前是要把需求想好，到底怎样的一个配置管理是对开发人员来说比较友好的？

我认为有以下几点:

- 可以自定义配置，并且支持不同的环境（开发、测试、生产）。
- 使用灵活。对使用者来说不要有太多的束缚。

理论上来说配置这个东西应当完全独立出来，由一个配置中心来负责管理并且这样可以与应用解耦。

不过这样的实现和当前 `cicada` 的定义有些冲突，我想尽量小的依赖第三方组件并可以完全独立运行。

因此基于这样的情况便有了以下的实现。


# 使用

在看实现之前先看看基于目前的配置管理如何在业务中使用起来。

结合现在大家使用 `SpringBoot` 的习惯，`cicada` 默认会读取 `classpath` 下的 `application.properties` 配置文件。并且会默认读取其中的应用端口以及初始路由地址。

同时也新增了一个 api。

```java
public class MainStart {

    public static void main(String[] args) throws Exception {
        CicadaServer.start(MainStart.class,"/cicada-example") ;
    }
}

public class MainStart {

    public static void main(String[] args) throws Exception {
        CicadaServer.start(MainStart.class) ;
    }
}

```

这样在不传默认地址的时候 `cicada` 会从 `application.properties` 中读取。

考虑到后面可维护的情况，`cicada` 也支持配置各种不同的配置文件。

使用也比较简单，只需要继承 `cicada` 提供的一个抽象类即可。

```java
public class KafkaConfiguration extends AbstractCicadaConfiguration {

    public KafkaConfiguration() {
        super.setPropertiesName("kafka.properties");
    }


}

public class RedisConfiguration extends AbstractCicadaConfiguration {


    public RedisConfiguration() {
        super.setPropertiesName("redis.properties");
    }

}
```

![](https://i.loli.net/2019/05/08/5cd1d14d192b4.jpg)

按照这样的配置也会默认从 `classpath` 读取这两个配置文件。

> 当然这里有个前提：代码里配置的文件名必须得和配置文件名称相同。

那如何在业务中读取这两个配置文件的内容呢？

这也简单，代码一看就懂：

![](https://i.loli.net/2019/05/08/5cd1d14eb04b2.jpg)

- 首先需要通过 `ConfigurationHolder` 获取各自不同配置的管理对象（需要显式指定类类型）。
- 通过 `get()` 方法直接获取配置。
- 同时也支持获取 `application.properties` 里的配置。

同时为了支持在不同环境的使用，当配置了启动参数将会优先读取。

```shell
-Dapplication.properties=/xx/application.properties
-Dkafka.properties=/xx/kakfa.properties
-Dredis.properties=/xx/redis.properties
```

这样算是基本实现了上述的配置要求。

# 实现

要实现以上的功能有几个核心点：

1. 加载所有配置文件。
2. 将不同的配置文件用不同的对象进行管理。
3. 提供简易的接口使用。

由于 `cicada` 需要支持多个配置文件，所有需要定义一个抽象类供所有的配置管理实现。

![](https://i.loli.net/2019/05/08/5cd1d150763bd.jpg)

定义比较简单，其中有两个重要的成员变量：

- 文件名称：用于初始化时通过名称加载配置文件。
- `Properties` 其实就是一个 Map 结构的缓存，用于存放所有的配置。当然对外提供的查询是基于它的。


接着就是在初始化时需要找出所有继承了 `AbstractCicadaConfiguration` 的类。

![](https://i.loli.net/2019/05/08/5cd1d152ac101.jpg)

查询出来之后自然是要进行遍历同时反射创建对象。

由于之前已经调用了 

`super.setPropertiesName("redis.properties");` 

来赋值配置文件名称，所以还需要在遍历过程中将 `Properties` 进行赋值。

同时在这里也体现出优先读取的是 VM 启动参数中的配置文件。

```java
String systemProperty = System.getProperty(conf.getPropertiesName());
```

![](https://i.loli.net/2019/05/08/5cd1d15444720.jpg)

需要额外提一点的是：在查找所有用户自定义的配置管理类时需要手动将 `cicada` 内置的
`ApplicationConfiguration` 加入其中。

因为使用应用的包名通过反射是查询不出该类的。


## 保存自定义配置管理

为了方便用户在使用时候可以随意的读取各个配置文件，所以还需要将反射创建的对象保存到一个内部缓存中，核心代码就是上上图中的这段代码：

```java
// add configuration cache
ConfigurationHolder.addConfiguration(aClass.getName(), conf);
```

其中 `ConfigurationHolder` 的定义如下。

![](https://i.loli.net/2019/05/08/5cd1d15b7604e.jpg)

其实也是利用一个 Map 来存放这些对象。

这样在使用时候只需要取出即可。

```java
KafkaConfiguration configuration = (KafkaConfiguration) getConfiguration(KafkaConfiguration.class);
String brokerList = configuration.get("kafka.broker.list");
```

# 重构

本次升级同时还重构了部分代码，比如启动类。

现在看上去要清爽和直接的多：

![](https://i.loli.net/2019/05/08/5cd1d15c784dc.jpg)

其中也有一点需要注意的地方。

大家如果查看日志的话会发现应用启动之后会打印本次的耗时，自然就是在启动时候记录一个时间，初始化完毕之后记录一个即可。

![](https://i.loli.net/2019/05/08/5cd1d15e10f42.jpg)

在之前的实现中由于都是在一个方法内，所以直接使用就行了。

但现在优化之后跨越了不同的方法和类，难道要把时间作为参数在各个方法之前传递嘛？

> 那未免太不优雅了。

所以 `ThreadLocal` 就有了发挥余地。

在初始化的方法中我将当前时间写入：

```java
ThreadLocalHolder.setLocalTime(System.currentTimeMillis());
```

在最后记录日志的地方直接取出比较即可：

![](https://i.loli.net/2019/05/08/5cd1d15f2b6db.jpg)

这样使用起来就完全不需要管什么参数传递了。

同时 `ThreadLocalHolder` 的定义：

![](https://i.loli.net/2019/05/08/5cd1d16035ab1.jpg)

这里还是有一点需要注意，在这种长生命周期的容器中一定得要记得**及时清除**。

我这里的时间在查询一次之后就不用了，所以完全放心的在 `getLocalTime()` 方法中删掉。


# 总结


这就是本次 `v1.0.2` 中的升级内容，包含了配置支持以及代码重构。其中有些内容我觉得对接触少的同学来说还是挺有帮助的。

关于上两次的版本介绍请查看这里：

- [「造个轮子」——cicada(轻量级 WEB 框架)](https://crossoverjie.top/2018/09/03/wheel/cicada1/)
- [「造个轮子」——cicada 源码分析](https://crossoverjie.top/2018/09/05/wheel/cicada2/)

还没点关注的朋友可以点波关注：

[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada)

也欢迎大家参与一起维护！。

同时后续关于 `cicada` 的更新会放慢一些。会介绍一些平时实战相关的内容，比如 Kafka 之类的，请持续关注。


**你的点赞与转发是最大的支持。**
