---
title: sbc(五)Hystrix-服务容错与保护
date: 2017/09/20 01:13:22    
categories: 
- sbc
tags: 
- Java
- SpringBoot
- SpringCloud
- Hystrix
---

![1](https://i.loli.net/2019/05/08/5cd1ba8f8f39f.jpg)


# 前言

看过 [应用限流](http://crossoverjie.top/2017/08/11/sbc4/)的朋友应该知道，限流的根本目的就是为了保障服务的高可用。

本次再借助`SpringCloud`中的集成的`Hystrix`组件来谈谈服务容错。

其实产生某项需求的原因都是为了解决某个需求。当我们将应用进行分布式模块部署之后,各个模块之间通过远程调用的方式进行交互(`RPC`)。拿我们平时最常见的下单买商品来说，点击下单按钮的一瞬间可能会向发送的请求包含：

- 请求订单系统创建订单。
- 请求库存系统扣除库存。
- 请求用户系统更新用户交易记录。

这其中的每一步都有可能因为网络、资源、服务器等原因造成延迟响应甚至是调用失败。当后面的请求源源不断的过来时延迟的资源也没有的到释放，这样的堆积很有可能把其中一个模块拖垮，其中的依赖关系又有可能把整个调用链中的应用Over最后导致整个系统不可能。这样就会产生一种现象:`雪崩效应`。

之前讲到的限流也能起到一定的保护作用，但还远远不够。我们需要从各个方面来保障服务的高可用。

比如：

- 超时重试。
- 断路器模式。
-  服务降级。
等各个方面来保障。

<!--more-->

# 使用Hystrix

`SpringCloud`中已经为我们集成了`Netflix`开源的`Hystrix`框架，使用该框架可以很好的帮我们做到服务容错。

## Hystrix简介

下面是一张官方的流程图:

![](https://i.loli.net/2019/05/08/5cd1ba9465427.jpg)

简单介绍下:

> 在远程调用时，将请求封装到HystrixCommand进行同步或是异步调用，在调用过程中判断熔断器是否打开、线程池或是信号量是否饱和、执行过程中是否抛出异常，如果是的话就会进入回退逻辑。并且整个过程中都会收集运行状态来控制断路器的状态。

不但如此该框架还拥有自我恢复功能，当断路器打开后，每次请求都会进入回退逻辑。当我们的应用恢复正常后也不能再进入回退逻辑吧。

所以`hystrix`会在断路器打开后的一定时间将请求发送到服务提供者，如果正常响应就关闭断路器，反之则继续打开，这样就能很灵活的自我修复了。

## Feign整合Hystrix

在之前的章节中已经使用`Feign`来进行声明式调用了，并且在实际开发中也是如此，所以这次我们就直接用Feign来整合Hystrix。

使用了项目原有的`sbc-user,sbc-order`来进行演示，调用关系如下图:

![](https://i.loli.net/2019/05/08/5cd1ba961dd9c.jpg)

`User应用`通过`Order`提供出来的`order-client`依赖调用了`Order`中的创建订单服务。

其中主要修改的就是`order-client`，在之前的`OrderServiceClient`接口中增加了以下注解:

```java
@RequestMapping(value="/orderService")
@FeignClient(name="sbc-order",
        // fallbackFactory = OrderServiceFallbackFactory.class,
        // FIXME: 2017/9/4 如果配置了fallback 那么fallbackFactory将会无效
        fallback = OrderServiceFallBack.class,
        configuration = OrderConfig.class)
@RibbonClient
public interface OrderServiceClient extends OrderService{

    @ApiOperation("获取订单号")
    @RequestMapping(value = "/getOrderNo", method = RequestMethod.POST)
    BaseResponse<OrderNoResVO> getOrderNo(@RequestBody OrderNoReqVO orderNoReq) ;
}
```
由于Feign已经默认整合了`Hystrix`所以不需要再额外加入依赖。

## 服务降级

对应的`@FeignClient中的fallback属性`则是服务容错中很关键的服务降级的具体实现，来看看`OrderServiceFallBack`类:

```java
public class OrderServiceFallBack implements OrderServiceClient {
    @Override
    public BaseResponse<OrderNoResVO> getOrderNo(@RequestBody OrderNoReqVO orderNoReq) {
        BaseResponse<OrderNoResVO> baseResponse = new BaseResponse<>() ;
        OrderNoResVO vo = new OrderNoResVO() ;
        vo.setOrderId(123456L);
        baseResponse.setDataBody(vo);
        baseResponse.setMessage(StatusEnum.FALLBACK.getMessage());
        baseResponse.setCode(StatusEnum.FALLBACK.getCode());
        return baseResponse;
    }
}
```
该类实现了`OrderServiceClient`接口，可以很明显的看出其中的`getOrderNo()`方法就是服务降级时所触发的逻辑。

光有实现还不够，我们需要将改类加入到`Spring`中管理起来。这样上文中`@FeignClient`的`configuration`属性就起到作用了，来看看对应的`OrderConfig`的代码:

```java
@Configuration
public class OrderConfig {
    @Bean
    public OrderServiceFallBack fallBack(){
        return new OrderServiceFallBack();
    }
    @Bean
    public OrderServiceFallbackFactory factory(){
        return new OrderServiceFallbackFactory();
    }

}
```
其中`new OrderServiceFallBack()`并用了`@Bean`注解，等同于:

```
<bean id="orderServiceFallBack" class="com.crossoverJie.order.feign.config.OrderServiceFallBack">
</bean>
```

这样每当请求失败就会执行回退逻辑，如下图:
![](https://i.loli.net/2019/05/08/5cd1ba9c7c388.jpg)

值得注意的是即便是执行了回退逻辑断路器也不一定打开了，我们可以通过应用的`health`端点来查看`Hystrix`的状态。

ps:想要查看该端点需要加入以下依赖:

```xml
<dependency>
 <groupId>org.springframework.boot</groupId>
 <artifactId>spring-boot-starter-actuator</artifactId> 
</dependency>
```
就拿刚才的例子来说，先关闭`Order`应用，在`Swagger`访问下面这个接口，肯定是会进入回退逻辑:

```java
@RestController
@Api("用户服务API")
@RequestMapping(value = "/userService")
@Validated
public interface UserService {

    @ApiOperation("hystrix容错调用")
    @RequestMapping(value = "/getUserByHystrix", method = RequestMethod.POST)
    BaseResponse<OrderNoResVO> getUserByHystrix(@RequestBody UserReqVO userReqVO) ;
}
```

查看`health`端点:

![](https://i.loli.net/2019/05/08/5cd1baa68a4a0.jpg)
发现`Hystrix`的状态依然是UP状态，表明当前断路器并没有打开。

反复调用多次接口之后再次查看`health`端点:
![](https://i.loli.net/2019/05/08/5cd1baaba6f4a.jpg)

发现这个时候断路器已经打开了。

> 这是因为断路器只有在达到了一定的失败阈值之后才会打开。

## 输出异常

进入回退逻辑之后还不算完，大部分场景我们都需要记录为什么回退，也就是具体的异常。这些信息对我们后续的系统监控，应用调优也有很大帮助。

实现起来也很简单:
上文中在`@FeignClient`注解中加入的`fallbackFactory = OrderServiceFallbackFactory.class`属性则是用于处理回退逻辑以及包含异常信息：

```java
/**
 * Function:查看fallback原因
 *
 * @author crossoverJie
 *         Date: 2017/9/4 00:45
 * @since JDK 1.8
 */
public class OrderServiceFallbackFactory implements FallbackFactory<OrderServiceClient>{

    private final static Logger LOGGER = LoggerFactory.getLogger(OrderServiceFallbackFactory.class);

    @Override
    public OrderServiceClient create(Throwable throwable) {

        return new OrderServiceClient() {
            @Override
            public BaseResponse<OrderNoResVO> getOrderNo(@RequestBody OrderNoReqVO orderNoReq) {
                LOGGER.error("fallback:" + throwable);

                BaseResponse<OrderNoResVO> baseResponse = new BaseResponse<>() ;
                OrderNoResVO vo = new OrderNoResVO() ;
                vo.setOrderId(123456L);
                baseResponse.setDataBody(vo);
                baseResponse.setMessage(StatusEnum.FALLBACK.getMessage());
                baseResponse.setCode(StatusEnum.FALLBACK.getCode());
                return baseResponse;
            }
        };
    }
}
```

代码很简单，实现了`FallbackFactory`接口中的`create()`方法，该方法的入参就是异常信息，可以按照我们的需要自行处理，后面则是和之前一样的回退处理。

`2017-09-21 13:22:30.307 ERROR 27838 --- [rix-sbc-order-1] c.c.o.f.f.OrderServiceFallbackFactory    : fallback:java.lang.RuntimeException: com.netflix.client.ClientException: Load balancer does not have available server for client: sbc-order
`。

**Note**:

`fallbackFactory`和`fallback`属性不可共用。

# Hystrix监控

Hystrix还自带了一套监控组件，只要依赖了`spring-boot-starter-actuator`即可通过`/hystrix.stream`端点来获得监控信息。
![](https://i.loli.net/2019/05/08/5cd1babaa3ad3.jpg)

冰冷的数据肯定没有实时的图表来的直观，所以`Hystrix`也自带`Dashboard`。

## Hystrix与Turbine聚合监控

为此我们新建了一个应用`sbc-hystrix-turbine`来显示`hystrix-dashboard`。
目录结构和普通的`springboot`应用没有差异，看看主类:

```java
//开启EnableTurbine

@EnableTurbine
@SpringBootApplication
@EnableHystrixDashboard
public class SbcHystrixTurbineApplication {

	public static void main(String[] args) {
		SpringApplication.run(SbcHystrixTurbineApplication.class, args);
	}
}
```

- 其中使用`@EnableHystrixDashboard`开启`Dashboard`
- `@EnableTurbine`开启`Turbine`支持。

以上这些注解需要以下这些依赖:
```xml
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-starter-turbine</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-netflix-turbine</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-actuator</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-starter-hystrix-dashboard</artifactId>
		</dependency>
```

> 实际项目中，我们的应用都是多节点部署以达到高可用的目的，单个监控显然不现实，所以需要使用Turbine来进行聚合监控。

关键的`application.properties`配置文件:

```properties
# 项目配置
spring.application.name=sbc-hystrix-trubine
server.context-path=/
server.port=8282

# eureka地址
eureka.client.serviceUrl.defaultZone=http://node1:8888/eureka/
eureka.instance.prefer-ip-address=true

# 需要加入的实例
turbine.appConfig=sbc-user,sbc-order
turbine.cluster-name-expression="default"
```
其中`turbine.appConfig`配置我们需要监控的应用，这样当多节点部署的时候就非常方便了(`同一个应用的多个节点spring.application.name值是相同的`)。

将该应用启动访问`http://ip:port/hystrix.stream`：

![](https://i.loli.net/2019/05/08/5cd1babf06bd4.jpg)

由于我们的turbine和Dashboard是一个应用所以输入`http://localhost:8282/turbine.stream`即可。

![](https://i.loli.net/2019/05/08/5cd1bac102a95.jpg)

详细指标如官方描述:
![](https://i.loli.net/2019/05/08/5cd1bacaa0788.jpg)

通过该面板我们就可以及时的了解到应用当前的各个状态，如果再加上一些报警措施就能帮我们及时的响应生产问题。

# 总结

服务容错的整个还是比较大的,博主也是摸着石头过河，关于本次的`Hystrix`只是一个入门版，后面会持续分析它的线程隔离、信号量隔离等原理。

> 项目：[https://github.com/crossoverJie/springboot-cloud](https://github.com/crossoverJie/springboot-cloud)

> 博客：[http://crossoverjie.top](http://crossoverjie.top)。
