---
title: 升级到 Pulsar3.0 后深入了解 JWT 鉴权
date: 2023/11/19 16:19:28
categories:
  - OB
tags:
  - Pulsar
---

![image.png](https://s2.loli.net/2023/11/19/gAadEDNG4piBbSl.png)


# 背景
最近在测试将 `Pulsar` 2.11.2 升级到 `3.0.1`的过程中碰到一个鉴权问题，正好借着这个问题充分了解下 `Pulsar` 的鉴权机制是如何运转的。
<!--more-->
Pulsar 支持 `Namespace/Topic` 级别的鉴权，在生产环境中往往会使用 `topic` 级别的鉴权，从而防止消息泄露或者其他因为权限管控不严格而导致的问题。

![image.png](https://s2.loli.net/2023/11/19/1HGIlndNFCWwAzK.png)

我们会在创建 `topic` 的时候为 `topic` 绑定一个应用，这样就只能由这个应用发送消息，其他的应用尝试发送消息的时候会遇到 401 鉴权的异常。
> 同理，对于订阅者也可以关联指定的应用，从而使得只有规定的应用可以消费消息。

# 鉴权流程
以上的两个功能本质上都是通过 `Pulsar` 的 `admin-API` 实现的。

![image.png](https://s2.loli.net/2023/11/19/zlLxTZi7rV8XvJg.png)
这里关键的就是 `role`，在我们的场景下通常是一个应用的 `AppId`，只要是一个和项目唯一绑定的 `ID` 即可。

这只是授权的一步，整个鉴权流程图如下：
![](https://s2.loli.net/2023/11/19/mGcIvBYo6SNy8gH.png)

## 详细步骤
### 生成公私钥
```shell
bin/pulsar tokens create-key-pair --output-private-key my-private.key --output-public-key my-public.key
```
将公钥分发到 `broker` 的节点上，鉴权的时候 `broker` 会使用公钥进行验证。

而私钥通常是管理员单独保存起来用于在后续的步骤为客户端生成 `token`

### 使用私钥生成 token
之后我们便可以使用这个私钥生成 `token` 了：
```shell
bin/pulsar tokens create --private-key file:///path/to/my-private.key \
            --subject 123456

eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9
```
> 其中的 `subject` 和本文长提到的 `role` 相等

### 使用 subject 授权
只是单纯生成了 `token` 其实并没有什么作用，还得将 `subject`(role) 与 `topic` 进行授权绑定。

![image.png](https://s2.loli.net/2023/11/19/zlLxTZi7rV8XvJg.png)
也就是上图的这个步骤。
> 这里创建的 `admin` 客户端也得使用一个 `superRole` 角色的 `token` 才有权限进行授权。
>  `superRole` 使用在  `broker.conf` 中进行配置。

### 客户端使用 token 接入 broker
```java
PulsarClient client = PulsarClient.builder()
    .serviceUrl("pulsar://broker.example.com:6650/")
    .authentication(AuthenticationFactory.token("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJKb2UifQ.ipevRNuRP6HflG8cFKnmUPtypruRC4fb1DWtoLL62SY")）
    .build();
```
使用刚才私钥生成的 token 接入 broker 才能生产或者消费数据。

## originalPrincipal cannot be a proxy role
这些流程正常都没啥问题，但直到我升级了 `Pulsar3.0` 后客户端直接就连不上了。

在 `broker` 中看到了 `WARN` 的警告日志：
```shell
cannot specify originalPrincipal when connecting without valid proxy role
```
![image.png](https://s2.loli.net/2023/11/19/8atrUwAj2Tg6GLu.jpg)
之后在 3.0 的升级日志中看到相关的 [Issue](https://github.com/apache/pulsar/pull/19455)。

从这个 PR 相关的代码和变更的文档可以得知：
![image.png](https://s2.loli.net/2023/11/19/3ktMOS6IjDu9nmE.png)
![image.png](https://s2.loli.net/2023/11/19/fpJ8CuwnlXdhxWm.png)

升级到 3.0 之后风险校验等级提高了，`proxyRole` 这个字段需要在 `broker` 中进行指定（之前的版本不需要强制填写）。

因为我们使用了 Proxy 组件，所有的请求都需要从 proxy 中转一次，这个 proxyRole 是为了告诉 broker：只有使用了 `proxyRole` 作为 `token` 的 `Proxy` 才能访问 broker，这样保证了 `broker` 的安全。

```config
superUserRoles: broker-admin,admin,proxy-admin 
proxyRoles: proxy-admin
```
以上是我的配置，我的 Proxy 配置的也是 `proxy-admin` 这个 token，所以理论上是没有问题的，但依然鉴权失败了，查看 broker 的日志后拿到以下日志：
```shell
Illegal combination of role [proxy-admin] and originalPrincipal [proxy-admin]: originalPrincipal cannot be a proxy role.
```
排查了许久依然没有太多头绪，所以我提了相关的 issue:
[https://github.com/apache/pulsar/issues/21583](https://github.com/apache/pulsar/issues/21583)
之后我咨询了 `Pulsar` 的 PMC [@Technoboy](https://github.com/Technoboy-)  在他的提示下发现我在测试的时候使用的是 `proxy-admin`，正好和 `proxyRoles` 相等。
![image.png](https://s2.loli.net/2023/11/19/AuoY8Sq4FPUVHjN.png)
阅读源码和这个 `PR` 的 `comment` 之后得知：
![image.png](https://s2.loli.net/2023/11/19/pTbQkj2rOKnHNwS.png)
也就是说客户端不能使用和 `proxyRole` 相同的角色进行连接，这个角色应当也只能给 `Proxy` 使用，这样的安全性才会高。

所以这个 Comment 还在讨论这是一个 `breaking change?` 还是一个增强补丁。
因为合并这个 PR 后对没有使用 `proxyRole` 的客户端将无法连接，同时也可能出现我这种 `proxyRole` 就是客户端使用的角色，这种情况也会鉴权失败。

所以我换了一个 superRole 角色就可以了，比如换成了 `admin`。

> 但其实即便是放到我们的生产系统，只要配置了 `proxyRole` 也不会有问题，因为我们应用所使用的 role 都是不这里的 `superUserRole`，全部都是使用 `AppId` 生成的。
# token 不一致
但也有一个疑惑，我在换为存放在 `configmap` 中的 admin token 之前(测试环境使用的是 helm 安装集群，所以这些 token 都是存放在 configmap 中的)，

为了验证是否只要非 `proxyRole` 的 `superRole` 都可以使用，我就自己使用了私钥重新生成了一个 `admin` 的 `token`。

```shell
bin/pulsar tokens create --private-key file:///pulsar/private/private.key --subject admin
```
这样生成的 `token` 也是可以使用的，但是我将 token 复制出来之后却发现 helm 生成的 `token` 与我用 `pulsar` 命令行生成的 `token` 并不相同。

为了搞清楚为什么 token 不同但鉴权依然可以通过的原因，之后我将 token decode之后知道了原因：
![image.png](https://s2.loli.net/2023/11/19/rKMRqGsmTDvLnZ2.png)
![image.png](https://s2.loli.net/2023/11/19/xZn4v5EIFwXMRKk.png)
原来是 Header 不同从而导致最终的 token 不同，helm 生成的 `token` 中多了一个 typ 字段。

---
之后我检查了 helm 安装的流程，发现原来 helm 的脚本中使用的并不是 Java 的命令行工具：
```shell
${PULSARCTL_BIN} token create -a RS256 --private-key-file ${privatekeytmpfile} --subject ${role} 2&> ${tokentmpfile}
```

这个 `PULSARCTL_BIN` 是一个由 Go 写的命令行工具，我查看了其中的源码，才知道 Go 的 JWT 工具会自带一个 header。
[https://github.com/streamnative/pulsarctl](https://github.com/streamnative/pulsarctl)

![image.png](https://s2.loli.net/2023/11/19/kZ2zaOfo7PbvT4j.png)
而 `Java` 是没有这个逻辑的，但也只是加了 `header`，`payload` 的值都是相同的。
这样也就解释了为什么 `token` 不同但确依然能使用的原因。

#Blog #Pulsar 