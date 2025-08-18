---
title: 利用责任链模式设计一个拦截器
date: 2018/10/22 00:19:36 
categories: 
- cicada
- 轮子
tags: 
- Java
- HTTP
- Netty
- 责任链
---

![](https://i.loli.net/2019/05/08/5cd1c6a7aaad8.jpg)

# 前言

近期在做 [Cicada](https://github.com/TogetherOS/cicada) 的拦截器功能，正好用到了责任链模式。

这个设计模式在日常使用中频率还是挺高的，借此机会来分析分析。

# 责任链模式

先来看看什么是责任链模式。

引用一段维基百科对其的解释：

> 责任链模式在面向对象程式设计里是一种软件设计模式，它包含了一些命令对象和一系列的处理对象。每一个处理对象决定它能处理哪些命令对象，它也知道如何将它不能处理的命令对象传递给该链中的下一个处理对象。该模式还描述了往该处理链的末尾添加新的处理对象的方法。

光看这段描述可能大家会觉得懵，简单来说就是该设计模式用于对某个对象或者请求进行一系列的处理，这些处理逻辑正好组成一个链条。

下面来简单演示使用与不使用责任链模式有什么区别和优势。

<!--more-->

# 责任链模式的应用

## 传统实现

假设这样的场景：传入了一段内容，需要对这段文本进行加工；比如过滤敏感词、错别字修改、最后署上版权等操作。

常见的写法如下：

```java
public class Main {
    public static void main(String[] args) {
        String msg = "内容内容内容" ;

        String result = Process.sensitiveWord()
                .typo()
                .copyright();
    }
}
```

这样看似没啥问题也能解决需求，但如果我还需要为为内容加上一个统一的标题呢？在现有的方式下就不得不新增处理方法，并且是在这个客户端（`Process`）的基础上进行新增。

显然这样的扩展性不好。

## 责任链模式实现

这时候就到了责任链模式发挥作用了。

该需求非常的符合对某一个对象、请求进行一系列处理的特征。

于是我们将代码修改：

这时 `Process` 就是一个接口了，用于定义真正的处理函数。

```java
public interface Process {

    /**
     * 执行处理
     * @param msg
     */
    void doProcess(String msg) ;
}
```

同时之前对内容的各种处理只需要实现该接口即可：

```java
public class SensitiveWordProcess implements Process {
    @Override
    public void doProcess(String msg) {
        System.out.println(msg + "敏感词处理");
    }
}

public class CopyrightProcess implements Process {

    @Override
    public void doProcess(String msg) {
        System.out.println(msg + "版权处理");
    }
}

public class CopyrightProcess implements Process {

    @Override
    public void doProcess(String msg) {
        System.out.println(msg + "版权处理");
    }
}
```

然后只需要给客户端提供一个执行入口以及添加责任链的入口即可：

```java
public class MsgProcessChain {

    private List<Process> chains = new ArrayList<>() ;

    /**
     * 添加责任链
     * @param process
     * @return
     */
    public MsgProcessChain addChain(Process process){
        chains.add(process) ;
        return this ;
    }

    /**
     * 执行处理
     * @param msg
     */
    public void process(String msg){
        for (Process chain : chains) {
            chain.doProcess(msg);
        }
    }
}
```

这样使用起来就非常简单：

```java
public class Main {
    public static void main(String[] args) {
        String msg = "内容内容内容==" ;

        MsgProcessChain chain = new MsgProcessChain()
                .addChain(new SensitiveWordProcess())
                .addChain(new TypoProcess())
                .addChain(new CopyrightProcess()) ;

        chain.process(msg) ;
    }
}
```

当我需要再增加一个处理逻辑时只需要添加一个处理单元即可（`addChain(Process process)`），并对客户端 `chain.process(msg)` 是无感知的，不需要做任何的改动。


可能大家没有直接写过责任链模式的相关代码，但不经意间使用到的却不少。

比如 `Netty` 中的 `pipeline` 就是一个典型的责任链模式，它可以让一个请求在整个管道中进行流转。

![](https://i.loli.net/2019/05/08/5cd1c6ac3bb76.jpg)

通过官方图就可以非常清楚的看出是一个责任链模式：

![](https://i.loli.net/2019/05/08/5cd1c6afdad1d.jpg)

# 用责任链模式设计一个拦截器

对于拦截器来说使用责任链模式再好不过了。

下面来看看在 `Cicada` 中的实现：

首先是定义了和上文 `Process` 接口类似的 `CicadaInterceptor` 抽象类：

```java
public abstract class CicadaInterceptor {

    public boolean before(CicadaContext context,Param param) throws Exception{
        return true;
    }

    public void after(CicadaContext context,Param param) throws Exception{}
}
```

同时定义了一个 `InterceptProcess` 的客户端：

![](https://i.loli.net/2019/05/08/5cd1c6b4dc66d.jpg)

其中的 `loadInterceptors()` 会将所有的拦截器加入到责任链中。

再提供了两个函数分别对应了拦截前和拦截后的入口：

![](https://i.loli.net/2019/05/08/5cd1c6bb7ea9e.jpg)

## 实际应用

现在来看看具体是怎么使用的吧。

![](https://i.loli.net/2019/05/08/5cd1c6bff1876.jpg)

在请求的 `handle` 中首先进行加载（`loadInterceptors(AppConfig appConfig)`），也就是初始化责任链。

接下来则是客户端的入口；调用拦截前后的入口方法即可。

> 由于是拦截器，那么在 `before` 函数中是可以对请求进行拦截的。只要返回 `false` 就不会继续向后处理。所以这里做了一个返回值的判断。

同时对于使用者来说只需要创建拦截器类继承 `CicadaInterceptor` 类即可。

这里做了一个演示，分别有两个拦截器：

1. 记录一个业务 `handle` 的执行时间。
2. 在 `after` 里打印了请求参数。
3. 同时可在第一个拦截器中返回 `false` 让请求被拦截。

先来做前两个试验：

![](https://i.loli.net/2019/05/08/5cd1c6c2b3ab4.jpg)

![](https://i.loli.net/2019/05/08/5cd1c6c693e9c.jpg)

---

这样当我请求其中一个接口时会将刚才的日志打印出来：

![](https://i.loli.net/2019/05/08/5cd1c6cf51a77.jpg)

---

接下来我让打印执行时间的拦截器中拦截请求，同时输入向前端输入一段文本：

![](https://i.loli.net/2019/05/08/5cd1c6d354832.jpg)

---

请求接口可以看到如下内容：

![](https://i.loli.net/2019/05/08/5cd1d108d5254.jpg)

![](https://i.loli.net/2019/05/08/5cd1d10a698d8.jpg)

同时后面的请求参数也没有打印出来，说明请求确实被拦截下来。



---

同时我也可以调整拦截顺序，只需要在` @Interceptor(order = 1)` 注解中定义这个 `order` 属性即可（默认值是 0，越小越先执行）。

之前是打印请求参数的拦截器先执行，这次我手动将它的 order 调整为 2，而打印时间的 order 为 1 。

![](https://i.loli.net/2019/05/08/5cd1d10cc646d.jpg)

再次请求接口观察后台日志：

![](https://i.loli.net/2019/05/08/5cd1d10f1cb35.jpg)

发现打印执行时间的拦截器先执行。


那这个执行执行顺序如何实现自定义配置的呢？

其实也比较简单，有以下几步：

- 在加载拦截器时将注解里的 `order` 保存起来。
- 设置拦截器到责任链中时通过反射将 `order` 的值保存到各个拦截器中。
- 最终通过排序重新排列这个责任链的顺序。

贴一些核心代码。

扫描拦截器时保存 `order` 值：

![](https://i.loli.net/2019/05/08/5cd1d116ac586.jpg)

---

保存 `order` 值到拦截器中：

![](https://i.loli.net/2019/05/08/5cd1d11869eac.jpg)

---

重新对责任链排序：

![](https://i.loli.net/2019/05/08/5cd1d11967bfd.jpg)


# 总结

整个责任链模式已经讲完，希望对这个设计模式还不了解的朋友带来些帮助。

上文中的源码如下：

- [https://github.com/TogetherOS/cicada:一个高性能、轻量 HTTP 框架](https://github.com/TogetherOS/cicada)
- [https://git.io/fxKid](https://git.io/fxKid)


**欢迎关注公众号一起交流：**
