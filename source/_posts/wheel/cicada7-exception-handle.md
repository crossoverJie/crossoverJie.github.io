---
title: 设计一个全局异常处理器
date: 2019/07/15 08:29:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
---

![](https://i.loli.net/2019/07/14/5d2b4a7010e6815837.jpg)

# 前言

最近稍微闲了一点于是把这个半年都没更新的开源项目 [cicada](https://github.com/TogetherOS/cicada) 重新捡了起来。

一些新关注的朋友应该还不知道这项目是干啥的？先来看看官方介绍吧（其实就我自己写的😀）

> cicada: 基于 Netty4 实现的快速、轻量级 WEB 框架；没有过多的依赖，核心 jar 包仅 `30KB`。

<!--more-->

![](https://i.loli.net/2019/07/14/5d2b4a70635d532624.jpg)



针对这个轮子以前也写过相关的介绍，感兴趣的可以再翻回去看看：

- [「造个轮子」——cicada(轻量级 WEB 框架)](https://crossoverjie.top/2018/09/03/wheel/cicada1/)
- [「造个轮子」——cicada 源码分析](https://crossoverjie.top/2018/09/05/wheel/cicada2/)
- [「造个轮子」——cicada 设计一个配置模块](https://crossoverjie.top/2018/09/14/wheel/cicada3/)
- [「造个轮子」——cicada 设计全局上下文](https://crossoverjie.top/2018/10/09/wheel/cicada4/)
- [利用责任链模式设计一个拦截器](https://crossoverjie.top/2018/10/22/wheel/cicada5/)
- [设计一个可拔插的 IOC 容器](https://crossoverjie.top/2018/11/15/wheel/cicada6/)

这些都看完了相信对这个小玩意应该会有更多的想法。


# 效果

广告打完了，回到正题；大家平时最常用的 `MVC` 框架当属 `SpringMVC` 了，而在搭建脚手架的时候相信全局异常处理是必不可少的。

## Spring 用法

通常我们的做法如下：

传统 `Spring` 版本：

- 实现一个 `Spring` 自带的接口，重写其中的方法，最后的异常处理便在此处。
- 将这个类配置在 `Spring` 的 `xml` ，当做一个 bean 注册到 `Spring` 容器中。

```java
public class CustomExceptionResolver implements HandlerExceptionResolver {

    @Override
    public ModelAndView resolveException(HttpServletRequest request,
            HttpServletResponse response, Object handler, Exception ex) {
	//自定义处理
}
```

```xml
<bean class="ssm.exception.CustomExceptionResolver"></bean> 
```

---

当然现在流行的 `SpringBoot` 也有对应的简化版本：

```java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(value = Exception.class)
    public Object defaultErrorHandler(HttpServletRequest req, Exception e) throws Exception {
        //自定义处理
    }
}
```

全部都换为注解形式，但本质上还是一样的。

> 都是要在容器中创建一个特殊的 bean，这个 bean 专门用于处理异常，当系统运行时出现异常，就从容器中找到该 bean，并执行其中的方法即可。

至于这个特殊的 `bean` 如何标识出来，无非就是实现某个特定接口或者用注解声明，也就对应了传统 `Spring` 和 `SpringBoot` 的用法。

## cicada 用法

`cicada` 在设计自己的全局异常处理器时也参考了 Spring 的相关设计，所以最终用法如下：

```java
@CicadaBean
public class ExceptionHandle implements GlobalHandelException {
    private final static Logger LOGGER = LoggerBuilder.getLogger(ExceptionHandle.class);

    @Override
    public void resolveException(CicadaContext context, Exception e) {
        LOGGER.error("Exception", e);
        WorkRes workRes = new WorkRes();
        workRes.setCode("500");
        workRes.setMessage(e.getClass().getName() + "系统运行出现异常");
        context.json(workRes);
    }
}
```

自定义一个实现了 `GlobalHandelException` 接口的类，当请求出现异常时，页面和后台将会如下输出：

![](https://i.loli.net/2019/07/14/5d2b4a708987b32808.jpg)
![](https://i.loli.net/2019/07/14/5d2b4a70e668052739.jpg)


# 设计


看得出用法和 `Spring` 非常类似，也是需要实现一个接口 `GlobalHandelException`，同时使用 `@CicadaBean` 注解该类将他加载到 `cicada` 内置的 `IOC` 容器内。

当出现异常时则在这个 `IOC` 容器中找到该对象调用它的 `resolveException` 即可。

其中还可以通过 `CicadaContext` 全局上下文响应不同的输出（`json/text/html`）。

## 核心原理

![](https://i.loli.net/2019/07/14/5d2b4a712df5717670.jpg)

简单画了下流程图，步骤如下：

- 初始化时会找到实现了 `GlobalHandelException` 接口的类，将它实例化并注册到 `IOC` 容器中。
- 当发生异常时从容器中获取到异常处理器的对象，执行其中的处理函数即可。


说了半天原理来看看源码是如何实现的。


![](https://i.loli.net/2019/07/14/5d2b4a716caeb94532.jpg)

在初始化 `bean` 时，如果是一个异常处理器则会将他单独存放（也就相当于前文说的打标识）。

其中的 `GlobalHandelException` 本身的定义也非常简单：

![](https://i.loli.net/2019/07/14/5d2b4a7198bb390309.jpg)

---

接下来是运行时：

![](https://i.loli.net/2019/07/14/5d2b4a71bc98986729.jpg)
![](https://i.loli.net/2019/07/14/5d2b4a71f27d495514.jpg)
![](https://i.loli.net/2019/07/14/5d2b4a7221b4f38396.jpg)

而当出现异常时则会通过之前的保存的异常处理 `bean` 进行异常处理，在调用的同时将全局上下文及异常信息传递过去就齐活了。

这样就可以在这个实现类中实现我们自己的异常处理逻辑了。

# 总结

万一今后面试官问你们 `SpringMVC` 的异常处理是如何实现的？你该知道怎么回答了吧😏。

同时也可以发散一下，是否可以配置一个针对于某一个 `controller` 的异常处理，这样每个 `controller` 产生的异常可以单独处理，如果没有配置则进入全局异常；原理也差不多，感兴趣的朋友可以提个 `PR` 完成该 `feature`。

项目源码：

[https://github.com/TogetherOS/cicada](https://github.com/TogetherOS/cicada)

**你的点赞与分享是对我最大的支持**
