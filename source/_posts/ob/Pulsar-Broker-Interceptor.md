---
title: 如何编写一个 Pulsar Broker Interceptor 插件
date: 2023/12/11 16:38:27
categories:
  - OB
tags:
  - Pulsar
---

# 背景
之前写过一篇文章 [VictoriaLogs：一款超低占用的 ElasticSearch 替代方案](https://crossoverjie.top/2023/08/23/ob/VictoriaLogs-Intro/)讲到了我们使用 `Victorialogs` 来存储 Pulsar 消息队列的消息 trace 信息。

![image.png](https://s2.loli.net/2023/12/11/UYdMH19uyjrNA2I.png)


而其中的关键的埋点信息是通过 Pulsar 的 `BrokerInterceptor` 实现的，后面就有朋友咨询这块代码是否开源，目前是没有开源的，不过借此机会可以聊聊如何实现一个 `BrokerInterceptor` 插件，当前还没有相关的介绍文档。
<!--more-->

其实当时我在找 `BrokerInterceptor` 的相关资料时就发现官方并没有提供对应的开发文档。

只有一个 [additional servlet](https://pulsar.apache.org/docs/3.1.x/develop-plugin/#what-is-an-additional-servlet)的开发文档，而 `BrokerInterceptor` 只在 [YouTube](https://www.youtube.com/watch?v=alzv7FyOoP0) 上找到了一个社区分享的视频。
![image.png](https://s2.loli.net/2023/12/11/H3rs8OdYZecQEn5.png)

虽说看视频可以跟着实现，但总归是没有文档方便。

---
在这之前还是先讲讲 `BrokerInterceptor` 有什么用？
![image.png](https://s2.loli.net/2023/12/11/F8cxdwsTyWuaVGg.png)

其实从它所提供的接口就能看出，在消息到达 Broker 后的一些关键节点都提供了相关的接口，实现这些接口就能做很多事情了，比如我这里所需要的消息追踪。
# 创建项目
下面开始如何使用 `BrokerInterceptor`：
首先是创建一个 `Maven` 项目，然后引入相关的依赖：

```xml
<dependency>  
<groupId>org.apache.pulsar</groupId>  
<artifactId>pulsar-broker</artifactId>  
<version>${pulsar.version}</version>  
<scope>provided</scope>  
</dependency>
```
# 实现接口
然后我们便可以实现 `org.apache.pulsar.broker.intercept.BrokerInterceptor` 来完成具体的业务了。

在我们做消息追踪的场景下，我们实现了以下几个接口：
- messageProduced
- messageDispatched
- messageAcked

以 `messageProduced` 为例，需要解析出消息ID，然后拼接成一个字符串写入 `Victorialogs` 存储中，其余的两个埋点也是类似的。
```java
@Override  
public void messageProduced(ServerCnx cnx, Producer producer, long startTimeNs, long ledgerId, long entryId,  
                            Topic.PublishContext publishContext) {  
    String ns = getNs(producer.getTopic().getName());  
    if (!LogSender.checkNamespace(ns)) {  
        return;  
    }    String topic = producer.getTopic().getName();  
    String partition = getPartition(topic);  
    String msgId = String.format("%s:%s:%s", ledgerId, entryId, partition);  
    String s = new Event.Publish(msgId, producer.getClientAddress(), System.currentTimeMillis(),  
            producer.getProducerName(), topic).toString();  
    LogSender.send(s);  
}
```

# 编写项目描述文件

我们需要创建一个项目描述文件，路径如下：
`src/main/resources/META-INF/services/broker_interceptor.yml`
名字也是固定的，broker 会在启动的时候读取这个文件，其内容如下：
```yaml
name: interceptor-name
description: description
interceptorClass: com.xx.CustomInterceptor
```
重点是填写自定义实现类的全限定名。

# 配置打包插件
```xml
<build>  
  <finalName>${project.artifactId}</finalName>  
  <plugins>  
    <plugin>  
      <groupId>org.apache.nifi</groupId>  
      <artifactId>nifi-nar-maven-plugin</artifactId>  
      <version>1.2.0</version>  
      <extensions>true</extensions>  
      <configuration>  
        <finalName>${project.artifactId}-${project.version}</finalName>  
      </configuration>  
      <executions>  
        <execution>  
          <id>default-nar</id>  
          <phase>package</phase>  
          <goals>  
            <goal>nar</goal>  
          </goals>  
        </execution>  
      </executions>  
    </plugin>  
  </plugins>  
</build>
```
由于 Broker 识别的是 nar 包，所以我们需要配置 nar 包插件，之后使用 `mvn package` 就会生成出 nar 包。

# 配置 broker.conf

我们还需要在 broker.conf 中配置：
```config
brokerInterceptors: "interceptor-name"
```
也就是刚才配置的插件名称。

不过需要注意的是，如果你是使用 helm 安装的 pulsar，在 3.1 版本之前需要手动将`brokerInterceptors` 写入到 `broker.conf` 中。

```dockerfile
FROM apachepulsar/pulsar-all:3.0.1  
COPY target/interceptor-1.0.1.nar /pulsar/interceptors/  
RUN echo "\n" >> /pulsar/conf/broker.conf  
RUN echo "brokerInterceptors=" >> /pulsar/conf/broker.conf
```

不然在最终容器中的 `broker.conf` 中是读取不到这个配置的，导致插件没有生效。

> 我们是重新基于官方镜像打的一个包含自定义插件的镜像，最终使用这个镜像进行部署。


[https://github.com/apache/pulsar/pull/20719](https://github.com/apache/pulsar/pull/20719)
我在这个 PR 中已经将配置加入进去了，但得在 3.1 之后才能生效；也就是在 3.1 之前都得加上加上这行：
```dockerfile
RUN echo "\n" >> /pulsar/conf/broker.conf  
RUN echo "brokerInterceptors=" >> /pulsar/conf/broker.conf
```

---
目前来看 Pulsar 的 `BrokerInterceptor` 应该使用不多，不然使用 helm 安装时是不可能生效的；而且官方文档也没用相关的描述。



#Blog #Pulsar 