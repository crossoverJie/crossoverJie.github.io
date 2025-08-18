---
title: 分享几个 SpringBoot 实用的小技巧
date: 2018/10/15 00:01:24       
categories: 
- SpringBoot
tags: 
- Mock
- 加密
---

![](https://i.loli.net/2019/05/08/5cd1c6c1c0c74.jpg)

# 前言

最近分享的一些源码、框架设计的东西。我发现大家热情不是特别高，想想大多数应该还是正儿八经写代码的居多；这次就分享一点接地气的： `SpringBoot` 使用中的一些小技巧。

算不上多高大上的东西，但都还挺有用。

<!--more-->

# 屏蔽外部依赖

第一个是`屏蔽外部依赖`，什么意思呢？

比如大家日常开发时候有没有这样的烦恼：

项目是基于 `SpringCloud` 或者是 `dubbo` 这样的分布式服务，你需要依赖许多基础服务。

> 比如说某个订单号的生成、获取用户信息等。

由于服务拆分，这些功能都是在其他应用中以接口的形式提供，单测还好我还可以利用 `Mock` 把它屏蔽掉。

但如果自己想把应用启动起来同时把自己相关的代码跑一遍呢？

通常有几种做法：

- 本地把所有的服务都启动起来。
- 把注册中心换为开发环境，依赖开发环境的服务。
- 直接把代码推送到开发环境自测。

看起来三种都可以，以前我也是这么干的。但还是有几个小问题：

- 本地启动有可能服务很多，全部起来电脑能不能撑住还两说，万一服务有问题就进行不下去了。
- 依赖开发环境的前提是网络打通，还有一个问题就是开发环境代码很不稳定很大可能会影响你的测试。
- 推送到开发环境应该是比较靠谱的方案，但如果想调试只有日志大法，没有本地 `debug` 的效率高效。


那如何解决问题呢？既可以在本地调试也不用启动其他服务。

其实也可以利用单测的做法，把其他外部依赖 `Mock` 掉就行了。

大致的流程分为以下几步：

- `SpringBoot` 启动之后在 `Spring` 中找出你需要屏蔽的那个 `API` 的 `bean`（通常情况下这个接口都是交给 `Spring` 管理的）。
- 手动从 `bean` 容器中删除该 `bean`。
- 重新创建一个该 `API` 的对象，只不过是通过 `Mock` 出来的。
- 再手动注册进 `bean` 容器中。


以下面这段代码为例：

```java
    @Override
    public BaseResponse<OrderNoResVO> getUserByHystrix(@RequestBody UserReqVO userReqVO) {

        OrderNoReqVO vo = new OrderNoReqVO();
        vo.setAppId(123L);
        vo.setReqNo(userReqVO.getReqNo());
        BaseResponse<OrderNoResVO> orderNo = orderServiceClient.getOrderNo(vo);
        return orderNo;
    }
```


> 这是一个 SpringCloud 应用。

它依赖于 `orderServiceClient` 获取一个订单号。


其中的 `orderServiceClient` 就是一个外部 API，也是被 Spring 所管理。

## 替换原有的 Bean

下一步就是替换原有的 Bean。

```java
@Component
public class OrderMockServiceConfig implements CommandLineRunner {

    private final static Logger logger = LoggerFactory.getLogger(OrderMockServiceConfig.class);

    @Autowired
    private ApplicationContext applicationContext;

    @Value("${excute.env}")
    private String env;

    @Override
    public void run(String... strings) throws Exception {

        // 非本地环境不做处理
        if ("dev".equals(env) || "test".equals(env) || "pro".equals(env)) {
            return;
        }

        DefaultListableBeanFactory defaultListableBeanFactory = (DefaultListableBeanFactory) applicationContext.getAutowireCapableBeanFactory();

        OrderServiceClient orderServiceClient = defaultListableBeanFactory.getBean(OrderServiceClient.class);
        logger.info("======orderServiceClient {}=====", orderServiceClient.getClass());

        defaultListableBeanFactory.removeBeanDefinition(OrderServiceClient.class.getCanonicalName());

        OrderServiceClient mockOrderApi = PowerMockito.mock(OrderServiceClient.class,
                invocationOnMock -> BaseResponse.createSuccess(DateUtil.getLongTime() + "", "mock orderNo success"));

        defaultListableBeanFactory.registerSingleton(OrderServiceClient.class.getCanonicalName(), mockOrderApi);

        logger.info("======mockOrderApi {}=====", mockOrderApi.getClass());
    }
}
```


其中实现了 `CommandLineRunner` 接口，可以在 `Spring` 容器初始化完成之后调用 `run()` 方法。

代码非常简单，简单来说首先判断下是什么环境，毕竟除开本地环境其余的都是需要真正调用远程服务的。

之后就是获取 `bean` 然后手动删除掉。

关键的一步：

```java
OrderServiceClient mockOrderApi = PowerMockito.mock(OrderServiceClient.class,
                invocationOnMock -> BaseResponse.createSuccess(DateUtil.getLongTime() + "", "mock orderNo success"));

defaultListableBeanFactory.registerSingleton(OrderServiceClient.class.getCanonicalName(), mockOrderApi);
```

创建了一个新的 `OrderServiceClient` 对象并手动注册进了 `Spring` 容器中。

第一段代码使用的是 `PowerMockito.mock` 的 API，他可以创建一个代理对象，让所有调用 `OrderServiceClient` 的方法都会做默认的返回。

```java
BaseResponse.createSuccess(DateUtil.getLongTime() + "", "mock orderNo success"))
```

测试一下，当我们没有替换时调用刚才那个接口并且本地也没有启动 `OrderService`：

![](https://i.loli.net/2019/05/08/5cd1c6c3cc479.jpg)

因为没有配置 fallback 所以会报错，表示找不到这个服务。


替换掉 bean 时：

![](https://i.loli.net/2019/05/08/5cd1c6c68a740.jpg)

再次请求没有报错，并且获得了我们默认的返回。

![](https://i.loli.net/2019/05/08/5cd1c6cd7ba1d.jpg)

通过日志也会发现 `OrderServiceClient` 最后已经被 `Mock` 代理了，并不会去调用真正的方法。

# 配置加密

下一个则是配置加密，这应该算是一个基本功能。

比如我们配置文件中的一些账号和密码，都应该是密文保存的。

因此这次使用了一个开源组件来实现加密与解密，并且对 `SpringBoot` 非常友好只需要几段代码即可完成。

- 首先根据加密密码将需要加密的配置加密为密文。
- 替换原本明文保存的配置。
- 再使用时进行解密。

使用该包也只需要引入一个依赖即可：

```xml
<dependency>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-spring-boot-starter</artifactId>
    <version>1.14</version>
</dependency>
```

同时写一个单测根据密码生成密文，密码也可保存在配置文件中：

```
jasypt.encryptor.password=123456
```

接着在单测中生成密文。

```java
    @Autowired
    private StringEncryptor encryptor;

    @Test
    public void getPass() {
        String name = encryptor.encrypt("userName");
        String password = encryptor.encrypt("password");
        System.out.println(name + "----------------");
        System.out.println(password + "----------------");

    }
```

之后只需要使用密文就行。

由于我这里是对数据库用户名和密码加密，所以还得有一个解密的过程。

利用 `Spring Bean` 的一个增强接口即可实现：

```java
@Component
public class DataSourceProcess implements BeanPostProcessor {


    @Autowired
    private StringEncryptor encryptor;

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {

        if (bean instanceof DataSourceProperties){
            DataSourceProperties dataSourceProperties = (DataSourceProperties) bean;
            dataSourceProperties.setUsername(encryptor.decrypt(dataSourceProperties.getUsername())) ;
            dataSourceProperties.setPassword(encryptor.decrypt(dataSourceProperties.getPassword()));
            return dataSourceProperties ;
        }

        return bean;
    }
}
```

这样就可以在真正使用时还原为明文。

同时也可以在启动命令中配置刚才的密码：

```
java -Djasypt.encryptor.password=password -jar target/jasypt-spring-boot-demo-0.0.1-SNAPSHOT.jar
```

# 总结

这样两个小技巧就讲完了，大家有 `SpringBoot` 的更多使用技巧欢迎留言讨论。

上文的一些实例代码可以在这里找到：

[https://github.com/crossoverJie/springboot-cloud](https://github.com/crossoverJie/springboot-cloud)


**欢迎关注公众号一起交流：**
