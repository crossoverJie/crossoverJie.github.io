---
title: 分布式系统如何做负载均衡
date: 2024/07/15 10:22:14
categories:
  - OB
  - Pulsar
tags:
 - Pulsar
---


# 背景
Pulsar 有提供一个查询 Broker 负载的接口：

```java
    /**
     * Get load for this broker.
     *
     * @return
     * @throws PulsarAdminException
     */
LoadManagerReport getLoadReport() throws PulsarAdminException;

public interface LoadManagerReport extends ServiceLookupData {  
  
    ResourceUsage getCpu();  
  
    ResourceUsage getMemory();  
  
    ResourceUsage getDirectMemory();  
  
    ResourceUsage getBandwidthIn();  
  
    ResourceUsage getBandwidthOut();
}
```

可以返回一些 broker 的负载数据，比如 CPU、内存、流量之类的数据。
<!--more-->

> 我目前碰到的问题是目前会遇到部分节点的负债不平衡，导致资源占用不均衡，所以想要手动查询所有节点的负载数据，然后人工进行负载。

理论上这些数据是在运行时实时计算的数据，如果对于单机的倒还好说，每次请求这个接口直接实时计算一次就可以了。


但对于集群的服务来说会有多个节点，目前 Pulsar 提供的这个接口只能查询指定节点的负载数据，也就是说每次得传入目标节点的 IP 和端口。

