---
title: 时隔五年 9K star 的 IM 项目发布 v2.0.0 了
date: 2024/11/04 11:11:48
categories:
  - IM
tags:
 - IM
---

最近业余时间花了小三个月重构了 [cim](https://github.com/crossoverJie/cim)，也将版本和升级到了 [v2.0.0](https://github.com/crossoverJie/cim/releases/tag/v2.0.0)，合并了十几个 PR 同时也新增了几位开发者。

![image.png](https://s2.loli.net/2024/10/12/yKzedUZ8DQlVwTC.png)

> 其中有两位也是咱们星球里的小伙伴🎉

<!--more-->
# 介绍
上次发版还是在五年前了：
![](https://s2.loli.net/2024/10/12/WCP1Vn62SeBNAmZ.png)

因为确实已经很久没有更新了，在开始之前还是先介绍 [cim](https://github.com/crossoverJie/cim/) 是什么。

这里有一张简单的使用图片：
![Oct-14-2024 11-09-54-min.gif](https://s2.loli.net/2024/10/14/pBvDML4HVgyYZxS.gif)
同时以前也有录过相关的视频：

通过 [cim](https://github.com/crossoverJie/cim) 这个名字和视频可以看出，它具备 IM 即时通讯的基本功能，同时基于它可以实现：
- 即时通讯
- 消息推送
- IOT 消息平台

现在要在本地运行简单许多了，前提是有 docker 就可以了。

```bash
docker run --rm --name zookeeper -d -p 2181:2181 zookeeper:3.9.2
docker run --rm --name redis -d -p 6379:6379 redis:7.4.0

git clone https://github.com/crossoverJie/cim.git
cd cim
mvn clean package -DskipTests=true
cd cim-server && cim-client && cim-forward-route
mvn clean package spring-boot:repackage -DskipTests=true
```

## 架构
[cim](https://github.com/crossoverJie/cim) 的架构图如下：
![](https://s2.loli.net/2024/10/13/O7wVi8QYr3lMFJo.png)
主要分为三个部分：
- Client 基本交互功能
	- 消息收发
	- 消息查询
	- 延迟消息
- Route 提供了消息路由以及相关的管理功能
	- API 转发
	- 消息推送
	- 会话管理
	- 可观测性
- Server 主要就提供长链接能力，以及真正的消息推送

同时还有元数据中心（支持扩展实现）、消息存储等组件；

不管是客户端、route、server 都是支持集群：
- route 由于是无状态，可以任意扩展
- server 通过注册中心也支持集群部署，当发生宕机或者是扩容时，客户端会通过心跳和重连机制保证可用性。

所以整个架构不存在**单点**，同时比较简单清晰的，大部分组件都支持可扩展。
## 流程

![](https://s2.loli.net/2024/10/13/8teMn7BSa5VWuvi.png)



为了更方便理解，花了一个流程图。
- server 在启动之后会先在元数据中心注册
- 同时 route 会订阅元数据中的 server 信息
- 客户端登陆时会调用 route 获取一个 server 的节点信息
- 然后发起登陆请求。
	- 成功之后会保持长链接。
- 客户端向发送消息时会调用 route 接口来发起消息
	- route 根据长链接关系选择 server 进行消息推送
## v2.0.0

接下来介绍下本次 [v2.0.0](https://github.com/crossoverJie/cim/releases/tag/v2.0.0) 有哪些重大变更，毕竟是修改了大的版本号。

这里列举一些重大的改动：
![image.png](https://s2.loli.net/2024/10/12/mRGDV6hBCTAblcI.png)

- 首先是支持了元数据中心，解耦了 zookeeper，也支持自定义实现。
- 支持了集成测试，可以保证提交的 PR 对现有功能的影响降到最低，代码质量有一定保证；review 代码时更加放心。
- 单独抽离了 `client-sdk`，代码耦合性更好且更易维护。
- 服务之间调用的 RPC 完成了重构
	- 支持了动态 URL
	- 泛型数据解析
- 还有社区小伙伴贡献的一些 bug 修复、`RpcProxyManager` 的 IOC 支持等特性。



# 总结

更多的部署和使用可以参考项目首页的 README，有详细的介绍。

[cim](https://github.com/crossoverJie/cim) 目前还需要优化的地方非常多；接下来的重点是实现 ACK，同时会完善一下通讯协议。
![image.png](https://s2.loli.net/2024/10/14/l7RIZfYOsmM1N3P.png)

todo 列表我也添加了很多，所以非常推荐感兴趣的朋友可以先看看 todo 列表，说不定就有你感兴趣的可以参与一下。

