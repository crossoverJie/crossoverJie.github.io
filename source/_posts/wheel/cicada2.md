---
title: 「造个轮子」——cicada 源码分析
date: 2018/09/05 01:09:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2019/05/08/5cd1d14f1f2b1.jpg)

# 前言

两天前写了文章[《「造个轮子」——cicada(轻量级 WEB 框架)》
](https://crossoverjie.top/2018/09/03/wheel/cicada1/) 向大家介绍了 `cicada` 之后收到很多反馈，也有许多不错的建议。

同时在 GitHub 也收获了 100 多颗 小♥♥（绝对不是刷的。。）

![](https://i.loli.net/2019/05/08/5cd1d15189c70.jpg)

也有朋友希望能出一个源码介绍，本文就目前的 `v1.0.1` 版本来一起分析分析。

> 没有看错，刚发布就修复了一个 bug，想要试用的请升级到 `1.0.1` 吧。

<!--more-->

# 技术选型

一般在做一个新玩意之前都会有技术选型的过程，但这点在做 `cicada` 的时候却异常简单。

因为我的需求是想提供一个高性能的 HTTP 服务，纵观整个开源界其实选择不多。

加上最近我在做 Netty 相关的开发，所以自然而然就选择了它。

同时 Netty 自带了对 HTTP 协议的编解码器，可以非常简单快速的开发一个 HTTP 服务器。我只需要把精力放在参数处理、路由等业务处理上即可。

同时 Netty 也是基于 NIO 实现，性能上也有保证。关于 Netty 相关内容可以参考[这里](https://crossoverjie.top/categories/Netty/)。

下面来重点分析其中的各个过程。


# 路由规则

最核心的自然就是 HTTP 的处理 `handle`，对应的就是 `HttpHandle` 类。

![](https://i.loli.net/2019/05/08/5cd1d15386288.jpg)

查看源码其实很容易看出具体的步骤，注释也很明显。

这里只分析重点功能。

先来考虑下需求。

首先作为一个 HTTP 框架，自然是得让使用者能有地方来实现业务代码；就像咱们现在使用 SpringMVC 时写的 `controller` 一样。

其实当时考虑过三种方案：

- 像 SpringMVC 一样定义注解，只要声明了对应注解我就认为这是一个业务类。
- 用过 Struts2 的同学应该有印象，它的业务类 Action 都是配置到一个 XML 中；在里面配置接口对应的业务处理类。
- 同样的思路，只是把 XML 文件换成 `properties` 配置文件，在里面编写 JSON 格式的对应关系。


这时就得分析各个方案的优缺点了。

方案二和三其实就是 XML 和 json 的对比了；XML 会让维护者感到结构清晰，同时便于维护和新增。

JSON 就不太方便处理了，并且在这样的场景并不用于传输自然也发挥不出优势。

最后考虑到现在流行的 SpringBoot 都在去 XML，要是再搞一个依赖于 XML 的东西也跟不上大家的使用习惯。

于是就采用类似于 SpringMVC 这样的注解形式。


既然采用了注解，那框架怎么知道用户访问某个接口时能对应到业务类呢？

所以首先第一步自然是需要将加有注解的类全部扫描一遍，放到一个本地缓存中。

这样才能方便后续的路由定位。

# 路由策略

其中核心的源码在 `routeAction` 方法中。

![](https://i.loli.net/2019/05/08/5cd1d15aa7f17.jpg)

首先会全局扫描使用了 `@CicadaAction` 的注解，然后再根据请求地址找到对应的业务类。

全局扫描代码：

![](https://i.loli.net/2019/05/08/5cd1d15ca2e73.jpg)

首先是获取到项目中自定义的所有类，然后判断是否加有 `@CicadaAction` 注解。

是目标类则把他缓存到一个本地 Map 中，方便下次访问时可以不再扫描直接从缓存中获取即可（反射很耗性能）。

执行完 `routeAction` 后会获得真正的业务类类型。

`Class<?> actionClazz = routeAction(queryStringDecoder, appConfig);`

# 传参方式

拿到业务类的类类型之后就成功一大半了，只需要反射生成它的对象然后执行方法即可。

在执行方法之前又要涉及到一个问题，参数我该怎么传递呢？

考虑到灵活性我采用了最简答 Map 方式。

因此定义了一个通用的 Param 接口并继承了 Map 接口。

```java
public interface Param extends Map<String, Object> {

    /**
     * get String
     * @param param
     * @return
     */
    String getString(String param);

    /**
     * get Integer
     * @param param
     * @return
     */
    Integer getInteger(String param);

    /**
     * get Long
     * @param param
     * @return
     */
    Long getLong(String param);

    /**
     * get Double
     * @param param
     * @return
     */
    Double getDouble(String param);

    /**
     * get Float
     * @param param
     * @return
     */
    Float getFloat(String param);

    /**
     * get Boolean
     * @param param
     * @return
     */
    Boolean getBoolean(String param) ;
}
```

其中封装了几种基本类型的获取方式。

同时在 `buildParamMap()` 方法中，将接口中的参数封装到这个 Map 中。

```java
Param paramMap = buildParamMap(queryStringDecoder);
```

![](https://i.loli.net/2019/05/08/5cd1d15e4425b.jpg)


# 业务执行

最后只需要执行业务即可；由于在上文已经获取到业务类的类类型，所以这里通过反射即可调用。

同时也定义了一个业务类需要实现的一个通用接口 `WorkAction`，想要实现具体业务只要实现它就行。

![](https://i.loli.net/2019/05/08/5cd1d15f63262.jpg)

而这里的方法参数自然就是刚才定义的参数接口 `Param`。

由于所有的业务类都是实现了 `WorkAction`，所以在反射时都可以定义为 `WorkAction` 对象。

```java
WorkAction action = (WorkAction) actionClazz.newInstance();
WorkRes execute = action.execute(paramMap);
```

最后将构建好的参数 map 传入即可。

# 响应返回

有了请求那自然也得有响应，观察刚才定义的 `WorkAction` 接口可以发现其实定义了一个 `WorkRes` 响应类。

所有的响应数据都需要封装到这个对象中。

![](https://i.loli.net/2019/05/08/5cd1d160649b6.jpg)

这个没啥好说的，都是一些基本数据。

最后在 `responseMsg()` 方法中将响应数据编码为 JSON 输出即可。

![](https://i.loli.net/2019/05/08/5cd1d16783d38.jpg)

# 拦截器设计

拦截器也是一个框架基本的功能，用处非常多。

`cicada` 的实现原理非常简单，就是在 `WorkAction` 接口执行业务逻辑之前调用一个方法、执行完毕之后调用另一个方法。


也是同样的思路需要定义一个接口 `CicadaInterceptor`，其中有两个方法。

![](https://i.loli.net/2019/05/08/5cd1d168565eb.jpg)

看方法名字自然也能看出具体作用。

![](https://i.loli.net/2019/05/08/5cd1d1694b1c1.jpg)

同时在这两个方法中执行具体的调用。

这里重点要看看 `interceptorBefore` 方法。

![](https://i.loli.net/2019/05/08/5cd1d16a97d32.jpg)

其中也是加入了一个缓存，尽量的减少反射操作。


## 适配器

就这样的拦截器接口是够用了，但并不是所有的业务都需要实现两个接口。

因此也提供了一个适配器 `AbstractCicadaInterceptorAdapter`。

![](https://i.loli.net/2019/05/08/5cd1d17122767.jpg)

它作为一个抽象类实现了 `CicadaInterceptor` 接口，这样后续的拦截业务也可继承该接口选择性的实现方法即可。

类似于这样：

![](https://i.loli.net/2019/05/08/5cd1d17301847.jpg)



# 总结

`v1.0.1` 版本的 `cicada` 就介绍完毕了，其中的原理和源码都比较简单。

大量使用了反射和一些设计模式、多态等应用，这方面经验较少的朋友可以参考下。

同时也有很多不足；比如传参后续会考虑更加优雅的方式、拦截器目前写的比较死，后续会利用动态代理实现自定义拦截。

其实 `cicada` 只是利用周末两天时间做的，bug 肯定少不了；也欢迎大家在 GitHub 上提 [issue](https://github.com/TogetherOS/cicada/issues) 参与。

最后贴下项目地址：

[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada)

**你的点赞与转发是最大的支持。**

