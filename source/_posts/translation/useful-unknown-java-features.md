---
title: 【译】你可能不知道但却很有用的 Java 特性
date: 2022/01/18 08:02:13       
categories: 
- 翻译
tags: 
- Java
---


**[原文链接](https://piotrminkowski.com/2022/01/05/useful-unknown-java-features/#2-period-of-days-in-time-format-7b240340-e2be-42dd-ae04-607d3a539d1b)**

![](https://tva1.sinaimg.cn/large/008i3skNly1gycijo0cdzj31hf0u0jy1.jpg)

在这篇文章中你将会学习到一些你可能没听过但有用的 Java 特性，这些是我个人常用的一些特性或者是从其他文章中学习到的，重点是关注 API 而不是语言本身。


<!--more-->

# 延迟队列

众所周知，在 Java 中有许多类型的集合可以使用，但你听说过 `DelayQueue` 吗？它是一个特定类型的集合，允许我们基于延时时间对数据排序，这是一个非常有意思的类，它实现了 `BlockingQueue` 接口，只有当数据过期后才能从队列里取出。

使用它的第一步，你的 class 需要实现 `Delayed` 接口中的 `getDelay` 方法，当然也可以不用声明一个 class，使用 Record 也是可以的。

> 这是 Java14 的新特性

```java
public record DelayedEvent(long startTime, String msg) implements Delayed {

    public long getDelay(TimeUnit unit) {
        long diff = startTime - System.currentTimeMillis();
        return unit.convert(diff, TimeUnit.MILLISECONDS);
    }

    public int compareTo(Delayed o) {
        return (int) (this.startTime - ((DelayedEvent) o).startTime);
    }

}
```

假设我们需要一个延时 10s 取出的数据，我们只需要放入一个比当前时间多 10s 的任务即可。

```java
final DelayQueue<DelayedEvent> delayQueue = new DelayQueue<>();
final long timeFirst = System.currentTimeMillis() + 10000;
delayQueue.offer(new DelayedEvent(timeFirst, "1"));
log.info("Done");
log.info(delayQueue.take().msg());
```

最终输出如下：
![](https://tva1.sinaimg.cn/large/008i3skNly1gyd5q8ndpuj30sg04s0t3.jpg)

# 时间格式的日期

这个特性可能对大部分人来说没什么用，但老实说我个人非常喜欢；不管怎么说 Java 8 在时间 API 上改进了许多。从这个版本开始或许你不再需要其他任何扩展库了。

你能想到嘛，从 Java 16 中你甚至可以用标准库表示一天内的日期了，比如 “in the morning” “in the afternoon” ，这是一个新的格式语句 **B**。

```java
String s = DateTimeFormatter
  .ofPattern("B")
  .format(LocalDateTime.now());
System.out.println(s);
```

以下是我的输出，具体和你当前时间有关。
![](https://tva1.sinaimg.cn/large/008i3skNly1gyd5yop8a2j30gq02uaa0.jpg)

你可能会想为什么会是调用 “B” 呢，这确实看起来不太直观，通过下表也许能解答疑惑：
![](https://tva1.sinaimg.cn/large/008i3skNly1gyflhuzlugj30va0q20vw.jpg)


# Stamped Lock

在我看来，并发包是 Java 中最有意思的包之一，同时又很少被开发者熟练掌握，特别是长期使用 web 开发框架的开发者。

有多少人曾经使用过 Lock 呢？相对于 `synchronized` 来说这是一种更灵活的线程同步机制。

从 Java8 开始你可以使用一种新的锁：`StampedLock.StampedLock`，能够替代 `ReadWriteLock`。


假设现在有两个线程，一个线程更新金额、一个线程读取余额；更新余额的线程首先需要读取金额，再多线程的情况下需要某种同步机制（不然更新数据会发生错误），第二个线程用乐观锁的方式读取余额。


```java
StampedLock lock = new StampedLock();
Balance b = new Balance(10000);
Runnable w = () -> {
   long stamp = lock.writeLock();
   b.setAmount(b.getAmount() + 1000);
   System.out.println("Write: " + b.getAmount());
   lock.unlockWrite(stamp);
};
Runnable r = () -> {
   long stamp = lock.tryOptimisticRead();
   if (!lock.validate(stamp)) {
      stamp = lock.readLock();
      try {
         System.out.println("Read: " + b.getAmount());
      } finally {
         lock.unlockRead(stamp);
      }
   } else {
      System.out.println("Optimistic read fails");
   }
};
```

现在更新和读取的都用 50 个线程来进行测试，最终的余额将会等于 60000.

```java
ExecutorService executor = Executors.newFixedThreadPool(10);
for (int i = 0; i < 50; i++) {
   executor.submit(w);
   executor.submit(r);
}
```

# 并发累加器

锁并并不是并发包中唯一有意思的特性，并发累加器也同样有趣；它可以根据我们提供的函数更新数据；再多线程更新数据的场景下，`LongAccumulator` 是比 `AtomicLong` 更优的选择。

现在让我们来看看具体如何使用，我们需要两个参数进行初始化；第一个是用于累加计算的函数，通常是一个 sum 函数，第二个参数则是累加计算的初始化值。

接下来我们用 10000 作为初始值来创建一个 `LongAccumulator`，最终结果是多少？其实结果与上文相同，都是 60000，但这次我们并没有使用锁。

```java
LongAccumulator balance = new LongAccumulator(Long::sum, 10000L);
Runnable w = () -> balance.accumulate(1000L);

ExecutorService executor = Executors.newFixedThreadPool(50);
for (int i = 0; i < 50; i++) {
   executor.submit(w);
}

executor.shutdown();
if (executor.awaitTermination(1000L, TimeUnit.MILLISECONDS))
   System.out.println("Balance: " + balance.get());
assert balance.get() == 60000L;
```


# 数组的二分查找

假设我们想在一个排序列表中插入一个新元素，可以使用 `Arrays.binarySearch()` 函数，当这个 key 存在时将会返回 key 所在的索引，如果不存在时将会返回插入的位置`-(insertion point)-1`。

binarySearch 是 Java 中非常简单且有效的查询方法。

下面的这个例子中，对返回结果取反便能的到索引位置。

```java
int[] t = new int[] {1, 2, 4, 5};
int x = Arrays.binarySearch(t, 3);

assert ~x == 2;
```

> 负数的二进制是以正数的补码表示，对一个数取反+1 就等于补码，所以这里直接取反就等于 Arrays.binarySearch() 不存在时的返回值了。


# Bit Set 

如果你需要对二进制数组进行操作你会怎么做？用 `boolean[]`  布尔数组?

有一种更高效又更省内存的方式，那就是 `BitSet`。它允许我们存储和操作 bit 数组，与 `boolean[]` 相比可省 8 倍的内存；也可以使用 `and/or/xor` 等逻辑操作。

假设我们现在有两个 bit 数组，我们需要对他们进行 `xor` 运算；我们需要创建两个 BitSet 实例，然后调用 xor 函数。

```java
BitSet bs1 = new BitSet();
bs1.set(0);
bs1.set(2);
bs1.set(4);
System.out.println("bs1 : " + bs1);

BitSet bs2 = new BitSet();
bs2.set(1);
bs2.set(2);
bs2.set(3);
System.out.println("bs2 : " + bs2);

bs2.xor(bs1);
System.out.println("xor: " + bs2);
```

最终的输出结果如下：

![](https://tva1.sinaimg.cn/large/008i3skNly1gyfqb8umowj30iy05qdfx.jpg)