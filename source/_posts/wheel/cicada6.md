---
title: 设计一个可拔插的 IOC 容器
date: 2018/11/15 08:19:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2019/05/08/5cd1c63f1bd4a.jpg)

# 前言

磨了许久，借助最近的一次通宵上线 [cicada](https://github.com/TogetherOS/cicada) 终于更新了 `v2.0.0` 版本。

之所以大的版本号变为 2，确实是向下不兼容了；主要表现为：

- 修复了几个反馈的 `bug`。
- 灵活的路由方式。
- 可拔插的 `IOC` 容器选择。

其中重点是后面两个。

<!--more-->

# 新的路由方式

先来看第一个：路由方式的更新。

在之前的版本想要写一个接口必须的实现一个 `WorkAction`；而且最麻烦的是一个实现类只能做一个接口。

因此也有朋友给我提过这个 [issue](https://github.com/TogetherOS/cicada/issues/12)。

![](https://i.loli.net/2019/05/08/5cd1c64216f7d.jpg)

---

于是改进后的使用方式如下：

![](https://i.loli.net/2019/05/08/5cd1c647f3a27.jpg)

> 是否有点似曾相识的感觉😊。

如上图所示，不需要实现某个特定的接口；只需要使用不同的注解即可。

同时也支持自定义 `pojo`, `cicada` 会在调用过程中对参数进行实例化。

拿这个 `getUser` 接口为例，当这样请求时这些参数就会被封装进 `DemoReq` 中.

[http://127.0.0.1:5688/cicada-example/routeAction/getUser?id=1234&name=zhangsan](http://127.0.0.1:5688/cicada-example/routeAction/getUser?id=1234&name=zhangsan)

同时得到响应：

```json
{"message":"hello =zhangsan"}
```

实现过程也挺简单，大家查看源码便会发现；这里贴一点比较核心的步骤。

- 扫描所有使用 `@CicadaAction` 注解的类。
- 扫描所有使用 `@CicadaRoute` 注解的方法。
- 将他们的映射关系存入 `Map` 中。
- 请求时根据 `URL` 去 `Map` 中查找这个关系。
- 反射构建参数及方法调用。


**扫描类以及写入映射关系**

![](https://i.loli.net/2019/05/08/5cd1c64971c37.jpg)

---

**请求时查询映射关系**

![](https://i.loli.net/2019/05/08/5cd1c64ade749.jpg)

---

**反射调用这些方法**

![](https://i.loli.net/2019/05/08/5cd1c64d6e772.jpg)



# 是否需要 IOC 容器

上面那几个步骤其实我都是一把梭写完的，但当我写到执行具体方法时感觉`有点意思`了。

大家都知道反射调用方法有两个重要的参数：

![](https://i.loli.net/2019/05/08/5cd1c65023d49.jpg)

- `obj` 方法执行的实例。
- `args..` 自然是方法的参数。

我第一次写的时候是这样的：

```java
method.invoke(method.getDeclaringClass().newInstance(), object);
```

然后一测试，也没问题。

当我写完之后 `review` 代码时发现不对：这样这里每次都会创建一个新的实例，而且反射调用 `newInstance()` 效率也不高。

这时我不自觉的想到了 Spring 中 IOC 容器，和这里场景也非常的类似。

> 在应用初始化时将所有的接口实例化并保存到 bean 容器中，当需要使用时只需要从容器中获取即可。

这样只是会在启动时做很多加载工作，但造福后代啊。

# 可拔插的 IOC 容器

于是我打算自己实现一个这样的 bean 容器。

但在实现之前又想到一个 feature:

> 不如把实现 bean 容器的方案交给使用者选择，可以选择使用 bean 容器，也可以就用之前的每次都创建新的实例，就像 Spring 中的 prototype 作用域一样。

甚至可以自定义容器实现，比如将 bean 存放到数据库、Redis 都行；当然一般人也不会这么干。

和 `SPI` 的机制也有点类似。

要实现上述的需求大致需要以下步骤：
- 一个通用的接口，包含了注册容器、从容器中获取实例等方法。
- `BeanManager` 类，由它来管理具体使用哪种 `IOC` 容器。


所以首先定义了一个接口；`CicadaBeanFactory`:

![](https://i.loli.net/2019/05/08/5cd1c651de476.jpg)

包含了注册和获取实例的接口。

同时分别有两个不同的容器实现方案。

默认实现；`CicadaDefaultBean`：
![](https://i.loli.net/2019/05/08/5cd1c65811e8e.jpg)

也就是文中说道的，每次都会创建实例；由于这种方式其实根本就没有 bean 容器，所以也不存在注册了。

接下来是真正的 IOC 容器；`CicadaIoc`：

![](https://i.loli.net/2019/05/08/5cd1c65b97711.jpg)

> 它将所有的实例都存放在一个 Map 中。

当然也少不了刚才提到的 `CicadaBeanManager`，它会在应用启动的时候将所有的实例注册到 `bean` 容器中。

![](https://i.loli.net/2019/05/08/5cd1c65e91a11.jpg)

重点是图中标红的部分：

- 需要根据用户的选择实例化 `CicadaBeanFactory` 接口。
- 将所有的实例注册到 CicadaBeanFactory 接口中。

同时也提供了一个获取实例的方法：

![](https://i.loli.net/2019/05/08/5cd1c65f98cbb.jpg)

就是直接调用 `CicadaBeanFactory` 接口的方法。

---

然后在上文提到的反射调用方法处就变为：

![](https://i.loli.net/2019/05/08/5cd1c666b4ec4.jpg)

从 `bean` 容器中获取实例了；获取的过程可以是每次都创建一个新的对象，也可以是直接从容器中获取实例。这点对于这里的调用者来说**并不关心**。

所以这也实现了标题所说的：`可拔插`。

为了实现这个目的，我将 `CicadaIoc` 的实现单独放到一个模块中，以 jar 包的形式提供实现。

![](https://i.loli.net/2019/05/08/5cd1c6680a66b.jpg)

所以如果你想要使用 `IOC` 容器的方式获取实例时只需要在你的应用中额外加入这个 jar 包即可。

```xml
<dependency>
    <groupId>top.crossoverjie.opensource</groupId>
    <artifactId>cicada-ioc</artifactId>
    <version>2.0.0</version>
</dependency>
```

如果不使用则是默认的 `CicadaDefaultBean` 实现，也就是每次都会创建对象。

这样有个好处：

当你自己想实现一个 `IOC` 容器时；只需要实现 `cicada` 提供的 `CicadaBeanFactory` 接口，并在你的应用中只加入你的 `jar` 包即可。

**其余所有的代码都不需要改变，便可随意切换不的容器。**

> 当然我是推荐大家使用 `IOC` 容器的（其实就是单例），牺牲一点应用启动时间带来后续性能的提升是值得的。

# 总结

`cicada` 的大坑填的差不多了，后续也会做一些小功能的迭代。

还没有关注的朋友赶紧关注一波：

[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada)


> PS：虽然没有仔细分析 Spring IOC 的实现，但相信看完此篇的朋友应该对 Spring IOC 以及 SpringMVC 会有一些自己的理解。


**你的点赞与分享是对我最大的支持**
