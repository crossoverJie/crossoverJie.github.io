---
title: Pulsar客户端消费模式揭秘：Go 语言实现 ZeroQueueConsumer
date: 2024/07/29 22:31:57
categories:
  - OB
  - Pulsar
tags:
 - Pulsar
---



前段时间在 [pulsar-client-go](https://github.com/apache/pulsar-client-go) 社区里看到这么一个 [issue](https://github.com/apache/pulsar-client-go/issues/1223)：
![](https://s2.loli.net/2024/06/24/KNsvV7jeZYSaiPq.png)

<!--more-->
```go
import "github.com/apache/pulsar-client-go/pulsar"

client, err := pulsar.NewClient(pulsar.ClientOptions{
    URL: "pulsar://localhost:6650",
})
if err != nil {
    log.Fatal(err)
}
consumer, err := client.Subscribe(pulsar.ConsumerOptions{
    Topic:             "persistent://public/default/mq-topic-1",
    SubscriptionName:  "sub-1",
    Type:              pulsar.Shared,
    ReceiverQueueSize: 0,
})
if err != nil {
    log.Fatal(err)
}


// 小于等于 0 时会设置为 1000
const (  
    defaultReceiverQueueSize = 1000  
)
if options.ReceiverQueueSize <= 0 {  
    options.ReceiverQueueSize = defaultReceiverQueueSize  
}
```

他发现手动将 pulsar-client-go 客户端的 `ReceiverQueueSize` 设置为 0 的时候，客户端在初始化时会再将其调整为 1000.

```go
if options.ReceiverQueueSize < 0 {  
    options.ReceiverQueueSize = defaultReceiverQueueSize  
}
```

而如果手动将源码修改为可以设置为 0 时，却不能正常消费，消费者会一直处于 waiting 状态，获取不到任何数据。

经过我的排查发现是 Pulsar 的  Go  客户端缺少了一个 [ZeroQueueConsumerImpl](https://github.com/apache/pulsar/blob/83b86abcb74595d7e8aa31b238a7dbb19a04dde2/pulsar-client/src/main/java/org/apache/pulsar/client/impl/ConsumerImpl.java#L268-L272)的实现类，这个类主要用于可以精细控制消费逻辑。


> If you'd like to have tight control over message dispatching across consumers, set the **consumers' receiver queue size very low (potentially even to 0 if necessary)**. Each consumer has a receiver queue that determines how many messages the consumer attempts to fetch at a time. For example, a receiver queue of 1000 (the default) means that the consumer attempts to process 1000 messages from the topic's backlog upon connection. Setting the receiver queue to 0 essentially means ensuring that each consumer is only doing one thing at a time.

[https://pulsar.apache.org/docs/next/cookbooks-message-queue/#client-configuration-changes](https://pulsar.apache.org/docs/next/cookbooks-message-queue/#client-configuration-changes)

正如官方文档里提到的那样，可以将 ReceiverQueueSize 设置为 0；这样消费者就可以一条条的消费数据，而不会将消息堆积在客户端队列里。

# 客户端消费逻辑

借此机会需要再回顾下 pulsar 客户端的消费逻辑，这样才能理解 `ReceiverQueueSize` 的作用以及如何在 pulsar-client-go 如何实现这个 `ZeroQueueConsumerImpl`。

Pulsar 客户端的消费模式是基于推拉结合的：

![](https://s2.loli.net/2024/06/24/bTP1WGVJUR9wzYe.png)
如这张图所描述的流程，消费者在启动的时候会主动向服务端发送一个 Flow 的命令，告诉服务端需要下发多少条消息给客户端。

同时会使用刚才的那个 `ReceiverQueueSize`参数作为内部队列的大小，将客户端下发的消息存储在内部队列里。

然后在调用 `receive` 函数的时候会直接从这个队列里获取数据。

![](https://s2.loli.net/2024/06/24/e3AabLk4FqB8VTo.png)
![](https://s2.loli.net/2024/06/24/ZGHiaXBJfEyxh5d.png)

每次消费成功后都会将内部的一个 `AvailablePermit+1`，直到大于 `MaxReceiveQueueSize / 2` 就会再次向 broker 发送 flow 命令，告诉 broker 再次下发消息。


所以这里有一个很关键的事件：就是向 broker 发送 `flow` 命令，这样才会有新的消息下发给客户端。

之前经常都会有研发同学让我排查无法消费的问题，最终定位到的原因几乎都是消费缓慢，导致这里的 `AvailablePermit` 没有增长，从而也就不会触发 broker 给客户端推送新的消息。

看到的现象就是消费非常缓慢。


# ZeroQueueConsumerImpl 原理

下面来看看 `ZeroQueueConsumerImpl` 是如何实现队列大小为 0 依然是可以消费的。

![](https://s2.loli.net/2024/06/24/Vmk9l2nucP31bNX.png)
在构建 consumer 的时候，就会根据队列大小从而来创建普通消费者还是 `ZeroQueueConsumerImpl` 消费者。


```java
@Override  
protected CompletableFuture<Message<T>> internalReceiveAsync() {  
    CompletableFuture<Message<T>> future = super.internalReceiveAsync();  
    if (!future.isDone()) {  
        // We expect the message to be not in the queue yet  
        increaseAvailablePermits(cnx());  
    }  
    return future;  
}
```

这是 `ZeroQueueConsumerImpl` 重写的一个消费函数，其中关键的就是 `increaseAvailablePermits(cnx());`.

```java
    void increaseAvailablePermits(ClientCnx currentCnx) {
        increaseAvailablePermits(currentCnx, 1);
    }

    protected void increaseAvailablePermits(ClientCnx currentCnx, int delta) {
        int available = AVAILABLE_PERMITS_UPDATER.addAndGet(this, delta);
        while (available >= getCurrentReceiverQueueSize() / 2 && !paused) {
            if (AVAILABLE_PERMITS_UPDATER.compareAndSet(this, available, 0)) {
                sendFlowPermitsToBroker(currentCnx, available);
                break;
            } else {
                available = AVAILABLE_PERMITS_UPDATER.get(this);
            }
        }
    }
```

从源码里可以得知这里的逻辑就是将 AvailablePermit 自增，达到阈值后请求 broker 下发消息。

因为在 `ZeroQueueConsumerImpl` 中队列大小为 0，所以 `available >= getCurrentReceiverQueueSize() / 2`永远都会为 true。

也就是说每消费一条消息都会请求 broker 让它再下发一条消息，这样就达到了每一条消息都精确控制的效果。

# pulsar-client-go 中的实现

为了在 pulsar-client-go 实现这个需求，我提交了一个 [PR](https://github.com/apache/pulsar-client-go/pull/1225) 来解决这个问题。

其实从上面的分析已经得知为啥手动将 `ReceiverQueueSize` 设置为 0 无法消费消息了。

根本原因还是在初始化的时候优于队列为 0，导致不会给 broker 发送 flow 命令，这样就不会有消息推送到客户端，也就无法消费到数据了。

所以我们依然得参考 Java 的 `ZeroQueueConsumerImpl` 在每次消费的时候都手动增加  `availablePermits`。

为此我也新增了一个消费者 `zeroQueueConsumer`。

```go
// EnableZeroQueueConsumer, if enabled, the ReceiverQueueSize will be 0.  
// Notice: only non-partitioned topic is supported.  
// Default is false.  
EnableZeroQueueConsumer bool

consumer, err := client.Subscribe(ConsumerOptions{  
    Topic:                   topicName,  
    SubscriptionName:        "sub-1",  
    Type:                    Shared,  
    NackRedeliveryDelay:     1 * time.Second,  
    EnableZeroQueueConsumer: true,  
})

if options.EnableZeroQueueConsumer {  
    options.ReceiverQueueSize = 0  
}
```

在创建消费者的时候需要指定是否开启 `ZeroQueueConsumer`，当开启后会手动将 ReceiverQueueSize 设置为 0.

```java
// 可以设置默认值。
private int receiverQueueSize = 1000;
```

> 在 Go 中无法像 Java 那样在结构体初始化化的时候就指定默认值，再加上 Go 的 int 类型具备零值（也就是0），所以无法区分出 ReceiverQueueSize=0 是用户主动设置的，还是没有传入这个参数使用的零值。

所以才需要新增一个参数来手动区分是否使用 `ZeroQueueConsumer`。


![](https://s2.loli.net/2024/06/24/TK2fJVEFlnL4dIy.png)
之后在创建 `consumer` 的时候进行判断，只有使用的是单分区的 `topic` 并且开启了 `EnableZeroQueueConsumer` 才能创建  `zeroQueueConsumer`。

---
![](https://s2.loli.net/2024/06/24/Aq5onPKOjIgserx.png)


> 使用 PARTITIONED_METADATA 命令可以让 broker 返回分区数量。

---

```go
func (z *zeroQueueConsumer) Receive(ctx context.Context) (Message, error) {
	if state := z.pc.getConsumerState(); state == consumerClosed || state == consumerClosing {
		z.log.WithField("state", state).Error("Failed to ack by closing or closed consumer")
		return nil, errors.New("consumer state is closed")
	}
	z.Lock()
	defer z.Unlock()
	z.pc.availablePermits.inc()
	for {
		select {
		case <-z.closeCh:
			return nil, newError(ConsumerClosed, "consumer closed")
		case cm, ok := <-z.messageCh:
			if !ok {
				return nil, newError(ConsumerClosed, "consumer closed")
			}
			return cm.Message, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

}
```

其中的关键代码：`z.pc.availablePermits.inc()`

消费时的逻辑其实和 Java 的 `ZeroQueueConsumerImpl` 逻辑保持了一致，也是每消费一条数据之前就增加一次 `availablePermits`。

pulsar-client-go 的运行原理与 Java 客户端的类似，也是将消息存放在了一个内部队列里，所以每次消费消息只需要从这个队列 `messageCh` 里获取即可。

值得注意的是， pulsar-client-go 版本的 `zeroQueueConsumer` 就不支持直接读取内部的队列了。

```go
func (z *zeroQueueConsumer) Chan() <-chan ConsumerMessage {  
    panic("zeroQueueConsumer cannot support Chan method")  
}
```

会直接 panic，因为直接消费 channel 在客户端层面就没法帮用户主动发送 flow 命令了，所以这个功能就只能屏蔽掉了，只可以主动的 `receive` 消息。

![](https://s2.loli.net/2024/06/24/dDlr3RWM6iYHFbc.png)

许久之前我也画过一个关于 pulsar client 的消费流程图，后续考虑会再写一篇关于 pulsar client 的原理分析文章。


参考链接：
- https://github.com/apache/pulsar-client-go/issues/1223
- https://cloud.tencent.com/developer/article/2307608
- https://pulsar.apache.org/docs/next/cookbooks-message-queue/#client-configuration-changes
- https://github.com/apache/pulsar-client-go/pull/1225