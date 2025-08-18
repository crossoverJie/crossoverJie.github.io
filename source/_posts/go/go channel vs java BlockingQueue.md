---
title: Go channel VS Java BlockingQueue
date: 2021/07/02 08:25:16 
categories: 
- Go
tags: 
- Go
- Java
- channel
- BlockingQueue
---

![](https://i.loli.net/2021/07/03/PykYJp6qmdb2h1B.jpg)

# 前言

最近在实现两个需求，由于两者之间并没有依赖关系，所以想利用队列进行解耦；但在 `Go` 的标准库中并没有现成可用并且并发安全的数据结构；但 `Go` 提供了一个更加优雅的解决方案，那就是 `channel`。

# channel 应用

`Go` 与 `Java` 的一个很大的区别就是并发模型不同，Go 采用的是 `CSP(Communicating sequential processes)` 模型；用 Go 官方的说法：

> Do not communicate by sharing memory; instead, share memory by communicating.

<!--more-->

翻译过来就是：不用使用共享内存来通信，而是用通信来共享内存。

而这里所提到的**通信**，在 Go 里就是指代的 `channel`。

只讲概念并不能快速的理解与应用，所以接下来会结合几个实际案例更方便理解。

## futrue task

`Go` 官方没有提供类似于 `Java` 的 `FutureTask` 支持：

```java
    public static void main(String[] args) throws InterruptedException, ExecutionException {
        ExecutorService executorService = Executors.newFixedThreadPool(2);
        Task task = new Task();
        FutureTask<String> futureTask = new FutureTask<>(task);
        executorService.submit(futureTask);
        String s = futureTask.get();
        System.out.println(s);
        executorService.shutdown();
    }
}

class Task implements Callable<String> {
    @Override
    public String call() throws Exception {
        // 模拟http
        System.out.println("http request");
        Thread.sleep(1000);

        return "request success";
    }
}
```
但我们可以使用 `channel` 配合 `goroutine` 实现类似的功能：

```go
func main() {
	ch := Request("https://github.com")
	select {
	case r := <-ch:
		fmt.Println(r)
	}
}
func Request(url string) <-chan string {
	ch := make(chan string)
	go func() {
		// 模拟http请求
		time.Sleep(time.Second)
		ch <- fmt.Sprintf("url=%s, res=%s", url, "ok")
	}()
	return ch
}
```

`goroutine` 发起请求后直接将这个 `channel` 返回，调用方会在请求响应之前一直阻塞，直到 `goroutine` 拿到了响应结果。


## goroutine 互相通信

```java
   /**
     * 偶数线程
     */
    public static class OuNum implements Runnable {
        private TwoThreadWaitNotifySimple number;

        public OuNum(TwoThreadWaitNotifySimple number) {
            this.number = number;
        }

        @Override
        public void run() {
            for (int i = 0; i < 11; i++) {
                synchronized (TwoThreadWaitNotifySimple.class) {
                    if (number.flag) {
                        if (i % 2 == 0) {
                            System.out.println(Thread.currentThread().getName() + "+-+偶数" + i);

                            number.flag = false;
                            TwoThreadWaitNotifySimple.class.notify();
                        }

                    } else {
                        try {
                            TwoThreadWaitNotifySimple.class.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
    }


    /**
     * 奇数线程
     */
    public static class JiNum implements Runnable {
        private TwoThreadWaitNotifySimple number;

        public JiNum(TwoThreadWaitNotifySimple number) {
            this.number = number;
        }

        @Override
        public void run() {
            for (int i = 0; i < 11; i++) {
                synchronized (TwoThreadWaitNotifySimple.class) {
                    if (!number.flag) {
                        if (i % 2 == 1) {
                            System.out.println(Thread.currentThread().getName() + "+-+奇数" + i);

                            number.flag = true;
                            TwoThreadWaitNotifySimple.class.notify();
                        }

                    } else {
                        try {
                            TwoThreadWaitNotifySimple.class.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
    }
```
> 这里截取了”两个线程交替打印奇偶数“的部分代码。

Java 提供了 `object.wait()/object.notify()` 这样的等待通知机制，可以实现两个线程间通信。

`go` 通过 `channel` 也能实现相同效果：

```go
func main() {
	ch := make(chan struct{})
	go func() {
		for i := 1; i < 11; i++ {
			ch <- struct{}{}
			//奇数
			if i%2 == 1 {
				fmt.Println("奇数:", i)
			}
		}
	}()

	go func() {
		for i := 1; i < 11; i++ {
			<-ch
			if i%2 == 0 {
				fmt.Println("偶数:", i)
			}
		}
	}()

	time.Sleep(10 * time.Second)
}
```


本质上他们都是利用了线程(`goroutine`)阻塞然后唤醒的特性，只是 Java 是通过 wait/notify 机制；

而 go 提供的 channel 也有类似的特性：

1. 向 `channel` 发送数据时(`ch<-struct{}{}`)会被阻塞，直到 channel 被消费(`<-ch`)。

> 以上针对于`无缓冲 channel`。

`channel` 本身是由 `go` 原生保证并发安全的，不用额外的同步措施，可以放心使用。


## 广播通知

不仅是两个 `goroutine` 之间通信，同样也能广播通知，类似于如下 `Java` 代码：

```java
    public static void main(String[] args) throws InterruptedException {
        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                try {
                    synchronized (NotifyAll.class){
                        NotifyAll.class.wait();
                    }
                    System.out.println(Thread.currentThread().getName() + "done....");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();
        }
        Thread.sleep(3000);
        synchronized (NotifyAll.class){
            NotifyAll.class.notifyAll();
        }
    }
```

主线程将所有等待的子线程全部唤醒，这个本质上也是通过 `wait/notify` 机制实现的，区别只是通知了所有等待的线程。


换做是 `go` 的实现：
```go
func main() {
	notify := make(chan struct{})
	for i := 0; i < 10; i++ {
		go func(i int) {
			for {
				select {
				case <-notify:
					fmt.Println("done.......",i)
					return
				case <-time.After(1 * time.Second):
					fmt.Println("wait notify",i)

				}
			}
		}(i)
	}
	time.Sleep(1 * time.Second)
	close(notify)
	time.Sleep(3 * time.Second)
}
```

当关闭一个 `channel` 后，会使得所有获取 `channel` 的 `goroutine` 直接返回，不会阻塞，正是利用这一特性实现了广播通知所有 `goroutine` 的目的。

> 注意，同一个 channel 不能反复关闭，不然会出现panic。



## channel 解耦

以上例子都是基于无缓冲的 `channel`，通常用于 `goroutine` 之间的同步；同时 channel 也具备缓冲的特性：

```go
ch :=make(chan T, 100)
```

可以直接将其理解为队列，正是因为具有缓冲能力，所以我们可以将业务之间进行解耦，生产方只管往 `channel` 中丢数据，消费者只管将数据取出后做自己的业务。

同时也具有阻塞队列的特性：
- 当 `channel` 写满时生产者将会被阻塞。
- 当 `channel` 为空时消费者也会阻塞。


> 从上文的例子中可以看出，实现相同的功能 go 的写法会更加简单直接，相对的 Java 就会复杂许多（当然这也和这里使用的偏底层 api 有关）。

# Java 中的 BlockingQueue

这些特性都与 Java 中的 `BlockingQueue` 非常类似，他们具有以下的相同点：

- 可以通过两者来进行 `goroutine/thread` 通信。
- 具备队列的特征，可以解耦业务。
- 支持并发安全。


同样的他们又有很大的区别，从表现上看：
- `channel` 支持 `select` 语法，对 `channel` 的管理更加简洁直观。
- `channel` 支持关闭，不能向已关闭的 `channel` 发送消息。
- `channel` 支持定义方向，在编译器的帮助下可以在语义上对行为的描述更加准确。

当然还有本质上的区别就是 channel 是 go 推荐的 `CSP` 模型的核心，具有编译器的支持，可以有很轻量的成本实现并发通信。

而 `BlockingQueue` 对于 `Java` 来说只是一个实现了并发安全的数据结构，即便不使用它也有其他的通信方式；只是他们都具有阻塞队列的特征，所有在初步接触 `channel` 时容易产生混淆。

| 相同点    | channel 特有 |
| ------------ | ----------- |
| 阻塞策略 | 支持select |
| 设置大小 | 支持关闭 |
| 并发安全 | 自定义方向 |
| 普通数据结构 | 编译器支持 |


# 总结

有过一门编程语言的使用经历在学习其他语言是确实是要方便许多，比如之前写过 `Java` 再看 `Go` 时就会发现许多类似之处，只是实现不同。

拿这里的并发通信来说，本质上是因为并发模型上的不同；

`Go` 更推荐使用通信来共享内存，而 `Java` 大部分场景都是使用共享内存来通信（这样就得加锁来同步）。

带着疑问来学习确实会事半功倍。

最近和网友讨论后再补充一下，其实 `Go channel` 的底层实现也是通过对共享内存的加锁来实现的，这点任何语言都不可避免。

既然都是共享内存那和我们自己使用共享内存有什么区别呢？主要还是 channel 的抽象层级更高，我们使用这类高抽象层级的方式编写代码会更易理解和维护。

但在一些特殊场景，需要追求极致的性能，降低加锁颗粒度时用共享内存会更加合适，所以 Go 官方也提供有` sync.Map/Mutex` 这样的库；只是在并发场景下更推荐使用 `channel` 来解决问题。