![](https://s2.loli.net/2024/06/07/ephIgndx54sFlLa.png)

所以我的预期是可以提供一个查询所有节点负载的接口，已经提了 `issue`，最近准备写 Purpose 把这个需求解决了。

实现这个需求的方案有两种：
1. 拿到所有 broker 也就是服务节点信息，依次遍历调用接口，然后自己组装信息。
2. 从 zookeeper 中获取负载信息。

理论上第二种更好，第一种实现虽然更简单，但每次都发起一次 http 请求，多少有些浪费。

第二种方案直接从源头获取负载信息，只需要请求一次就可以了。

而正好社区提供了一个命令行工具可以直接打印所有的 `broker` 负载数据：

```bash
pulsar-perf monitor-brokers --connect-string <zookeeper host:port>
```

![](https://s2.loli.net/2024/06/07/UN8gpW915RfcODb.png)


# 分布式系统常用组件

提供的命令行工具其实就是直接从 zookeeper 中查询的数据。

在分布式系统中需要一个集中的组件来管理各种数据，比如：
1. 可以利用该组件来选举 leader 节点
2. 使用该组件来做分布式锁
3. 为分布式系统同步数据
4. 统一的存放和读取某些数据

可以提供该功能的组件其实也不少：
- [zookeeper](https://zookeeper.apache.org/)
- [etcd](https://etcd.io/)
- [oxia](https://github.com/streamnative/oxia)


Zookeeper 是老牌的分布式协调组件，可以做 leader 选举、配置中心、分布式锁、服务注册与发现等功能。

在许多中间件和系统中都有应用，比如：

- [Apache Pulsar](https://github.com/apache/pulsar) 中作为协调中心
- [Kafka](https://github.com/apache/kafka) 中也有类似的作用。
- 在 [Dubbo](https://github.com/apache/dubbo) 中作为服务注册发现组件。

---

etcd 的功能与 zookeeper 类似，可以用作服务注册发现，也可以作为 Key Value 键值对存储系统；在 kubernetes 中扮演了巨大作用，经历了各种考验，稳定性已经非常可靠了。

---

[Oxia](https://github.com/streamnative/oxia) 则是 StreamNative 开发的一个用于替换 Zookeeper 的中间件，功能也与 Zookeeper 类似；目前已经可以在 Pulsar 中替换 Zookeeper，只是还没有大规模的使用。


# Pulsar 中的应用
下面以 Pulsar 为例（使用 zookeeper），看看在这类大型分布式系统中是如何处理负载均衡的。

再开始之前先明确下负载均衡大体上会做哪些事情。

1. 首先上报自己节点的负载数据
2. Leader 节点需要定时收集所有节点的负载数据。
	1. 这些负载数据中包括：
		1. `CPU`、堆内存、堆外内存等通用数据的使用量
		2. 流出、流入流量
		3. 一些系统特有的数据，比如在 `Pulsar` 中就是：
			1. 每个 `broker` 中的 `topic`、`consumer`、`producer`、`bundle` 等数据。
3. 再由 leader 节点读取到这些数据后选择负载较高的节点，将数据迁移到负载较低的节点。

以上就是一个完整的负载均衡的流程，下面我们依次看看在 `Pulsar` 中是如何实现这些逻辑的。

在 Pulsar 中提供了多种负载均衡策略，以下是加载负载均衡器的逻辑：

```java
static LoadManager create(final PulsarService pulsar) {  
    try {  
        final ServiceConfiguration conf = pulsar.getConfiguration();  
        // Assume there is a constructor with one argument of PulsarService.  
        final Object loadManagerInstance = Reflections.createInstance(conf.getLoadManagerClassName(),  
                Thread.currentThread().getContextClassLoader());  
        if (loadManagerInstance instanceof LoadManager) {  
            final LoadManager casted = (LoadManager) loadManagerInstance;  
            casted.initialize(pulsar);  
            return casted;  
        } else if (loadManagerInstance instanceof ModularLoadManager) {  
            final LoadManager casted = new ModularLoadManagerWrapper((ModularLoadManager) loadManagerInstance);  
            casted.initialize(pulsar);  
            return casted;  
        }  
    } catch (Exception e) {  
        LOG.warn("Error when trying to create load manager: ", e);  
    }  
    // If we failed to create a load manager, default to SimpleLoadManagerImpl.  
    return new SimpleLoadManagerImpl(pulsar);  
}
```

默认使用的是 `ModularLoadManagerImpl`， 如果出现异常那就会使用 `SimpleLoadManagerImpl` 作为兜底。

他们两个的区别是 `ModularLoadManagerImpl` 的功能更全，可以做更为细致的负载策略。

接下来以默认的 `ModularLoadManagerImpl` 为例讲解上述的流程。

## 上报负载数据
在负载均衡器启动的时候就会收集节点数据然后进行上报：

```java
      public void start() throws PulsarServerException {
        try {

            String brokerId = pulsar.getBrokerId();
            brokerZnodePath = LoadManager.LOADBALANCE_BROKERS_ROOT + "/" + brokerId;
            // 收集本地负载数据
            updateLocalBrokerData();

			// 上报 zookeeper
            brokerDataLock = brokersData.acquireLock(brokerZnodePath, localData).join();
        } catch (Exception e) {
            log.error("Unable to acquire lock for broker: [{}]", brokerZnodePath, e);
            throw new PulsarServerException(e);
        }
    }
```



首先获取到当前 broker 的 Id 然后拼接一个 zookeeper 节点的路径，将生成的 localData 上传到 zookeeper 中。

```shell
// 存放 broker 的节点信息
ls /loadbalance/brokers

[broker-1:8080, broker-2:8080]

// 根据节点信息查询负载数据
get /loadbalance/brokers/broker-1:8080
```
上报的数据：

```json
{"webServiceUrl":"http://broker-1:8080","pulsarServiceUrl":"pulsar://broker-1:6650","persistentTopicsEnabled":true,"nonPersistentTopicsEnabled":true,"cpu":{"usage":7.311714728372232,"limit":800.0},"memory":{"usage":124.0,"limit":2096.0},"directMemory":{"usage":36.0,"limit":256.0},"bandwidthIn":{"usage":0.8324254085661579,"limit":1.0E7},"bandwidthOut":{"usage":0.7155446715644209,"limit":1.0E7},"msgThroughputIn":0.0,"msgThroughputOut":0.0,"msgRateIn":0.0,"msgRateOut":0.0,"lastUpdate":1690979816792,"lastStats":{"my-tenant/my-namespace/0x4ccccccb_0x66666664":{"msgRateIn":0.0,"msgThroughputIn":0.0,"msgRateOut":0.0,"msgThroughputOut":0.0,"consumerCount":2,"producerCount":0,"topics":1,"cacheSize":0}},"numTopics":1,"numBundles":1,"numConsumers":2,"numProducers":0,"bundles":["my-tenant/my-namespace/0x4ccccccb_0x66666664"],"lastBundleGains":[],"lastBundleLosses":[],"brokerVersionString":"3.1.0-SNAPSHOT","protocols":{},"advertisedListeners":{"internal":{"brokerServiceUrl":"pulsar://broker-1:6650"}},"loadManagerClassName":"org.apache.pulsar.broker.loadbalance.impl.ModularLoadManagerImpl","startTimestamp":1690940955211,"maxResourceUsage":0.140625,"loadReportType":"LocalBrokerData"}
```


### 采集数据

```java
public static SystemResourceUsage getSystemResourceUsage(final BrokerHostUsage brokerHostUsage) {  
    SystemResourceUsage systemResourceUsage = brokerHostUsage.getBrokerHostUsage();  
  
    // Override System memory usage and limit with JVM heap usage and limit  
    double maxHeapMemoryInBytes = Runtime.getRuntime().maxMemory();  
    double memoryUsageInBytes = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();  
    double memoryUsage = memoryUsageInBytes / MIBI;  
    double memoryLimit = maxHeapMemoryInBytes / MIBI;  
    systemResourceUsage.setMemory(new ResourceUsage(memoryUsage, memoryLimit));  
  
    // Collect JVM direct memory  
    systemResourceUsage.setDirectMemory(new ResourceUsage((double) (getJvmDirectMemoryUsed() / MIBI),  
            (double) (DirectMemoryUtils.jvmMaxDirectMemory() / MIBI)));  
  
    return systemResourceUsage;  
}
```

会在运行时获取一些 JVM 和 堆外内存的数据。

## 收集所有节点数据
作为 `leader` 节点还需要收集所有节点的负载数据，然后根据一些规则选择将负载较高的节点移动到负债较低的节点中。

```java
    private void updateAllBrokerData() {
	    // 从 zookeeper 中获取所有节点
        final Set<String> activeBrokers = getAvailableBrokers();
        final Map<String, BrokerData> brokerDataMap = loadData.getBrokerData();
        for (String broker : activeBrokers) {
            try {
                String key = String.format("%s/%s", LoadManager.LOADBALANCE_BROKERS_ROOT, broker);
                // 依次读取各个节点的负载数据
                Optional<LocalBrokerData> localData = brokersData.readLock(key).get();
                if (!localData.isPresent()) {
                    brokerDataMap.remove(broker);
                    log.info("[{}] Broker load report is not present", broker);
                    continue;
                }

                if (brokerDataMap.containsKey(broker)) {
                    // Replace previous local broker data.
                    brokerDataMap.get(broker).setLocalData(localData.get());
                } else {
                    // Initialize BrokerData object for previously unseen
                    // brokers.
                    // 将数据写入到本地缓存
                    brokerDataMap.put(broker, new BrokerData(localData.get()));
                }
            } catch (Exception e) {
                log.warn("Error reading broker data from cache for broker - [{}], [{}]", broker, e.getMessage());
            }
        }
        // Remove obsolete brokers.
        for (final String broker : brokerDataMap.keySet()) {
            if (!activeBrokers.contains(broker)) {
                brokerDataMap.remove(broker);
            }
        }
    }
```

会从 zookeeper 的节点中获取到所有的 broker 列表（broker 会在启动时将自身的信息注册到 zookeeper 中。）

然后依次读取各自节点的负载数据，也就是在负载均衡器启动的时候上报的数据。

## 筛选出所有 broker 中需要 unload 的 bundle

在 Pulsar 中 topic 是最核心的概念，而为了方便管理大量 topic，提出了一个 Bundle 的概念； Bundle 是一批 topic 的集合，管理 Bundle 自然会比 topic 更佳容易。

所以在 Pulsar 中做负载均衡最主要的就是将负载较高节点中的 bundle 转移到低负载的 broker 中。

```java
    private void updateAllBrokerData() {
        final Set<String> activeBrokers = getAvailableBrokers();
        final Map<String, BrokerData> brokerDataMap = loadData.getBrokerData();
        for (String broker : activeBrokers) {
            try {
                String key = String.format("%s/%s", LoadManager.LOADBALANCE_BROKERS_ROOT, broker);
                Optional<LocalBrokerData> localData = brokersData.readLock(key).get();
                if (!localData.isPresent()) {
                    brokerDataMap.remove(broker);
                    log.info("[{}] Broker load report is not present", broker);
                    continue;
                }

                if (brokerDataMap.containsKey(broker)) {
                    // Replace previous local broker data.
                    brokerDataMap.get(broker).setLocalData(localData.get());
                } else {
                    // Initialize BrokerData object for previously unseen
                    // brokers.
                    brokerDataMap.put(broker, new BrokerData(localData.get()));
                }
            } catch (Exception e) {
                log.warn("Error reading broker data from cache for broker - [{}], [{}]", broker, e.getMessage());
            }
        }
        // Remove obsolete brokers.
        for (final String broker : brokerDataMap.keySet()) {
            if (!activeBrokers.contains(broker)) {
                brokerDataMap.remove(broker);
            }
        }
    }
```

负载均衡器在启动的时候就会查询所有节点的数据，然后写入到 `brokerDataMap` 中。

![](https://s2.loli.net/2024/06/12/ASoLedKVlgRbCFO.png)
同时也会注册相关的 zookeeper 事件，当注册的节点发生变化时（一般是新增或者删减了 broker 节点）就会更新内存中缓存的负载数据。

之后 leader 节点会定期调用 `org.apache.pulsar.broker.loadbalance.impl.ModularLoadManagerImpl#doLoadShedding` 函数查询哪些数据需要卸载，然后进行重新负载。

```java
final Multimap<String, String> bundlesToUnload = loadSheddingStrategy.findBundlesForUnloading(loadData, conf);
```
最核心的就是调用这个 `findBundlesForUnloading` 函数，会返回需要卸载 bundle 集合，最终会遍历这个集合调用 admin API 进行卸载和重平衡。


而这个函数会有多种实现，本质上就是根据传入的各个节点的负载数据，然后根据自定义的规则返回一批需要卸载的数据。

以默认的 `org.apache.pulsar.broker.loadbalance.impl.ThresholdShedder` 规则为例：

![](https://s2.loli.net/2024/06/12/hg751LtwZMrUyFb.png)
它是根据带宽、内存、流量等各个指标的权重算出每个节点的负载值，之后为整个集群计算出一个平均负载值。

以上图为例：超过 `ShedBundles` 的数据就需要被卸载掉，然后转移到低负载的节点中。

所以最左边节点和超出的 bundle 部分就需要被返回。

具体的计算逻辑如下：
```java
    private void filterAndSelectBundle(LoadData loadData, Map<String, Long> recentlyUnloadedBundles, String broker,
                                       LocalBrokerData localData, double minimumThroughputToOffload) {
        MutableDouble trafficMarkedToOffload = new MutableDouble(0);
        MutableBoolean atLeastOneBundleSelected = new MutableBoolean(false);
        loadData.getBundleDataForLoadShedding().entrySet().stream()
                .map((e) -> {
                    String bundle = e.getKey();
                    BundleData bundleData = e.getValue();
                    TimeAverageMessageData shortTermData = bundleData.getShortTermData();
                    double throughput = shortTermData.getMsgThroughputIn() + shortTermData.getMsgThroughputOut();
                    return Pair.of(bundle, throughput);
                }).filter(e ->
                        !recentlyUnloadedBundles.containsKey(e.getLeft())
                ).filter(e ->
                        localData.getBundles().contains(e.getLeft())
                ).sorted((e1, e2) ->
                        Double.compare(e2.getRight(), e1.getRight())
                ).forEach(e -> {
                    if (trafficMarkedToOffload.doubleValue() < minimumThroughputToOffload
                            || atLeastOneBundleSelected.isFalse()) {
                        selectedBundlesCache.put(broker, e.getLeft());
                        trafficMarkedToOffload.add(e.getRight());
                        atLeastOneBundleSelected.setTrue();
                    }
                });
    }
```

从代码里看的出来就是在一个备选集合中根据各种阈值和判断条件筛选出需要卸载的 bundle。

---

而 `SimpleLoadManagerImpl` 的实现如下：
```java
synchronized (currentLoadReports) {
	for (Map.Entry<ResourceUnit, LoadReport> entry : currentLoadReports.entrySet()) {
		ResourceUnit overloadedRU = entry.getKey();
		LoadReport lr = entry.getValue();
		// 所有数据做一个简单的筛选，超过阈值的数据需要被 unload
		if (isAboveLoadLevel(lr.getSystemResourceUsage(), overloadThreshold)) {
			ResourceType bottleneckResourceType = lr.getBottleneckResourceType();
			Map<String, NamespaceBundleStats> bundleStats = lr.getSortedBundleStats(bottleneckResourceType);
			if (bundleStats == null) {
				log.warn("Null bundle stats for bundle {}", lr.getName());
				continue;

			}
```

就是很简单的通过将判断节点的负载是否超过了阈值 `isAboveLoadLevel`，然后做一个简单的排序就返回了。

从这里也看得出来 `SimpleLoadManagerImpl` 和 `ModularLoadManager` 的区别，`SimpleLoadManagerImpl` 更简单，并没有提供多个 `doLoadShedding` 的筛选实现。


# 总结

总的来说对于无状态的服务来说，理论上我们只需要做好负载算法即可（轮训、一致性哈希、低负载优先等）就可以很好的平衡各个节点之间的负载。

而对于有状态的服务来说，负载均衡就是将负载较高节点中的数据转移到负载低的节点中。

其中的关键就是需要存储各个节点的负载数据（业界常用的是存储到 zookeeper 中），然后再由一个 leader 节点从这些节点中根据某种负载算法选择出负载较高的节点以及负载较低的节点，最终把数据迁移过去即可。

