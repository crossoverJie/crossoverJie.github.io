---
title: SSM(十) 项目重构-互联网项目的Maven结构
date: 2017/03/04 01:44:54       
categories: 
- SSM
tags: 
- Maven
- 重构
---
![互联网项目的maven.jpg](https://ooo.0o0.ooo/2017/03/03/58b992d46fd02.jpg)

# 前言

很久没有更新博客了，之前定下周更逐渐成了月更。怎么感觉像我追过的一部动漫。
这个博文其实很早就想写了。
之前所有的代码都是在一个模块里面进行开发，这和maven的理念是完全不相符的，最近硬是抽了一个时间来对项目的结构进行了一次重构。

> 先来看看这次重构之后的目录结构

![1.jpg](https://ooo.0o0.ooo/2017/03/04/58b99366edad6.jpg)

<!--more-->

# 为什么需要分模块
> 至于为什么要分模块呢？

我们设想一个这样的场景：
在现在的互联网开发中，会把一个很大的系统拆分成各个子系统用于降低他们之间的耦合度。

在一个子项目中通常都会为`API`、`WEB`、`Service`等模块。
而且当项目够大时，这些通常都不是一个人能完成的工作，需要一个团队来各司其职。

想象一下：当之前所有的项目都在一个模块的时候，A改动了API，需要`Deploy`代码。而B也改动了`service`的代码，但并没有完全做完。所以A在提交`build`的时候就会报错

而且在整个项目足够大的时候，这个`build`的时间也是很影响效率的。

但让我将各个模块之间分开之后效果就不一样了。我修改了`API`我就只需要管我的就行，不需要整个项目进行`build`。

而且当有其他项目需要依赖我这个`API`的时候也只需要依赖`API`即可，不用整个项目都依赖过去。


# 各个模块的作用

来看下这次我所分的模块。

## ROOT
这是整个项目的根节点。
先看一下其中的`pom.xml`：

```xml
<groupId>com.crossoverJie</groupId>
    <artifactId>SSM</artifactId>
    <packaging>pom</packaging>
    <version>2.0.0</version>

    <modules>
        <module>SSM-API</module>
        <module>SSM-BOOT</module>
        <module>SSM-SERVICE</module>
        <module>SSM-WEB</module>
    </modules>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <spring.version>4.1.4.RELEASE</spring.version>
        <jackson.version>2.5.0</jackson.version>
        <lucene.version>6.0.1</lucene.version>
    </properties>


    <dependencyManagement>

        <dependencies>
            <dependency>
                <groupId>com.crossoverJie</groupId>
                <artifactId>SSM-API</artifactId>
                <version>2.0.0</version>
            </dependency>
         </dependencies>
    </dependencyManagement>
```

我截取了其中比较重点的配置。

由于这是父节点，所以我的`packag`类型使用的是`pom`。
其中分别有着四个子模块。

其中重点看下`<dependencyManagement>`这个标签。
如果使用的是`IDEA`这个开发工具的话是可以看到如下图：
![2.jpg](https://ooo.0o0.ooo/2017/03/04/58b997c0232ea.jpg)

标红的有一个向下的箭头，点一下就可以进入子模块中相同的依赖。
这样子模块就不需要配置具体的版本了，统一由父模块来进行维护，对之后的版本升级也带来了好处。

## SSM-API
接下来看下`API`这个模块：

通常这个模块都是用于定义外部接口的，以及改接口所依赖的一些`DTO类`。
一般这个模块都是拿来给其他项目进行依赖，并和本项目进行数据交互的。

## SSM-BOOT
`BOOT`这个模块比较特殊。
可以看到这里没有任何代码，只有一个`rpc`的配置文件。
通常这个模块是用于给我们内部项目进行依赖的，并不像上面的`API`模块一样给其他部门或者是项目进行依赖的。

因为在我们的`RPC`调用的时候，用`dubbo`来举例，是需要配置所依赖的`consumer`。

但如果是我们自己内部调用的话我们就可以把需要调用自己的`dubbo`服务提供者配置在这里，这样的话我们自己调用就只需要依赖这个`BOOT`就可以进行调用了。

哦对了，`BOOT`同时还会依赖`API`，这样才实现了只依赖`BOOT`就可以调用自己内部的`dubbo`服务了。
如下所示：
```xml
    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <scope>test</scope>
        </dependency>

        <dependency>
            <groupId>com.crossoverJie</groupId>
            <artifactId>SSM-API</artifactId>
        </dependency>

    </dependencies>
```

## SSM-SERVICE
`SERVICE`模块就比较好理解了。
是处理具体业务逻辑的地方，也是对之前的API的实现。

通常这也是一个`web`模块，所以我的`pom`类型是`WAR`。

## SSM-WEB
其实`WEB`模块和`SERVICE`模块有点重合了。通常来说这个模块一般在一个对外提供`http`访问接口的项目中。

这里只是为了展示项目结构，所以也写在了这里。

他的作用和`service`差不多，都是`WAR`的类型。

# 总结
这次没有实现什么特别的功能，只是对一些还没有接触过这种项目结构开发的童鞋能起到一些引导作用。

具体源码还请关注我的`github`。

> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)

> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。

> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。


