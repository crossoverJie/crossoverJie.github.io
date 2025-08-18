---
title: 🤳如何为复杂的 Java 应用编写集成测试
date: 2024/09/29 19:16:06
categories:
  - cim
  - test
tags:
- cim
---


最近有时间又把以前开源的 [IM 消息系统](https://github.com/crossoverJie/cim)捡起来继续开发了（确实这些年经常有朋友催更）。

> 没错，确实是这些年，因为上次发版还是再 2019 年的八月份。


这段时间比较重大的更新就是把[元数据中心](https://github.com/crossoverJie/cim/pull/140)抽离出来了，以前是和 zookeeper 的代码强耦合在一起的，重构之后可以有多种实现了。

<!--more-->

今后甚至可以提供一个 jar 包就可以把后端服务全部启动起来用于体验，此时就可以使用一个简单的基于内存的注册中心。

除此之外做的更多的就是新增了一个集成测试的模块，没有完善的集成测试功能在合并代码的时候都要小心翼翼，基本的功能需求都没法保证。

加上这几年我也接触了不少优秀的开源项目（比如 Pulsar、OpenTelemetry、HertzBeat 等），他们都有完整的代码合并流程；首先第一点就得把测试流水线跑通过。

这一点在 OpenTelemetry 社区更为严格：

![](https://s2.loli.net/2024/09/04/wlaPtbJNux5vc9n.png)

> 他们的构建测试流程非常多，包括单元测试、集成测试、代码风格、多版本兼容等。

所以在结合了这些优秀项目的经验后我也为 cim 项目新增相关的模块 [cim-integration-test](https://github.com/crossoverJie/cim/pull/144)，同时也在 github 上配置了相关的 action，最终的效果如下：

![](https://s2.loli.net/2024/09/04/p9tLcvPTlMBIVq4.png)
![](https://s2.loli.net/2024/09/04/Rxw5F8kNWT1pDO7.png)

在 `“Build with Maven”` 阶段触发单元测试和集成测试，最终会把测试结果上传到 Codecov，然后会在 PR 的评论区输出测试报告。
![](https://s2.loli.net/2024/09/04/zmPHB16ryCtGoEM.png)

相关的 action 配置如下：

![](https://s2.loli.net/2024/09/05/mteK1Yj43Z7gIrR.png)

就是配置了几个 Job，重点是这里的：

```shell
mvn -B package --file pom.xml
```

它会编译并运行项目下面的所有 test 代码。

# cim-integration-test 模块

为了方便进行集成测试，我新增了 `cim-integration-test` 这个模块，这里面没有任何源码，只有测试相关的代码。

![](https://s2.loli.net/2024/09/05/RfK8FVrL916D7cI.png)

类的继承关系图如下：

![](https://s2.loli.net/2024/09/05/75U9vbkPZOgqrRx.png)

因为我们做集成测试需要把 cim 所依赖的服务都启动起来，目前主要由以下几个服务：
- cim-server: cim 的服务端
- cim-route: 路由服务
- cim-client: 客户端

而 route 服务是依赖于 server 服务，所以 route 继承了 server，client 则是需要 route 和 server 都启动，所以它需要继承 route。

## 集成 test container

先来看看 server 的测试实现：

```java
public abstract class AbstractServerBaseTest {  
  
    private static final DockerImageName DEFAULT_IMAGE_NAME = DockerImageName  
            .parse("zookeeper")  
            .withTag("3.9.2");  
  
    private static final Duration DEFAULT_STARTUP_TIMEOUT = Duration.ofSeconds(60);  
  
    @Container  
    public final ZooKeeperContainer  
            zooKeeperContainer = new ZooKeeperContainer(DEFAULT_IMAGE_NAME, DEFAULT_STARTUP_TIMEOUT);  
  
    @Getter  
    private String zookeeperAddr;  
  
    public void startServer() {  
        zooKeeperContainer.start();  
        zookeeperAddr = String.format("%s:%d", zooKeeperContainer.getHost(), zooKeeperContainer.getMappedPort(ZooKeeperContainer.DEFAULT_CLIENT_PORT));  
        SpringApplication server = new SpringApplication(CIMServerApplication.class);  
        server.run("--app.zk.addr=" + zookeeperAddr);  
    }  
}
```

因为 `server` 是需要依赖 `zookeeper` 作为元数据中心，所以在启动之前需要先把 zookeeper 启动起来。

此时就需要使用 [testcontainer](https://testcontainers.com/) 来做支持了，使用它可以在单测的过程中使用 docker 启动任意一个服务，这样在 CI 中做集成测试就很简单了。

![](https://s2.loli.net/2024/09/06/X3vzp5qd7tbAIHB.png)

我们日常使用的大部分中间件都是支持的，使用起来也很简单。

先添加相关的依赖：

```xml
<dependencies>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <version>42.7.3</version>
    </dependency>
    <dependency>
        <groupId>ch.qos.logback</groupId>
        <artifactId>logback-classic</artifactId>
        <version>1.5.6</version>
    </dependency>
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.10.2</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

然后在选择我们需要依赖的服务，比如是 `PostgreSQL`：

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <version>1.19.8</version>
    <scope>test</scope>
</dependency>
```

然后在测试代码中启动相关的服务
```java
class CustomerServiceTest {

  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
    "postgres:16-alpine"
  );

  CustomerService customerService;

  @BeforeAll
  static void beforeAll() {
    postgres.start();
  }

  @AfterAll
  static void afterAll() {
    postgres.stop();
  }

  @BeforeEach
  void setUp() {
    DBConnectionProvider connectionProvider = new DBConnectionProvider(
      postgres.getJdbcUrl(),
      postgres.getUsername(),
      postgres.getPassword()
    );
    customerService = new CustomerService(connectionProvider);
  }
```

通常情况下我们都是需要获取这些中间件的链接，比如 IP 端口啥的。

```java
org.testcontainers.containers.ContainerState#getHost
org.testcontainers.containers.ContainerState#getMappedPort
```
通常是通过这两个函数来获取对应的 IP 和端口。
# 集成 

```java
@Container  
RedisContainer redis = new RedisContainer(DockerImageName.parse("redis:7.4.0"));  
  
public void startRoute() {  
    redis.start();  
    SpringApplication route = new SpringApplication(RouteApplication.class);  
    String[] args = new String[]{  
            "--spring.data.redis.host=" + redis.getHost(),  
            "--spring.data.redis.port=" + redis.getMappedPort(6379),  
            "--app.zk.addr=" + super.getZookeeperAddr(),  
    };    
    route.setAdditionalProfiles("route");  
    route.run(args);  
}
```

对于 route 来说不但需要 `zookeeper` 还需要 `Redis` 来存放用户的路由关系，此时就还需要运行一个 Redis 的容器，使用方法同理。

最后就需要以 `springboot` 的方式将这两个应用启动起来，我们直接创建一个 `SpringApplication` 对象，然后将需要修改的参数通过 `--varname=value` 的形式将数据传递进去。

还可以通过 `setAdditionalProfiles()` 函数指定当前应用运行的 profile，这样我们就可以在测试目录使用对应的配置文件了。

![image.png](https://s2.loli.net/2024/09/06/ySK2akYOIAPJqUH.png)

```java
route.setAdditionalProfiles("route");  
```

比如我们这里设置为 route 就可以使用 `application-route.yaml` 作为 route 的配置文件启动，就不用每个参数都通过 `--` 传递了。


```java
private void login(String userName, int port) throws Exception {  
    Long userId = super.registerAccount(userName);  
    SpringApplication client = new SpringApplication(CIMClientApplication.class);  
    client.setAdditionalProfiles("client");  
    String[] args = new String[]{  
            "--server.port=" + port,  
            "--cim.user.id=" + userId,  
            "--cim.user.userName=" + userName  
    };  
    client.run(args);  
}  
  
@Test  
public void olu() throws Exception {  
    super.startServer();  
    super.startRoute();  
    this.login("crossoverJie", 8082);  
    this.login("cj", 8182);  
    MsgHandle msgHandle = SpringBeanFactory.getBean(MsgHandle.class);  
    msgHandle.innerCommand(":olu");  
    msgHandle.sendMsg("hello");  
}
```

我们真正要测试的其实是客户端的功能，只要客户端功能正常，说明 server 和 route 也是正常的。

比如这里的 `olu(oline user)` 的测试流程是：
- 启动 server 和 route
- 登录注册两个账号
- 查询出所有用户
- 发送消息

最终的测试结果如下，符合预期。

![image.png](https://s2.loli.net/2024/09/06/uX7BrNwC8iOHqSQ.png)

# 碰到的问题

## 应用分层

不知道大家注意到刚才测试代码存在的问题没有，主要就是没法断言。

因为客户端、route、server 都是以一个应用的维度去运行的，没法获取到一些关键指标。

比如输出在线用户，当客户端作为一个应用时，在线用户就是直接打印在了终端，而没有直接暴露一个接口返回在线数据；收发消息也是同理。

其实在应用内部这些都是有接口的，但是作为一个整体的 `springboot` 应用就没有提供这些能力了。

本质上的问题就是这里应该有一个 client-sdk 的模块，client 也是基于这个 sdk 实现的，这样就可以更好的测试相关的功能了。

之后就准备把 sdk 单独抽离一个模块，这样可以方便基于这个 sdk 实现不同的交互，甚至做一个 UI 界面都是可以的。

## 编译失败

还有一个问题就是我是直接将 `client/route/server` 的依赖集成到 `integration-test` 模块中：

```xml
<dependency>  
  <groupId>com.crossoverjie.netty</groupId>  
  <artifactId>cim-server</artifactId>  
  <version>${project.version}</version>  
  <scope>compile</scope>  
</dependency>  
  
<dependency>  
  <groupId>com.crossoverjie.netty</groupId>  
  <artifactId>cim-forward-route</artifactId>  
  <version>${project.version}</version>  
  <scope>compile</scope>  
</dependency>  
  
<dependency>  
  <groupId>com.crossoverjie.netty</groupId>  
  <artifactId>cim-client</artifactId>  
  <version>${project.version}</version>  
  <scope>compile</scope>  
</dependency>
```

在 IDEA 里直接点击测试按钮是可以直接运行这里的测试用例的，但是想通过 `mvn test` 时就遇到了问题。

![image.png](https://s2.loli.net/2024/09/06/DFy6otpPvjar4JM.png)

会在编译期间就是失败了，我排查了很久最终发现是因为这三个模块应用使用了springboot 的构建插件：

```xml
<plugin>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-maven-plugin</artifactId>
	<executions>
		<execution>
			<goals>
				<goal>repackage</goal>
			</goals>
		</execution>
	</executions>
</plugin>
```

这几个模块最终会被打包成一个 springboot 的 jar 包，从而导致 integration-test 在编译时无法加载进来从而使用里面的类。

暂时没有找到好的解决办法，我就只有把这几个插件先去掉，需要打包时再手动指定插件。

```shell
mvn clean package spring-boot:repackage -DskipTests=true
```

其实这里的本质问题也是没有分层的结果，最好还是依赖 `route` 和 `server` 的 SDK 进行测试。


现在因为有了测试的 CI 也欢迎大家来做贡献，可以看看这里的 `help want`，有一些简单易上手可以先搞起来。

![](https://s2.loli.net/2024/09/06/kmgfrIxdhGXib9L.png)

https://github.com/crossoverJie/cim/issues/135

参考链接：
- https://github.com/crossoverJie/cim/pull/140
- https://github.com/crossoverJie/cim/pull/144