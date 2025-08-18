---
title: 深入理解单元测试：技巧与最佳实践
date: 2024/08/15 10:43:09
categories:
  - OB
tags:
 - 单测
---


之前分享过如何快速上手开源项目以及如何在开源项目里做集成测试，但还没有讲过具体的实操。

今天来详细讲讲如何写单元测试。


# 🤔什么情况下需要单元测试
这个大家应该是有共识的，对于一些功能单一、核心逻辑、同时变化不频繁的公开函数才有必要做单元测试。

对于业务复杂、链路繁琐但也是核心流程的功能通常建议做 e2e 测试，这样可以保证最终测试结果的一致性。

<!--more-->

# 💀具体案例

我们都知道单测的主要目的是模拟执行你写过的每一行代码，目的就是要覆盖到主要分支，做到自己的每一行代码都心中有数。

下面以 `Apache HertzBeat` 的一些单测为例，讲解如何编写一个单元测试。

![](https://s2.loli.net/2024/07/02/SbqCvHVZk6f5tB1.png)
先以一个最简单的 `org.apache.hertzbeat.collector.collect.udp.UdpCollectImpl#preCheck` 函数测试为例。
这里的 `preCheck` 函数就是简单的检测做参数校验。
测试时只要我们手动将 `metrics` 设置为 `null` 就可以进入这个 if 条件。

```java
@ExtendWith(MockitoExtension.class)
class UdpCollectImplTest {

    @InjectMocks
    private UdpCollectImpl udpCollect;

    @Test
    void testPreCheck() {
        List<String> aliasField = new ArrayList<>();
        aliasField.add("responseTime");
        Metrics metrics = new Metrics();
        metrics.setAliasFields(aliasField);
        assertThrows(IllegalArgumentException.class, () -> udpCollect.preCheck(metrics));
    }
}    
```

来看具体的单测代码，我们一行行的来看：

`@ExtendWith(MockitoExtension.class)` 是 `Junit5` 提供的一个注解，里面传入的 `MockitoExtension.class` 是我们单测 mock 常用的框架。

简单来说就是告诉 `Junit5` ，当前的测试类会使用 mockito 作为扩展运行，从而可以 `mock` 我们运行时的一些对象。

---

```java
@InjectMocks  
private UdpCollectImpl udpCollect;
```

`@InjectMocks` 也是 `mockito` 这个库提供的注解，通常用于声明需要测试的类。

```java
@InjectMocks  
private AbstractCollect udpCollect;
```
![](https://s2.loli.net/2024/07/02/zSocET9f5y6lqC3.png)

需要注意的是这个注解必须是一个具体的类，不可以是一个抽象类或者是接口。

其实当我们了解了他的原理就能知道具体的原因：
![](https://s2.loli.net/2024/07/02/5DwRyVsBHd1EmpA.png)


当我们 debug 运行时会发现 `udpCollect` 对象是有值的，而如果我们去掉这个注解 `@InjectMocks` 再运行就会抛空指针异常。
> 因为并没有初始化 udpCollect

而使用 `@InjectMocks`注解后，`mockito` 框架会自动给 `udpCollect` 注入一个代理对象；而如果是一个接口或者是抽象类，mockito 框架是无法知道创建具体哪个对象。

当然在这个简单场景下，我们直接 `udpCollect = new UdpCollectImpl()` 进行测试也是可以的。

# 🔥配合 jacoco 输出单测覆盖率

![](https://s2.loli.net/2024/07/02/fgv3O4RbnHsQTWV.png)
![](https://s2.loli.net/2024/07/02/coXOGkjyE2zKsYa.png)

在 IDEA 中我们可以以 `Coverage` 的方式运行，`IDEA` 就将我们的单测覆盖情况显示在源代码中，绿色的部分就代表在实际在运行时执行到的地方。

我们也可以在 `maven` 项目中集成 `jacoco`，只需要添加一个根目录的 `pom.xml` 中添加一个 `plugin` 就可以了。

```xml
<plugin>  
    <groupId>org.jacoco</groupId>  
    <artifactId>jacoco-maven-plugin</artifactId>  
    <version>${jacoco-maven-plugin.version}</version>  
    <executions>  
        <execution>  
            <goals>  
                <goal>prepare-agent</goal>  
            </goals>  
        </execution>  
        <execution>  
            <id>report</id>  
            <phase>test</phase>  
            <goals>  
                <goal>report</goal>  
            </goals>  
        </execution>  
    </executions>  
</plugin>
```

之后运行 `mvn test` 就会在 target 目录下生成测试报告了。

![](https://s2.loli.net/2024/07/02/GiBrPjtLcXhgDbp.png)

我们还可以在 GitHub 的 CI 中集成 `Codecov`，他会直接读取 jacoco 的测试数据，并且在 PR 的评论区加上测试报告。
![](https://s2.loli.net/2024/07/02/ujdGke4gf5mAW3x.png)


![](https://s2.loli.net/2024/07/02/nFt5SukAjMPZ96W.png)

![](https://s2.loli.net/2024/07/02/KcXJUs3mehxFAYz.png)

需要从 `Codecov` 里将你项目的 token 添加到 repo 的 环境变量中即可。

具体可以参考这个 PR：[https://github.com/apache/hertzbeat/pull/1985](https://github.com/apache/hertzbeat/pull/1985)


# ☀️复杂一点的单测

刚才展示的是一个非常简单的场景，下面来看看稍微复杂的。

我们以这个单测为例：
`org.apache.hertzbeat.collector.collect.redis.RedisClusterCollectImplTest`

```java
@ExtendWith(MockitoExtension.class)
public class RedisClusterCollectImplTest {
    
    @InjectMocks
    private RedisCommonCollectImpl redisClusterCollect;


    @Mock
    private StatefulRedisClusterConnection<String, String> connection;

    @Mock
    private RedisAdvancedClusterCommands<String, String> cmd;

    @Mock
    private RedisClusterClient client;
}
```

这个单测在刚才的基础上多了一个 `@Mock` 的注解。

这是因为我们需要测试的 `RedisCommonCollectImpl` 类中需要依赖 `StatefulRedisClusterConnection/RedisAdvancedClusterCommands/RedisClusterClient` 这几个类所提供的服务。

单测的时候需要使用 `mockito` 创建一个他们的对象，并且注入到需要被测试的 `RedisCommonCollectImpl`类中。

> 不然我们就需要准备单测所需要的资源，比如可以使用的 Redis、MySQL 等。


## 🚤模拟行为

只是注入进去还不够，我们还需要模拟它的行为：
- 比如调用某个函数可以模拟返回数据
- 模拟函数调用抛出异常
- 模拟函数调用耗时

这里以最常见的模拟函数返回为例：

![](https://s2.loli.net/2024/07/02/3lnFxsQmcWqao5u.png)

```java
String clusterNodes = connection.sync().clusterInfo();
```
在源码里看到会使用 connection 的 `clusterInfo()` 函数返回集群信息。

```java
        String clusterKnownNodes = "2";
        String clusterInfoTemp = """
                cluster_slots_fail:0
                cluster_known_nodes:%s
                """;
        String clusterInfo = String.format(clusterInfoTemp, clusterKnownNodes);
        Mockito.when(cmd.clusterInfo()).thenReturn(clusterInfo);        
```

此时我们就可以使用 `Mockito.when().thenReturn()` 来模拟这个函数的返回数据。

而其中的 `cmd` 自然也是需要模拟返回的：
```java
        Mockito.mockStatic(RedisClusterClient.class).when(()->RedisClusterClient.create(Mockito.any(ClientResources.class),
                Mockito.any(RedisURI.class))).thenReturn(client);
        Mockito.when(client.connect()).thenReturn(connection);
        
        Mockito.when(connection.sync()).thenReturn(cmd);
        Mockito.when(cmd.info(metrics.getName())).thenReturn(info);
        Mockito.when(cmd.clusterInfo()).thenReturn(clusterInfo);
```

`cmd` 是通过 `Mockito.when(connection.sync()).thenReturn(cmd);`返回的，而 `connection` 又是从 `client.connect()` 返回的。

最终就像是套娃一样，`client` 在源码中是通过一个静态函数创建的。

### ⚡模拟静态函数

我依稀记得在我刚接触 `mockito` 的 16～17 年那段时间还不支持模拟调用静态函数，不过如今已经支持了：

```java
@Mock  
private RedisClusterClient client;


Mockito.mockStatic(RedisClusterClient.class).when(()->RedisClusterClient.create(Mockito.any(ClientResources.class),  
        Mockito.any(RedisURI.class))).thenReturn(client);
```
这样就可以模拟静态函数的返回值了，但前提是返回的 `client` 需要使用 `@Mock` 注解。

### 💥模拟构造函数
![](https://s2.loli.net/2024/07/02/aFiCLRyYh4IU83o.png)
有时候我们也需要模拟构造函数，从而可以模拟后续这个对象的行为。

```java
        MockedConstruction<FTPClient> mocked = Mockito.mockConstruction(FTPClient.class,
                (ftpClient, context) -> {
                    Mockito.doNothing().when(ftpClient).connect(ftpProtocol.getHost(),
                            Integer.parseInt(ftpProtocol.getPort()));

                    Mockito.doAnswer(invocationOnMock -> true).when(ftpClient)
                            .login(ftpProtocol.getUsername(), ftpProtocol.getPassword());
                    Mockito.when(ftpClient.changeWorkingDirectory(ftpProtocol.getDirection())).thenReturn(isActive);
                    Mockito.doNothing().when(ftpClient).disconnect();
                });
```
可以使用 `Mockito.mockConstruction` 来进行模拟，该对象的一些行为就直接写在这个模拟函数内。

需要注意的是返回的 `mocked` 对象需要记得关闭。


### 不需要 Mock

当然也不是所有的场景都需要 `mock`。

比如刚才第一个场景，没有依赖任何外部服务时就不需要 `mock`。

![](https://s2.loli.net/2024/07/02/mW3gxERBc4qoz2L.png)


类似于这个 [PR](https://github.com/apache/hertzbeat/pull/2021) 里的测试，只是依赖一个基础的内存缓存组件，就没必要 mock，但如果依赖的是 `Redis` 缓存组件还是需要 mock 的。
[https://github.com/apache/hertzbeat/pull/2021](https://github.com/apache/hertzbeat/pull/2021)

### ⚙️修改源码

如果有些测试场景下需要获取内部变量方便后续的测试，但是该测试类也没有提供获取变量的函数，我们就只有修改源码来配合测试了。

比如这个 [PR](https://github.com/apache/hertzbeat/pull/)：
![](https://s2.loli.net/2024/07/02/bxfQgsymWVcnawE.png)

当然如果只是给测试环境下使用的函数或变量，我们可以加上 `@VisibleForTesting`注解标明一下，这个注解没有其他作用，可以让后续的维护者更清楚的知道这是做什么用的。



# 📈集成测试
单元测试只能测试一些功能单一的函数，要保证整个软件的质量仅依赖单测是不够的，我们还需要集成测试。

通常是需要对外提供服务的开源项目都需要集成测试：
- Pulsar
- Kafka
- Dubbo 等

以我接触到的服务型应用主要分为两类：一个是 Java 应用一个是 Golang 应用。

# 🐳Golang
![](https://s2.loli.net/2024/07/11/vZISu9Qg3foKhsU.png)

`Golang` 因为工具链没有 Java 那么强大，所以大部分的集成测试的功能都是通过编写 Makefile 和 shell 脚本实现的。

还是以我熟悉的 Pulsar 的 `go-client` 为例，它在 GitHub 的集成测试是通过 GitHub action 触发的，定义如下：
![](https://s2.loli.net/2024/05/20/f2196pujo8m7KRe.png)
最终调用的是 Makefile 中的 test 命令，并且把需要测试的 Golang 版本传入进去。

![](https://s2.loli.net/2024/05/20/YpwtSHnLXqU1xQj.png)

`Dockerfile`：
![](https://s2.loli.net/2024/05/20/1ySGWF46U7EC2rk.png)


这个镜像简单来说就是将 Pulsar 的镜像作为基础运行镜像（这里面包含了 Pulsar 的服务端），然后将这个 pulsar-client-go 的代码复制进去编译。

接着运行：
```shell
cd /pulsar/pulsar-client-go && ./scripts/run-ci.sh
```
也就是测试脚本。

![](https://s2.loli.net/2024/05/20/2Afmdu8ozRvH9FC.png)

测试脚本的逻辑也很简单：
- 启动 pulsar 服务端
- 运行测试代码
因为所有的测试代码里连接服务端的地址都是 `localhost`，所以可以直接连接。
![](https://s2.loli.net/2024/05/20/C1RHxTkuz25Mlj8.png)

通过这里的 [action](https://github.com/apache/pulsar-client-go/actions/runs/9014510238/job/24768797555) 日志可以跟踪所有的运行情况。

# ☕Java

![](https://s2.loli.net/2024/07/11/KlqzSwJ6f895A4n.png)

Java 因为工具链强大，所以集成测试几乎不需要用 Makefile 和脚本配合执行。

还是以 Pulsar 为例，它的集成测试是需要模拟在本地启动一个服务端（因为 Pulsar 的服务端源码和测试代码都是 Java 写的，更方便做测试），然后再运行测试代码。

> 这个的好处是任何一个单测都可以在本地直接运行，而  Go 的代码还需要先在本地启动一个服务端，测试起来比较麻烦。


来看看它是如何实现的，我以其中一个 [BrokerClientIntegrationTest](https://github.com/apache/pulsar/blob/631b13ad23d7e48c6e82d38f97c23d129062cb7c/pulsar-broker/src/test/java/org/apache/pulsar/client/impl/BrokerClientIntegrationTest.java#L117)为例：
![](https://s2.loli.net/2024/05/20/9PbioA3RQLMBy6J.png)
![](https://s2.loli.net/2024/05/20/blKePdxTUIkgRD3.png)
会在单测启动的时候先启动服务端。

![](https://s2.loli.net/2024/05/20/gzY3lyTGuEDUwZF.png)

最终会调用 `PulsarTestContext` 的 `build` 函数启动 `broker`（服务端），而执行单测也只需要使用 `mvn test` 就可以自动触发这些单元测试。
![](https://s2.loli.net/2024/05/20/N15amZihWI73Qyw.png)
只是每一个单测都需要启停服务端，所以要把 Pulsar 的所有单测跑完通常需要 1～2 个小时。


以上就是日常编写单测可能会碰到的场景，希望对大家有所帮助。