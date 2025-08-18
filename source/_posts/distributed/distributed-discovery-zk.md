---
title: 分布式(一) 搞定服务注册与发现
date: 2018/08/27 00:10:36 
categories: 
- Distributed 
tags: 
- Zookeeper
- SpringBoot
---


![](https://i.loli.net/2019/05/08/5cd1d22474b79.jpg)

## 背景

最近在做分布式相关的工作，由于人手不够只能我一个人来怼；看着这段时间的加班表想想就是够惨的。

不过其中也有遇到的不少有意思的事情今后再拿来分享，今天重点来讨论服务的**注册与发现**。

## 分布式带来的问题

我的业务比较简单，只是需要知道现在有哪些服务实例可供使用就可以了（并不是做远程调用，只需要拿到信息即可）。

要实现这一功能最简单的方式可以在应用中配置所有的服务节点，这样每次在使用时只需要通过某种算法从配置列表中选择一个就可以了。

但这样会有一个非常严重的问题：

由于应用需要根据应用负载情况来灵活的调整服务节点的数量，这样我的配置就不能写死。

不然就会出现要么新增的节点没有访问或者是已经 down 掉的节点却有请求，这样肯定是不行的。

往往要解决这类分布式问题都需要一个公共的区域来保存这些信息，比如是否可以利用 Redis？

每个节点启动之后都向 Redis 注册信息，关闭时也删除数据。

其实就是存放节点的 `ip + port`，然后在需要知道服务节点信息时候只需要去 Redis 中获取即可。

<!--more-->

如下图所示：

![](https://i.loli.net/2019/05/08/5cd1d22a0ab9f.jpg)

但这样会导致每次使用时都需要频繁的去查询 Redis，为了避免这个问题我们可以在每次查询之后在本地缓存一份最新的数据。这样优先从本地获取确实可以提高效率。

但同样又会出现新的问题，如果服务提供者的节点新增或者删除消费者这边根本就不知道情况。

要解决这个问题最先想到的应该就是利用定时任务定期去更新服务列表。

以上的方案肯定不完美，并且不优雅。主要有以下几点：

- 基于定时任务会导致很多无效的更新。
- 定时任务存在周期性，没法做到实时，这样就可能存在请求异常。
- 如果服务被强行 kill，没法及时清除 Redis，这样这个看似可用的服务将永远不可用！


所以我们需要一个更加靠谱的解决方案，这样的场景其实和 Dubbo 非常类似。

用过的同学肯定对这张图不陌生。

![](https://i.loli.net/2019/05/08/5cd1d22aa8afa.jpg)

> 引用自 Dubbo [官网](https://dubbo.incubator.apache.org/en-us/)


其中有一块非常核心的内容（红框出）就是服务的注册与发现。

通常来说消费者是需要知道服务提供者的网络地址(ip + port)才能发起远程调用，这块内容和我上面的需求其实非常类似。

而 Dubbo 则是利用 Zookeeper 来解决问题。

## Zookeeper 能做什么

在具体讨论怎么实现之前先看看 Zookeeper 的几个重要特性。

Zookeeper 实现了一个类似于文件系统的树状结构：

![](https://i.loli.net/2019/05/08/5cd1d22b37597.jpg)

这些节点被称为 znode(名字叫什么不重要)，其中每个节点都可以存放一定的数据。

最主要的是 znode 有四种类型：

- 永久节点（除非手动删除，节点永远存在）
- 永久有序节点（按照创建顺序会为每个节点末尾带上一个序号如：`root-1`）
- 瞬时节点（创建客户端与 Zookeeper 保持连接时节点存在，断开时则删除并会有相应的通知）
- 瞬时有序节点（在瞬时节点的基础上加上了顺序）

考虑下上文使用 Redis 最大的一个问题是什么？

其实就是不能实时的更新服务提供者的信息。

那利用 Zookeeper 是怎么实现的？

主要看第三个特性：**瞬时节点**

Zookeeper 是一个典型的观察者模式。

- 由于瞬时节点的特点，我们的消费者可以订阅瞬时节点的父节点。
- 当新增、删除节点时所有的瞬时节点也会自动更新。
- 更新时会给订阅者发起通知告诉最新的节点信息。

这样我们就可以实时获取服务节点的信息，同时也只需要在第一次获取列表时缓存到本地；也不需要频繁和 Zookeeper 产生交互，只用等待通知更新即可。

并且不管应用什么原因节点 down 掉后也会在 Zookeeper 中删除该信息。

## 效果演示

这样实现方式就变为这样。

![](https://i.loli.net/2019/05/08/5cd1d22ba62d5.jpg)

为此我新建了一个应用来进行演示：

[https://github.com/crossoverJie/netty-action/tree/master/netty-action-zk](https://github.com/crossoverJie/netty-action/tree/master/netty-action-zk)


就是一个简单的 SpringBoot 应用，只是做了几件事情。

- 应用启动时新开一个线程用于向 Zookeeper 注册服务。
- 同时监听一个节点用于更新本地服务列表。
- 提供一个接口用于返回一个可有的服务节点。

我在本地启动了两个应用分别是：`127.0.0.1:8083,127.0.0.1:8084`。来看看效果图。

两个应用启动完成：

![](https://i.loli.net/2019/05/08/5cd1d22d1fd47.jpg)

![](https://i.loli.net/2019/05/08/5cd1d22ed3d2f.jpg)

---

当前 Zookeeper 的可视化树状结构：

![](https://i.loli.net/2019/05/08/5cd1d2353b899.jpg)

---

当想知道所有的服务节点信息时：

![](https://i.loli.net/2019/05/08/5cd1d235d30ea.jpg)

---

想要获取一个可用的服务节点时：

![](https://i.loli.net//2019//05//08//5cd1dc84306df.jpg)

这里只是采取了简单的轮询。


---

当 down 掉一个节点时：应用会收到通知更新本地缓存。同时 Zookeeper 中的节点会自动删除。

![](https://i.loli.net/2019/05/08/5cd1d2b5b15fd.jpg)

![](https://i.loli.net/2019/05/08/5cd1d2b66b2b2.jpg)

---

再次获取最新节点时：

![](https://i.loli.net//2019//05//08//5cd1dd090d37e.jpg)

---
当节点恢复时自然也能获取到最新信息。本地缓存也会及时更新。

![](https://i.loli.net/2019/05/08/5cd1d4faa9cfc.jpg)

![](https://i.loli.net//2019//05//08//5cd1dd8cc097a.jpg)

## 编码实现

实现起来倒也比较简单，主要就是 ZKClient 的 api 使用。

贴几段比较核心的吧。


### 注册

> 启动注册 Zookeeper。

![](https://i.loli.net/2019/05/08/5cd1d52ed5080.jpg)

主要逻辑都在这个线程中。

- 首先创建父节点。如上图的 Zookeeper 节点所示；需要先创建 `/route` 根节点，创建的时候会判断是否已经存在。
- 接着需要判断是否需要将自己注册到 Zookeeper 中，因为有些节点只是用于服务发现，他自身是不需要承担业务功能（是我自己项目的需求）。
- 将当前应用的所在 ip 以及端口注册上去，同时需要监听根节点 `/route` ，这样才能在其他服务上下线时候获得通知。

### 根据本地缓存

> 监听到服务变化

```java
    public void subscribeEvent(String path) {
        zkClient.subscribeChildChanges(path, new IZkChildListener() {
            @Override
            public void handleChildChange(String parentPath, List<String> currentChilds) throws Exception {
                logger.info("清除/更新本地缓存 parentPath=【{}】,currentChilds=【{}】", parentPath,currentChilds.toString());

                //更新所有缓存/先删除 再新增
                serverCache.updateCache(currentChilds) ;
            }
        });


    }
```

可以看到这里是更新了本地缓存，该缓存采用了 Guava 提供的 Cache，感兴趣的可以查看之前的[源码分析](https://crossoverjie.top/categories/Guava/)。

```java
    /**
     * 更新所有缓存/先删除 再新增
     *
     * @param currentChilds
     */
    public void updateCache(List<String> currentChilds) {
        cache.invalidateAll();
        for (String currentChild : currentChilds) {
            String key = currentChild.split("-")[1];
            addCache(key);
        }
    }
```

### 客户端负载

> 同时在客户端提供了一个负载算法。


其实就是一个轮询的实现：

```java
    /**
     * 选取服务器
     *
     * @return
     */
    public String selectServer() {
        List<String> all = getAll();
        if (all.size() == 0) {
            throw new RuntimeException("路由列表为空");
        }
        Long position = index.incrementAndGet() % all.size();
        if (position < 0) {
            position = 0L;
        }

        return all.get(position.intValue());
    }
```

当然这里可以扩展出更多的如权重、随机、[LRU](https://crossoverjie.top/%2F2018%2F04%2F07%2Falgorithm%2FLRU-cache%2F) 等算法。


## Zookeeper 其他优势及问题

Zookeeper 自然是一个很棒的分布式协调工具，利用它的特性还可以有其他作用。

- 数据变更发送通知这一特性可以实现统一配置中心，再也不需要在每个服务中单独维护配置。
- 利用瞬时有序节点还可以实现分布式锁。

在实现注册、发现这一需求时，Zookeeper 其实并不是最优选。

由于 Zookeeper 在 CAP 理论中选择了 CP（一致性、分区容错性），当 Zookeeper 集群有半数节点不可用时是不能获取到任何数据的。

对于一致性来说自然没啥问题，但在注册、发现的场景下更加推荐 `Eureka`，已经在 SpringCloud 中得到验证。具体就不在本文讨论了。

但鉴于我的使用场景来说 Zookeeper 已经能够胜任。


## 总结

本文所有完整代码都托管在 GitHub。

[https://github.com/crossoverJie/netty-action](https://github.com/crossoverJie/netty-action)。


一个看似简单的注册、发现功能实现了，但分布式应用远远不止这些。

由于网络隔离之后带来的一系列问题还需要我们用其他方式一一完善；后续会继续更新分布式相关内容，感兴趣的朋友不妨持续关注。

**你的点赞与转发是最大的支持。**
