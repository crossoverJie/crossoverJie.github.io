---
title: 「造个轮子」——cicada(轻量级 WEB 框架)
date: 2018/09/03 01:10:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2019/05/08/5cd1d1720ab7a.jpg)

# 前言

俗话说 「不要重复造轮子」，关于是否有必要不再本次讨论范围。

创建这个项目的主要目的还是提升自己，看看和知名类开源项目的差距以及学习优秀的开源方式。

好了，现在着重来谈谈 [cicada](https://github.com/crossoverJie/cicada) 这个项目的核心功能。

我把他定义为一个快速、轻量级 WEB 框架；没有过多的依赖，核心 jar 包仅 30KB。

也仅需要一行代码即可启动一个 `HTTP` 服务。

![](https://i.loli.net/2019/05/08/5cd1d17354c8b.jpg)

<!--more-->

---

![](https://i.loli.net/2019/05/08/5cd1d1741f0cb.jpg)

# 特性

现在来谈谈重要的几个特性。

![](https://i.loli.net/2019/05/08/5cd1d175166b9.jpg)

当前版本主要实现了基本的请求、响应、自定义参数以及拦截器功能。

> 功能虽少，但五脏俱全。

在今后的迭代过程中会逐渐完善上图功能，有好的想法也欢迎提 [https://github.com/crossoverJie/cicada/issues](https://github.com/crossoverJie/cicada/issues)。

# 快速启动

下面来看看如何快速启动一个 HTTP 服务。

只需要创建一个 Maven 项目，并引入核心包。

```xml
<dependency>
    <groupId>top.crossoverjie.opensource</groupId>
    <artifactId>cicada-core</artifactId>
    <version>1.0.1</version>
</dependency>
```

如上图所示，再配置一个启动类即可。

```java
public class MainStart {

    public static void main(String[] args) throws InterruptedException {
        CicadaServer.start(MainStart.class,"/cicada-example") ;
    }
}
```


## 配置业务 Action

当然我们还需要一个实现业务逻辑的地方。`cicada` 提供了一个接口，只需要实现该接口即可实现具体逻辑。

创建业务 Action 实现 `top.crossoverjie.cicada.server.action.WorkAction` 接口。

```java
@CicadaAction(value = "demoAction")
public class DemoAction implements WorkAction {


    private static final Logger LOGGER = LoggerBuilder.getLogger(DemoAction.class) ;

    private static AtomicLong index = new AtomicLong() ;

    @Override
    public WorkRes<DemoResVO> execute(Param paramMap) throws Exception {
        String name = paramMap.getString("name");
        Integer id = paramMap.getInteger("id");
        LOGGER.info("name=[{}],id=[{}]" , name,id);

        DemoResVO demoResVO = new DemoResVO() ;
        demoResVO.setIndex(index.incrementAndGet());
        WorkRes<DemoResVO> res = new WorkRes();
        res.setCode(StatusEnum.SUCCESS.getCode());
        res.setMessage(StatusEnum.SUCCESS.getMessage());
        res.setDataBody(demoResVO) ;
        return res;
    }

}
```

同时需要再自定义类中加上 `@CicadaAction` 注解，并需要指定一个 `value`，该 value 主要是为了在请求路由时能找到业务类。

这样启动应用并访问 

`http://127.0.0.1:7317/cicada-example/demoAction?name=12345&id=10` 

便能执行业务逻辑同时得到服务端的返回。

![](https://i.loli.net/2019/05/08/5cd1d21b836c2.jpg)

目前默认支持的是 `json` 响应，后期也会加上模板解析。

服务中也会打印相关日志。

![](https://i.loli.net/2019/05/08/5cd1d21c7ebc4.jpg)

## 灵活的参数配置

这里所有的请求参数都封装在 `Param` 中，可以利用其中的各种 API 获取请求数据。

之所以是灵活的：我们甚至可以这样请求：

```
http://127.0.0.1:7317/cicada-example/demoAction?jsonData="info": {
    "age": 22,
    "name": "zhangsan"
  }
```

这样就可以传递任意结构的数据，只要业务处理时进行解析即可。

# 自定义拦截器

拦截器是一个框架的基本功能，可以利用拦截器实现日志记录、事务提交等通用工作。

为此 `cicada` 提供一个接口: `top.crossoverjie.cicada.server.intercept.CicadaInterceptor`。

我们只需要实现该接口即可编写拦截功能：

```java
@Interceptor(value = "executeTimeInterceptor")
public class ExecuteTimeInterceptor implements CicadaInterceptor {

    private static final Logger LOGGER = LoggerBuilder.getLogger(ExecuteTimeInterceptor.class);

    private Long start;

    private Long end;

    @Override
    public void before(Param param) {
        start = System.currentTimeMillis();
    }

    @Override
    public void after(Param param) {
        end = System.currentTimeMillis();

        LOGGER.info("cast [{}] times", end - start);
    }
}
```

这里演示的是记录所有 action 的执行时间。

目前默认只实现了 action 的拦截，后期也会加入自定义拦截器。

## 拦截适配器

虽说在拦截器中提供了 `before/after` 两个方法，但也不是所有的方法都需要实现。

因此 `cicada` 提供了一个适配器：

`top.crossoverjie.cicada.server.intercept.AbstractCicadaInterceptorAdapter`

我们需要继承他便可按需实现其中的某个方法，如下所示：

```java
@Interceptor(value = "loggerInterceptor")
public class LoggerInterceptorAbstract extends AbstractCicadaInterceptorAdapter {

    private static final Logger LOGGER = LoggerBuilder.getLogger(LoggerInterceptorAbstract.class) ;

    @Override
    public void before(Param param) {
        LOGGER.info("logger param=[{}]",param.toString());
    }

}
```

# 性能测试

既然是一个 HTTP 服务框架，那性能自然也得保证。

在测试条件为：`300 并发连续压测两轮；1G 内存、单核 CPU、1Mbps。`用 Jmeter 压测情况如下：

![](https://i.loli.net/2019/05/08/5cd1d21d32a5f.jpg)

同样的服务器用 Tomcat 来压测看看结果。

Tomcat 的线程池配置:

```xml
<Executor name="tomcatThreadPool" namePrefix="consumer-exec-"
        maxThreads="510" minSpareThreads="10"/>
```

![](https://i.loli.net/2019/05/08/5cd1d220bbdbf.jpg)

我这里请求的是 Tomcat 的一个 doc 目录，虽说结果看似 `cicada` 的性能比 Tomcat  还强。

但其实这个对比过程中的变量并没有完全控制好，Tomcat 所返回的是 HTML，而 `cicada` 仅仅返回了 json，当然问题也不止这些。

但还是能说明 `cicada` 目前的性能还是不错的。

# 总结

本文没有过多讨论 `cicada` 实现原理，感兴趣的可以看看源码，都比较简单。

在后续的更新中会仔细探讨这块内容。

同时不出意外 `cicada` 会持续更新，未来也会加入更多实用的功能。

甚至我会在适当的时机将它应用于我的生产项目，也希望更多朋友能参与进来一起把这个「轮子」做的更好。

项目地址：[https://github.com/crossoverJie/cicada](https://github.com/crossoverJie/cicada)

**你的点赞与转发是最大的支持。**

