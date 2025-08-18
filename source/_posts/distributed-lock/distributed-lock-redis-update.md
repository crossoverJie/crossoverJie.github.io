---
title: 分布式工具的一次小升级⏫
date: 2018/06/07 22:20:46 
categories: 
- Distributed Tools
tags: 
- Distributed Lock
- Distributed Limited
---

![](https://i.loli.net/2019/05/08/5cd1d53277e6e.jpg)

## 前言

之前在做 [秒杀架构实践](https://crossoverjie.top/2018/05/07/ssm/SSM18-seconds-kill/#distributed-redis-tool-%E2%AC%86%EF%B8%8Fv1-0-3) 时有提到对 [distributed-redis-tool](https://github.com/crossoverJie/distributed-redis-tool) 的一次小升级，但是没有细说。

其实主要原因是：

> 秒杀时我做压测：由于集成了这个限流组件，并发又比较大，所以导致连接、断开 Redis 非常频繁。
> 最终导致获取不了 Redis connection 的异常。

## 池化技术

这就是一个典型的对稀缺资源使用不善导致的。

何为稀缺资源？常见的有：

- 线程
- 数据库连接
- 网络连接等

这些资源都有共同的特点：**创建销毁成本较高**。

<!--more-->

这里涉及到的 Redis 连接也属于该类资源。

我们希望将这些稀有资源管理起来放到一个池子里，当需要时就从中获取，用完就放回去，不够用时就等待（或返回）。

这样我们只需要初始化并维护好这个池子，就能避免频繁的创建、销毁这些资源（也有资源长期未使用需要缩容的情况）。

通常我们称这项姿势为池化技术，如常见的：

- 线程池
- 各种资源的连接池等。

为此我将使用到 Redis 的 [分布式锁](https://crossoverjie.top/%2F2018%2F03%2F29%2Fdistributed-lock%2Fdistributed-lock-redis%2F)、[分布式限流](https://crossoverjie.top/2018/04/28/sbc/sbc7-Distributed-Limit/) 都升级为利用连接池来获取 Redis 的连接。

这里以[分布式锁](https://github.com/crossoverJie/distributed-redis-tool#distributed-lock)为例：

将使用的 api 修改为：

原有：

```java
@Configuration
public class RedisLockConfig {

    @Bean
    public RedisLock build(){
        //Need to get Redis connection 
        RedisLock redisLock = new RedisLock() ;
        HostAndPort hostAndPort = new HostAndPort("127.0.0.1",7000) ;
        JedisCluster jedisCluster = new JedisCluster(hostAndPort) ;
        RedisLock redisLock = new RedisLock.Builder(jedisCluster)
                .lockPrefix("lock_test")
                .sleepTime(100)
                .build();
                
        return redisLock ;
    }

}
```

现在：
```java
@Configuration
public class RedisLockConfig {
    private Logger logger = LoggerFactory.getLogger(RedisLockConfig.class);
    
    
    @Autowired
    private JedisConnectionFactory jedisConnectionFactory;
    
    @Bean
    public RedisLock build() {
        RedisLock redisLock = new RedisLock.Builder(jedisConnectionFactory,RedisToolsConstant.SINGLE)
                .lockPrefix("lock_")
                .sleepTime(100)
                .build();

        return redisLock;
    }
}
```

将以前的 Jedis 修改为 `JedisConnectionFactory`，后续的 Redis 连接就可通过这个对象获取。

并且显示的传入使用 RedisCluster 还是单机的 Redis。

所以在真正操作 Redis 时需要修改：

```java
    public boolean tryLock(String key, String request) {
        //get connection
        Object connection = getConnection();
        String result ;
        if (connection instanceof Jedis){
            result =  ((Jedis) connection).set(lockPrefix + key, request, SET_IF_NOT_EXIST, SET_WITH_EXPIRE_TIME, 10 * TIME);
            ((Jedis) connection).close();
        }else {
            result = ((JedisCluster) connection).set(lockPrefix + key, request, SET_IF_NOT_EXIST, SET_WITH_EXPIRE_TIME, 10 * TIME);
            try {
                ((JedisCluster) connection).close();
            } catch (IOException e) {
                logger.error("IOException",e);
            }
        }

        if (LOCK_MSG.equals(result)) {
            return true;
        } else {
            return false;
        }
    }
    
    //获取连接
    private Object getConnection() {
        Object connection ;
        if (type == RedisToolsConstant.SINGLE){
            RedisConnection redisConnection = jedisConnectionFactory.getConnection();
            connection = redisConnection.getNativeConnection();
        }else {
            RedisClusterConnection clusterConnection = jedisConnectionFactory.getClusterConnection();
            connection = clusterConnection.getNativeConnection() ;
        }
        return connection;
    }    
```

最大的改变就是将原有操作 Redis 的对象（`T extends JedisCommands`）改为从连接池中获取。

由于使用了 `org.springframework.data.redis.connection.jedis.JedisConnectionFactory` 作为 Redis 连接池。

所以需要再使用时构件好这个对象：

```java
        JedisPoolConfig config = new JedisPoolConfig();
        config.setMaxIdle(10);
        config.setMaxTotal(300);
        config.setMaxWaitMillis(10000);
        config.setTestOnBorrow(true);
        config.setTestOnReturn(true);

        RedisClusterConfiguration redisClusterConfiguration = new RedisClusterConfiguration();
        redisClusterConfiguration.addClusterNode(new RedisNode("10.19.13.51", 7000));

        //单机
        JedisConnectionFactory jedisConnectionFactory = new JedisConnectionFactory(config);

        //集群
        //JedisConnectionFactory jedisConnectionFactory = new JedisConnectionFactory(redisClusterConfiguration) ;
        jedisConnectionFactory.setHostName("47.98.194.60");
        jedisConnectionFactory.setPort(6379);
        jedisConnectionFactory.setPassword("");
        jedisConnectionFactory.setTimeout(100000);
        jedisConnectionFactory.afterPropertiesSet();
        //jedisConnectionFactory.setShardInfo(new JedisShardInfo("47.98.194.60", 6379));
        //JedisCluster jedisCluster = new JedisCluster(hostAndPort);

        HostAndPort hostAndPort = new HostAndPort("10.19.13.51", 7000);
        JedisCluster jedisCluster = new JedisCluster(hostAndPort);
        redisLock = new RedisLock.Builder(jedisConnectionFactory, RedisToolsConstant.SINGLE)
                .lockPrefix("lock_")
                .sleepTime(100)
                .build();

```

看起比较麻烦，需要构建对象的较多。

但整合 Spring 使用时就要清晰许多。


## 配合 Spring

Spring 很大的一个作用就是帮我们管理对象，所以像上文那些看似很复杂的对象都可以交由它来管理：

```xml
   <!-- jedis 配置 -->
    <bean id="JedispoolConfig" class="redis.clients.jedis.JedisPoolConfig">
        <property name="maxIdle" value="${redis.maxIdle}"/>
        <property name="maxTotal" value="${redis.maxTotal}"/>
        <property name="maxWaitMillis" value="${redis.maxWait}"/>
        <property name="testOnBorrow" value="${redis.testOnBorrow}"/>
        <property name="testOnReturn" value="${redis.testOnBorrow}"/>
    </bean>
    <!-- redis服务器中心 -->
    <bean id="connectionFactory" class="org.springframework.data.redis.connection.jedis.JedisConnectionFactory">
        <property name="poolConfig" ref="JedispoolConfig"/>
        <property name="port" value="${redis.port}"/>
        <property name="hostName" value="${redis.host}"/>
        <property name="password" value="${redis.password}"/>
        <property name="timeout" value="${redis.timeout}"></property>
    </bean>
    <bean id="redisTemplate" class="org.springframework.data.redis.core.RedisTemplate">
        <property name="connectionFactory" ref="connectionFactory"/>
        <property name="keySerializer">
            <bean class="org.springframework.data.redis.serializer.StringRedisSerializer"/>
        </property>
        <property name="valueSerializer">
            <bean class="org.springframework.data.redis.serializer.StringRedisSerializer"/>
        </property>
    </bean>
```

这个其实没多少好说的，就算是换成 SpringBoot 也是创建 `JedispoolConfig,connectionFactory,redisTemplate` 这些 bean 即可。

## 总结

换为连接池之后再进行压测自然没有出现获取不了 Redis 连接的异常（并发达到一定的量也会出错）说明更新是很有必要的。

推荐有用到该组件的朋友都升级下，也欢迎提出 Issues 和 PR。

项目地址：

[https://github.com/crossoverJie/distributed-redis-tool](https://github.com/crossoverJie/distributed-redis-tool)
