---
title: sbc(三)自定义Starter-SpringBoot重构去重插件
date: 2017/08/01 20:10:19    
categories: 
- sbc
tags: 
- Java
- SpringBoot
- SpringCloud
- AOP
- 重构
---

![pexels-photo-9046.jpg](https://i.loli.net/2017/08/01/59800eca06bf0.jpg)

# 前言

之前看过[SSM(十四) 基于annotation的http防重插件](http://crossoverjie.top/2017/05/24/SSM14/)的朋友应该记得我后文说过之后要用`SpringBoot`来进行重构。

> 这次采用自定义的`starter`的方式来进行重构。 

关于`starter(起步依赖)`其实在第一次使用`SpringBoot`的时候就已经用到了，比如其中的:

```xml
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-web</artifactId>
</dependency>
```
我们只需要引入这一个依赖`SpringBoot`就会把相关的依赖都加入进来，自己也不需要再去担心各个版本之间的兼容问题(具体使用哪个版本由使用的`spring-boot-starter-parent`版本决定)，这些`SpringBoot`都已经帮我们做好了。

![01.jpg](https://i.loli.net/2017/08/01/598028d65b395.jpg)

---

<!--more-->


# Spring自动化配置

先加入需要的一些依赖:

```xml
	<dependency>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter</artifactId>
	</dependency>

	<!--aop相关-->
	<dependency>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-aop</artifactId>
	</dependency>

	<!--redis相关-->
	<dependency>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-redis</artifactId>
	</dependency>

	<!--配置相关-->
	<dependency>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-configuration-processor</artifactId>
		<optional>true</optional>
	</dependency>

	<!--通用依赖-->
	<dependency>
		<groupId>com.crossoverJie</groupId>
		<artifactId>sbc-common</artifactId>
		<version>1.0.0-SNAPSHOT</version>
	</dependency>
```

创建了`CheckReqConf`配置类用于在应用启动的时候自动配置。
当然前提还得在`resources`目录下创建`META-INF/spring.factories`配置文件用于指向当前类，才能在应用启动时进行自动配置。

`spring.factories`:

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=
\com.crossoverJie.request.check.conf.CheckReqConf
```

## 使用条件化配置

试着考虑下如下情况:

> 因为该插件是使用`redis`来存储请求信息的，外部就依赖了`redis`。如果使用了该插件的应用没有配置或者忘了配置`redis`的一些相关连接，那么在应用使用过程中肯定会出现写入`redis`异常。
> 
> 如果异常没有控制好的话还有可能影响项目的正常运行。

那么怎么解决这个情况呢，可以使用`Spring4.0`新增的条件化配置来解决。

解决思路是:可以简单的通过判断应用中是否配置有`spring.redis.host`redis连接，如果没有我们的这个配置就会被忽略掉。

实现代码:

```java
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

@Configuration
@ComponentScan("com.crossoverJie.request.check.interceptor,com.crossoverJie.request.check.properties")

//是否有redis配置的校验，如果没有配置则不会加载改配置，也就是当前插件并不会生效
@Conditional(CheckReqCondition.class)
public class CheckReqConf {
}
```

具体校验的代码`CheckReqCondition`:

```java
public class CheckReqCondition implements Condition {

    private static Logger logger = LoggerFactory.getLogger(CheckReqCondition.class);


    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata annotatedTypeMetadata) {

        //如果没有加入redis配置的就返回false
        String property = context.getEnvironment().getProperty("spring.redis.host");
        if (StringUtils.isEmpty(property)){
            logger.warn("Need to configure redis!");
            return false ;
        }else {
            return true;
        }

    }
}
```

只需要实现`org.springframework.context.annotation.Condition`并重写`matches()`方法,即可实现个人逻辑。

> 可以在使用了该依赖的配置文件中配置或者是不配置`spring.redis.host`这个配置,来看我们的切面类(`ReqNoDrcAspect`)中53行的日志是否有打印来判断是否生效。

这样只有在存在该key的情况下才会应用这个配置。
> 当然最好的做法是直接尝试读、写redis,看是否连接畅通来进行判断。



# `AOP`切面

最核心的其实就是这个切面类，里边主要逻辑和之前是一模一样的就不在多说,只是这里应用到了自定义配置。

切面类`ReqNoDrcAspect`:

```java
//切面注解
@Aspect
//扫描
@Component
//开启cglib代理
@EnableAspectJAutoProxy(proxyTargetClass = true)
public class ReqNoDrcAspect {
    private static Logger logger = LoggerFactory.getLogger(ReqNoDrcAspect.class);

    @Autowired
    private CheckReqProperties properties ;

    private String prefixReq ;

    private long day ;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @PostConstruct
    public void init() throws Exception {
        prefixReq = properties.getRedisKey() == null ? "reqNo" : properties.getRedisKey() ;
        day = properties.getRedisTimeout() == null ? 1L : properties.getRedisTimeout() ;
        logger.info("sbc-request-check init......");
        logger.info(String.format("redis prefix is [%s],timeout is [%s]", prefixReq, day));
    }

    /**
     * 切面该注解
     */
    @Pointcut("@annotation(com.crossoverJie.request.check.anotation.CheckReqNo)")
    public void checkRepeat(){
    }

    @Before("checkRepeat()")
    public void before(JoinPoint joinPoint) throws Exception {
        BaseRequest request = getBaseRequest(joinPoint);
        if(request != null){
            final String reqNo = request.getReqNo();
            if(StringUtil.isEmpty(reqNo)){
                throw new SBCException(StatusEnum.REPEAT_REQUEST);
            }else{
                try {
                    String tempReqNo = redisTemplate.opsForValue().get(prefixReq +reqNo);
                    logger.debug("tempReqNo=" + tempReqNo);

                    if((StringUtil.isEmpty(tempReqNo))){
                        redisTemplate.opsForValue().set(prefixReq + reqNo, reqNo, day, TimeUnit.DAYS);
                    }else{
                        throw new SBCException("请求号重复,"+ prefixReq +"=" + reqNo);
                    }

                } catch (RedisConnectionFailureException e){
                    logger.error("redis操作异常",e);
                    throw new SBCException("need redisService") ;
                }
            }
        }

    }



    public static BaseRequest getBaseRequest(JoinPoint joinPoint) throws Exception {
        BaseRequest returnRequest = null;
        Object[] arguments = joinPoint.getArgs();
        if(arguments != null && arguments.length > 0){
            returnRequest = (BaseRequest) arguments[0];
        }
        return returnRequest;
    }
}

```

这里我们的写入`redis`key的前缀和过期时间改为从`CheckReqProperties`类中读取:

```java
@Component
//定义配置前缀
@ConfigurationProperties(prefix = "sbc.request.check")
public class CheckReqProperties {
    private String redisKey ;//写入redis中的前缀
    private Long redisTimeout ;//redis的过期时间 默认是天

    public String getRedisKey() {
        return redisKey;
    }

    public void setRedisKey(String redisKey) {
        this.redisKey = redisKey;
    }

    public Long getRedisTimeout() {
        return redisTimeout;
    }

    public void setRedisTimeout(Long redisTimeout) {
        this.redisTimeout = redisTimeout;
    }

    @Override
    public String toString() {
        return "CheckReqProperties{" +
                "redisKey='" + redisKey + '\'' +
                ", redisTimeout=" + redisTimeout +
                '}';
    }
}
```

这样如果是需要很多配置的情况下就可以将内容封装到该对象中，方便维护和读取。

使用的时候只需要在自己应用的`application.properties`中加入

```properties
# 去重配置
sbc.request.check.redis-key = req
sbc.request.check.redis-timeout= 2
```

# 应用插件

使用方法也和之前差不多(在[sbc-order](https://github.com/crossoverJie/springboot-cloud/tree/master/sbc-order)应用)：

- 加入依赖：

```xml
<!--防重插件-->
<dependency>
    <groupId>com.crossoverJie.request.check</groupId>
    <artifactId>request-check</artifactId>
    <version>1.0.0-SNAPSHOT</version>
</dependency>
```

- 在接口上加上注解:

```Java
@RestController
@Api(value = "orderApi", description = "订单API", tags = {"订单服务"})
public class OrderController implements OrderService{
    private final static Logger logger = LoggerFactory.getLogger(OrderController.class);


    @Override
    @CheckReqNo
    public BaseResponse<OrderNoResVO> getOrderNo(@RequestBody OrderNoReqVO orderNoReq) {
        BaseResponse<OrderNoResVO> res = new BaseResponse();
        res.setReqNo(orderNoReq.getReqNo());
        if (null == orderNoReq.getAppId()){
            throw new SBCException(StatusEnum.FAIL);
        }
        OrderNoResVO orderNoRes = new OrderNoResVO() ;
        orderNoRes.setOrderId(DateUtil.getLongTime());
        res.setCode(StatusEnum.SUCCESS.getCode());
        res.setMessage(StatusEnum.SUCCESS.getMessage());
        res.setDataBody(orderNoRes);
        return res ;
    }
}
```

使用效果如下:

![02.jpg](https://i.loli.net/2017/08/01/59803ca7b9ece.jpg)
![03.jpg](https://i.loli.net/2017/08/01/59803ca7d603d.jpg)


# 总结

注意一点是`spring.factories`的路径不要搞错了,之前就是因为路径写错了，导致自动配置没有加载，AOP也就没有生效，排查了好久。。


> 项目：[https://github.com/crossoverJie/springboot-cloud](https://github.com/crossoverJie/springboot-cloud)

> 博客：[http://crossoverjie.top](http://crossoverjie.top)。