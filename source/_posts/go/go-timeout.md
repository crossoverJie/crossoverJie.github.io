---
title: Go 里的超时控制
date: 2021/10/28 08:02:16 
categories: 
- Go
tags: 
- timer
---

![](https://i.loli.net/2021/11/15/yI7WFgfcobRiHkx.jpg)

# 前言

日常开发中我们大概率会遇到超时控制的场景，比如一个批量耗时任务、网络请求等；一个良好的超时控制可以有效的避免一些问题（比如 `goroutine` 泄露、资源不释放等）。

<!--more-->

# Timer
在 go 中实现超时控制的方法非常简单，首先第一种方案是 `Time.After(d Duration)`：

```go
func main() {
	fmt.Println(time.Now())
	x := <-time.After(3 * time.Second)
	fmt.Println(x)
}
```
output:

```shell
2021-10-27 23:06:04.304596 +0800 CST m=+0.000085653
2021-10-27 23:06:07.306311 +0800 CST m=+3.001711390
```
![](https://i.loli.net/2021/11/15/E4eIjN9nHrcTpOk.jpg)

`time.After()` 会返回一个 `Channel`，该 `Channel` 会在延时 d 段时间后写入数据。

有了这个特性就可以实现一些异步控制超时的场景：

```go
func main() {
	ch := make(chan struct{}, 1)
	go func() {
		fmt.Println("do something...")
		time.Sleep(4*time.Second)
		ch<- struct{}{}
	}()
	
	select {
	case <-ch:
		fmt.Println("done")
	case <-time.After(3*time.Second):
		fmt.Println("timeout")
	}
}
```

这里假设有一个 `goroutine` 在跑一个耗时任务，利用 select 有一个 `channel` 获取到数据便退出的特性，当 `goroutine` 没有在有限时间内完成任务时，主 `goroutine` 便会退出，也就达到了超时的目的。

output:
```shell
do something...
timeout
```



timer.After 取消，同时 Channel 发出消息，也可以关闭通道等通知方式。

注意 Channel 最好是有大小，防止阻塞 goroutine ，导致泄露。


# Context

第二种方案是利用 context，go 的 context 功能强大；
![](https://i.loli.net/2021/11/15/Z4pzi1THxMFXCWj.jpg)
利用 `context.WithTimeout()` 方法会返回一个具有超时功能的上下文。

```go
	ch := make(chan string)
	timeout, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	go func() {
		time.Sleep(time.Second * 4)

		ch <- "done"
	}()

	select {
	case res := <-ch:
		fmt.Println(res)
	case <-timeout.Done():
		fmt.Println("timout", timeout.Err())
	}
```

同样的用法，`context` 的 `Done()` 函数会返回一个 `channel`，该 `channel` 会在当前工作完成或者是上下文取消生效。

```shell
timout context deadline exceeded
```

通过 `timeout.Err()` 也能知道当前 `context ` 关闭的原因。

## goroutine 传递 context 

使用 `context` 还有一个好处是，可以利用其天然在多个 goroutine 中传递的特性，让所有传递了该 context 的 goroutine 同时接收到取消通知，这点在多 go 中应用非常广泛。

```go
func main() {
	total := 12
	var num int32
	log.Println("begin")
	ctx, cancelFunc := context.WithTimeout(context.Background(), 3*time.Second)
	for i := 0; i < total; i++ {
		go func() {
			//time.Sleep(3 * time.Second)
			atomic.AddInt32(&num, 1)
			if atomic.LoadInt32(&num) == 10 {
				cancelFunc()
			}
		}()
	}
	for i := 0; i < 5; i++ {
		go func() {

			select {
			case <-ctx.Done():
				log.Println("ctx1 done", ctx.Err())
			}

			for i := 0; i < 2; i++ {
				go func() {
					select {
					case <-ctx.Done():
						log.Println("ctx2 done", ctx.Err())
					}
				}()
			}

		}()
	}

	time.Sleep(time.Second*5)
	log.Println("end", ctx.Err())
	fmt.Printf("执行完毕 %v", num)
}
```

在以上例子中，无论 `goroutine` 嵌套了多少层，都是可以在 `context` 取消时获得消息（当然前提是 `context` 得传递走）

某些特殊情况需要提前取消 context 时，也可以手动调用 `cancelFunc()` 函数。


## Gin 中的案例

Gin 提供的 `Shutdown(ctx)` 函数也充分使用了 `context`。

```go
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}
	log.Println("Server exiting")
```
![](https://i.loli.net/2021/11/15/KhaxHcAbd3foJjZ.jpg)

比如以上代码便是超时等待 10s 进行 `Gin` 的资源释放，实现的原理也和上文的例子相同。


# 总结


因为写 go 的时间不长，所以自己写了一个练手的项目：一个接口压力测试工具。

![go-benchmark-test.md---008i3skNly1gw04urcj16g30gn0571kz.gif](https://i.loli.net/2021/11/15/lrNwUd1HFZuiQoe.gif)
![](https://i.loli.net/2021/11/15/VMFemnbtlI8JXZP.jpg)

其中一个很常见的需求就是压测 N 秒后退出，这里正好就应用到了相关知识点，同样是初学 `go` 的小伙伴可以参考。

[https://github.com/crossoverJie/ptg/blob/d0781fcb5551281cf6d90a86b70130149e1525a6/duration.go#L41](https://github.com/crossoverJie/ptg/blob/d0781fcb5551281cf6d90a86b70130149e1525a6/duration.go#L41)
