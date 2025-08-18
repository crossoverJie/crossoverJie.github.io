---
title: 撸了一个 Feign 增强包
date: 2020/07/28 08:10:36 
categories: 
- 轮子
tags: 
- Java
- Feign
- SpringBoot
---

![](https://i.loli.net/2020/07/28/uA1BmwnQNs3GXHS.jpg)

# 前言

最近准备将公司的一个核心业务系统用 `Java` 进行重构，大半年没写 `Java` ，`JDK` 都更新到 14 了，考虑到稳定性等问题最终还是选择的 `JDK11`。

在整体架构选型时，由于是一个全新的系统，所以没有历史包袱，同时团队中也有多位大牛坐镇，因此我们的选项便大胆起来。

最终结果就是直接一把梭，直接上未来的大趋势：`Service Mesh`，直接把什么 `SpringCloud`、`Dubbo` 这类分布式框架全部干掉。

本次的重点不是讨论 `Service Mesh` 是什么、能解决什么问题、为什么选择它，毕竟我也在学习阶段，啥时候整明白线上也稳定了再和大家来交流。

<!--more-->

# 问题

既然方向定了就开始实际撸码了，不过刚一开始就验证了”理想很丰满、现实很骨感“；

由于我们去掉了 `SpringCloud` 和 `Dubbo` 这类框架，服务的注册、发现、负载均衡等需求全部都下沉到 `Service Mesh` 中提供了。

但对于开发来说依然希望可以调用本地方法的方式来调用远程服务，这在 `SpringCloud` 这类框架中是很容易实现的，框架本身就有很好的支持。

回到我们这个场景，需求其实很简单，就是想达到 `SpringCloud` 中的 `Feign` 这样的声明式+注解的方式调用。

![](https://i.loli.net/2020/07/28/xnIo8mQbjHfURZg.jpg)

```java
    @Autowired
    private StoreClient client ;
    
    Store store = client.update(1, store)
```

使用 `spring-cloud-openfeign` 这个包其实就能实现上述的需求了，但这样会引入一些我们根本不会使用的 `SpringCloud` 的相关依赖，让人感觉”不干净了“；同时也和 `Service Mesh` 的理念相反，其中的一大目的就是要降低这类框架的侵入性。

---

其实 `spring-cloud-openfeign` 的核心就是 [Feign](https://github.com/OpenFeign/feign)，本身它也是可以开箱即用的，所以便尝试看 `Feign` 自己是否支持这样的用法。

![](https://i.loli.net/2020/07/28/TXLH9rFSNyp1x4I.jpg)

通过官方文档可以得知：是可以定义接口的形式来调用远程接口的，但它本质上是不依赖其他库便可以使用，所以它本身是没有和 `Spring` 整合也是合情合理，但也就造成了没有现成库可供我们使用。

> 我们自然是不想写上图红框处的代码的，希望所有接口直接注入就可以使用。


# 使用

因此结合以上的需求便有了这个库 [feign-plus](https://github.com/crossoverJie/feign-plus)

它的使用流程其实就是翻版的 `spring-cloud-openfeign`：

```java
@FeignPlusClient(name = "github", url = "${github.url}")
public interface Github {

    @RequestLine("GET /repos/{owner}/{repo}/contributors")
    List<GitHubRes> contributors(@Param("owner") String owner, @Param("repo") String repo);
}
```

在 `SpringBoot` 入口进行扫描：

```java
@SpringBootApplication
@EnableFeignPlusClients(basePackages = "top.crossoverjie.feign.test")
public class DemoApplication {

	public static void main(String[] args) {
		SpringApplication.run(DemoApplication.class, args);
	}

}
```

在 `Spring` 上下文中直接注入使用：

```java
    @Autowired
    private Github github ;
    
    List<GitHubRes> contributors = github.contributors("crossoverJie", "feign-plus");
    logger.info("contributors={}", new Gson().toJson(contributors));    
```

所以当我们需要调用一些外部第三方接口时（比如支付宝、外部 OpenAPI）便可类似于这样定义一个接口，把所有 HTTP 请求的细节屏蔽掉。

当然也适合公司内部之间的服务调用，和咱们以前写 `SpringCloud` 或 `Dubbo` 时类似；服务提供方提供一个 `Client` 包，消费方直接依赖便可以调用。其他的负载均衡、容错之类的由 `Service Mesh` 替我们完成。

对于内部接口，也可以加上 `@RequestMapping("/path")` 注解：

![](https://i.loli.net/2020/07/28/XetQ4EgyqiRhJdB.jpg)

在请求时便会在 url 后拼接上 `/order`，这样在配置 `feign.order.service.url` 时只需要填入服务提供方的域名或 IP 即可。

---


`feign-plus` 也支持切换具体的 httpclient，默认是 `okhttp3`，通过以下配置便可更改。

```properties
# default(okhttp3)
feign.httpclient=http2Client
```

当然也有其他相关配置：

```properties
feign.plus.max-idle-connections = 520
feign.plus.connect-timeout = 11000
feign.plus.read-timeout = 12000
```



# 实现

最后简单聊聊是如何完成的吧，其实本质上就是 `spring-cloud-openfeign` 的浓缩版。

其中最为核心的便是 `top.crossoverjie.feign.plus.factory.FeignPlusBeanFactory` 类。

![](https://i.loli.net/2020/07/28/N3yep2SP1zniu6T.jpg)

该类实现了 `org.springframework.beans.factory.FactoryBean`接口，并重写了 `getObject()` 方法返回一个对象。

> 这段代码是不是似曾相识，其实就是 `Feign` 的官方 `demo`。

这里所返回的对象其实就是我们定义的接口的代理对象，而这个对象本身则是 `Feign` ，所以再往里说：我们的 `http` 请求编解码、发起请求等逻辑又被这个 `feign` 对象所代理了。

![](https://i.loli.net/2020/07/28/joLesbxGQrEkK37.jpg)

这个 `HardCodedTarget` 则是 `Feign` 内部用于代理最终请求的对象。

> 有一个小难受的地方：这样的自己定义 Bean 然后注入对象 Idea 是识别不了的，认为当前上下文没有该 Bean，但是 spring-cloud-openfeign 却可以识别。

---

由于 `Feign` 支持多个客户端，所以这里的客户端可以通过配置文件动态指定。

![](https://i.loli.net/2020/07/28/q74soVAQbl5NyK6.jpg)

利用 `SpringBoot` 提供的 `@ConditionalOnExpression` 注解可以根据配置动态的选择使用哪个 `httpclient`,也就是动态选择生成哪个 `Bean`。

# 总结

这个库的逻辑非常简单，本质上就是封装了 `Feign` 并提供了 `SpringBoot` 的支持，欢迎有类似需求的朋友下载使用。

`feign-plus`源码：[https://github.com/crossoverJie/feign-plus](https://github.com/crossoverJie/feign-plus)


**你的点赞与分享是对我最大的支持**
