---
title: SpringCloud Feign 实现动态 URL
date: 2022/05/23 08:15:36 
categories: 
- 问题排查
- Java 进阶
tags: 
- Feign
- SpringCloud
---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hksgjbitj21hc0u0ajs.jpg)

# 背景
前段时间同事碰到一个问题，需要在 `SpringCloud` 的 Feign 调用中使用自定义的 URL；通常情况下是没有这个需求的；毕竟都用了 `SpringCloud` 的了，那服务之间的调用都是走注册中心的，不会需要自定义 URL 的情况。

<!--more-->

但也有特殊的，比如我们这里碰到 `ToB` 场景，需要对每个商户自定义的 `URL` 进行调用。

虽说也可以使用原生的 `Feign` 甚至是自定义一个 `OKHTTP Client` 实现，但这些方案都得换一种写法；

打算利用现有的 `SpringCloud` `OpenFeign` 来实现，毕竟原生的 Feign 其实是支持该功能的，而 `SpringCloud OpenFeign` 也只是在这基础上封装了一层。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hmgcpmg5j21aa0bsjtl.jpg)

只需要在接口声明处加上一个 `URI` 参数即可，这样就可以在每次调用时传递不同的 `URI` 来实现动态 `URL` 的目的。

---
想法很简单，但实践起来却不是那么回事了。
伪代码如下：

```java
	@FeignClient(name = "dynamic")
	interface DynamicClient {
		@GetMapping("/")
		String get(URI uri);
	}
	
	dynamicClient.get(URI.create("https://github.com"));	
```

执行后会抛出负载均衡的异常：

```java
java.lang.RuntimeException: com.netflix.client.ClientException:
Load balancer does not have available server for client: github.com
```

这个异常也能理解，就是找不到 github 这个服务；找不到也是合理的，毕竟也不是一个内部注册的服务。

但按照 `Feign` 的官方介绍，只要接口中声明了 `URI` 这个参数就能自定义，同时我自己也用原生的 Feign 测试过确实没什么问题。



# Debug

那问题只能出在 `SpringCloud OpenFeign` 的封装上了；经过同事的搜索在网上找到一篇博客解决了这个问题。

https://www.cnblogs.com/syui-terra/p/14386188.html

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hmzxmu68j20xg0u0n16.jpg)

按照文中的说法，确实只需要加上 URL 参数同时有值就可以了，但原因不明。

本着打破砂锅问到底的精神，我个人也想知道 `OpenFeign` 是如何处理的，只要 url 有值就可以，这完全是个黑盒，而且在官方的注释中并没有对这种情况有特殊说明。

所以我准备从源码中找到答案。

既然是 url 有值就能正常运行，那一定是在运行过程中获取了这个值；

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hn5b81vtj211o0ds763.jpg)
但我在源码中查看 url 所使用的地方，并没有在单测之外找到哪里有所应用，说明源码中并没有直接调用 `url()` 这个函数来获取值。

但 `org.springframework.cloud.openfeign.FeignClient` 这个注解总会使用吧，于是我又查询这个注解的使用情况。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hnamym3tj22sh0u0tl4.jpg)
最终在这里查到了使用的痕迹。

> 这里查阅源码时也有一些小技巧，比如如果我们直接查询时，IDEA 默认的查询范围是整个项目和所有依赖库，会有许多干扰信息。

比如我这里就需要只看项目源码，单测这些都不用看；所以在查询的时候可以过滤一下，这样干扰信息就会少很多。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hndgadtzj22mo0u0wou.jpg)

左边的工具栏还有许多过滤条件，大家可以自行研究一下。

---
接着从源码中进行阅读，会发现是将 `@FeignClient` 中的所有数据都写到一个 `Map` 里进行使用的。
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hnfkwg9dj21920u0jyh.jpg)
最终会发现这个 url 被写入到了 `FeignClientFactoryBean` 中的 url 成员变量中了。

查看哪里在使用这个 url 就知道背后的原理了。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hnkav8hgj21l20rsdlb.jpg)

在这里打个断点会发现：当 url 为空时会返回一个 `LoadBalance` 的 `client`，也就是会从注册中心获取 `url` 的客户端，而 `url` 有值时则会获取一个默认的客户端，这样就不会走负载均衡了。

> 所以我们如果想在 OpenFeign 中使用动态 url 时就得让 @Feign 的 url 有值才行，无论是什么都可以。

## Feign 的实现

既然已经看到这一步了，我也比较好奇 Feign 是如何做到只要有 URI 参数就使用指定的 URL 呢？

> 这里也分享一个读源码的小技巧，如果我们跟着程序执行的思路去一步步 `debug` 的话会非常消耗时间，毕竟这类成熟库的代码量也不小。

这里我们从官方文档中可以得知只要在接口参数中使用了 `java.net.URI` 便会走自定义的 url，所以我们反过来只要在源码中找到哪里在使用 `java.net.URI` 便能知道关键源码。

毕竟使用 `java.net.URI` 的场景也不会太多。

---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hnw6rwq1j225408idia.jpg)
所以只需要在这个依赖的地方 `cmd+shift+f` 全局搜索 `java.net.URI` 就能查到结果，果然不多，只有两处使用。

---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2hnzg6tcvj21r60sgjxn.jpg)
再结合使用场景猜测大概率是判断参数中是否是有 `URL.class` 这样的条件，或者是 url 对象；总之我们先用
`URL` 这样关键字在这两个文件中搜索一下，记得勾选匹配大小写；最后会发现的确是判断了参数中是否有 `URL` 这个类，同时将这个索引位置记录了下来。

想必后续会通过这个索引位置读取最终的 `url` 信息。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h2ho2auls1j21v20daq7r.jpg)

最终通过这个索引的使用地方查询到了核心源码，如果有值时就取这个 URI 中所指定的地址作为 `target`。

到此为止这个问题的背后原理都已经分析完毕了。

# 总结

其实本文重点是分析了一些 `debug` 和阅读源码的一些小技巧，特别是在读关于 `Spring` 相关的代码时一定不能 debug 跟踪到细节中，因为调用链通常是很长的，稍不留神就把自己都绕晕了，只需要知道核心、关键源码是如何处理的即可。

最后对于 OpenFeign 处理动态 url 的方案确实也有些疑惑，是一个典型的`约定大于配置`的场景，但问题就在于我们并不知道这个约定是 `@Feign`  的 url 得有值。

所以我也提了一个 `PR` 给 `OpenFeign`，感兴趣的朋友也可以查看一下：

[https://github.com/spring-cloud/spring-cloud-openfeign/pull/713](https://github.com/spring-cloud/spring-cloud-openfeign/pull/713)
