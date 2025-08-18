---
title: 利用策略模式优化过多 if else 代码
date: 2019/01/30 16:50:36 
categories: 
- Java 进阶
- 设计模式
tags: 
- Java
- 策略模式
---

![](https://i.loli.net/2019/05/05/5ccef1ffd774f.jpg)

# 前言

不出意外，这应该是年前最后一次分享，本次来一点实际开发中会用到的小技巧。

<!--more-->

比如平时大家是否都会写类似这样的代码：

```java
if(a){
	//dosomething
}else if(b){
	//doshomething
}else if(c){
	//doshomething
} else{
	////doshomething
}
```

条件少还好，一旦 `else if` 过多这里的逻辑将会比较混乱，并很容易出错。

比如这样：

![](https://i.loli.net/2019/05/05/5ccef63089d79.jpg)

> 摘自 [cim](https://github.com/crossoverJie/cim) 中的一个客户端命令的判断条件。


刚开始条件较少，也就没管那么多直接写的；现在功能多了导致每次新增一个 `else` 条件我都得仔细核对，生怕影响之前的逻辑。

这次终于忍无可忍就把他重构了，重构之后这里的结构如下：

![](https://i.loli.net/2019/05/05/5ccef221d1575.jpg)

最后直接变为两行代码，简洁了许多。

而之前所有的实现逻辑都单独抽取到其他实现类中。

![](https://i.loli.net/2019/05/05/5ccef23ed1f7c.jpg)
![](https://i.loli.net/2019/05/05/5ccef256abc9b.jpg)

这样每当我需要新增一个 `else` 逻辑，只需要新增一个类实现同一个接口便可完成。每个处理逻辑都互相独立互不干扰。


# 实现

![](https://i.loli.net/2019/05/05/5ccef2723156b.jpg)

按照目前的实现画了一个草图。

整体思路如下：
- 定义一个 `InnerCommand` 接口，其中有一个 `process` 函数交给具体的业务实现。
- 根据自己的业务，会有多个类实现 `InnerCommand` 接口；这些实现类都会注册到 `Spring Bean` 容器中供之后使用。
- 通过客户端输入命令，从 `Spring Bean` 容器中获取一个 `InnerCommand` 实例。
- 执行最终的 `process` 函数。


主要想实现的目的就是不在有多个判断条件，只需要根据当前客户端的状态动态的获取 `InnerCommand` 实例。

从源码上来看最主要的就是 `InnerCommandContext` 类，他会根据当前客户端命令动态获取 `InnerCommand` 实例。

![](https://i.loli.net/2019/05/05/5ccef28c2eedc.jpg)

- 第一步是获取所有的 `InnerCommand` 实例列表。
- 根据客户端输入的命令从第一步的实例列表中获取类类型。
- 根据类类型从 `Spring` 容器中获取具体实例对象。


因此首先第一步需要维护各个命令所对应的类类型。

![](https://i.loli.net/2019/05/05/5ccef2b72abb8.jpg)

所以在之前的枚举中就维护了命令和类类型的关系，只需要知道命令就能知道他的类类型。


这样才能满足只需要两行代码就能替换以前复杂的 `if else`，同时也能灵活扩展。

```java
InnerCommand instance = innerCommandContext.getInstance(msg);
instance.process(msg) ;
```

# 总结

当然还可以做的更灵活一些，比如都不需要显式的维护命令和类类型的对应关系。

只需要在应用启动时扫描所有实现了 `InnerCommand` 接口的类即可，在 [cicada](https://github.com/TogetherOS/cicada) 中有类似实现，感兴趣的可以自行[查看](https://github.com/TogetherOS/cicada)。

这样一些小技巧希望对你有所帮助。


以上所有源码可以在这里查看：

[https://github.com/crossoverJie/cim](https://github.com/crossoverJie/cim)


**你的点赞与分享是对我最大的支持**
