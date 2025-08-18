---
title: 撸了一个可调试 gRPC 的 GUI 客户端
date: 2021/11/28 08:11:16 
categories: 
- Go
tags: 
- grpc
---


![go-grpc-client-gui.md---008i3skNly1gwuz3q9a2nj30rs0rs3z1.jpg](https://i.loli.net/2021/11/29/FzbRvSVafJ6glCm.jpg)

# 前言

平时大家写完 `gRPC` 接口后是如何测试的？往往有以下几个方法：

1. 写单测代码，自己模拟客户端测试。
![go-grpc-client-gui.md---008i3skNly1gwv0138u2ij31eq0lwn07.jpg](https://i.loli.net/2021/11/29/OVNjXQbYal7o9kP.jpg)

2. 可以搭一个 `gRPC-Gateway` 服务，这样就可以在 `postman` 中进行模拟。

<!--more-->

但这两种方法都不是特别优雅；第一种方法当请求结构体嵌套特别复杂时，在代码中维护起来就不是很直观；而且代码会特别长。

第二种方法在 postman 中与请求 HTTP 接口一样，看起来非常直观；但需要额为维护一个 `gRPC-Gateway` 服务，同时接口定义发生变化时也得重新发布，使用起来稍显复杂。

于是我经过一番搜索找到了两个看起来还不错的工具：

- [BloomRPC](https://github.com/bloomrpc/bloomrpc)
- [https://github.com/fullstorydev/grpcui](https://github.com/fullstorydev/grpcui)

![](https://i.loli.net/2021/11/29/zJ5I12HNfpso6XK.jpg)

首先看 `BloomRPC` 页面美观，功能也很完善；但却有个非常难受的地方，那就是不支持 `int64` 数据的请求, 会有精度问题。

![](https://i.loli.net/2021/11/29/tAFs8zbN5yRJo7d.jpg)
> 这里我写了一个简单的接口，直接将请求的 `int64` 返回回来。

```go
func (o *Order) Create(ctx context.Context, in *v1.OrderApiCreate) (*v1.Order, error) {
	fmt.Println(in.OrderId)
	return &v1.Order{
		OrderId: in.OrderId,
		Reason:  nil,
	}, nil
}
```
会发现服务端收到的数据精度已经丢失了。

这个在我们大量使用 `int64` 的业务中非常难受，大部分接口都没法用了。

---
![](https://i.loli.net/2021/11/29/VaBdYTsGiKzMnr8.jpg)
`grpcui` 是我在使用了 `BloomRPC` 一段时间之后才发现的工具，功能也比较完善; `BloomRPC` 中的精度问题也不存在。

但由于我之前已经习惯了在 `BloomRPC` 中去调试接口，加上日常开发过程中我的浏览器几乎都是开了几十个 tap 页面，导致在其中找到 `grpcui` 不是那么方便。

所以我就想着能不能有一个类似于  `BloomRPC` 的独立 APP，也支持 `int64` 的工具。

---

## 准备

找了一圈，貌似没有发现。恰好前段时间写了一个 `gRPC` 的压测工具，其实已经把该 APP 需要的核心功能也就是泛化调用实现了。

由于核心能力是用 Go 实现的，所以这个 APP 最好也是用 Go 来写，这样复用代码会更方便一些；正好也想看看用 Go 来实现 GUI 应用效果如何。

但可惜 Go 并没有提供原生的 GUI 库支持，最后翻来找去发现了一个库：[fyne](https://github.com/fyne-io/fyne)

从 `star` 上看用的比较多，同时也支持跨平台打包；所以最终就决定使用该库在构建这个应用。


# 核心功能

整个 App 的交互流程我参考了  `BloomRPC` ，但作为一个不懂审美、设计的后端开发来说，整个过程中最难的就是布局了。

![go-grpc-client-gui.md---008i3skNly1gwv8ft1l4rj30rs0eimxs.jpg](https://i.loli.net/2021/11/29/lUmXMxyZcQ3dtuW.jpg)

这是我花了好几个晚上调试出来的第一版页面，虽然也能用但查看请求和响应数据非常不方便。

于是又花了一个周末最终版如下（乍一看貌似没区别）：

![ptg-min.gif](https://i.loli.net/2021/11/29/GnPF5UESwNrojOl.gif)

虽然页面上与 `BloomRPC` 还有一定差距，但也不影响使用；关键是 `int64` 的问题解决了；又可以愉快的撸码了。

## 安装

有类似需求也想体验的朋友可以在这里下载使用：
[https://github.com/crossoverJie/ptg/releases/download/0.0.2/ptg-mac-gui.tar](https://github.com/crossoverJie/ptg/releases/download/0.0.2/ptg-mac-gui.tar)

由于我手上暂时没有 `Windows` 电脑，所以就没有打包 exe 程序；有相关需求的朋友可以自行下载源码编译：

```go
git clone git@github.com:crossoverJie/ptg.git
cd ptg
make pkg-win
```

# 后续计划
当前版本的功能还比较简陋，只支持常用的 `unary` 调用；后续也会逐步加上 `stream`、`metadata`、工作空间的存储与还原等支持。

对页面、交互有建议也欢迎提出。

![](https://i.loli.net/2021/11/29/zTkSKE2HWPVhfgA.jpg)

> 原本是准备上传到 `brew` 方便安装的，结果折腾了一晚上因为数据不够被拒了，所以对大家有帮助或者感兴趣的话帮忙点点关注（咋有种直播带货的感觉🐶） 

源码地址：[https://github.com/crossoverJie/ptg](https://github.com/crossoverJie/ptg)
