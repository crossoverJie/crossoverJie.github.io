---
title: Pulsar 重复消费?
date: 2022/03/18 08:15:36 
categories: 
- 问题排查
- Java 进阶
tags: 
- Pulsar
- Consumer
---

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h09wy1o5v8j20rs0rs408.jpg)



# 背景

许久没有分享 Java 相关的问题排查了，最近帮同事一起排查了一个问题：

> 在使用 `Pulsar` 消费时，发生了同一条消息反复消费的情况。

<!--more-->

# 排查

当他告诉我这个现象的时候我就持怀疑态度，根据之前使用的经验 Pulsar 在官方文档以及 API 中都解释过：

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h0c6a9vzvuj216y05gdhd.jpg)
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h0c6apssrmj21t00o8afc.jpg)
只有当设置了消费的 `ackTimeout` 并超时消费时才会重复投递消息，默认情况下是关闭的，查看代码也确实没有开启。

那会不会是调用了 `negativeAcknowledge()` 方法呢（调用该方法也会触发重新投递），因为我们使了一个第三方库 [https://github.com/majusko/pulsar-java-spring-boot-starter](https://github.com/majusko/pulsar-java-spring-boot-starter) 只有当抛出异常时才会调用该方法。

查阅代码之后也没有地方抛出异常，甚至整个过程中都没看到异常产生；这就有点诡异了。

## 复现

为了捋清楚整个事情的来龙去脉，详细了解了他的使用流程；

其实也就是业务出现了 `bug`，他在消息消费时 `debug` 然后进行单步调试，当走完一次调试后，没多久马上又收到了同样的消息。

但奇怪的是也不是每次 `debug` 后都能重复消费，我们都说如果一个 `bug` 能 100% 完全复现，那基本上就解决一大半了。

所以我们排查的第一步就是完全复现这个问题。

---

为了排除掉是 IDEA 的问题（虽然极大概率不太可能）既然是 `debug` 的时候产生的问题，那其实转换到代码也就是 `sleep` 嘛，所以我们打算在消费逻辑里直接 `sleep` 一段时间看能否复现。

经过测试，`sleep` 几秒到几十秒都无法复现，最后索性 `sleep` 一分钟，神奇的事情发生了，每次都成功复现！

既然能成功复现那就好说了，因为我自己的业务代码也有使用到 `Pulsar` 的地方，为了方便调试就准备在自己的项目里再复现一次。

结果诡异的事情再次发生，我这里又不能复现了。

> 虽然这才是符合预期的，但这就没法调了呀。


本着相信现代科学的前提，我们俩唯一的区别就是项目不一样了，为此我对比了两边的代码。

```java
    @PulsarConsumer(
            topic = xx,
            clazz = Xx.class,
            subscriptionType = SubscriptionType.Shared
    )
    public void consume(Data msg) {
        log.info("consume msg:{}", msg.getOrderId());
        Lock lock = redisLockRegistry.obtain(msg.getOrderId());
        if (lock.tryLock()) {
            try {
                orderService.do(msg.getOrderId());
            } catch (Exception e) {
                log.error("consumer msg:{} err:", msg.toString(), e);
            } finally {
                lock.unlock();
            }
        }

    }
```

结果不出所料，同事那边的代码加了锁；一个基于 Redis 的分布式锁，这时我一拍大腿不会是解锁的时候超时了导致抛了异常吧。

为了验证这个问题，在能复现的基础上我在框架的 `Pulsar` 消费处打了断点：
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h0c4tmq9dhj22zg0hon4e.jpg)
![](https://tva1.sinaimg.cn/large/e6c9d24ely1h0c5xve3qaj21ss070q4u.jpg)
果然破案了，异常提示已经非常清楚了：加锁已经过了超时时间。

进入异常后直接 `negative` 消息，同时异常也被吃掉了，所以之前没有发现。

![](https://tva1.sinaimg.cn/large/e6c9d24ely1h0dckg14crj21l60maq88.jpg)
查阅了 `RedisLockRegistry` 的源码，默认超时时间正好是一分钟，所以之前我们 `sleep` 几十秒也无法复现这个问题。

# 总结

事后我向同事了解了下为啥这里要加锁，因为我看下来完全没有加锁的必要；结果他是因为从别人那里复制的代码才加上的，压根没想那么多。

所以这事也能得出一些教训：

- ctrl C/V 虽然方便，但也得充分考虑自己的业务场景。
- 使用一些第三方 API 时，需要充分了解其作用、参数。




**你的点赞与分享是对我最大的支持**

