---
title: Java SPI 的原理与应用
date: 2020/02/24 08:29:36 
categories: 
- cicada
- spi
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![cicada8-spi.md---0082zybply1gc6rp5ur8fj30u00u0tf7.jpg](https://i.loli.net/2020/02/24/JxoDiHGdOK5q7Nj.jpg)

# 前言

不知大家现在有没有去公司复工，我已经在家办公将近 3 周了，同时也在家呆了一个多月；还好工作并没有受到任何影响，我个人一直觉得远程工作和 IT 行业是非常契合的，这段时间的工作效率甚至比在办公室还高，同时由于我们公司的业务在海外，所以疫情几乎没有造成太多影响。

扯远了，这次主要是想和大家分享一下 `Java` 的 `SPI` 机制。周末没啥事，我翻了翻我之前的写的博客 [《设计一个可拔插的 IOC 容器》](https://crossoverjie.top/2018/11/15/wheel/cicada6/)，发现当时的实现并不那么优雅。

还没看过的朋友的我先做个前景提要，当时的需求：

> 我实现了一个类似于的 SpringMVC 但却很轻量的 http 框架 [cicada](https://github.com/TogetherOS/cicada/)，其中当然也需要一个 IOC 容器，可以存放所有的单例 bean。

> 这个 IOC 容器的实现我希望可以有多种方式，甚至可以提供一个接口供其他人实现；当然切换这个 IOC 容器的过程肯定是不能存在硬编码的，也就是这里所提到的**可拔插**。
> 当我想使用 A 的实现方式时，我就引入 A 的 jar 包，使用 B 时就引入 B 的包。

<!--more-->

![cicada8-spi.md---0082zybply1gc6sqv3gp4j30zm0u0n8c.jpg](https://i.loli.net/2020/02/24/n7QkNmv5t2r4HOy.jpg)

先给大家看看两次实现的区别，先从代码简洁程度来说就是 `SPI` 更胜一筹。

# 什么是 SPI

在具体分析之前还是先了解下 `SPI` 是什么？

首先它其实是 `Service provider interface` 的简写，翻译成中文就是服务提供发现接口。

不过这里不要被这个名词搞混了，这里的`服务发现`和我们常听到的微服务中的服务发现并不能划等号。

就如同上文提到的对 `IOC` 容器的多种实现方式 A、B、C（可以把它们理解为服务），我需要在运行时知道应该使用哪一种具体的实现。

其实本质上来说这就是一种典型的面向接口编程，这一点在我们刚开始学习编程的时候就被反复强调了。

# SPI 实践

接下来我们来如何来利用 SPI 实现刚才提到的可拔插 IOC 容器。

既然刚才都提到了 SPI 的本质就是面向接口编程，所以自然我们首先需要定义一个接口：

![cicada8-spi.md---0082zybply1gc6tlhql39j31490u0wjj.jpg](https://i.loli.net/2020/02/24/DVBJez2YtwiKs9S.jpg)

其中包含了一些 `Bean` 容器所必须的操作：注册、获取、释放 bean。

为了让其他人也能实现自己的 `IOC` 容器，所以我们将这个接口单独放到一个 `Module` 中，可供他人引入实现。

![cicada8-spi.md---0082zybply1gc6tobsdgwj30u40ewdh1.jpg](https://i.loli.net/2020/02/24/CASm2MdYGj7IZRl.jpg)

所以当我要实现一个单例的 `IOC` 容器时，我只需要新建一个 `Module` 然后引入刚才的模块并实现 `CicadaBeanFactory` 接口即可。


当然其中最重要的则是需要在 `resources` 目录下新建一个 `META-INF/services/top.crossoverjie.cicada.base.bean.CicadaBeanFactory` 文件，文件名必须得是我们之前定义接口的全限定名（SPI 规范）。

![cicada8-spi.md---0082zybply1gc6ts164zlj30uk0amq3x.jpg](https://i.loli.net/2020/02/24/AR8zJs5QrV1W2yE.jpg)

其中的内容便是我们自己实现类的全限定名：

```java
top.crossoverjie.cicada.bean.ioc.CicadaIoc
```

可以想象最终会通过这里的全限定名来反射创建对象。

只不过这个过程 Java 已经提供 API 屏蔽掉了：

```java
    public static CicadaBeanFactory getCicadaBeanFactory() {
        ServiceLoader<CicadaBeanFactory> cicadaBeanFactories = ServiceLoader.load(CicadaBeanFactory.class);
        if (cicadaBeanFactories.iterator().hasNext()){
            return cicadaBeanFactories.iterator().next() ;
        }

        return new CicadaDefaultBean();
    }
```

当 `classpath` 中存在我们刚才的实现类（引入实现类的 jar 包），便可以通过 `java.util.ServiceLoader` 工具类来找到所有的实现类（可以有多个实现类同时存在，只不过通常我们只需要一个）。

----

一些都准备好之后，使用自然就非常简单了。

```xml
    <dependency>
        <groupId>top.crossoverjie.opensource</groupId>
        <artifactId>cicada-ioc</artifactId>
        <version>2.0.4</version>
    </dependency>
```

我们只需要引入这个依赖便能使用它的实现，当我们想换一种实现方式时只需要更换一个依赖即可。

这样就做到了不修改一行代码灵活的`可拔插`选择 `IOC` 容器了。


# SPI 的一些其他应用

虽然平时并不会直接使用到 SPI 来实现业务，但其实我们使用过的绝大多数框架都会提供 SPI 接口方便使用者扩展自己的功能。

比如 `Dubbo` 中提供一系列的扩展：
![cicada8-spi.md---0082zybply1gc6ue6zubvj30gq0pymyq.jpg](https://i.loli.net/2020/02/24/L3hFlJO9bX7IAd1.jpg)

同类型的 `RPC` 框架 `motan` 中也提供了响应的扩展：
![cicada8-spi.md---0082zybply1gc6ufacqt5j30lm0j8q5j.jpg](https://i.loli.net/2020/02/24/5WxzwG8Q9ZeIY3r.jpg)

他们的使用方式都和 Java SPI 非常类似，只不过原理略有不同，同时也新增了一些功能。

比如 `motan` 的 `spi` 允许是否为单例等等。

再比如 MySQL 的驱动包也是利用 SPI 来实现自己的连接逻辑。

![cicada8-spi.md---0082zybply1gc6uqg2ga2j30ii0bmdgz.jpg](https://i.loli.net/2020/02/24/TJLCI2yEn8WV9MX.jpg)

# 总结

 `Java` 自身的 `SPI` 其实也有点小毛病，比如：

- 遍历加载所有实现类效率较低。
- 当多个 `ServiceLoader` 同时 `load` 时会有并发问题（虽然没人这么干）。

最后总结一下，`SPI` 并不是某项高深的技术，本质就是面向接口编程，而面向接口本身在我们日常开发中也是必备技能，所以了解使用 `SPI` 也是很用处的。

本文所有源码：

[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada)

**你的点赞与分享是对我最大的支持**