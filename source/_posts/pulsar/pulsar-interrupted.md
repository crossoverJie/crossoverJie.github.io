---
title: 一个诡异的 Pulsar InterruptedException 异常
date: 2023/02/23 08:08:08 
categories: 
- Pulsar
tags: 
- InterruptedException
- Pulsar
---
![](https://s2.loli.net/2023/02/22/mQaCJMopS1WAjVN.png)
# 背景

![](https://s2.loli.net/2023/02/22/Lw3UbtiJ1GKyg6x.png)
今天收到业务团队反馈线上有个应用往 Pulsar 中发送消息失败了，经过日志查看得知是发送消息时候抛出了 `java.lang.InterruptedException` 异常。

和业务沟通后得知是在一个 `gRPC` 接口中触发的消息发送，大约持续了半个小时的异常后便恢复正常了，这是整个问题的背景。

<!--more-->

# 前置排查
拿到该问题后首先排查下是否是共性问题，查看了其他的应用没有发现类似的异常；同时也查看了 Pulsar broker 的监控大盘，在这个时间段依然没有波动和异常；

这样可以初步排除是 Pulsar 服务端的问题。

接着便是查看应用那段时间的负载情况，从应用 QPS 到 JVM 的各个内存情况依然没发现有什么明显的变化。


# Pulsar 源码排查

既然看起来应用本身和 Pulsar broker 都没有问题的话那就只能从异常本身来排查了。

首先第一步要得知具体使用的是 `Pulsar-client` 是版本是多少，因为业务使用的是内部基于官方 SDK 封装 `springboot starter` 所以第一步还得排查这个 `starter` 是否有影响。

通过查看源码基本排除了 `starter` 的嫌疑，里面只是简单的封装了 `SDK` 的功能而已。

```java
org.apache.pulsar.client.api.PulsarClientException: java.util.concurrent.ExecutionException: org.apache.pulsar.client.api.PulsarClientException: java.lang.InterruptedException at org.apache.pulsar.client.api.PulsarClientException.unwrap(PulsarClientException.java:1027) at org.apache.pulsar.client.impl.TypedMessageBuilderImpl.send(TypedMessageBuilderImpl.java:91) at 
java.base/java.lang.Thread.run(Thread.java:834) Caused by: java.util.concurrent.ExecutionException: org.apache.pulsar.client.api.PulsarClientException: java.lang.InterruptedException at java.base/java.util.concurrent.CompletableFuture.reportGet(CompletableFuture.java:395) 
at java.base/java.util.concurrent.CompletableFuture.get(CompletableFuture.java:1999) 
at org.apache.pulsar.client.impl.TypedMessageBuilderImpl.send(TypedMessageBuilderImpl.java:89) ... 49 common frames omitted Caused by: org.apache.pulsar.client.api.PulsarClientException: java.lang.InterruptedException 
at org.apache.pulsar.client.impl.ProducerImpl.canEnqueueRequest(ProducerImpl.java:775) 
at org.apache.pulsar.client.impl.ProducerImpl.sendAsync$original$BWm7PPlZ(ProducerImpl.java:393) 
at org.apache.pulsar.client.impl.ProducerImpl.sendAsync$original$BWm7PPlZ$accessor$i7NYMN6i(ProducerImpl.java) 
at org.apache.pulsar.client.impl.ProducerImpl$auxiliary$EfuVvJLT.call(Unknown Source) 
at org.apache.skywalking.apm.agent.core.plugin.interceptor.enhance.InstMethodsInter.intercept(InstMethodsInter.java:86) 
at org.apache.pulsar.client.impl.ProducerImpl.sendAsync(ProducerImpl.java) 
at org.apache.pulsar.client.impl.ProducerImpl.internalSendAsync(ProducerImpl.java:292) 
at org.apache.pulsar.client.impl.ProducerImpl.internalSendWithTxnAsync(ProducerImpl.java:363) 
at org.apache.pulsar.client.impl.PartitionedProducerImpl.internalSendWithTxnAsync(PartitionedProducerImpl.java:191) 
at org.apache.pulsar.client.impl.PartitionedProducerImpl.internalSendAsync(PartitionedProducerImpl.java:167) 
at org.apache.pulsar.client.impl.TypedMessageBuilderImpl.sendAsync(TypedMessageBuilderImpl.java:103) 
at org.apache.pulsar.client.impl.TypedMessageBuilderImpl.send(TypedMessageBuilderImpl.java:82) ... 49 common frames omitted Caused by: java.lang.InterruptedException: null
at java.base/java.util.concurrent.locks.AbstractQueuedSynchronizer.acquireSharedInterruptibly(AbstractQueuedSynchronizer.java:1343) 
at java.base/java.util.concurrent.Semaphore.acquire(Semaphore.java:318) 
at org.apache.pulsar.client.impl.ProducerImpl.canEnqueueRequest(ProducerImpl.java:758)
```

接下来便只能是分析堆栈了，因为 Pulsar-client 的部分实现源码是没有直接打包到依赖中的，反编译的话许多代码行数对不上，所以需要将官方的源码拉到本地，切换到对于的分支进行查看。

> 这一步稍微有点麻烦，首先是代码库还挺大的，加上之前如果没有准备好 Pulsar 的开发环境的话估计会劝退一部分人；但其实大部分问题都是网络造成的，只要配置一些 Maven 镜像多试几次总会编译成功。

我这里直接将分支切换到 `branch-2.8`。

从堆栈的顶部开始排查 `TypedMessageBuilderImpl.java:91`：
![](https://s2.loli.net/2023/02/23/Q53Vm1Fkau9Yn2c.png)
看起来是内部异步发送消息的时候抛了异常。

接着往下看到这里：

```java
java.lang.InterruptedException 
at org.apache.pulsar.client.impl.ProducerImpl.canEnqueueRequest(ProducerImpl.java:775) at
```

![](https://s2.loli.net/2023/02/23/LdJspv5CfaRm3EW.png)
看起来是这里没错，但是代码行数明显不对；因为 2.8 这个分支也是修复过几个版本，所以中间有修改导致代码行数与最新代码对不上也正常。

```java
semaphore.get().acquire();
```
不过初步来看应该是这行代码抛出的线程终端异常，这里看起来只有他最有可能了。

![](https://s2.loli.net/2023/02/23/V3mFAuRKzgWnN5T.png)
为了确认是否是真的是这行代码，这个文件再往前翻了几个版本最终确认了就是这行代码没错了。

我们点开`java.util.concurrent.Semaphore#acquire()`的源码，

```java
    /**
     * <li>has its interrupted status set on entry to this method; or
     * <li>is {@linkplain Thread#interrupt interrupted} while waiting
     * for a permit,
     * </ul>
     * then {@link InterruptedException} is thrown and the current thread's
     * interrupted status is cleared.
     *
     * @throws InterruptedException if the current thread is interrupted
     */
    public void acquire() throws InterruptedException {
        sync.acquireSharedInterruptibly(1);
    }
    
    public final void acquireSharedInterruptibly(int arg)
        throws InterruptedException {
        if (Thread.interrupted() ||
            (tryAcquireShared(arg) < 0 &&
             acquire(null, arg, true, true, false, 0L) < 0))
            throw new InterruptedException();
    }    
```
通过源码会发现 `acquire()` 函数确实会响应中断，一旦检测到当前线程被中断后便会抛出 `InterruptedException` 异常。

# 定位问题

所以问题的原因基本确定了，就是在 Pulsar 的发送消息线程被中断了导致的，但为啥会被中断还需要继续排查。


我们知道线程中断是需要调用 `Thread.currentThread().interrupt();` API的，首先猜测是否 Pulsar 客户端内部有个线程中断了这个发送线程。

于是我在 `pulsar-client` 这个模块中搜索了相关代码：
![](https://s2.loli.net/2023/02/23/w6USaRvMqAIjCfm.png)
排除掉和 producer 不相关的地方，其余所有中断线程的代码都是在有了该异常之后继续传递而已；所以初步来看 pulsar-client 内部没有主动中断的操作。

既然 Pulsar 自己没有做，那就只可能是业务做的了？

于是我在业务代码中搜索了一下：
![](https://s2.loli.net/2023/02/23/lVzJPf9ZWBGmuti.png)

果然在业务代码中搜到了唯一一处中断的地方，而且通过调用关系得知这段代码是在消息发送前执行的，并且和 Pulsar 发送函数处于同一线程。

大概的伪代码如下：
```java
        List.of(1, 2, 3).stream().map(e -> {
                    return CompletableFuture.supplyAsync(() -> {
                        try {
                            TimeUnit.MILLISECONDS.sleep(10);
                        } catch (InterruptedException ex) {
                            throw new RuntimeException(ex);
                        }
                        return e;
                    });
                }
        ).collect(Collectors.toList()).forEach(f -> {
            try {
                Integer integer = f.get();
                log.info("====" + integer);
                if (integer==3){
                    TimeUnit.SECONDS.sleep(10);
                    Thread.currentThread().interrupt();
                }
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            } catch (ExecutionException e) {
                throw new RuntimeException(e);
            }
        });
	   MessageId send = producer.newMessage().value(msg.getBytes()).send();
```

执行这段代码可以完全复现同样的堆栈。

幸好中断这里还打得有日志：

![](https://s2.loli.net/2023/02/23/nHE4WcfaKD8iqSb.png)
![](https://s2.loli.net/2023/02/23/4df5ehMBwj9DyQV.png)

通过日志搜索发现异常的时间和这个中断的日志时间点完全重合，这样也就知道根本原因了。

因为业务线程和消息发送线程是同一个，在某些情况下会执行 `Thread.currentThread().interrupt();`，其实单纯执行这行函数并不会发生什么，只要没有去响应这个中断，也就是 `Semaphore` 源码中的判断了线程中断的标记：

```java
    public final void acquireSharedInterruptibly(int arg)
        throws InterruptedException {
        if (Thread.interrupted() ||
            (tryAcquireShared(arg) < 0 &&
             acquire(null, arg, true, true, false, 0L) < 0))
            throw new InterruptedException();
    }
```

但恰好这里业务中断后自己并没有去判断这个标记，导致 Pulsar 内部去判断了，最终抛出了这个异常。


# 总结

所以归根结底还是这里的代码不合理导致的，首先是自己中断了线程但也没使用，从而导致有被其他基础库使用的可能，所以会造成了一些不可预知的后果。

再一个是不建议在业务代码中使用 `Thread.currentThread().interrupt();` 这类代码，第一眼根本不知道是要干啥，也不易维护。

其实本质上线程中断也是线程间通信的一种手段，有这类需求完全可以换为内置的 `BlockQueue` 这类函数来实现。

