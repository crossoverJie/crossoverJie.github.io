---
title: SSM(四)WebService入门详解
date: 2016/08/02 17:28      
categories: 
- SSM
tags: 
- Java
- CXF
- IDEA
---

![](https://i.loli.net/2019/05/08/5cd1ba1be78e8.jpg)

# 前言
webservice这个不知道大家首次接触的时候是怎么理解的，反正我记得我当时第一次接触这个东西的时候以为又是一个XX框架，觉得还挺高大上。然而这一切在之后我使用过后才发现这些全都是YY。
那么webservice到底是什么呢，根据我自己的理解：简单来说就像是一个公开的接口，其他系统不管你是用什么语言来编写的都可以调用这个接口，并可以返回相应的数据给你。就像是现在很多的天气应用，他们肯定不会自己去搞一个气象局之类的部门去监测天气，大多都是直接调用一个天气接口，然后返回天气数据，相关应用就可以将这些信息展示给用户了。
通常来说发布这类接口的应用都是用一两种语言来编写即可，但是调用这个接口应用可能会是各种语言来编写的，为了满足这样的需求webservice出现了。
> 简单来说webservice就是为了满足以上需求而定义出来的规范。

----------


# Spring整合CXF
在Java中实现webservice有多种方法，java本身在jdk1.7之后也对webservice有了默认的实现，但是在我们实际开发中一般还是会使用框架来，比如这里所提到的CXF就有着广泛的应用。
废话我就不多说了，直接讲Spring整合CXF，毕竟现在的JavaEE开发是离不开Spring了。
该项目还是基于之前的[SSM](https://github.com/crossoverjie/SSM)进行开发的。
## 加入maven依赖
第一步肯定是要加入maven依赖：
```xml
        <!--cxf-->
        <!-- https://mvnrepository.com/artifact/org.apache.cxf/cxf-rt-frontend-jaxws -->
        <dependency>
            <groupId>org.apache.cxf</groupId>
            <artifactId>cxf-rt-frontend-jaxws</artifactId>
            <version>3.1.6</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.apache.cxf/cxf-core -->
        <dependency>
            <groupId>org.apache.cxf</groupId>
            <artifactId>cxf-core</artifactId>
            <version>3.1.6</version>
        </dependency>
        <!-- https://mvnrepository.com/artifact/org.apache.cxf/cxf-rt-transports-http -->
        <dependency>
            <groupId>org.apache.cxf</groupId>
            <artifactId>cxf-rt-transports-http</artifactId>
            <version>3.1.6</version>
        </dependency>
```
<!--more-->

## web.xml配置
接着我们需要配置一个CXF的servlet：

```xml
    <!--定义一个cxf的servlet-->
    <servlet>
        <servlet-name>CXFServlet</servlet-name>
        <servlet-class>org.apache.cxf.transport.servlet.CXFServlet</servlet-class>
    </servlet>
    <servlet-mapping>
        <servlet-name>CXFServlet</servlet-name>
        <url-pattern>/webservice/*</url-pattern>
    </servlet-mapping>
```
之后只要我们访问webservice/*这个地址就会进入CXF的servlet中。

## 整合Spring配置
接下来是最重要的一部，用Spring整合CXF：
在这之前我有新建一个CXF的包，如下图：

![](https://i.loli.net/2019/05/08/5cd1ba1e3ca45.jpg)

这里有两个主要类
 - HelloWorld接口。
 - 实现HelloWorld接口的HelloWorldImpl类。
代码如下：
HelloWorld.java
```java
package com.crossoverJie.cxf;

import javax.jws.WebService;

@WebService
public interface HelloWorld {
	public String say(String str);
}
```
其中就只定义了一个简单的`say()`方法。
HelloWorldImpl.java
```java
package com.crossoverJie.cxf.impl;
import com.crossoverJie.cxf.HelloWorld;
import org.springframework.stereotype.Component;
import javax.jws.WebService;
@Component("helloWorld")
@WebService
public class HelloWorldImpl implements HelloWorld {
	public String say(String str) {
		return "Hello"+str;
	}
}
```
这里就是对`say()`方法的简单实现。
接下来就是整合Spring了，由于需要使用到CXF的标签，所以我们需要添加额外的命名路径如下：

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:p="http://www.springframework.org/schema/p"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:jee="http://www.springframework.org/schema/jee"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xmlns:jaxws="http://cxf.apache.org/jaxws"
       xsi:schemaLocation="
        http://www.springframework.org/schema/aop http://www.springframework.org/schema/aop/spring-aop-4.0.xsd
        http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
        http://www.springframework.org/schema/context http://www.springframework.org/schema/context/spring-context-4.0.xsd
        http://www.springframework.org/schema/jee http://www.springframework.org/schema/jee/spring-jee-4.0.xsd
        http://www.springframework.org/schema/tx http://www.springframework.org/schema/tx/spring-tx-4.0.xsd
        http://cxf.apache.org/jaxws http://cxf.apache.org/schemas/jaxws.xsd">


    <import resource="classpath:META-INF/cxf/cxf.xml"/>
    <import resource="classpath:META-INF/cxf/cxf-servlet.xml"/>
    <!-- 自动扫描webService -->
    <context:component-scan base-package="com.crossoverJie.cxf" />
    <!-- 定义webservice的发布接口  -->
    <jaxws:endpoint
            implementor="#helloWorld"
            address="/HelloWorld"
</beans>
```

更加具体的配置可以查看官方给出的文档:[http://cxf.apache.org/docs/how-do-i-develop-a-service.html](http://cxf.apache.org/docs/how-do-i-develop-a-service.html)。
`#helloWorld`指的是我们在`HelloWorldImpl`类中所自定义的名字，`/HelloWorld`则是我们需要访问的地址。
之后我们运行项目输入该地址：[http://127.0.0.1:8080/ssm/webservice/HelloWorld?wsdl](http://127.0.0.1:8080/ssm/webservice/HelloWorld?wsdl)如果出现如下界面：

![](https://i.loli.net/2019/05/08/5cd1ba23ed4e7.jpg)

则说明我们的webservice发布成功了。
接下来只需要通过客户端调用这个接口即可获得返回结果了。


----------


# 总结
以上就是一个简单的webservice入门实例，更多的关于CXF拦截器，客户端调用就没有做过多介绍，后续有时间的话再接着更新。
> 项目地址：[https://github.com/crossoverJie/SSM.git](https://github.com/crossoverJie/SSM.git)
> 个人博客地址：[http://crossoverjie.top](http://crossoverjie.top)。
> GitHub地址：[https://github.com/crossoverJie](https://github.com/crossoverJie)。
