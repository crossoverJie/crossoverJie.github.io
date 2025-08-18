---
title: 观察者模式的实际应用
date: 2021/09/02 08:02:16 
categories: 
- Go
- 设计模式
tags: 
- 设计模式
- observer
---

![](https://i.loli.net/2021/10/25/QWzgA94m6MpIndl.jpg)

# 前言

设计模式不管是在面试还是工作中都会遇到，但我经常碰到小伙伴抱怨实际工作中自己应用设计模式的机会非常小。

正好最近工作中遇到一个用`观察者模式`解决问题的场景，和大家一起分享。

<!--more-->

背景如下：

在用户创建完订单的标准流程中需要做额外一些事情：
![](https://i.loli.net/2021/10/25/H3ZKealzx4LfdIv.jpg)


同时这些业务也是不固定的，随时会根据业务发展增加、修改逻辑。

如果直接将逻辑写在下单业务中，这一`”坨“`不是很核心的业务就会占据的越来越多，修改时还有可能影响到正常的下单流程。

当然也有其他方案，比如可以启动几个定时任务，定期扫描扫描订单然后实现自己的业务逻辑；但这样会浪费许多不必要的请求。

# 观察者模式

因此观察者模式就应运而生，它是由事件发布者在自身状态发生变化时发出通知，由观察者获取消息实现业务逻辑。

这样事件发布者和接收者就可以完全解耦，互不影响；本质上也是对开闭原则的一种实现。

# 示例代码

![](https://i.loli.net/2021/10/25/185RJunI4wDX7TF.jpg)

先大体看一下观察者模式所使用到的接口与关系：

- 主体接口：定义了注册实现、循环通知接口。
- 观察者接口：定义了接收主体通知的接口。
- 主体、观察者接口都可以有多个实现。
- 业务代码只需要使用 `Subject.Nofity()` 接口即可。


---
接下来看看创建订单过程中的实现案例。

> 代码采用 go 实现，其他语言也是类似。

首先按照上图定义了两个接口：

```go
type Subject interface {
	Register(Observer)
	Notify(data interface{})
}

type Observer interface {
	Update(data interface{})
}
```

由于我们这是一个下单的事件，所以定义了 `OrderCreateSubject` 实现 `Subject`：

```go
type OrderCreateSubject struct {
	observerList []Observer
}

func NewOrderCreate() Subject {
	return &OrderCreateSubject{}
}

func (o *OrderCreateSubject) Register(observer Observer) {
	o.observerList = append(o.observerList, observer)
}
func (o *OrderCreateSubject) Notify(data interface{}) {
	for _, observer := range o.observerList {
		observer.Update(data)
	}
}
```

其中的 `observerList` 切片是用于存放所有订阅了下单事件的观察者。

接着便是编写观察者业务逻辑了，这里我实现了两个：

```go
type B1CreateOrder struct {
}
func (b *B1CreateOrder) Update(data interface{}) {
	fmt.Printf("b1.....data %v \n", data)
}


type B2CreateOrder struct {
}
func (b *B2CreateOrder) Update(data interface{}) {
	fmt.Printf("b2.....data %v \n", data)
}
```

使用起来也非常简单：

```go
func TestObserver(t *testing.T) {
	create := NewOrderCreate()
	create.Register(&B1CreateOrder{})
	create.Register(&B2CreateOrder{})

	create.Notify("abc123")
}
```

Output：
```
b1.....data abc123 
b2.....data abc123 
```

1. 创建一个`创建订单`的主体 `subject`。
2. 注册所有的订阅事件。
3. 在需要通知处调用 `Notify` 方法。

这样一旦我们需要修改各个事件的实现时就不会互相影响，即便是要加入其他实现也是非常容易的：

1. 编写实现类。
2. 注册进实体。

不会再修改核心流程。


## 配合容器

其实我们也可以省略掉注册事件的步骤，那就是使用容器；大致流程如下：

1. 自定义的事件全部注入进容器。
2. 再注册事件的地方从容器中取出所有的事件，挨个注册。

> 这里所使用的容器是 [https://github.com/uber-go/dig](https://github.com/uber-go/dig)

![](https://i.loli.net/2021/10/25/WXOG27IZ8x4EwDi.jpg)

修改后的代码中，每当我们新增一个观察者（事件订阅）时，只需要使用容器所提供 `Provide` 函数注册进容器即可。


同时为了让容器能够支持同一个对象存在多个实例也需要新增部分代码：

Observer.go:

```go
type Observer interface {
	Update(data interface{})
}
type (
	Instance struct {
		dig.Out
		Instance Observer `group:"observers"`
	}

	InstanceParams struct {
		dig.In
		Instances []Observer `group:"observers"`
	}
)
```

在 `observer` 接口中需要新增两个结构体用于存放同一个接口的多个实例。

>  `group:"observers"` 用于声明是同一个接口。

创建具体观察者对象时返回 `Instance` 对象。

```go
func NewB1() Instance {
	return Instance{
		Instance: &B1CreateOrder{},
	}
}

func NewB2() Instance {
	return Instance{
		Instance: &B2CreateOrder{},
	}
}
```

> 其实就是用 Instance 包装了一次。

这样在注册观察者时，便能从 `InstanceParams.Instances` 中取出所有的观察者对象了。

```go
	err = c.Invoke(func(subject Subject, params InstanceParams) {
		for _, instance := range params.Instances {
			subject.Register(instance)
		}
	})
```



这样在使用时直接从容器中获取主题对象，然后通知即可：

```go
	err = c.Invoke(func(subject Subject) {
		subject.Notify("abc123")
	})
```

更多关于 dig 的用法可以参考官方文档：

[https://pkg.go.dev/go.uber.org/dig#hdr-Value_Groups](https://pkg.go.dev/go.uber.org/dig#hdr-Value_Groups)

# 总结

有经验的开发者会发现和发布订阅模式非常类似，当然他们的思路是类似的；我们不用纠结与两者的差异（面试时除外）；学会其中的思路更加重要。



