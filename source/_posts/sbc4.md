---
title: sbc(四)应用限流
date: 2017/08/11 18:13:22    
categories: 
- sbc
tags: 
- Java
- SpringBoot
- SpringCloud
- RateLimiter
---

![pexels-photo-306198.jpeg](https://i.loli.net/2017/08/11/598c8c87529b1.jpeg)


# 前言

> 在一个高并发系统中对流量的把控是非常重要的，当巨大的流量直接请求到我们的服务器上没多久就可能造成接口不可用，不处理的话甚至会造成整个应用不可用。

比如最近就有个这样的需求，我作为客户端要向`kafka`生产数据，而`kafka`的消费者则再源源不断的消费数据，并将消费的数据全部请求到`web服务器`，虽说做了负载(有4台`web服务器`)但业务数据的量也是巨大的，每秒钟可能有上万条数据产生。如果生产者直接生产数据的话极有可能把`web服务器`拖垮。

对此就必须要做限流处理，每秒钟生产一定限额的数据到`kafka`，这样就能极大程度的保证`web`的正常运转。

**其实不管处理何种场景，本质都是降低流量保证应用的高可用。**


# 常见算法

对于限流常见有两种算法:

- 漏桶算法
- 令牌桶算法

漏桶算法比较简单，就是将流量放入桶中，漏桶同时也按照一定的速率流出，如果流量过快的话就会溢出(`漏桶并不会提高流出速率`)。溢出的流量则直接丢弃。

如下图所示:

![漏桶算法，来自网络.png](https://i.loli.net/2017/08/11/598c905caa8cb.png)

<!--more-->

这种做法简单粗暴。

`漏桶算法`虽说简单，但却不能应对实际场景，比如突然暴增的流量。

这时就需要用到`令牌桶算法`:

`令牌桶`会以一个恒定的速率向固定容量大小桶中放入令牌，当有流量来时则取走一个或多个令牌。当桶中没有令牌则将当前请求丢弃或阻塞。

![令牌桶算法-来自网络.gif](https://i.loli.net/2017/08/11/598c91f2a33af.gif)

> 相比之下令牌桶可以应对一定的突发流量.

# RateLimiter实现

对于令牌桶的代码实现，可以直接使用`Guava`包中的`RateLimiter`。

```java
    @Override
    public BaseResponse<UserResVO> getUserByFeignBatch(@RequestBody UserReqVO userReqVO) {
        //调用远程服务
        OrderNoReqVO vo = new OrderNoReqVO() ;
        vo.setReqNo(userReqVO.getReqNo());

        RateLimiter limiter = RateLimiter.create(2.0) ;
        //批量调用
        for (int i = 0 ;i< 10 ; i++){
            double acquire = limiter.acquire();
            logger.debug("获取令牌成功!,消耗=" + acquire);
            BaseResponse<OrderNoResVO> orderNo = orderServiceClient.getOrderNo(vo);
            logger.debug("远程返回:"+JSON.toJSONString(orderNo));
        }

        UserRes userRes = new UserRes() ;
        userRes.setUserId(123);
        userRes.setUserName("张三");

        userRes.setReqNo(userReqVO.getReqNo());
        userRes.setCode(StatusEnum.SUCCESS.getCode());
        userRes.setMessage("成功");

        return userRes ;
    }
```

[详见此](https://github.com/crossoverJie/springboot-cloud/blob/master/sbc-user/user/src/main/java/com/crossoverJie/sbcuser/controller/UserController.java#L82:L105)。

调用结果如下:

![1.jpg](https://i.loli.net/2017/08/11/598c960f8983f.jpg)

代码可以看出以每秒向桶中放入两个令牌，请求一次消耗一个令牌。所以每秒钟只能发送两个请求。按照图中的时间来看也确实如此(返回值是获取此令牌所消耗的时间，差不多也是每500ms一个)。

使用`RateLimiter `有几个值得注意的地方:

允许`先消费，后付款`，意思就是它可以来一个请求的时候一次性取走几个或者是剩下所有的令牌甚至多取，但是后面的请求就得为上一次请求买单，它需要等待桶中的令牌补齐之后才能继续获取令牌。

# 总结

针对于单个应用的限流 `RateLimiter` 够用了，如果是分布式环境可以借助 `Redis` 来完成。

最近也怼了一个，可以[参考](https://crossoverjie.top/2018/04/28/sbc/sbc7-Distributed-Limit/)。

> 项目：[https://github.com/crossoverJie/springboot-cloud](https://github.com/crossoverJie/springboot-cloud)

> 博客：[http://crossoverjie.top](http://crossoverjie.top)。