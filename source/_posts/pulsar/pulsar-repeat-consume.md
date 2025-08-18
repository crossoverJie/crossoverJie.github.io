---
title: 通过 Pulsar 源码彻底解决重复消费问题
date: 2023/02/27 08:08:08 
categories: 
- Pulsar
tags: 
- Consumer
- Pulsar
---

![](https://s2.loli.net/2023/02/26/Oz94bQasM2Einok.png)

# 背景
最近真是和 `Pulsar` 杠上了，业务团队反馈说是线上有个应用消息重复消费。

![](https://s2.loli.net/2023/02/26/c2eZuTPUvrlB1YF.png)

而且在测试环境是可以稳定复现的，根据经验来看一般能稳定复现的都比较好解决。

<!--more-->

# 定位问题

接着便是定位问题了，根据之前的经验让业务按照这几种情况先排查一下：
![](https://s2.loli.net/2023/02/26/IrvxGDQuaSt7AOE.png)

通过排查：1,2可以排除了。
1. 没有相关日志
2. 存在异常，但最外层也捕获了，所以不管有无异常都会 ACK。

第三个也在消费的入口和提交消息出计算了时间，最终发现都是在2s左右 ACK 的。

伪代码如下：

```java
        Consumer consumer = client.newConsumer()
                .subscriptionType(SubscriptionType.Shared)
                .enableRetry(true)
                .topic(topic)
                .ackTimeout(30, TimeUnit.SECONDS)
                .subscriptionName("my-sub")
                .messageListener(new MessageListener<byte[]>() {
                    @SneakyThrows
                    @Override
                    public void received(Consumer<byte[]> consumer, Message<byte[]> msg) {
                        log.info("msg_id{}",msg.getMessageId().toString());
                        TimeUnit.SECONDS.sleep(2);
                        consumer.acknowledge(msg);
                    }
                })
                .subscribe();
```

那这就很奇怪了，因为代码里配置的 ackTimeout 是 30s，理论上来说是不会存在超时导致消息重发的。

为了排除是否是超时引起的，直接将业务代码注释掉了，等于是消息收到后立即就 ACK，经过测试发现这样确实就没有重复消费了。


为了再次确认是不是和 ackTimeout 有关，直接将 `.ackTimeout(30, TimeUnit.SECONDS)` 注释掉后测试，发现也没有重复消费了。

# 确认原因

既然如此那一定是和这个配置有关了，但看代码确实没有超时，为了定位具体原因只有去看 client 的源码了。



这里简单梳理下消息的消费的流程：
1. 根据 `.receiverQueueSize(1000)` 的配置，默认情况下 broker 会直接给客户端推送 1000 条消息。
2. 客户端将这 1000 条消息保存到内部队列中。
3. 如果使用同步消费 `receive()` 时，本质上就是去 `take` 这个内部队列。
4. 如果是使用的是 `messageListener` 异步消费并配置 `ackTimeout`，每当从队列里获得一条消息后便会把这条消息加入 `UnAckedMessageTracker` 内部的一个时间轮中，定时检测顶部是否存在消息，如果存在则会触发重新投递。
4.1 加入时间轮后，`异步`调用我们自定义的事件，这个异步操作是提交到一个无界队列中由单个线程依次排队执行（这点是这次问题的关键）
5. 业务 ACK 的时候会从时间轮中删除消息，所以如果消息 ACK 的足够快，在第四步就不会获取到消息进行重新投递。

![](https://s2.loli.net/2023/02/26/2PuOadlU6oRqHVN.png)

整体流程如上图，代码细节如下图：
![](https://s2.loli.net/2023/02/26/jMOqBUe912cdEWg.png)

所以问题的根本原因就是写入时间轮（`UnAckedMessageTracker`）开始倒计时的线程和回调业务逻辑的不是同一个线程。

如果业务执行耗时，等到消息从那个单线程的无界队列中取出来的时候很有可能已经过了 ackTimeou 的时间，从而导致了超时重发。

也就是用户所理解的 `ackTimeout` 周期（应该进入回调时候开始计时）和 SDK 实现的不一致造成的。


之后我再次确认同样的代码换为同步消费是没有问题的，不会导致重复消费：

```java
while (true) {
Message msg = consumer.receive();
            log.info(
                    "consumer Message received: " + new String(msg.getData()) + msg.getMessageId().toString());
            TimeUnit.SECONDS.sleep(2);
            consumer.acknowledge(msg);	
}
```

查看代码后发现同步代码的获取消息和加入 `UnAckedMessageTracker` 时间轮是同步的，也就不会出现超时的问题。
![](https://s2.loli.net/2023/02/26/AUiDgXYO7QvINTF.png)

# 总结

所以其实 是`messageListener` 异步消费的 ackTimeout 的语义是有问题的，需要将加入 `UnAckedMessageTracker` 处移动到回调函数中同步调用。

我查看了最新的 `2.11.x` 版本的代码依然没有修复，正准备提个 PR 切换到 master 时才发现已经有相关的 PR 了，只是还没有发版。

修复的背景和思路也是类似的，具体参考：

https://github.com/apache/pulsar/pull/18911

其实业务中并不推荐使用 ackTimeout 这个配置了，不好预估时间从而导致超时，而且我相信大部分业务配置好 `ackTImeout` 后直到后续出问题的时候才想起来要改。
所以干脆一开始就不要使用。

在 go 版本的 SDK 中直接废弃掉了这个参数，推荐使用 nack API 替换。

![](https://s2.loli.net/2023/02/26/kQaZAcJi6WjNDXq.png)



