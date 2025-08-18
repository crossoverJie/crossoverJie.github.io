---
title: sbc(一)SpringBoot+SpringCloud初探 
date: 2017/6/15 21:40:15    
categories: 
- sbc
tags: 
- Java
- SpringBoot
- SpringCloud
---

# 前言

![sb1.jpg](https://ooo.0o0.ooo/2017/06/15/59417275b1746.jpg)

有看过我之前的[SSM](https://github.com/crossoverJie/SSM)系列的朋友应该有一点印象是非常深刻的。

> 那就是需要配置的配置文件非常多，什么`Spring`、`mybatis`、`redis`、`mq`之类的配置文件非常多，并且还存在各种版本，甚至有些版本还互不兼容。其中有很多可能就是刚开始整合的时候需要配置，之后压根就不会再动了。

鉴于此，`Spring`又推出了又一神器[SpringBoot](https://projects.spring.io/spring-boot/).

它可以让我们更加快速的开发`Spring`应用，甚至做到了开箱即用。
由于在实际开发中我们使用`SpringBoot`+`SpringCloud`进行了一段时间的持续交付，并在生产环境得到了验证，其中也有不少踩坑的地方，借此机会和大家分享交流一下。

本篇我们首先会用利用`SpringBoot`构建出一个简单的`REST API`.
接着会创建另一个`SpringBoot`项目，基于`SpringCloud`部署，并在两个应用之间进行调用。


# 使用`SpringBoot`构建`REST API`
我们可以使用`Spring`官方提供的初始化工具帮我们生成一个基础项目：[http://start.spring.io/](http://start.spring.io/),如下图所示：
![sb2.jpg](https://ooo.0o0.ooo/2017/06/16/5942bbbb8797e.jpg)

填入相应信息即可。由于只是要实现`REST API`所以这里只需要引用`web`依赖即可。

<!--more-->

将生成好的项目导入`IDE`(我使用的是`idea`)中,目录结构如下;
![sb3.jpg](https://ooo.0o0.ooo/2017/06/16/5942bde60ac4c.jpg)

- 其中的`SbcUserApplication`是整个应用的入口。
- `resource/application.properties`这里是存放整个应用的配置文件。
- 其中的`static`和`templates`是存放静态资源以及前端模板的地方，由于我们采用了前后端分离，所以这些目录基本上用不上了。

通过运行`SbcUserApplication`类的`main`方法可以启动`SpringBoot`项目。

接着在`PostMan`中进行调用，看到以下结果表明启动成功了：

![springBoot01.jpg](https://ooo.0o0.ooo/2017/06/26/5950a607afe13.jpg)

这样一看是不是要比之前用`Spring+SpringMVC`来整合要方便快捷很多。

# 创建另一个`SpringBoot`项目

当我们的项目采用微服务构建之后自然就会被拆分成N多个独立的应用。比如上文中的`sbc-user`用于用户管理。这里再创建一个`sbc-order`用户生成订单。

> 为了方便之后的代码复用，我将`common`包中的一些枚举值、工具类单独提到`sbc-common`应用中了，这样有其他应用要使用这些基础类直接引入这个依赖即可。

```xml
<dependency>
	<groupId>com.crossoverJie</groupId>
	<artifactId>sbc-common</artifactId>
	<version>1.0.0-SNAPSHOT</version>
</dependency>
```

创建步骤和上文差不多，这里就不再赘述了。
其中有一个`order/getOrderNo`的服务，调用结果如下：

![springBoot02.jpg](https://ooo.0o0.ooo/2017/06/26/5950de9914c91.jpg)

之后会利用`SpringCloud`来将两个服务关联起来，并可以互相调用。


# 使用`SpringCloud`进行分布式调用

## 搭建`eureka`注册中心
既然是要搭建微服务那自然少不了注册中心了，之前讲的`dubbo`采用的是`zookeeper`作为注册中心，`SpringCloud`则采用的是`Netflix Eureka`来做服务的注册与发现。

新建一个项目`sbc-service`,目录结构如下：

![springBoot03.jpg](https://ooo.0o0.ooo/2017/06/26/59511b85974be.jpg)

核心的`pom.xml`

```xml
<dependencies>
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-starter-eureka-server</artifactId>
	</dependency>
	<dependency>
		<groupId>ch.qos.logback</groupId>
		<artifactId>logback-classic</artifactId>
		<version>1.2.1</version>
	</dependency>

</dependencies>

<dependencyManagement>
	<dependencies>
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-dependencies</artifactId>
			<version>Brixton.RELEASE</version>
			<type>pom</type>
			<scope>import</scope>
		</dependency>
	</dependencies>
</dependencyManagement>

```

非常easy，只需要引入`eureka `的依赖即可。
然后在入口类加入一个注解`@EnableEurekaServer`，即可将该项目作为服务注册中心：

```java
package com.crossoverJie.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

@EnableEurekaServer
@SpringBootApplication
public class EurekaApplication {
	private final static Logger logger = LoggerFactory.getLogger(EurekaApplication.class);
	public static void main(String[] args) {

		SpringApplication.run(EurekaApplication.class, args);
		logger.info("SpringBoot Start Success");
	}

}
```

接着修改配置文件`application.properties`:

```properties
server.port=8888

# 不向注册中心注册自己
eureka.client.register-with-eureka=false

# 不需要检索服务
eureka.client.fetch-registry=false

eureka.client.serviceUrl.defaultZone=http://localhost:${server.port}/eureka/
```

配置一下端口以及注册中心的地址即可。
然后按照正常启动`springBoot`项目一样启动即可。

在地址栏输入[http://localhost:8888](http://localhost:8888/)看到一下界面：

![springBoot04.jpg](https://ooo.0o0.ooo/2017/06/26/59511cef59d46.jpg)

当然现在在注册中心还看不到任何一个应用，下面需要将上文的`sbc-user,sbc-order`注册进来。

## 向注册中心注册服务提供者

只需要在`application.properties`配置文件中加上注册中心的配置：

```
eureka.client.serviceUrl.defaultZone=http://localhost:8888/eureka/
```

并在`sbc-order`的主类中加入`@EnableDiscoveryClient`注解即可完成注册服务。

启动注册中心以及应用，在注册中心看到一下界面则成功注册:

![springBoot05.jpg](https://ooo.0o0.ooo/2017/06/26/595129f117276.jpg)


## 消费注册中心的服务

服务是注册上去了，自然是需要消费了，这里就简单模拟了在调用`http://localhost:8080/user/getUser`这个接口的时候`getUser`接口会去调用`order`的`getOrder`服务。

这里会用到另一个依赖:

```xml
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-ribbon</artifactId>
</dependency>
```

他可以帮我们做到客户端负载，具体使用如下：

- 加入ribbon依赖。
- 在主类中开启`@LoadBalanced`客户端负载。
- 创建`restTemplate`类的实例

```java
@Bean
	@LoadBalanced
	public RestTemplate restTemplate() {
		return new RestTemplate();
	}
```

- 使用`restTemplate `调用远程服务:

```java

	 @Autowired
    private RestTemplate restTemplate;
    
	 @RequestMapping(value = "/getUser",method = RequestMethod.POST)
    public UserRes getUser(@RequestBody UserReq userReq){
        OrderNoReq req = new OrderNoReq() ;
        req.setReqNo("1213");
        //调用远程服务
        ResponseEntity<Object> res = restTemplate.postForEntity("http://sbc-order/order/getOrderNo", req, Object.class);
        logger.info("res="+JSON.toJSONString(res));

        logger.debug("入参="+ JSON.toJSONString(userReq));
        UserRes userRes = new UserRes() ;
        userRes.setUserId(123);
        userRes.setUserName("张三");

        userRes.setReqNo(userReq.getReqNo());
        userRes.setCode(StatusEnum.SUCCESS.getCode());
        userRes.setMessage("成功");

        return userRes ;

    }
```

由于我的远程接口是`post`,所以使用了`postForEntity()`方法，如果是`get`就换成`getForEntity()`即可。

> 注意这里是使用应用名`sbc-order(配置于sbc-order的application.properties中)`来进行调用的，并不是一个IP地址。

启动注册中心、两个应用。
用`PostMan`调用`getUser`接口时控制台打印:

```
2017-06-27 00:18:04.534  INFO 63252 --- [nio-8080-exec-3] c.c.sbcuser.controller.UserController    : res={"body":{"code":"4000","message":"appID不能为空","reqNo":"1213"},"headers":{"X-Application-Context":["sbc-order:8181"],"Content-Type":["application/xml;charset=UTF-8"],"Transfer-Encoding":["chunked"],"Date":["Mon, 26 Jun 2017 16:18:04 GMT"]},"statusCode":"OK","statusCodeValue":200}

```
由于并没有传递`appId`所以`order`服务返回了一个错误，也正说明是远程调用到了该服务。


# 总结

> ps:这里只是简单使用了`ribbon`来进行服务调用，但在实际的开发中还是比较少的使用这种方式来调用远程服务，而是使用`Feign`进行声明式调用，可以简化客户端代码，具体使用方式请持续关注。


本次算是`springBoot+springCloud`的入门，还有很多东西没有讲到，之后我将会根据实际使用的一些经验继续分享`SpringCloud`这个新兴框架。

> 项目：[https://github.com/crossoverJie/springboot-cloud](https://github.com/crossoverJie/springboot-cloud)

> 博客：[http://crossoverjie.top](http://crossoverjie.top)。