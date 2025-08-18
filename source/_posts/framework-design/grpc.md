---
title: 5分钟学会 gRPC
date: 2022/03/08 08:12:16 
categories: 
- framework
tags: 
- Go
- gRPC
---

![](https://s2.loli.net/2022/03/13/EvoDe9JNqPLHwdF.jpg)
# 介绍

我猜测大部分长期使用 `Java` 的开发者应该较少会接触 `gRPC`，毕竟在 `Java` 圈子里大部分使用的还是 `Dubbo/SpringClound` 这两类服务框架。

我也是近段时间有机会从零开始重构业务才接触到 `gRPC` 的，当时选择 `gRPC` 时也有几个原因：

![](https://s2.loli.net/2022/03/13/XCYkMxjpUgvZE5L.jpg)

- 基于云原生的思路开发部署项目，而在云原生中 `gRPC` 几乎已经是标准的通讯协议了。
- 开发语言选择了 Go，在 Go 圈子中 `gRPC` 显然是更好的选择。
- 公司内部有部分业务使用的是 `Python` 开发，在多语言兼容性上 `gRPC` 支持的非常好。



<!--more-->

经过线上一年多的平稳运行，可以看出 `gRPC` 还是非常稳定高效的；rpc 框架中最核心的几个要点：

- 序列化
- 通信协议
- IDL（接口描述语言）

这些在 `gRPC` 中分别对应的是：

- 基于 `Protocol Buffer` 序列化协议，性能高效。
- 基于 `HTTP/2` 标准协议开发，自带 `stream`、多路复用等特性；同时由于是标准协议，第三方工具的兼容性会更好（比如负载均衡、监控等）
- 编写一份 `.proto` 接口文件，便可生成常用语言代码。 

# HTTP/2

学习 `gRPC` 之前首先得知道它是通过什么协议通信的，我们日常不管是开发还是应用基本上接触到最多的还是 `HTTP/1.1` 协议。

![](https://s2.loli.net/2022/03/13/r6w2Yvi9dkPqKEW.jpg)

由于 `HTTP/1.1` 是一个文本协议，对人类非常友好，相反的对机器性能就比较低。

需要反复对文本进行解析，效率自然就低了；要对机器更友好就得采用二进制，`HTTP/2` 自然做到了。

除此之外还有其他优点：

- 多路复用：可以并行的收发消息，互不影响
- `HPACK` 节省 `header` 空间，避免 `HTTP1.1` 对相同的 `header` 反复发送。


# Protocol

`gRPC` 采用的是 `Protocol` 序列化，发布时间比 `gRPC` 早一些，所以也不仅只用于 `gRPC`，任何需要序列化 IO 操作的场景都可以使用它。

它会更加的省空间、高性能；之前在开发 [https://github.com/crossoverJie/cim](https://github.com/crossoverJie/cim/blob/master/protocol/BaseRequestProto.proto) 时就使用它来做数据交互。

```proto
package order.v1;

service OrderService{

  rpc Create(OrderApiCreate) returns (Order) {}

  rpc Close(CloseApiCreate) returns (Order) {}

  // 服务端推送
  rpc ServerStream(OrderApiCreate) returns (stream Order) {}

  // 客户端推送
  rpc ClientStream(stream OrderApiCreate) returns (Order) {}
  
  // 双向推送
  rpc BdStream(stream OrderApiCreate) returns (stream Order) {}
}

message OrderApiCreate{
  int64 order_id = 1;
  repeated int64 user_id = 2;
  string remark = 3;
  repeated int32 reason_id = 4;
}
```

使用起来也是非常简单的，只需要定义自己的 `.proto` 文件，便可用命令行工具生成对应语言的 SDK。

具体可以参考官方文档：
[https://grpc.io/docs/languages/go/generated-code/](https://grpc.io/docs/languages/go/generated-code/)

# 调用

```shell
	protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    test.proto
```
![](https://s2.loli.net/2022/03/13/vAahTlgs54Pem7c.jpg)
生成代码之后编写服务端就非常简单了，只需要实现生成的接口即可。

```go
func (o *Order) Create(ctx context.Context, in *v1.OrderApiCreate) (*v1.Order, error) {
	// 获取 metadata
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.DataLoss, "failed to get metadata")
	}
	fmt.Println(md)
	fmt.Println(in.OrderId)
	return &v1.Order{
		OrderId: in.OrderId,
		Reason:  nil,
	}, nil
}
```

![](https://s2.loli.net/2022/03/13/wWJQ7Rv5BnqPrjo.jpg)

客户端也非常简单，只需要依赖服务端代码，创建一个 `connection` 然后就和调用本地方法一样了。

这是经典的 `unary`(一元)调用，类似于 http 的请求响应模式，一个请求对应一次响应。

![](https://s2.loli.net/2022/03/13/cxF2Xlj4BuWOEbz.jpg)

## Server stream

`gRPC` 除了常规的 `unary` 调用之外还支持服务端推送，在一些特定场景下还是很有用的。

![](https://s2.loli.net/2022/03/13/jz2CwFvfR6iuTMt.jpg) 

```go
func (o *Order) ServerStream(in *v1.OrderApiCreate, rs v1.OrderService_ServerStreamServer) error {
	for i := 0; i < 5; i++ {
		rs.Send(&v1.Order{
			OrderId: in.OrderId,
			Reason:  nil,
		})
	}
	return nil
}
```
服务端的推送如上所示，调用 `Send` 函数便可向客户端推送。

```go
	for {
		msg, err := rpc.RecvMsg()
		if err == io.EOF {
			marshalIndent, _ := json.MarshalIndent(msgs, "", "\t")
			fmt.Println(msg)
			return
		}
	}
```

客户端则通过一个循环判断当前接收到的数据包是否已经截止来获取服务端消息。

为了能更直观的展示这个过程，优化了之前开发的一个 `gRPC` [客户端](https://github.com/crossoverJie/ptg)，可以直观的调试 `stream` 调用。

![](https://s2.loli.net/2022/03/13/zqTm3bgysJcMEeZ.gif)

> 上图便是一个服务端推送示例。

## Client Stream

![](https://s2.loli.net/2022/03/13/rkSeCNVEzJ26sMd.jpg)

除了支持服务端推送之外，客户端也支持。

> 客户端在同一个连接中一直向服务端发送数据，服务端可以并行处理消息。

```go

// 服务端代码
func (o *Order) ClientStream(rs v1.OrderService_ClientStreamServer) error {
	var value []int64
	for {
		recv, err := rs.Recv()
		if err == io.EOF {
			rs.SendAndClose(&v1.Order{
				OrderId: 100,
				Reason:  nil,
			})
			log.Println(value)
			return nil
		}
		value = append(value, recv.OrderId)
		log.Printf("ClientStream receiv msg %v", recv.OrderId)
	}
	log.Println("ClientStream finish")
	return nil
}

	// 客户端代码
	for i := 0; i < 5; i++ {
		messages, _ := GetMsg(data)
		rpc.SendMsg(messages[0])
	}
	receive, err := rpc.CloseAndReceive()
```

代码与服务端推送类似，只是角色互换了。

![](https://s2.loli.net/2022/03/13/lZzfH8yq3MGwKa9.gif)


## Bidirectional Stream

![](https://s2.loli.net/2022/03/13/Le2OdbBN1DGScg6.jpg)

同理，当客户端、服务端同时都在发送消息也是支持的。

```go
// 服务端
func (o *Order) BdStream(rs v1.OrderService_BdStreamServer) error {
	var value []int64
	for {
		recv, err := rs.Recv()
		if err == io.EOF {
			log.Println(value)
			return nil
		}
		if err != nil {
			panic(err)
		}
		value = append(value, recv.OrderId)
		log.Printf("BdStream receiv msg %v", recv.OrderId)
		rs.SendMsg(&v1.Order{
			OrderId: recv.OrderId,
			Reason:  nil,
		})
	}
	return nil
}
// 客户端
	for i := 0; i < 5; i++ {
		messages, _ := GetMsg(data)
		// 发送消息
		rpc.SendMsg(messages[0])
		// 接收消息
		receive, _ := rpc.RecvMsg()
		marshalIndent, _ := json.MarshalIndent(receive, "", "\t")
		fmt.Println(string(marshalIndent))
	}
	rpc.CloseSend()
```

其实就是将上诉两则合二为一。

![](https://s2.loli.net/2022/03/13/Lxy7dhbD8ewlpUf.gif)

通过调用示例很容易理解。

## 元数据

`gRPC` 也支持元数据传输，类似于 `HTTP` 中的 `header`。

```go
	// 客户端写入
	metaStr := `{"lang":"zh"}`
	var m map[string]string
	err := json.Unmarshal([]byte(metaStr), &m)
	md := metadata.New(m)
	// 调用时将 ctx 传入即可
	ctx := metadata.NewOutgoingContext(context.Background(), md)
	
	// 服务端接收
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.DataLoss, "failed to get metadata")
	}
	fmt.Println(md)	
```

## gRPC gateway

`gRPC` 虽然功能强大使用也很简单，但对于浏览器、APP的支持还是不如 REST 应用广泛（浏览器也支持，但应用非常少）。

为此社区便创建了 [https://github.com/grpc-ecosystem/grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway) 项目，可以将 gRPC 服务暴露为 RESTFUL API。

![](https://s2.loli.net/2022/03/13/Gt2sRplIADyvTHg.jpg)

> 为了让测试可以习惯用 postman 进行接口测试，我们也将 gRPC 服务代理出去，更方便的进行测试。

## 反射调用

作为一个 rpc 框架，泛化调用也是必须支持的，可以方便开发配套工具；gRPC 是通过反射支持的，通过拿到服务名称、pb 文件进行反射调用。

[https://github.com/jhump/protoreflect](https://github.com/jhump/protoreflect) 这个库封装了常见的反射操作。

上图中看到的可视化 `stream` 调用也是通过这个库实现的。

# 负载均衡

由于 `gRPC` 是基于 `HTTP/2` 实现的，客户端和服务端会保持长连接；这时做负载均衡就不像是 `HTTP` 那样简单了。

而我们使用 `gRPC` 想达到效果和 HTTP 是一样的，需要对请求进行负载均衡而不是连接。

通常有两种做法：

- 客户端负载均衡
- 服务端负载均衡

客户端负载均衡在 `rpc` 调用中应用广泛，比如 `Dubbo` 就是使用的客户端负载均衡。

`gRPC` 中也提供有相关接口，具体可以参考官方demo。

[https://github.com/grpc/grpc-go/blob/87eb5b7502/examples/features/load_balancing/README.md](https://github.com/grpc/grpc-go/blob/87eb5b7502/examples/features/load_balancing/README.md)

客户端负载均衡相对来说对开发者更灵活（可以自定义适合自己的策略），但相对的也需要自己维护这块逻辑，如果有多种语言那就得维护多份。

所以在云原生这个大基调下，更推荐使用服务端负载均衡。

可选方案有：
- istio
- envoy
- apix 

这块我们也在研究，大概率会使用 `envoy/istio`。


# 总结
`gRPC` 内容还是非常多的，本文只是作为一份入门资料希望能让不了解 `gRPC` 的能有一个基本认识；这在云原生时代确实是一门必备技能。

> 对文中的 gRPC 客户端感兴趣的朋友，可以参考这里的源码：
[https://github.com/crossoverJie/ptg](https://github.com/crossoverJie/ptg)

