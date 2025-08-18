---
title: Pulsar3.0 升级指北
date: 2023/12/24 17:08:27
categories:
  - Pulsar
  - OB
tags:
  - Pulsar
---

![Pulsar3.0-upgrade.png](https://s2.loli.net/2023/12/24/4EVJDOaxl1WI3j9.png)

# Pulsar3.0 介绍
Pulsar3.0 是 Pulsar 社区推出的第一个 LTS 长期支持版本。

![image.png](https://s2.loli.net/2023/12/22/RL2AvFCQiIseMxH.png)

如图所示，LTS 版本会最长支持到 36 个月，而 Feature 版本最多只有六个月；类似于我们使用的 `JDK11,17,21` 都是可以长期使用的；所以也推荐大家都升级到 LTS 版本。

---
作为首个 LTS 版本，3.0 自然也是自带了许多新特性，这个会在后续介绍。

<!--more-->


# 升级指南

先来看看升级指南：
![image.png](https://s2.loli.net/2023/12/24/ZAc2845LvhsBHfx.png)
在官方的兼容表中会发现：不推荐跨版本升级。

也就是说如果你现在还在使用的是 2.10.x，那么推荐是先升级到 2.11.x 然后再升级到 3.0.x.

而且根据我们的使用经验来看，首个版本是不保险的，即便是 LTS 版本；
所以不推荐直接升级到 3.0.0，而是更推荐 3.0.1+，这个小版本会修复 3.0 所带来的一些 bug。


先讲一下我们的升级流程，大家可以用做参考。

## 升级前准备

根据我们的使用场景，为了以防万一，首先需要将我们的插件依赖升级到对应的版本。
![image.png](https://s2.loli.net/2023/12/24/8NzRJUrBWqKPkm9.png)
其实简单来说就是更新下依赖，然后再重新打包，在后续的流程进行测试。

### 预热镜像
之后是预热镜像，我们使用 `harbor` 搭建了自己的 docker 镜像仓库，这样在升级重启镜像的时候可以更快的从内网拉取镜像。

> 毕竟一个 pulsar-all 的镜像也不小，尽量的缩短启动时间。

预热的过程也很简单：

```shell
docker pull apachepulsar/pulsar-all:3.0.1

docker tag apachepulsar/pulsar-all:3.0.1 harbor-private.xx.com/pulsar/pulsar-all:3.0.1

docker image push harbor-private.xx.com/pulsar/pulsar-all:3.0.1
```

之后升级的时候就可以使用私服的镜像了。

## 功能测试

我这边有写了一个 `cli` 可以帮我快速创建或升级一个集群，然后触发我所编写的功能测试。


```shell
./pulsar-upgrade-cli upgrade pulsar-test ./charts/pulsar --version x.x.x -f charts/pulsar/values.yaml -n pulsar-test
```

这个 cli 很简单，一共就做三件事：
- 使用 helm 接口升级集群
- 等待所有的 Pod 都升级成功
- 触发功能测试

之后的效果如下：
![image.png](https://s2.loli.net/2023/12/24/m85XPGr9nLqtp17.png)

主要就是覆盖了我们的使用场景，都跑通过之后才会走后续的流程。
## 运行监控

![image.png](https://s2.loli.net/2023/12/24/2iDHdwPB4UJXsGh.png)


之后会启动一个 200 左右的并发生产和消费数据，模拟线上的使用情况，会一直让这个任务跑着，大概一晚上就可以了，第二天通过监控查看：
- 应用有无异常日志
- 流量是否正常
- 各个组件的内存占用
- 写入延迟等信息


## 升级步骤

组件的升级步骤这里参考了官方指南：
[https://pulsar.apache.org/docs/3.1.x/administration-upgrade/#upgrade-zookeeper-optional](https://pulsar.apache.org/docs/3.1.x/administration-upgrade/#upgrade-zookeeper-optional)
![image.png](https://s2.loli.net/2023/12/24/9dXxSTOwb8lFm1v.png)

- 升级ZK
- 关闭auto recovery
- 升级Bookkeeper
- 升级Broker
- 升级Proxy
- 开启auto recovery

只要一步步按照这个流程走，问题不大，哪一步出现问题后需要及时回滚，回滚流程参考下面的回滚部分。

同时在升级过程中需要一直查看 broker 的 error 日志，如果有明显的不符合预期的日志一定要注意。

> 在升级  bookkeeper 的时候，broker 可能会出现 bk 连接失败的异常，这个可以不用在意。
## 线上验证

都升级完后就是线上业务验证环节了：
- [x] 查看监控面板，是否有明显的流量、内存、延迟的异常指标。 ✅ 2023-12-24
- [x] topic 元数据完整性验证：这个是因为我们这次升级出了一个 topic 被删除的 bug，所以需要重点验证下；这部分会在下次详细分析。 ✅ 2023-12-24
- [x] 查看业务消息收发有无异常 ✅ 2023-12-24
- [x] 链路查询是否正常，我们有一个消息链路查询的页面，主要是使用 `Pulsar-SQL` 和 `broker-interceptor` 实现的。 ✅ 2023-12-24

## 异常回滚
当出现异常的时候需要立即回滚，这里的异常一般就是消息收发异常，客户端掉线等。

经过我的测试 3.0.x 的存储和之前的版本是兼容的，所以 `bookkeeper` 都能降级其他的组件就没啥可担心的了。

需要降级时直接将所有组件降级为上一个版本即可。

## 灾难恢复

因为是从 2.x 升级到 3.x 也是涉及到了跨大版本，所以也准备了灾难恢复的方案。

>比如极端情况下升级失败，所有数据丢失的情况。

整个灾难恢复的主要目的就是恢复后的集群对外提供的域名不发生变化，同时所有的客户端可以自动重连上来，也就是最坏的情况下所有的数据丢了可以接受，但不能影响业务正常使用。

所以我们的流程如下：

### 备份 topic
```java
@SneakyThrows  
@Test  
void backup(){  
    List<String> topicList = pulsarAdmin.topics().getPartitionedTopicList("tenant/namespace");  
    log.info("topic size={}",topicList.size());  
    // create a custom thread pool  
    CopyOnWriteArrayList<TopicMeta> dataList = new CopyOnWriteArrayList<>();  
    ExecutorService customThreadPool = Executors.newFixedThreadPool(10);  
    for (String topicName : topicList) {  
        customThreadPool.execute(()-> {  
            PartitionedTopicMetadata metadata;  
            try {  
                metadata = pulsarAdmin.topics().getPartitionedTopicMetadata(topicName);  
                TopicMeta topicMeta = new TopicMeta();  
  
                // backup topic  
                topicMeta.setName(topicName);  
                topicMeta.setPartition(metadata.partitions);  
  
                // backup permission  
                Map<String, Set<AuthAction>> permissions = pulsarAdmin.topics().getPermissions(topicName);  
                topicMeta.setPermissions(permissions);  
  
                // back sub  
                List<String> subscriptions = new ArrayList<>();  
                PartitionedTopicStats topicStats = pulsarAdmin.topics().getPartitionedStats(topicName, true);  
                topicStats.getSubscriptions().forEach((k,v)-> subscriptions.add(k));  
                topicMeta.setSubscriptions(subscriptions);  
  
                dataList.add(topicMeta);  
            } catch (PulsarAdminException e) {  
                throw new RuntimeException(e);  
            }        });    }  
    customThreadPool.shutdown();  
    while (!customThreadPool.isTerminated()) {  
    }  
    log.info("{}",dataList.size());  
    log.info("{}",JSONUtil.toJsonStr(dataList));  
}


// TopicMetaData
@Data  
public class TopicMeta {  
    private String name;  
    private int partition;  
    Map<String, Set<AuthAction>> permissions;  
    List<String> subscriptions = new ArrayList<>();  
}
```
第一步是备份 topic：
- topic 主要是名称和分区数量
- 备份权限
- 备份 topic 的订阅者
### 公私钥备份
因为我们客户端使用了 JWT 验证，所有为了使得恢复的 Pulsar 集群可以让客户端无缝切换到新集群，因此必须得使用相同的公私钥。

这个其实比较简单，我们使用的是 helm 安装的集群，所以只需要备份好 `Secret` 即可。

```yaml
apiVersion: v1  
data:  
  PRIVATEKEY: XXX  
  PUBLICKEY: XXX 
kind: Secret  
metadata:  
  name: pulsar-token-asymmetric-key  
  namespace: pulsar  
type: Opaque  

# 还有几个 superUser 的 Secret
```
### 数据恢复

#### 创建新集群
首先使用 helm 重新创建一个新集群：
```shell
./scripts/pulsar/prepare_helm_release.sh -n pulsar -k pulsar

helm install \    --values charts/pulsar/values.yaml \    --set namespace=pulsar\  
    --set initialize=true \  
    pulsar ./charts/pulsar -n pulsar
```

#### 恢复公私钥
直接使用刚才备份的公私钥覆盖到新集群即可。

#### 恢复namespace
进入 toolset pod 创建需要使用的 `tenant/namespace`

```shell
k exec -it pulsar-toolset-0 -n pulsar bash

bin/pulsar-admin tenants create tenant

bin/pulsar-admin namespaces create tenant/namespace
```

#### 元数据恢复

之后便是最重要的元数据恢复了：

```java
@SneakyThrows  
@Test  
void restore() {  
    PulsarAdmin pulsarAdmin = PulsarAdmin.builder().serviceHttpUrl("http://url:8080")  
            .authentication(AuthenticationFactory.token(token))  
            .build();  
    Path filePath = Path.of("restore-ns.json");  
    String fileContent = Files.readString(filePath);  
    List<TopicMeta> topicMetaList = JSON.parseArray(fileContent, TopicMeta.class);  
    ExecutorService customThreadPool = Executors.newFixedThreadPool(50);  
    for (TopicMeta topicMeta : topicMetaList) {  
        customThreadPool.execute(() -> {  
            // Create topic  
            try {  
                pulsarAdmin.topics().createPartitionedTopic(topicMeta.getName(), topicMeta.getPartition());  
            } catch (PulsarAdminException e) {  
                log.error("Create topic error");  
            }  
            // Create sub  
            for (String subscription : topicMeta.getSubscriptions()) {  
                try {  
                    pulsarAdmin.topics().createSubscription(topicMeta.getName(), subscription, MessageId.latest);  
                } catch (PulsarAdminException e) {  
                    log.error("createSubscription error");  
                }            }  
            // Grant permission  
            topicMeta.getPermissions().forEach((role, authActions) -> {  
                permission(pulsarAdmin, topicMeta.getName(), role, authActions);  
            });  
            log.info("topic:{} restore success", topicMeta.getName());  
  
  
        });    }  
    customThreadPool.shutdown();  
    while (!customThreadPool.isTerminated()) {  
    }    log.info("restore success");  
}


private synchronized void permission(PulsarAdmin pulsarAdmin, String topic, String role, Set<AuthAction> authActions) {  
    try {  
        pulsarAdmin.topics().grantPermission(topic, role, authActions);  
    } catch (PulsarAdminException e) {  
        log.error("grantPermission error", e);  
    }  
}
```
流程和备份类似：
- 创建分区 topic
- 创建订阅者
- 授权角色信息

因为授权接口限制了并发调用，所有需要加锁，导致整个恢复的流程就会比较慢。

8000 topic 的 namespace 大概恢复时间为 40min 左右。

之后依次恢复其他 namespace 即可。


#### 恢复 police

```java
admin.namespaces().setNamespaceMessageTTL("tenant/namespace", 3600 * 6);
admin.namespaces().setBacklogQuota("tenant/namespace", BacklogQuota)
```

如果之前的集群有设置 TTL 或者是 backlogQuota 时都需要手动恢复。
# 总结

以上就是整个升级和灾难恢复的流程，当然灾难恢复希望大家不要碰到。

我会在下一篇详细介绍 `Pulsar 3.0` 的新功能以及所碰到的一些坑。