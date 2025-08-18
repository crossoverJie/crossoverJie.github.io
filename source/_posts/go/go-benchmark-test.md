---
title: 编写一个接口压测工具
date: 2021/11/15 08:10:16 
categories: 
- Go
- 设计模式
tags: 
- grpc
- http
- benchmark
- performance
- 设计模式
---

![go-benchmark-test.md---008i3skNly1gwer3yhu0dj30vn0u00v3.jpg](https://i.loli.net/2021/11/15/NPjnuqgBEMTRSJk.jpg)

# 前言

前段时间有个项目即将上线，需要对其中的核心接口进行压测；由于我们的接口是 `gRPC` 协议，找了一圈发现压测工具并不像 `HTTP` 那么多。

最终发现了 [ghz](https://ghz.sh/) 这个工具，功能也非常齐全。

事后我在想为啥做 `gRPC` 压测的工具这么少，是有什么难点嘛？为了验证这个问题于是我准备自己写一个工具。

<!--more-->

# 特性

前前后后大概花了个周末的时间完成了相关功能。

[https://github.com/crossoverJie/ptg/](https://github.com/crossoverJie/ptg/)

![go-benchmark-test.md---008i3skNly1gw04urcj16g30gn0571kz.gif](https://i.loli.net/2021/11/15/lrNwUd1HFZuiQoe.gif)

也是一个命令行工具，使用起来效果如上图；完整的命令如下：

```shell
NAME:
   ptg - Performance testing tool (Go)

USAGE:
   ptg [global options] command [command options] [arguments...]

COMMANDS:
   help, h  Shows a list of commands or help for one command

GLOBAL OPTIONS:
   --thread value, -t value              -t 10 (default: 1 thread)
   --Request value, --proto value        -proto http/grpc (default: http)
   --protocol value, --pf value          -pf /file/order.proto
   --fully-qualified value, --fqn value  -fqn package.Service.Method
   --duration value, -d value            -d 10s (default: Duration of test in seconds, Default 10s)
   --request value, -c value             -c 100 (default: 100)
   --HTTP value, -M value                -m GET (default: GET)
   --bodyPath value, --body value        -body bodyPath.json
   --header value, -H value              HTTP header to add to request, e.g. "-H Content-Type: application/json"
   --target value, --tg value            http://gobyexample.com/grpc:127.0.0.1:5000
   --help, -h                            show help (default: false)
```

考虑到受众，所以同时支持 `HTTP` 与 `gRPC` 接口的压测。

做 `gRPC` 压测时所需的参数要多一些：

```shell script
ptg -t 10 -c 100 -proto grpc  -pf /xx/xx.proto -fqn hello.Hi.Say -body test.json  -tg "127.0.0.1:5000"
```

比如需要提供 `proto` 文件的路径、具体的请求参数还有请求接口的全路径名称。

> 目前只支持最常见的 unary call 调用，后续如果有需要的话也可以 stream。

同时也支持压测时间、次数两种压测方式。


# 安装

想体验的朋友如果本地有 go 环境那直接运行：

```shell
go get github.com/crossoverJie/ptg
```

没有环境也没关系，可以再 release 页面下载与自己环境对应的版本解压使用。

![go-benchmark-test.md---008i3skNly1gwf1nq32qyj31ei0sqjts.jpg](https://i.loli.net/2021/11/15/fvrtNbmxW3AOzEu.jpg)
[https://github.com/crossoverJie/ptg/releases](https://github.com/crossoverJie/ptg/releases)

## 设计模式

整个开发过程中还是有几个点想和大家分享，首先是设计模式。

因为一开始设计时就考虑到需要支持不同的压测模式（次数、时间；后续也可以新增其他的模式）。

所以我便根据压测的生命周期定义了一套接口：

```go
type (
	Model interface {
		Init()
		Run()
		Finish()
		PrintSate()
		Shutdown()
	}
)	
```

从名字也能看出来，分别对应：
- 压测初始化
- 运行压测
- 停止压测
- 打印压测信息
- 关闭程序、释放资源

![go-benchmark-test.md---008i3skNly1gwf21h4wa0j30pa09ewfo.jpg](https://i.loli.net/2021/11/15/TQ9jVHKtOeXlSnd.jpg)
![go-benchmark-test.md---008i3skNly1gwf21psdzhj30p809odh6.jpg](https://i.loli.net/2021/11/15/QcmOHB6lxAUszTE.jpg)

然后在两个不同的模式中进行实现。

这其实就是一个典型的依赖倒置原则。

> 程序员要依赖于抽象接口编程、不要依赖具体的实现。

其实大白话就是咱们 `Java` 里常说的面向接口编程；这个编程技巧在开发框架、SDK或是多种实现的业务中常用。

好处当然是显而易见：
当接口定义好之后，不同的业务只需要根据接口实现自己的业务就好，完全不会互相影响；维护、扩展都很方便。

支持 `HTTP` 和 `gRPC` 也是同理实现的：

```go
type (
	Client interface {
		Request() (*Response, error)
	}
)	
```
![](https://i.loli.net/2021/11/15/s4SY6B97GVjotAz.jpg)
![](https://i.loli.net/2021/11/15/2a8vRwb9skJhtqr.jpg)

当然前提得是前期的接口定义需要考虑周全、不能之后频繁修改接口定义，这样的接口就没有意义了。

## goroutine

另外一点则是不得不感叹 `goroutine+select+channel` 这套并发编程模型真的好用，并且也非常容易理解。

很容易就能写出一套并发代码：

```go
func (c *CountModel) Init() {
	c.wait.Add(c.count)
	c.workCh = make(chan *Job, c.count)
	for i := 0; i < c.count; i++ {
		go func() {
			c.workCh <- &Job{
				thread:   thread,
				duration: duration,
				count:    c.count,
				target:   target,
			}
		}()
	}
}
```

比如这里需要初始化 N 个 `goroutine` 执行任务，只需要使用 `go` 关键字，然后利用 channel 将任务写入。

当然在使用 `goroutine+channel` 配合使用时也得小心 `goroutine` 泄露的问题；简单来说就是在程序员退出时还有 `goroutine` 没有退出。

比较常见的例子就是向一个无缓冲的 `channel` 中写数据，当没有其他 `goroutine` 来读取数时，写入的 `goroutine` 就会被一直阻塞，最终导致泄露。


# 总结

有 `gRPC` 接口压测需求的朋友欢迎试用，提出宝贵意见；当然 `HTTP` 接口也可以。

源码地址：
[https://github.com/crossoverJie/ptg/](https://github.com/crossoverJie/ptg/)

最后如果有同样在学习 go 的朋友，特别是有 Java 开发经验的（这里大部分应该都写 Java）朋友，感兴趣的可以在公众号后台回复 "go群" 加入我创建的一个与 go 开发相关的技术群。

